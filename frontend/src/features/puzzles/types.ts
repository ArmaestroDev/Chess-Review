// Domain types for the puzzles feature. Co-located here (not in the root
// types.ts which is reserved for the analysis wire contract).

export type Tier = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';

/**
 * Outcome of a single puzzle attempt. `'solve'` is the only result that
 * yields ELO gain; everything else is a flavor of fail.
 *
 * - `'solve'`: user played the full solution unaided.
 * - `'fail'`:  user played a wrong move at some point.
 * - `'hint'`:  user solved it but used a hint along the way (no gain, half loss).
 * - `'reveal'`: user clicked Reveal Solution (full loss).
 */
export type PuzzleResult = 'solve' | 'fail' | 'hint' | 'reveal';

/** A single puzzle as bundled in the local catalog or returned by the API. */
export interface Puzzle {
  id: string;
  /** Position BEFORE the opponent's setup move. The user solves from after move 0. */
  fen: string;
  /** UCI move sequence. Index 0 is opponent's setup, then alternating user/opponent. */
  moves: string[];
  rating: number;
  popularity: number;
  nbPlays: number;
  themes: string[];
}

/** A historical attempt — what gets pushed into PuzzleProgress.history. */
export interface PuzzleAttempt {
  puzzleId: string;
  puzzleRating: number;
  tier: Tier;
  result: PuzzleResult;
  /** Signed ELO delta applied (positive on solve, negative on fail/reveal). */
  delta: number;
  eloAfter: number;
  /** Lichess theme tags — used by the hub's weakness card. May be empty. */
  themes: string[];
  /** ms since epoch — Date.now() at completion. */
  timestamp: number;
}

export interface PuzzleStatsByTier {
  solved: number;
  failed: number;
}

/** Top-level localStorage shape under key `chess-engine-puzzles`. */
export interface PuzzleProgress {
  schemaVersion: 1;
  elo: number;
  history: PuzzleAttempt[];
  stats: {
    solved: number;
    failed: number;
    byTier: Record<Tier, PuzzleStatsByTier>;
  };
  /** Date string (yyyy-mm-dd) → attempt; ensures one daily per UTC day. */
  dailyHistory: Record<string, PuzzleAttempt>;
  /** Recent puzzle IDs (cap ~50) so the random picker can avoid repeats. */
  lastSeenPuzzleIds: string[];
}

// ---- Solver state machine -------------------------------------------------
// Discriminated union — illegal states unrepresentable. The reducer in
// usePuzzleSession (Phase 3) is the only path that can construct these.

/** 0 = no hint shown, 1 = source square highlighted, 2 = + target square, 3 = + UCI text. */
export type HintLevel = 0 | 1 | 2 | 3;

export type SessionState =
  | { kind: 'idle' }
  | { kind: 'loading'; puzzleId: string }
  | {
      kind: 'awaiting-user-move';
      puzzle: Puzzle;
      /** Index into puzzle.moves of the move the user must play next. */
      nextMoveIdx: number;
      /** Sticky: once true for this attempt, no ELO gain is possible. */
      hintUsed: boolean;
      hintLevel: HintLevel;
    }
  | {
      kind: 'animating-opponent-reply';
      puzzle: Puzzle;
      /** Index of the opponent move being played. */
      nextMoveIdx: number;
      hintUsed: boolean;
      hintLevel: HintLevel;
    }
  | {
      // User played a wrong move. We fetch the engine's best response (the
      // "punisher") from the backend so the player can SEE why their move
      // was bad, then offer Retry (resumes at failedAtIdx — not move 1) or
      // Next puzzle.
      kind: 'failed';
      puzzle: Puzzle;
      /** Index of the user's move that failed. Retry resets nextMoveIdx here. */
      failedAtIdx: number;
      /** What the user played (UCI). */
      userWrongUci: string;
      /** Engine's best response, once computed. */
      punisherStatus: 'fetching' | 'ready' | 'unavailable';
      punisherUci: string | null;
      hintUsed: boolean;
      /** Filled in once ELO is committed for this attempt. */
      delta: number;
      eloAfter: number;
    }
  | {
      // Animating through the solution after the user clicked Reveal. Stays
      // here as the terminal state — currentRevealIdx clamps at moves.length
      // when the animation finishes; the result panel + retry/next are
      // visible throughout so the user can interrupt the replay.
      kind: 'revealing';
      puzzle: Puzzle;
      /** fenAt(puzzle, currentRevealIdx) is the displayed FEN. */
      currentRevealIdx: number;
      hintUsed: boolean;
      delta: number;
      eloAfter: number;
    }
  | {
      // Used for solve / hint outcomes. Wrong moves use 'failed'; reveal
      // uses 'revealing'.
      kind: 'completed';
      puzzle: Puzzle;
      result: PuzzleResult;
      delta: number;
      eloAfter: number;
      hintUsed: boolean;
    }
  | { kind: 'error'; message: string };

export interface DailyEntry {
  /** yyyy-mm-dd (UTC). */
  date: string;
  puzzleId: string;
}
