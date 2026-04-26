// Solver state machine. The reducer is pure; the surrounding hook handles
// the side effects: opponent-reply timer, sounds, and ELO commit.

import { useCallback, useEffect, useReducer, useRef } from 'react';
import type {
  HintLevel,
  Puzzle,
  PuzzleAttempt,
  PuzzleResult,
  SessionState,
} from '../types';
import { classifyTier } from '../utils/difficulty';
import { applyDelta, computeDelta } from '../utils/elo';
import {
  applyUci,
  uciToSan,
  validateMove,
} from '../utils/validateSolution';
import {
  classifySound,
  play as playSound,
  type SoundKind,
} from '../../../utils/sounds';
import { ensureConnected, socket } from '../../../socket';
import { useElo } from './useElo';
import { isDailyPuzzleId, todayDateKey } from './useDailyPuzzle';

const OPPONENT_REPLY_DELAY_MS = 400;
const PUNISHER_FETCH_TIMEOUT_MS = 8000;
const PUNISHER_DEPTH = 12;
const PUNISHER_ANIMATION_DELAY_MS = 250;
const REVEAL_STEP_INTERVAL_MS = 1200;

type Action =
  | { type: 'load'; puzzleId: string }
  | { type: 'puzzle-loaded'; puzzle: Puzzle }
  | { type: 'puzzle-load-failed'; message: string }
  | { type: 'user-move'; uci: string }
  | { type: 'opponent-move-played' }
  | { type: 'hint' }
  | { type: 'reveal' }
  | { type: 'reveal-step' }
  | { type: 'punisher-fetched'; uci: string }
  | { type: 'punisher-unavailable' }
  | { type: 'retry-from-failure' }
  | { type: 'commit-elo'; delta: number; eloAfter: number };

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'load':
      return { kind: 'loading', puzzleId: action.puzzleId };

    case 'puzzle-loaded':
      // After Moves[0] (opponent's setup) is conceptually applied, the user
      // is to move. nextMoveIdx = 1 = the user's first move.
      return {
        kind: 'awaiting-user-move',
        puzzle: action.puzzle,
        nextMoveIdx: 1,
        hintUsed: false,
        hintLevel: 0,
      };

    case 'puzzle-load-failed':
      return { kind: 'error', message: action.message };

    case 'user-move': {
      if (state.kind !== 'awaiting-user-move') return state;
      const expected = state.puzzle.moves[state.nextMoveIdx];
      if (!expected) return state;
      const fenBefore = fenAt(state.puzzle, state.nextMoveIdx);
      if (fenBefore == null) return state;
      const validation = validateMove({
        fenBefore,
        playedUci: action.uci,
        expectedUci: expected,
      });
      if (!validation.ok) {
        // Wrong move → enter the punishment-loop state. The hook fetches
        // the engine's best response and we render it on the board so the
        // user can SEE why their move was bad. Retry resumes at this idx.
        return {
          kind: 'failed',
          puzzle: state.puzzle,
          failedAtIdx: state.nextMoveIdx,
          userWrongUci: action.uci,
          punisherStatus: 'fetching',
          punisherUci: null,
          hintUsed: state.hintUsed,
          delta: 0,
          eloAfter: 0,
        };
      }
      const nextIdx = state.nextMoveIdx + 1;
      if (nextIdx >= state.puzzle.moves.length) {
        const result: PuzzleResult = state.hintUsed ? 'hint' : 'solve';
        return {
          kind: 'completed',
          puzzle: state.puzzle,
          result,
          delta: 0,
          eloAfter: 0,
          hintUsed: state.hintUsed,
        };
      }
      return {
        kind: 'animating-opponent-reply',
        puzzle: state.puzzle,
        nextMoveIdx: nextIdx,
        hintUsed: state.hintUsed,
        hintLevel: state.hintLevel,
      };
    }

    case 'punisher-fetched':
      if (state.kind !== 'failed') return state;
      return { ...state, punisherStatus: 'ready', punisherUci: action.uci };

    case 'punisher-unavailable':
      if (state.kind !== 'failed') return state;
      return { ...state, punisherStatus: 'unavailable', punisherUci: null };

    case 'retry-from-failure': {
      if (state.kind !== 'failed') return state;
      return {
        kind: 'awaiting-user-move',
        puzzle: state.puzzle,
        nextMoveIdx: state.failedAtIdx,
        // hintUsed sticks across retry — the user already used a hint on
        // this puzzle; they don't get a clean ELO slate by retrying.
        hintUsed: state.hintUsed,
        hintLevel: 0,
      };
    }

    case 'opponent-move-played': {
      if (state.kind !== 'animating-opponent-reply') return state;
      const nextIdx = state.nextMoveIdx + 1;
      if (nextIdx >= state.puzzle.moves.length) {
        const result: PuzzleResult = state.hintUsed ? 'hint' : 'solve';
        return {
          kind: 'completed',
          puzzle: state.puzzle,
          result,
          delta: 0,
          eloAfter: 0,
          hintUsed: state.hintUsed,
        };
      }
      return {
        kind: 'awaiting-user-move',
        puzzle: state.puzzle,
        nextMoveIdx: nextIdx,
        hintUsed: state.hintUsed,
        hintLevel: state.hintLevel,
      };
    }

    case 'hint': {
      if (state.kind !== 'awaiting-user-move') return state;
      const next = (Math.min(3, state.hintLevel + 1) as HintLevel);
      return { ...state, hintUsed: true, hintLevel: next };
    }

    case 'reveal': {
      if (
        state.kind === 'awaiting-user-move' ||
        state.kind === 'animating-opponent-reply'
      ) {
        // Start animating from the user's current position. The hook runs
        // a timer that ticks through the rest of puzzle.moves at
        // REVEAL_STEP_INTERVAL_MS spacing.
        return {
          kind: 'revealing',
          puzzle: state.puzzle,
          currentRevealIdx: state.nextMoveIdx,
          hintUsed: true,
          delta: 0,
          eloAfter: 0,
        };
      }
      return state;
    }

    case 'reveal-step': {
      if (state.kind !== 'revealing') return state;
      const next = state.currentRevealIdx + 1;
      if (next > state.puzzle.moves.length) return state;
      return { ...state, currentRevealIdx: next };
    }

    case 'commit-elo': {
      if (
        state.kind === 'completed' ||
        state.kind === 'failed' ||
        state.kind === 'revealing'
      ) {
        return { ...state, delta: action.delta, eloAfter: action.eloAfter };
      }
      return state;
    }

    default:
      return state;
  }
}

export interface UsePuzzleSessionApi {
  state: SessionState;
  /** Display FEN for the current state (post-setup-move and any user/opponent moves). */
  displayFen: string;
  /** Color the user controls; orientation should match. */
  userColor: 'white' | 'black';
  /** Squares to highlight (last move + hint visualizations). */
  highlights: { square: string; color?: string }[];
  /** Call when the user drags a piece. */
  submitMove: (uci: string) => void;
  /** Cycle the hint level (max 3). */
  requestHint: () => void;
  /** Trigger reveal — counts as a fail, full loss. */
  revealSolution: () => void;
  /** Manually start a new puzzle. */
  loadPuzzle: (puzzle: Puzzle) => void;
  /** Resume from the move where the user failed (NOT from move 1). */
  retryFromFailure: () => void;
}

export function usePuzzleSession(
  initialPuzzle: Puzzle | null,
): UsePuzzleSessionApi {
  const [state, dispatch] = useReducer(reducer, { kind: 'idle' } as SessionState);
  const { elo, commitAttempt } = useElo();

  // Track the puzzle id whose ELO has already been committed in this
  // session. Used to short-circuit:
  //   - Retry on the same puzzle (no re-commit)
  //   - StrictMode double-effect invocation
  // Does NOT reset on loadPuzzle / initialPuzzle change — the ref persists
  // across puzzles. When a NEW puzzle id finishes, ref !== id and commit
  // proceeds. When a SAME id finishes (retry), ref === id and commit skips.
  const committedForRef = useRef<string | null>(null);

  // Initial load when the parent passes us a puzzle.
  useEffect(() => {
    if (initialPuzzle) {
      dispatch({ type: 'puzzle-loaded', puzzle: initialPuzzle });
    }
  }, [initialPuzzle]);

  // ---- Side effects -----------------------------------------------------

  // Opponent reply timer + sound for the opponent's move.
  useEffect(() => {
    if (state.kind !== 'animating-opponent-reply') return;
    const opponentMoveIdx = state.nextMoveIdx;
    const fenBeforeOpp = fenAt(state.puzzle, opponentMoveIdx);
    const opponentUci = state.puzzle.moves[opponentMoveIdx];
    const sound: SoundKind | null =
      fenBeforeOpp && opponentUci
        ? classifySound(uciToSan(fenBeforeOpp, opponentUci) ?? '')
        : null;

    const t = window.setTimeout(() => {
      if (sound) playSound(sound);
      dispatch({ type: 'opponent-move-played' });
    }, OPPONENT_REPLY_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [state]);

  // Punisher fetch + animation: when the user plays a wrong move, ask the
  // backend (Stockfish via socket.analyzeMove) for the engine's best response
  // from the post-wrong-move position. Once we have it, schedule a tiny
  // delay so the user's piece has settled, then dispatch — the board's fen
  // prop will swap to the post-punisher position and react-chessboard
  // animates the slide.
  useEffect(() => {
    if (state.kind !== 'failed') return;
    if (state.punisherStatus !== 'fetching') return;

    const fenBefore = fenAt(state.puzzle, state.failedAtIdx);
    if (!fenBefore) {
      dispatch({ type: 'punisher-unavailable' });
      return;
    }

    let cancelled = false;
    let animationTimer: number | null = null;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      dispatch({ type: 'punisher-unavailable' });
    }, PUNISHER_FETCH_TIMEOUT_MS);

    ensureConnected();
    socket.emit(
      'analyzeMove',
      {
        fenBefore,
        uci: state.userWrongUci,
        depth: PUNISHER_DEPTH,
        ply: state.failedAtIdx,
      },
      (ack) => {
        if (cancelled) return;
        cancelled = true;
        window.clearTimeout(timeout);

        if (!ack.ok || !ack.move?.nextBestMoveUci) {
          dispatch({ type: 'punisher-unavailable' });
          return;
        }
        const punisherUci = ack.move.nextBestMoveUci;

        // Tiny delay so the user's wrong-move piece settles before the
        // punisher animates onto the board.
        animationTimer = window.setTimeout(() => {
          // Play opponent's move sound based on the resulting SAN.
          const fenAfterUserMove = applyUci(fenBefore, state.userWrongUci);
          if (fenAfterUserMove) {
            const san = uciToSan(fenAfterUserMove, punisherUci);
            if (san) playSound(classifySound(san));
          }
          dispatch({ type: 'punisher-fetched', uci: punisherUci });
        }, PUNISHER_ANIMATION_DELAY_MS);
      },
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      if (animationTimer != null) window.clearTimeout(animationTimer);
    };
  }, [state]);

  // ELO commit on first transition into a terminal state. Idempotent across
  // retries via committedForRef. Three terminal kinds: completed, failed,
  // revealing.
  useEffect(() => {
    if (
      state.kind !== 'completed' &&
      state.kind !== 'failed' &&
      state.kind !== 'revealing'
    ) {
      return;
    }
    if (committedForRef.current === state.puzzle.id) return;
    committedForRef.current = state.puzzle.id;

    const result: PuzzleResult =
      state.kind === 'completed'
        ? state.result
        : state.kind === 'revealing'
          ? 'reveal'
          : state.hintUsed
            ? 'hint'
            : 'fail';
    const delta = computeDelta(result, state.puzzle.rating, elo);
    const eloAfter = applyDelta(elo, delta);

    const attempt: PuzzleAttempt = {
      puzzleId: state.puzzle.id,
      puzzleRating: state.puzzle.rating,
      tier: classifyTier(state.puzzle.rating),
      result,
      delta,
      eloAfter,
      themes: state.puzzle.themes,
      timestamp: Date.now(),
    };
    // Daily puzzles are also indexed by date in dailyHistory so the calendar
    // page can render solved/failed cells. Always anchored to "today" (UTC):
    // even if the user replays a historical date via the calendar, the most
    // useful semantic is "this is when I attempted it."
    const dailyDateKey = isDailyPuzzleId(state.puzzle.id) ? todayDateKey() : null;
    commitAttempt(attempt, dailyDateKey);
    dispatch({ type: 'commit-elo', delta, eloAfter });

    // Result feedback sound — solved gets the gentle 'check'; everything
    // else gets the buzzer.
    playSound(
      state.kind === 'completed' && state.result === 'solve' ? 'check' : 'error',
    );
  }, [state, elo, commitAttempt]);

  // Reveal animation: tick through the remaining solution moves at a
  // human-readable pace, playing each move's sound as it animates.
  useEffect(() => {
    if (state.kind !== 'revealing') return;
    if (state.currentRevealIdx >= state.puzzle.moves.length) return;

    const fenBefore = fenAt(state.puzzle, state.currentRevealIdx);
    const moveUci = state.puzzle.moves[state.currentRevealIdx];

    const t = window.setTimeout(() => {
      if (fenBefore && moveUci) {
        const san = uciToSan(fenBefore, moveUci);
        if (san) playSound(classifySound(san));
      }
      dispatch({ type: 'reveal-step' });
    }, REVEAL_STEP_INTERVAL_MS);

    return () => window.clearTimeout(t);
  }, [state]);

  // ---- Derived view state ----------------------------------------------

  const puzzle = activePuzzle(state);
  const displayFen = computeDisplayFen(state, puzzle);
  // Derive userColor from the puzzle PROP, not from reducer state. The
  // reducer transitions out of 'idle' via a useEffect which fires AFTER the
  // first render, so anything reading userColor in the same render cycle
  // (e.g. the orientation effect in PuzzleSolver) would see 'white' before
  // the dispatch settles. Reading directly from the prop fixes that race
  // and is also resilient to prop changes (new puzzle navigations).
  const userColor: 'white' | 'black' = initialPuzzle
    ? userColorOf(initialPuzzle)
    : 'white';
  const highlights = computeHighlights(state, puzzle);

  // ---- API --------------------------------------------------------------

  const submitMove = useCallback(
    (uci: string) => {
      if (state.kind !== 'awaiting-user-move') return;
      const fenBefore = fenAt(state.puzzle, state.nextMoveIdx);
      if (!fenBefore) return;

      const expected = state.puzzle.moves[state.nextMoveIdx];
      const validation = expected
        ? validateMove({ fenBefore, playedUci: uci, expectedUci: expected })
        : { ok: false as const, reason: 'wrong-move' as const };

      // Sound for the user's move BEFORE the reducer transitions away.
      // Wrong moves get the buzzer; correct moves get their natural sound.
      if (!validation.ok) {
        playSound('error');
      } else {
        const san = uciToSan(fenBefore, uci) ?? '';
        playSound(classifySound(san));
      }

      dispatch({ type: 'user-move', uci });
    },
    [state],
  );

  const requestHint = useCallback(() => {
    dispatch({ type: 'hint' });
  }, []);

  const revealSolution = useCallback(() => {
    dispatch({ type: 'reveal' });
  }, []);

  const loadPuzzle = useCallback((puzzle: Puzzle) => {
    // Intentionally NOT resetting committedForRef — same-id reloads (retry)
    // must not trigger a second ELO commit.
    dispatch({ type: 'puzzle-loaded', puzzle });
  }, []);

  const retryFromFailure = useCallback(() => {
    dispatch({ type: 'retry-from-failure' });
  }, []);

  return {
    state,
    displayFen,
    userColor,
    highlights,
    submitMove,
    requestHint,
    revealSolution,
    loadPuzzle,
    retryFromFailure,
  };
}

// ---- Helpers ------------------------------------------------------------

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function activePuzzle(state: SessionState): Puzzle | null {
  switch (state.kind) {
    case 'awaiting-user-move':
    case 'animating-opponent-reply':
    case 'completed':
    case 'failed':
    case 'revealing':
      return state.puzzle;
    default:
      return null;
  }
}

/**
 * Compute the FEN to render given the current session state. Most states
 * are a simple replay of puzzle.moves up to some index; the 'failed' state
 * is special — it overlays the user's wrong move and (if known) the
 * engine's punisher onto the line, since neither is in puzzle.moves.
 */
function computeDisplayFen(state: SessionState, puzzle: Puzzle | null): string {
  if (!puzzle) return STARTING_FEN;
  if (state.kind === 'failed') {
    let fen = fenAt(puzzle, state.failedAtIdx);
    const afterWrong = applyUci(fen, state.userWrongUci);
    if (!afterWrong) return fen;
    fen = afterWrong;
    if (state.punisherStatus === 'ready' && state.punisherUci) {
      const afterPunisher = applyUci(fen, state.punisherUci);
      if (afterPunisher) fen = afterPunisher;
    }
    return fen;
  }
  return fenAt(puzzle, currentDisplayIdx(state));
}

/** What ply we're showing on the board, given the current state. */
function currentDisplayIdx(state: SessionState): number {
  switch (state.kind) {
    case 'awaiting-user-move':
      return state.nextMoveIdx; // user about to move from this position
    case 'animating-opponent-reply':
      return state.nextMoveIdx; // the opponent move's "before" position
    case 'completed':
      return state.puzzle.moves.length;
    case 'failed':
      // The wrong-move + punisher composition is handled in computeDisplayFen.
      return state.failedAtIdx;
    case 'revealing':
      return state.currentRevealIdx;
    default:
      return 0;
  }
}

/** FEN after applying puzzle.moves[0..idx-1] to puzzle.fen. */
function fenAt(puzzle: Puzzle, idx: number): string {
  let fen = puzzle.fen;
  for (let i = 0; i < idx; i++) {
    const next = applyUci(fen, puzzle.moves[i]!);
    if (next == null) return fen; // give up gracefully on malformed data
    fen = next;
  }
  return fen;
}

function userColorOf(puzzle: Puzzle): 'white' | 'black' {
  // puzzle.fen is the position BEFORE Moves[0] (opponent's setup), so
  // fen's side-to-move is the OPPONENT.
  const side = puzzle.fen.split(' ')[1];
  return side === 'w' ? 'black' : 'white';
}

const HINT_HIGHLIGHT_COLOR = 'rgba(216, 181, 106, 0.5)';
const LAST_MOVE_HIGHLIGHT = 'rgba(216, 181, 106, 0.32)';
const WRONG_MOVE_HIGHLIGHT = 'rgba(214, 68, 58, 0.40)';
const PUNISHER_HIGHLIGHT = 'rgba(91, 155, 213, 0.38)';

function computeHighlights(
  state: SessionState,
  puzzle: Puzzle | null,
): { square: string; color?: string }[] {
  const out: { square: string; color?: string }[] = [];
  if (!puzzle) return out;

  // Failed state: show the wrong move (red) and the punisher (blue) so the
  // player can see WHAT they did and WHAT was punished.
  if (state.kind === 'failed') {
    out.push({
      square: state.userWrongUci.slice(0, 2),
      color: WRONG_MOVE_HIGHLIGHT,
    });
    out.push({
      square: state.userWrongUci.slice(2, 4),
      color: WRONG_MOVE_HIGHLIGHT,
    });
    if (state.punisherStatus === 'ready' && state.punisherUci) {
      out.push({
        square: state.punisherUci.slice(0, 2),
        color: PUNISHER_HIGHLIGHT,
      });
      out.push({
        square: state.punisherUci.slice(2, 4),
        color: PUNISHER_HIGHLIGHT,
      });
    }
    return out;
  }

  // Show the last move's from/to so the user has spatial context.
  const idx = currentDisplayIdx(state);
  if (idx > 0) {
    const lastUci = puzzle.moves[idx - 1];
    if (lastUci) {
      out.push({ square: lastUci.slice(0, 2), color: LAST_MOVE_HIGHLIGHT });
      out.push({ square: lastUci.slice(2, 4), color: LAST_MOVE_HIGHLIGHT });
    }
  }

  // Hint visualization (only while still solving).
  if (state.kind === 'awaiting-user-move' && state.hintLevel > 0) {
    const expected = puzzle.moves[state.nextMoveIdx];
    if (expected) {
      out.push({ square: expected.slice(0, 2), color: HINT_HIGHLIGHT_COLOR });
      if (state.hintLevel >= 2) {
        out.push({ square: expected.slice(2, 4), color: HINT_HIGHLIGHT_COLOR });
      }
    }
  }
  return out;
}
