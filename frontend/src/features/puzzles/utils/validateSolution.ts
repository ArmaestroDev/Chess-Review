// Pure UCI matcher with Lichess any-mate-correct rule.
//
// Rules:
//   1. Exact UCI match against the expected move = correct.
//   2. ANY legal move that delivers checkmate is correct, even if the UCI
//      doesn't match. (Lichess convention — many puzzles have a unique
//      mate-in-1 but multiple syntactic encodings, e.g. underpromotion that
//      also mates is accepted.)
//   3. Multi-line tolerance is NOT implemented. Single solution line only.

import { Chess } from 'chess.js';

export interface ValidateOptions {
  /** FEN of the position the user is moving FROM. */
  fenBefore: string;
  /** UCI of the move the user just played. */
  playedUci: string;
  /** UCI the puzzle expects at this ply. */
  expectedUci: string;
}

export type ValidationOutcome =
  | { ok: true; reason: 'exact' | 'mate' }
  | { ok: false; reason: 'wrong-move' | 'illegal-move' };

/**
 * Validate a single user move. The board layer pre-validates legality before
 * onMove fires (react-chessboard + chess.js), so 'illegal-move' is mostly a
 * defensive fallback for hand-crafted UCIs.
 */
export function validateMove(opts: ValidateOptions): ValidationOutcome {
  const { fenBefore, playedUci, expectedUci } = opts;

  if (playedUci === expectedUci) {
    return { ok: true, reason: 'exact' };
  }

  // Mate-rule: any legal move that ends the game by checkmate is correct.
  const chess = new Chess(fenBefore);
  let applied;
  try {
    applied = chess.move({
      from: playedUci.slice(0, 2),
      to: playedUci.slice(2, 4),
      promotion: playedUci.length > 4 ? playedUci.slice(4, 5) : undefined,
    });
  } catch {
    return { ok: false, reason: 'illegal-move' };
  }
  if (!applied) {
    return { ok: false, reason: 'illegal-move' };
  }

  if (chess.isCheckmate()) {
    return { ok: true, reason: 'mate' };
  }
  return { ok: false, reason: 'wrong-move' };
}

/**
 * Apply a UCI move to a FEN and return the resulting FEN, or null if
 * illegal. Used by the solver to step through the puzzle's solution line
 * for opponent replies.
 */
export function applyUci(fen: string, uci: string): string | null {
  const chess = new Chess(fen);
  try {
    const applied = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
    });
    if (!applied) return null;
  } catch {
    return null;
  }
  return chess.fen();
}

/**
 * Return the SAN of a UCI move applied to a FEN, or null if illegal.
 * Useful for picking a move sound (`classifySound(san)`).
 */
export function uciToSan(fen: string, uci: string): string | null {
  const chess = new Chess(fen);
  try {
    const applied = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
    });
    return applied?.san ?? null;
  } catch {
    return null;
  }
}
