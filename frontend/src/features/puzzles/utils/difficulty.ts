// Tier ↔ rating mapping. Single source of truth for the runtime; the build
// script (frontend/scripts/build-catalog.ts) duplicates this table. If you
// change either, change both.

import type { Tier } from '../types';

/** [tier, low (inclusive), high (exclusive)] */
export const TIER_BANDS: ReadonlyArray<readonly [Tier, number, number]> = [
  ['beginner', 0, 1000],
  ['easy', 1000, 1400],
  ['medium', 1400, 1800],
  ['hard', 1800, 2200],
  ['expert', 2200, Number.POSITIVE_INFINITY],
] as const;

export const ALL_TIERS: ReadonlyArray<Tier> = [
  'beginner',
  'easy',
  'medium',
  'hard',
  'expert',
] as const;

const TIER_LABELS: Record<Tier, string> = {
  beginner: 'Beginner',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

/** Classify a numeric rating into the tier whose band contains it. */
export function classifyTier(rating: number): Tier {
  for (const [tier, lo, hi] of TIER_BANDS) {
    if (rating >= lo && rating < hi) return tier;
  }
  return 'expert';
}

export function tierLabel(tier: Tier): string {
  return TIER_LABELS[tier];
}

/** Inclusive low and exclusive high bounds for a tier. Useful for UI hints. */
export function tierRange(tier: Tier): { lo: number; hi: number } {
  for (const [t, lo, hi] of TIER_BANDS) {
    if (t === tier) return { lo, hi };
  }
  return { lo: 0, hi: Number.POSITIVE_INFINITY };
}
