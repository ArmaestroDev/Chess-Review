import { Chess, Move } from 'chess.js';
import { MoveClassification, UciScore } from './types';

const MATE_CP = 10_000;

/** Lichess win-probability mapping. Returns 0..100. `cp` is from the side's POV. */
export function winProbability(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Convert a UCI score to a centipawn value (mate scores collapse to ±MATE_CP - mate). */
export function scoreToCp(score: UciScore | null | undefined): number {
  if (!score) return 0;
  if (score.mate !== undefined) {
    if (score.mate > 0) return MATE_CP - score.mate;
    if (score.mate < 0) return -MATE_CP - score.mate;
    return 0;
  }
  return score.cp ?? 0;
}

/** Force a score into the white POV given who is *to move* in that position. */
export function scoreToWhitePov(score: UciScore | undefined, sideToMove: 'w' | 'b'): UciScore {
  if (!score) return { cp: 0 };
  if (sideToMove === 'w') return { ...score };
  if (score.mate !== undefined) return { mate: -score.mate };
  return { cp: -(score.cp ?? 0) };
}

const PIECE_VALUE: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100,
};

/**
 * Crude sacrifice detector: was the moved piece left on a square attacked by
 * an enemy piece of *strictly lower* nominal value than the moved piece, and
 * is the net material change (this move + any immediate recapture) negative
 * for the mover?  This catches piece sacs and exchange sacs without doing a
 * full SEE.
 */
export function looksLikeSacrifice(fenAfterMove: string, moved: Move): boolean {
  // The piece is now on `moved.to`. Side to move in fenAfterMove is the opponent.
  const board = new Chess(fenAfterMove);
  const movedPiece = board.get(moved.to as any);
  if (!movedPiece) return false;
  const movedValue = PIECE_VALUE[movedPiece.type] ?? 0;
  if (movedValue >= 100) return false; // king

  const attackers = board.attackers(moved.to as any, board.turn());
  if (!attackers || attackers.length === 0) return false;

  let minAttackerValue = Infinity;
  for (const sq of attackers) {
    const piece = board.get(sq as any);
    if (!piece) continue;
    const v = PIECE_VALUE[piece.type] ?? 0;
    if (v < minAttackerValue) minAttackerValue = v;
  }
  if (minAttackerValue >= movedValue) return false;

  // An exchange the mover initiated by capturing something is OK if they
  // captured at least as much as they're losing.
  const captured = moved.captured ? PIECE_VALUE[moved.captured] ?? 0 : 0;
  const netLoss = movedValue - captured;
  return netLoss > 0;
}

export interface ClassifyInput {
  movedColor: 'w' | 'b';
  bestMoveUci: string | null;
  playedUci: string;
  evalBeforeWhite: UciScore;
  evalAfterWhite: UciScore;
  secondBestEvalWhite: UciScore | null;
  fenAfterMove: string;
  movedMove: Move;
  ply: number;
  inferredBook: boolean;
}

export interface ClassifyOutput {
  classification: MoveClassification;
  wpLoss: number;
}

export function classifyMove(input: ClassifyInput): ClassifyOutput {
  const sign = input.movedColor === 'w' ? 1 : -1;
  const cpBefore = sign * scoreToCp(input.evalBeforeWhite);
  const cpAfter = sign * scoreToCp(input.evalAfterWhite);

  const wpBefore = winProbability(cpBefore);
  const wpAfter = winProbability(cpAfter);
  const wpLoss = Math.max(0, wpBefore - wpAfter);

  if (input.inferredBook) {
    return { classification: 'book', wpLoss };
  }

  const isBest = input.bestMoveUci !== null && input.bestMoveUci === input.playedUci;

  // Detect "only move": the second-best line is materially worse than the best.
  let onlyMove = false;
  if (isBest && input.secondBestEvalWhite) {
    const cpSecond = sign * scoreToCp(input.secondBestEvalWhite);
    const wpSecond = winProbability(cpSecond);
    onlyMove = wpBefore - wpSecond > 12; // top move is >12% WP better than #2
  }

  const sacrifice = looksLikeSacrifice(input.fenAfterMove, input.movedMove);

  // Brilliant: best move that involves a real sacrifice while keeping a
  // playable-or-better position for the mover.
  if (isBest && sacrifice && cpAfter > -100) {
    return { classification: 'brilliant', wpLoss };
  }

  if (isBest && onlyMove) {
    return { classification: 'great', wpLoss };
  }

  if (isBest) {
    return { classification: 'best', wpLoss };
  }

  if (wpLoss < 2) return { classification: 'good', wpLoss };
  if (wpLoss < 5) return { classification: 'ok', wpLoss };
  if (wpLoss < 10) return { classification: 'inaccuracy', wpLoss };
  if (wpLoss < 20) return { classification: 'mistake', wpLoss };
  return { classification: 'blunder', wpLoss };
}

/**
 * Best-effort opening-book heuristic. We don't ship a real book, but if the
 * move is among the engine's top candidate replies in the first ~12 plies and
 * the position is roughly balanced, we tag it as `book`.
 */
export function inferBook(opts: {
  ply: number;
  candidatesUci: string[];
  playedUci: string;
  evalBeforeCpWhite: number;
}): boolean {
  if (opts.ply >= 12) return false;
  if (Math.abs(opts.evalBeforeCpWhite) > 80) return false;
  return opts.candidatesUci.includes(opts.playedUci);
}

/**
 * Player accuracy is the average per-move accuracy across all of that player's
 * moves. `WP_loss → accuracy` follows lichess's harmonic mapping.
 */
export function accuracyFromWpLoss(wpLoss: number): number {
  // lichess: 103.1668 * exp(-0.04354 * wpLoss) - 3.1669
  const acc = 103.1668 * Math.exp(-0.04354 * wpLoss) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}
