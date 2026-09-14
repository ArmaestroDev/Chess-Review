// Pure derivations over PuzzleProgress for the hub/solver stat displays.
// All day boundaries are UTC, matching todayKey() / dailyHistory.

import type { PuzzleProgress } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

type History = PuzzleProgress['history'];

export interface TodayStats {
  /** Clean solves (result === 'solve'). */
  solved: number;
  /** Everything else: fail, hint, reveal. */
  failed: number;
  /** Sum of today's rating deltas. */
  delta: number;
}

export function startOfTodayUTC(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function todayStats(history: History): TodayStats {
  const start = startOfTodayUTC();
  const out: TodayStats = { solved: 0, failed: 0, delta: 0 };
  for (const a of history) {
    if (a.timestamp < start) continue;
    if (a.result === 'solve') out.solved += 1;
    else out.failed += 1;
    out.delta += a.delta;
  }
  return out;
}

export interface DayStreak {
  days: number;
  /** False when the streak is carried from yesterday and today has no attempt yet. */
  activeToday: boolean;
}

/**
 * Consecutive UTC days with ≥1 attempt. A streak that ended yesterday is
 * still alive (the user has until midnight UTC to extend it), so counting
 * starts from yesterday when today has no attempts.
 */
export function dayStreak(history: History): DayStreak {
  const days = new Set<number>();
  for (const a of history) {
    days.add(Math.floor(a.timestamp / DAY_MS));
  }
  const today = Math.floor(startOfTodayUTC() / DAY_MS);
  const activeToday = days.has(today);
  let cursor = activeToday ? today : today - 1;
  let n = 0;
  while (days.has(cursor)) {
    n += 1;
    cursor -= 1;
  }
  return { days: n, activeToday };
}

/** Rating after each of the last `limit` attempts, oldest first. */
export function ratingTrend(history: History, limit = 20): number[] {
  const recent = [...history]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit);
  if (recent.length === 0) return [];
  const first = recent[0]!;
  return [first.eloAfter - first.delta, ...recent.map((a) => a.eloAfter)];
}

export function accuracyPct(stats: PuzzleProgress['stats']): number {
  const total = stats.solved + stats.failed;
  return total > 0 ? Math.round((stats.solved / total) * 100) : 0;
}
