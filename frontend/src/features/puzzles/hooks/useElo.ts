// localStorage-backed user ELO + history. Single source of truth for the
// user's puzzle rating and stats; consumed by the solver hook and the hub.

import { useCallback, useEffect, useState } from 'react';
import type { PuzzleAttempt, PuzzleProgress } from '../types';
import {
  appendAttempt,
  loadProgress,
  saveProgress,
  subscribeProgress,
} from '../utils/puzzleProgress';

export interface UseEloApi {
  /** Current rating. */
  elo: number;
  /** Full progress object — pass through to UI for history/stats display. */
  progress: PuzzleProgress;
  /**
   * Commit a completed attempt. Updates ELO + persists to localStorage.
   * Pass `dailyDateKey` (yyyy-mm-dd UTC) when the attempt is a daily puzzle
   * so it appears on the calendar.
   */
  commitAttempt: (attempt: PuzzleAttempt, dailyDateKey?: string | null) => void;
  /** Reset to defaults (used by Settings or "Wipe progress" action). */
  reset: () => void;
}

export function useElo(): UseEloApi {
  const [progress, setProgress] = useState<PuzzleProgress>(() => loadProgress());

  // Same-tab sync: when one useElo instance commits, every other instance
  // re-reads. Cross-tab sync via the 'storage' event handles the rest.
  useEffect(() => {
    const unsubLocal = subscribeProgress(() => setProgress(loadProgress()));
    function onStorage(e: StorageEvent) {
      if (e.key !== 'chess-engine-puzzles') return;
      setProgress(loadProgress());
    }
    window.addEventListener('storage', onStorage);
    return () => {
      unsubLocal();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const commitAttempt = useCallback(
    (attempt: PuzzleAttempt, dailyDateKey?: string | null) => {
      setProgress((prev) => {
        const next = appendAttempt(prev, attempt, dailyDateKey);
        saveProgress(next);
        return next;
      });
    },
    [],
  );

  const reset = useCallback(() => {
    try {
      localStorage.removeItem('chess-engine-puzzles');
    } catch {
      /* ignore */
    }
    setProgress(loadProgress());
  }, []);

  return { elo: progress.elo, progress, commitAttempt, reset };
}
