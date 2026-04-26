// One-shot build pipeline:
//   download Lichess puzzle DB (.csv.zst) → stream-decompress via `zstd -d -c`
//   → fast-csv parse → quality-filter + per-tier reservoir sample
//   → write per-tier JSONs + themes.json + daily.json
//
// Run via:  npm run build:catalog -w frontend
// Requires: zstd CLI on PATH

import { spawn } from 'node:child_process';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  statSync,
} from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { parse } from 'fast-csv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = resolve(__dirname, '..');
const CACHE_DIR = join(FRONTEND_ROOT, '.cache');
const DATA_DIR = join(FRONTEND_ROOT, 'src', 'features', 'puzzles', 'data');
const CATALOG_DIR = join(DATA_DIR, 'catalog');

const LICHESS_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const ZST_PATH = join(CACHE_DIR, 'lichess_db_puzzle.csv.zst');
const CSV_PATH = join(CACHE_DIR, 'lichess_db_puzzle.csv');

type Tier = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';

// [tier, low (inclusive), high (exclusive)]
const TIER_BANDS: Array<[Tier, number, number]> = [
  ['beginner', 0, 1000],
  ['easy', 1000, 1400],
  ['medium', 1400, 1800],
  ['hard', 1800, 2200],
  ['expert', 2200, Number.POSITIVE_INFINITY],
];

const SAMPLES_PER_TIER = 500;
const MIN_POPULARITY = 80;
const MIN_PLAYS = 1000;
const MIN_RATING = 400;

interface CsvRow {
  PuzzleId: string;
  FEN: string;
  Moves: string;
  Rating: string;
  RatingDeviation: string;
  Popularity: string;
  NbPlays: string;
  Themes: string;
  GameUrl: string;
  OpeningTags: string;
}

interface PuzzleEntry {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  popularity: number;
  nbPlays: number;
  themes: string[];
}

function classifyTier(rating: number): Tier {
  for (const [tier, lo, hi] of TIER_BANDS) {
    if (rating >= lo && rating < hi) return tier;
  }
  return 'expert';
}

class Reservoir<T> {
  private samples: T[] = [];
  private seenCount = 0;
  constructor(private readonly capacity: number) {}
  push(item: T): void {
    if (this.samples.length < this.capacity) {
      this.samples.push(item);
    } else {
      const j = Math.floor(Math.random() * (this.seenCount + 1));
      if (j < this.capacity) this.samples[j] = item;
    }
    this.seenCount += 1;
  }
  items(): T[] {
    return this.samples;
  }
  seen(): number {
    return this.seenCount;
  }
}

async function ensureCachedDownload(): Promise<void> {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  if (existsSync(ZST_PATH) && statSync(ZST_PATH).size > 50_000_000) {
    console.log(`[cache] using ${ZST_PATH}`);
    return;
  }

  console.log(`[download] ${LICHESS_URL}`);
  const started = Date.now();
  const res = await fetch(LICHESS_URL);
  if (!res.ok || !res.body) {
    throw new Error(`download failed: HTTP ${res.status}`);
  }

  const out = createWriteStream(ZST_PATH);
  await new Promise<void>((ok, fail) => {
    Readable.fromWeb(res.body as never)
      .pipe(out)
      .on('finish', () => ok())
      .on('error', fail);
  });

  const mb = (statSync(ZST_PATH).size / 1e6).toFixed(1);
  const sec = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[download] wrote ${mb} MB in ${sec}s`);
}

async function ensureDecompressed(): Promise<void> {
  // Cache the decompressed CSV on disk (~1.1 GB). The pipe-based
  // `zstd -d -c | parse` flow misbehaves on Windows under some shell
  // wrappers (npm runs through cmd.exe), so we materialize the CSV first.
  if (existsSync(CSV_PATH) && statSync(CSV_PATH).size > 500_000_000) {
    console.log(`[cache] using ${CSV_PATH}`);
    return;
  }
  console.log(`[decompress] zstd -d -k ${ZST_PATH} -o ${CSV_PATH}`);
  const started = Date.now();
  await new Promise<void>((ok, fail) => {
    const z = spawn('zstd', ['-d', '-k', '-f', ZST_PATH, '-o', CSV_PATH], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    z.on('error', fail);
    z.on('exit', (code) => {
      if (code === 0) ok();
      else fail(new Error(`zstd exited ${code}`));
    });
  });
  const sec = ((Date.now() - started) / 1000).toFixed(1);
  const gb = (statSync(CSV_PATH).size / 1e9).toFixed(2);
  console.log(`[decompress] ${gb} GB in ${sec}s`);
}

async function streamCsv(): Promise<{
  reservoirs: Record<Tier, Reservoir<PuzzleEntry>>;
  dailyReservoir: Reservoir<PuzzleEntry>;
  themeCounts: Map<string, number>;
  totalRows: number;
  qualityKept: number;
}> {
  const reservoirs: Record<Tier, Reservoir<PuzzleEntry>> = {
    beginner: new Reservoir<PuzzleEntry>(SAMPLES_PER_TIER),
    easy: new Reservoir<PuzzleEntry>(SAMPLES_PER_TIER),
    medium: new Reservoir<PuzzleEntry>(SAMPLES_PER_TIER),
    hard: new Reservoir<PuzzleEntry>(SAMPLES_PER_TIER),
    expert: new Reservoir<PuzzleEntry>(SAMPLES_PER_TIER),
  };
  // Separate pool for daily-puzzle candidates — sampled directly from
  // the full stream (not from the post-sample medium reservoir), so
  // strict quality gates don't starve us.
  const dailyReservoir = new Reservoir<PuzzleEntry>(800);
  const themeCounts = new Map<string, number>();
  let totalRows = 0;
  let qualityKept = 0;

  await new Promise<void>((ok, fail) => {
    const parser = parse({ headers: true });
    createReadStream(CSV_PATH).pipe(parser);

    parser.on('data', (row: CsvRow) => {
      totalRows += 1;
      if (totalRows % 200_000 === 0) {
        console.log(`[parse] ${totalRows.toLocaleString()} rows scanned…`);
      }

      const rating = Number.parseInt(row.Rating, 10);
      if (!Number.isFinite(rating) || rating < MIN_RATING) return;

      const popularity = Number.parseInt(row.Popularity, 10);
      if (!Number.isFinite(popularity) || popularity < MIN_POPULARITY) return;

      const nbPlays = Number.parseInt(row.NbPlays, 10);
      if (!Number.isFinite(nbPlays) || nbPlays < MIN_PLAYS) return;

      const tier = classifyTier(rating);
      const themes = row.Themes
        ? row.Themes.split(/\s+/).filter(Boolean)
        : [];
      for (const t of themes) {
        themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
      }

      const entry: PuzzleEntry = {
        id: row.PuzzleId,
        fen: row.FEN,
        moves: row.Moves.split(/\s+/).filter(Boolean),
        rating,
        popularity,
        nbPlays,
        themes,
      };
      reservoirs[tier].push(entry);
      qualityKept += 1;

      // Daily candidate: medium-tier, popular, well-played.
      if (
        tier === 'medium' &&
        popularity >= 85 &&
        nbPlays >= 5000
      ) {
        dailyReservoir.push(entry);
      }
    });
    parser.on('error', fail);
    parser.on('end', () => ok());
  });

  return { reservoirs, dailyReservoir, themeCounts, totalRows, qualityKept };
}

async function writeOutputs(
  reservoirs: Record<Tier, Reservoir<PuzzleEntry>>,
  dailyReservoir: Reservoir<PuzzleEntry>,
  themeCounts: Map<string, number>,
  totalRows: number,
  qualityKept: number,
): Promise<void> {
  if (!existsSync(CATALOG_DIR)) mkdirSync(CATALOG_DIR, { recursive: true });

  const dailyEntries = dailyReservoir
    .items()
    .slice()
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 365);

  for (const [tier] of TIER_BANDS) {
    const sample = reservoirs[tier].items().slice().sort((a, b) => a.rating - b.rating);
    await writeFile(
      join(CATALOG_DIR, `${tier}.json`),
      JSON.stringify(sample),
    );
    console.log(
      `[write] ${tier}.json — ${sample.length} sampled from ${reservoirs[tier].seen().toLocaleString()} eligible`,
    );
  }

  const tierCounts = Object.fromEntries(
    TIER_BANDS.map(([t]) => [t, reservoirs[t].seen()]),
  ) as Record<Tier, number>;

  const themes = Array.from(themeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([name, count]) => ({ name, count }));

  await writeFile(
    join(DATA_DIR, 'themes.json'),
    JSON.stringify(
      {
        themes,
        tierCounts,
        totals: { rowsScanned: totalRows, qualityKept },
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`[write] themes.json — ${themes.length} themes`);

  await writeFile(
    join(DATA_DIR, 'daily.json'),
    JSON.stringify({ entries: dailyEntries, builtAt: new Date().toISOString() }),
  );
  console.log(`[write] daily.json — ${dailyEntries.length} daily entries`);

  console.log(
    `\nbuild complete. scanned ${totalRows.toLocaleString()} rows, kept ${qualityKept.toLocaleString()}.`,
  );
}

async function main(): Promise<void> {
  await ensureCachedDownload();
  await ensureDecompressed();
  const stats = await streamCsv();
  await writeOutputs(
    stats.reservoirs,
    stats.dailyReservoir,
    stats.themeCounts,
    stats.totalRows,
    stats.qualityKept,
  );
}

main().catch((err) => {
  console.error('build:catalog failed:', err);
  process.exit(1);
});
