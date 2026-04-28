// localStorage-backed puzzle progress. Mirrors the settings.ts idiom: one
// JSON blob, defensive parse, on schema mismatch fall back to defaults
// (never silently mutate). Capped history size to bound storage growth.

import type { PuzzleAttempt, PuzzleProgress, Tier } from '../types';
import { ALL_TIERS } from './difficulty';
import { ELO_FLOOR, ELO_CEILING, STARTING_ELO } from './elo';

const KEY = 'chess-engine-puzzles';
const HISTORY_CAP = 500;
const RECENT_IDS_CAP = 500;
/**
 * Hard-reset cycle for the no-rescore rule. After this many distinct scored
 * puzzles, `scoredPuzzleIds` clears so previously-attempted puzzles can earn
 * points again.
 */
export const SCORED_CYCLE_LIMIT = 2000;
const SCHEMA_VERSION = 1;

function makeDefault(): PuzzleProgress {
  return {
    schemaVersion: 1,
    elo: STARTING_ELO,
    history: [],
    stats: {
      solved: 0,
      failed: 0,
      byTier: ALL_TIERS.reduce(
        (acc, tier) => {
          acc[tier] = { solved: 0, failed: 0 };
          return acc;
        },
        {} as Record<Tier, { solved: number; failed: number }>,
      ),
    },
    dailyHistory: {},
    lastSeenPuzzleIds: [],
    scoredPuzzleIds: [],
  };
}

export function loadProgress(): PuzzleProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return makeDefault();
    const parsed = JSON.parse(raw) as Partial<PuzzleProgress>;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return makeDefault();

    const def = makeDefault();
    return {
      schemaVersion: 1,
      elo: clampElo(typeof parsed.elo === 'number' ? parsed.elo : def.elo),
      history: Array.isArray(parsed.history)
        ? (parsed.history.filter(isValidAttempt) as PuzzleAttempt[])
            .map((a) => ({ ...a, themes: Array.isArray(a.themes) ? a.themes : [] }))
            .slice(-HISTORY_CAP)
        : def.history,
      stats: mergeStats(parsed.stats, def.stats),
      dailyHistory: isPlainObject(parsed.dailyHistory)
        ? (parsed.dailyHistory as Record<string, PuzzleAttempt>)
        : def.dailyHistory,
      lastSeenPuzzleIds: Array.isArray(parsed.lastSeenPuzzleIds)
        ? parsed.lastSeenPuzzleIds.filter((s) => typeof s === 'string').slice(
            -RECENT_IDS_CAP,
          )
        : def.lastSeenPuzzleIds,
      scoredPuzzleIds: Array.isArray(parsed.scoredPuzzleIds)
        ? parsed.scoredPuzzleIds
            .filter((s) => typeof s === 'string')
            .slice(-SCORED_CYCLE_LIMIT)
        : def.scoredPuzzleIds,
    };
  } catch {
    return makeDefault();
  }
}

export function saveProgress(progress: PuzzleProgress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* localStorage unavailable / quota exceeded — silent. */
  }
  // Same-tab notification — cross-tab is handled by the 'storage' event,
  // which doesn't fire for the writing tab itself.
  for (const fn of progressListeners) fn();
}

const progressListeners = new Set<() => void>();

/** Subscribe to in-tab progress writes. Returns an unsubscribe fn. */
export function subscribeProgress(fn: () => void): () => void {
  progressListeners.add(fn);
  return () => {
    progressListeners.delete(fn);
  };
}

/**
 * Append an attempt and return the new progress object. Updates rolling
 * stats, prepends to recent IDs (capped), and trims history at the cap.
 * The caller is responsible for persisting via saveProgress.
 *
 * If `dailyDateKey` is provided, the attempt is also recorded under
 * `dailyHistory[dailyDateKey]` so the daily-puzzle calendar can render it.
 * Pass null/undefined for non-daily attempts.
 */
export function appendAttempt(
  progress: PuzzleProgress,
  attempt: PuzzleAttempt,
  dailyDateKey?: string | null,
): PuzzleProgress {
  const history = [...progress.history, attempt];
  if (history.length > HISTORY_CAP) {
    history.splice(0, history.length - HISTORY_CAP);
  }

  const isSolve = attempt.result === 'solve' || attempt.result === 'hint';
  const stats = {
    ...progress.stats,
    solved: progress.stats.solved + (isSolve ? 1 : 0),
    failed: progress.stats.failed + (isSolve ? 0 : 1),
    byTier: {
      ...progress.stats.byTier,
      [attempt.tier]: {
        solved:
          progress.stats.byTier[attempt.tier].solved + (isSolve ? 1 : 0),
        failed:
          progress.stats.byTier[attempt.tier].failed + (isSolve ? 0 : 1),
      },
    },
  };

  const lastSeen = [
    ...progress.lastSeenPuzzleIds.filter((id) => id !== attempt.puzzleId),
    attempt.puzzleId,
  ];
  if (lastSeen.length > RECENT_IDS_CAP) {
    lastSeen.splice(0, lastSeen.length - RECENT_IDS_CAP);
  }

  const dailyHistory = dailyDateKey
    ? { ...progress.dailyHistory, [dailyDateKey]: attempt }
    : progress.dailyHistory;

  // Cycle-bounded "already scored" set. New ids are appended; once the list
  // would overflow SCORED_CYCLE_LIMIT, the cycle resets to a fresh list seeded
  // with this attempt. Re-attempts of an id already present don't grow the
  // list (the caller computes delta=0 in that case).
  let scoredPuzzleIds = progress.scoredPuzzleIds;
  if (!scoredPuzzleIds.includes(attempt.puzzleId)) {
    scoredPuzzleIds =
      scoredPuzzleIds.length >= SCORED_CYCLE_LIMIT
        ? [attempt.puzzleId]
        : [...scoredPuzzleIds, attempt.puzzleId];
  }

  return {
    ...progress,
    elo: clampElo(attempt.eloAfter),
    history,
    stats,
    lastSeenPuzzleIds: lastSeen,
    dailyHistory,
    scoredPuzzleIds,
  };
}

/** Today's date as yyyy-mm-dd in UTC — used as key into dailyHistory. */
export function todayKey(): string {
  const d = new Date();
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function clampElo(n: number): number {
  if (!Number.isFinite(n)) return STARTING_ELO;
  return Math.max(ELO_FLOOR, Math.min(ELO_CEILING, Math.round(n)));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isValidAttempt(v: unknown): v is PuzzleAttempt {
  if (!isPlainObject(v)) return false;
  // `themes` is back-compatibly optional — old entries without it are kept
  // and treated as themes=[] by the consumers via `attempt.themes ?? []`.
  return (
    typeof v.puzzleId === 'string' &&
    typeof v.puzzleRating === 'number' &&
    typeof v.tier === 'string' &&
    typeof v.result === 'string' &&
    typeof v.delta === 'number' &&
    typeof v.eloAfter === 'number' &&
    typeof v.timestamp === 'number'
  );
}

function mergeStats(
  raw: unknown,
  def: PuzzleProgress['stats'],
): PuzzleProgress['stats'] {
  if (!isPlainObject(raw)) return def;
  const byTierRaw = isPlainObject(raw.byTier) ? raw.byTier : {};
  const byTier = ALL_TIERS.reduce(
    (acc, tier) => {
      const t = byTierRaw[tier];
      if (isPlainObject(t)) {
        acc[tier] = {
          solved: typeof t.solved === 'number' ? t.solved : 0,
          failed: typeof t.failed === 'number' ? t.failed : 0,
        };
      } else {
        acc[tier] = { solved: 0, failed: 0 };
      }
      return acc;
    },
    {} as Record<Tier, { solved: number; failed: number }>,
  );
  return {
    solved: typeof raw.solved === 'number' ? raw.solved : def.solved,
    failed: typeof raw.failed === 'number' ? raw.failed : def.failed,
    byTier,
  };
}
