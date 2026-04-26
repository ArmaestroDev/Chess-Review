// Bundled-catalog selector. Tier JSONs are loaded on demand via dynamic
// import — each tier is its own chunk so the user only pays for the tiers
// they actually pick. daily.json + themes.json stay eager because they're
// small and the hub renders synchronously from them.

import type { Puzzle, Tier } from '../types';
import dailyData from '../data/daily.json';
import themesMeta from '../data/themes.json';

// Daily entries are sampled independently from the tier reservoirs, so a
// daily ID won't necessarily appear in any tier catalog. findInCatalog
// must also check this set or the solver will fall through to the API
// proxy (and 503 if RAPIDAPI_KEY isn't configured).
const DAILY_ENTRIES: Puzzle[] = (
  dailyData as { entries: Puzzle[] }
).entries;

const ALL_TIERS_LOCAL: Tier[] = ['beginner', 'easy', 'medium', 'hard', 'expert'];

// Cache the promise (not the resolved value) so concurrent callers dedupe
// on the same in-flight import, and a rejected import can be evicted so the
// next caller retries (e.g. user's network blipped, or a deploy invalidated
// the chunk hash mid-session).
const tierCache = new Map<Tier, Promise<Puzzle[]>>();

function loadTier(tier: Tier): Promise<Puzzle[]> {
  const cached = tierCache.get(tier);
  if (cached) return cached;
  // The static-string + variable form is what Vite needs to emit one chunk
  // per tier; concatenated paths defeat the analyzer.
  const promise = (async () => {
    try {
      const mod = await import(`../data/catalog/${tier}.json`);
      return (mod.default ?? mod) as Puzzle[];
    } catch (err) {
      tierCache.delete(tier);
      throw err;
    }
  })();
  tierCache.set(tier, promise);
  return promise;
}

export interface ThemeInfo {
  name: string;
  count: number;
}

interface ThemesMeta {
  themes: ThemeInfo[];
  tierCounts: Record<Tier, number>;
  // Optional in the type because they're written by the build script and
  // older themes.json snapshots predate them. countByTheme/getThemeDifficulty
  // tolerate missing fields with sensible fallbacks.
  themeDifficulties?: Record<string, Tier>;
  themeCountsByTier?: Record<Tier, Record<string, number>>;
}

const META = themesMeta as unknown as ThemesMeta;

if (!META.themes || !META.tierCounts) {
  throw new Error(
    'themes.json missing required fields — run `npm run build:catalog -w frontend`',
  );
}

/** Top themes by total puzzle count across the full Lichess DB. */
export const THEMES: ReadonlyArray<ThemeInfo> = META.themes;

/** Per-tier eligible counts before sampling — drives the hub's stat tiles. */
export const TIER_TOTALS: Record<Tier, number> = META.tierCounts;

export interface PickOptions {
  /** Optional theme name; when set, only puzzles tagged with this theme are eligible. */
  theme?: string;
  /** IDs to avoid (e.g. recently-seen ids from localStorage). */
  excludeIds?: ReadonlyArray<string>;
}

export interface MultiPickOptions {
  tiers: ReadonlyArray<Tier>;
  themes: ReadonlyArray<string>;
  excludeIds?: ReadonlyArray<string>;
}

/**
 * Pick a single puzzle from the local catalog matching tier + optional
 * theme, biased away from recently-seen IDs. Returns null only if the
 * tier+theme combo has zero puzzles in the catalog (rare — the catalog is
 * sampled to cover every theme that has ≥1 puzzle in the tier).
 */
export async function pickFromCatalog(
  tier: Tier,
  opts: PickOptions = {},
): Promise<Puzzle | null> {
  const pool = await loadTier(tier);
  const excludeSet = new Set(opts.excludeIds ?? []);
  const themed = opts.theme
    ? pool.filter((p) => p.themes.includes(opts.theme!))
    : pool;
  if (themed.length === 0) return null;

  // Prefer un-seen puzzles; fall back to the full themed pool if everything's
  // been seen recently. Random index (Math.random is fine — variety bias only).
  const fresh = themed.filter((p) => !excludeSet.has(p.id));
  const candidates = fresh.length > 0 ? fresh : themed;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

/**
 * Pick a puzzle from the union of all selected tiers, restricted to those
 * tagged with at least one of the selected themes. Returns null if the
 * intersection is empty after filtering.
 */
export async function pickFromMultiSelect(
  opts: MultiPickOptions,
): Promise<Puzzle | null> {
  if (opts.tiers.length === 0 || opts.themes.length === 0) return null;
  const themeSet = new Set(opts.themes);
  const excludeSet = new Set(opts.excludeIds ?? []);

  const tierData = await Promise.all(opts.tiers.map((t) => loadTier(t)));
  const pool: Puzzle[] = [];
  for (const data of tierData) {
    for (const p of data) {
      if (p.themes.some((th) => themeSet.has(th))) pool.push(p);
    }
  }
  if (pool.length === 0) return null;

  const fresh = pool.filter((p) => !excludeSet.has(p.id));
  const candidates = fresh.length > 0 ? fresh : pool;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

/** Find a specific puzzle by ID across tier catalogs + daily set. */
export async function findInCatalog(id: string): Promise<Puzzle | null> {
  // Daily check is sync — covers the common deep-link case (sharing a daily
  // URL) without spinning up any tier chunks.
  const dailyHit = DAILY_ENTRIES.find((p) => p.id === id);
  if (dailyHit) return dailyHit;

  const allTiers = await Promise.all(ALL_TIERS_LOCAL.map((t) => loadTier(t)));
  for (const data of allTiers) {
    const hit = data.find((p) => p.id === id);
    if (hit) return hit;
  }
  return null;
}

/** All puzzles in a tier — used for stats / per-theme counts in the hub. */
export async function getCatalogTier(
  tier: Tier,
): Promise<ReadonlyArray<Puzzle>> {
  return loadTier(tier);
}

/** Per-theme count from the bundled sample (NOT the full Lichess total). */
export function countByTheme(tier: Tier, theme: string): number {
  return META.themeCountsByTier?.[tier]?.[theme] ?? 0;
}

export function getThemeDifficulty(theme: string): Tier {
  const t = META.themeDifficulties?.[theme];
  return t && ALL_TIERS_LOCAL.includes(t) ? t : 'medium';
}
