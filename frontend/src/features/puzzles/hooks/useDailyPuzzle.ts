// Date-seeded deterministic daily puzzle. Indexes into the bundled
// daily.json (365 hand-quality-filtered medium-tier puzzles) so the same
// UTC day yields the same puzzle for every user.

import { useMemo } from 'react';
import dailyData from '../data/daily.json';
import type { Puzzle } from '../types';

const ENTRIES = (dailyData as { entries: Puzzle[] }).entries;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DAILY_ID_SET: ReadonlySet<string> = new Set(
  ENTRIES.map((e) => e.id),
);

export interface UseDailyPuzzleApi {
  puzzle: Puzzle;
  /** yyyy-mm-dd of the chosen day (UTC). */
  date: string;
}

/** Today (UTC) as yyyy-mm-dd. */
export function todayDateKey(): string {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function dateToUtcMs(date: Date | string): number {
  if (typeof date === 'string') {
    const [y, m, d] = date.split('-').map((s) => parseInt(s, 10));
    return Date.UTC(y || 1970, (m || 1) - 1, d || 1);
  }
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Pure resolution: given a date (Date or yyyy-mm-dd UTC string) → the
 * deterministic daily puzzle for that day.
 */
export function puzzleForDate(date: Date | string): Puzzle {
  const utcMs = dateToUtcMs(date);
  const epochDay = Math.floor(utcMs / MS_PER_DAY);
  const idx = ((epochDay % ENTRIES.length) + ENTRIES.length) % ENTRIES.length;
  return ENTRIES[idx]!;
}

export function puzzleIdForDate(date: Date | string): string {
  return puzzleForDate(date).id;
}

/** True when `id` is one of the bundled daily puzzles (any past or future day). */
export function isDailyPuzzleId(id: string): boolean {
  return DAILY_ID_SET.has(id);
}

export function useDailyPuzzle(): UseDailyPuzzleApi {
  return useMemo(() => {
    const date = todayDateKey();
    return { puzzle: puzzleForDate(date), date };
  }, []);
}
