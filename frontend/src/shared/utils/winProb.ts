import type { UciScore } from '../types';

const MATE_CP = 10_000;

export function scoreToCp(score: UciScore | null | undefined): number {
  if (!score) return 0;
  if (score.mate !== undefined) {
    if (score.mate > 0) return MATE_CP - score.mate;
    if (score.mate < 0) return -MATE_CP - score.mate;
    return 0;
  }
  return score.cp ?? 0;
}

/** White-POV centipawn → 0..100 winning chance for white (lichess formula). */
export function whiteWinProbability(cpWhite: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cpWhite)) - 1);
}

/**
 * Format a White-POV score for the eval bar / chart label.
 * Mate scores show as "M3" / "-M3", cp shows with one decimal.
 */
export function formatScore(score: UciScore | null | undefined): string {
  if (!score) return '0.0';
  if (score.mate !== undefined) {
    if (score.mate === 0) return '#';
    return `${score.mate > 0 ? 'M' : '-M'}${Math.abs(score.mate)}`;
  }
  const cp = score.cp ?? 0;
  const v = cp / 100;
  if (Math.abs(v) < 0.05) return '0.0';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}`;
}

/** Compact score for inside the eval bar (no leading +). */
export function formatScoreCompact(score: UciScore | null | undefined): string {
  if (!score) return '0.0';
  if (score.mate !== undefined) return `M${Math.abs(score.mate)}`;
  return Math.abs((score.cp ?? 0) / 100).toFixed(1);
}
