import {
  describeResult,
  type ChessComGame,
  type ChessComTimeClass,
} from '../../../shared/utils/chessCom';

export interface OpeningCount {
  name: string;
  count: number;
  url: string;
}

export type WLDByTimeClass = Partial<
  Record<ChessComTimeClass, { win: number; loss: number; draw: number }>
>;

export interface ChessComActivity {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  /** 0..100, integer. */
  winRate: number;
  avgOppRating: number | null;
  /** chess.com accuracy %, 0..100; null when no game in the window had it. */
  avgAccuracy: number | null;
  topOpening: OpeningCount | null;
  byTimeClass: WLDByTimeClass;
}

const TIME_CLASSES: ChessComTimeClass[] = ['bullet', 'blitz', 'rapid', 'daily'];

export function computeActivity(
  games: ChessComGame[],
  perspective: string,
): ChessComActivity {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let oppRatingSum = 0;
  let oppRatingCount = 0;
  let accSum = 0;
  let accCount = 0;
  const ecoCounts = new Map<string, OpeningCount>();
  const byTimeClass: WLDByTimeClass = {};
  for (const tc of TIME_CLASSES) byTimeClass[tc] = { win: 0, loss: 0, draw: 0 };

  for (const g of games) {
    const isWhite = g.white.username.toLowerCase() === perspective.toLowerCase();
    const opp = isWhite ? g.black : g.white;
    const result = describeResult(g, perspective);

    if (result === 'win') wins++;
    else if (result === 'loss') losses++;
    else draws++;

    const bucket = byTimeClass[g.time_class];
    if (bucket) bucket[result]++;

    if (opp.rating > 0) {
      oppRatingSum += opp.rating;
      oppRatingCount++;
    }

    const myAcc = isWhite ? g.accuracies?.white : g.accuracies?.black;
    if (typeof myAcc === 'number' && Number.isFinite(myAcc)) {
      accSum += myAcc;
      accCount++;
    }

    if (g.eco) {
      const name = parseEcoName(g.eco);
      if (name) {
        const prev = ecoCounts.get(name);
        ecoCounts.set(name, {
          name,
          url: g.eco,
          count: (prev?.count ?? 0) + 1,
        });
      }
    }
  }

  const total = wins + losses + draws;
  const sortedOpenings = [...ecoCounts.values()].sort((a, b) => b.count - a.count);

  return {
    total,
    wins,
    losses,
    draws,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    avgOppRating: oppRatingCount > 0 ? Math.round(oppRatingSum / oppRatingCount) : null,
    avgAccuracy: accCount > 0 ? Math.round((accSum / accCount) * 10) / 10 : null,
    topOpening: sortedOpenings[0] ?? null,
    byTimeClass,
  };
}

function parseEcoName(ecoUrl: string): string {
  const slug = decodeURIComponent(ecoUrl.split('/').pop() ?? ecoUrl);
  // chess.com URLs append the played move-list to the opening family, e.g.
  // `Italian-Game-Anti-Berlin-Defense-3.Bb5-Nge7`. Cut at the first segment
  // that starts with a move-number prefix (`3.`, `12.`) so we keep just
  // the human-readable opening name.
  const segments = slug.split('-');
  const kept: string[] = [];
  for (const seg of segments) {
    if (/^\d+\./.test(seg)) break;
    kept.push(seg);
  }
  return kept.join(' ').trim();
}
