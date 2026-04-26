// Inverted ELO formula. The whole feature's "push toward harder content"
// behavior is encoded in T_SOLVE / T_LOSS below — harder tiers reward more
// on solve and punish less on fail.
//
//   delta_solve = round( BASE_GAIN * T_solve(tier) * G_solve(R_puz - R_user) )
//   delta_loss  = round( BASE_LOSS * T_loss(tier)  * G_loss(R_puz - R_user)  )

import { classifyTier } from './difficulty';
import type { PuzzleResult, Tier } from '../types';

export const STARTING_ELO = 600;
export const ELO_FLOOR = 100;
export const ELO_CEILING = 3000;

export const BASE_GAIN = 20;
export const BASE_LOSS = 15;

/** Tier-multiplier table. The inversion lives entirely here. */
export const T_SOLVE: Record<Tier, number> = {
  beginner: 0.5,
  easy: 0.75,
  medium: 1.0,
  hard: 1.4,
  expert: 1.8,
};

export const T_LOSS: Record<Tier, number> = {
  beginner: 1.5,
  easy: 1.25,
  medium: 1.0,
  hard: 0.65,
  expert: 0.4,
};

const GAP_DIVISOR = 400;
const G_SOLVE_MIN = 0.5;
const G_SOLVE_MAX = 2.0;
const G_LOSS_MIN = 0.4;
const G_LOSS_MAX = 1.6;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Reward multiplier when solving a puzzle harder than your current rating. */
export function gSolve(gap: number): number {
  return clamp(1 + gap / GAP_DIVISOR, G_SOLVE_MIN, G_SOLVE_MAX);
}

/** Penalty multiplier when failing a puzzle below your current rating. */
export function gLoss(gap: number): number {
  return clamp(1 - gap / GAP_DIVISOR, G_LOSS_MIN, G_LOSS_MAX);
}

/**
 * Compute the signed ELO delta for one attempt. Positive on solve, negative
 * on every flavor of fail. Hint halves the loss; reveal applies full loss.
 *
 * @param result        outcome of the attempt
 * @param puzzleRating  the puzzle's intrinsic rating
 * @param userElo       user's rating BEFORE this attempt
 */
export function computeDelta(
  result: PuzzleResult,
  puzzleRating: number,
  userElo: number,
): number {
  const tier = classifyTier(puzzleRating);
  const gap = puzzleRating - userElo;

  if (result === 'solve') {
    return Math.round(BASE_GAIN * T_SOLVE[tier] * gSolve(gap));
  }

  // All fail-flavored outcomes are negative.
  const baseLoss = Math.round(BASE_LOSS * T_LOSS[tier] * gLoss(gap));
  if (result === 'hint') {
    // Hint forfeits gain AND halves the loss (round up so it's never zero).
    return -Math.ceil(baseLoss / 2);
  }
  // 'fail' and 'reveal' both apply the full loss.
  return -baseLoss;
}

/** Apply a delta to a current ELO with floor/ceiling clamping. */
export function applyDelta(currentElo: number, delta: number): number {
  return clamp(currentElo + delta, ELO_FLOOR, ELO_CEILING);
}

// ---- Worked-example fixtures (kept here so any formula change forces a
// deliberate update of the README). Each row is computed by computeDelta,
// not hand-rolled, so they regenerate on next run.
//
// User at 800, puzzle at tier midpoint:
//   beginner (800):  +10 / -23
//   easy (1200):     +30 / -8
//   medium (1600):   +40 / -6
//   hard (2000):     +56 / -4
//   expert (2400):   +72 / -2
//
// User at 1500, puzzle at tier midpoint:
//   beginner (800):  +5  / -36
//   easy (1200):     +8  / -30
//   medium (1600):   +25 / -11
//   hard (2000):     +56 / -4
//   expert (2400):   +72 / -2
//
// Sanity: a 1500 user farming Beginner risks 36 to gain 5; the same user
// stretching to Hard gains 56 and risks only 4. The push is intentional.
