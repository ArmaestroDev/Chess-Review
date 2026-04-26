// Persisted picker filters (tiers + themes) and the convenience picker that
// respects them. Both PuzzleFilters (the UI) and the page-level Quick Start /
// Next handlers go through here so the selection actually drives navigation
// instead of just sitting in localStorage.

import type { Puzzle, Tier } from '../types';
import { THEMES, pickFromCatalog, pickFromMultiSelect } from '../api/catalog';
import { ALL_TIERS } from './difficulty';

const STORAGE_KEY = 'chess-engine-puzzle-filters';

// Descriptor-style tags the picker UI hides — short/long/crushing/etc. are
// outcome attributes, not skills. Keeps loadPersistedFilters in lockstep with
// the set the user can actually toggle.
const NON_SKILL_THEMES = new Set<string>([
  'short',
  'long',
  'veryLong',
  'oneMove',
  'crushing',
  'advantage',
  'mate',
  'master',
  'masterVsMaster',
  'middlegame',
  'endgame',
  'opening',
]);

export const SKILL_THEMES: ReadonlyArray<string> = THEMES.filter(
  (th) => !NON_SKILL_THEMES.has(th.name),
).map((th) => th.name);

export interface PersistedFilters {
  tiers: Tier[];
  themes: string[];
}

// Returns null when nothing has been persisted — lets callers distinguish
// "fresh user" (apply auto-defaults) from "user explicitly deselected
// everything" (honor the empty selection).
export function loadPersistedFilters(): PersistedFilters | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedFilters>;
    const tierSet = new Set<string>(ALL_TIERS);
    const themeSet = new Set<string>(SKILL_THEMES);
    return {
      tiers: Array.isArray(parsed.tiers)
        ? (parsed.tiers.filter(
            (s): s is Tier => typeof s === 'string' && tierSet.has(s),
          ) as Tier[])
        : [],
      themes: Array.isArray(parsed.themes)
        ? parsed.themes.filter(
            (s): s is string => typeof s === 'string' && themeSet.has(s),
          )
        : [],
    };
  } catch {
    return null;
  }
}

export function savePersistedFilters(f: PersistedFilters): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

// Picks a puzzle that respects the user's persisted filters when both tiers
// AND themes are non-empty. Falls back to fallbackTier (then 'medium') when
// filters are absent or only partially configured — that's the "fresh user
// hasn't opened the panel" path. Returns null when filters are set but yield
// zero matches; the caller decides what to do (PuzzleFilters renders an
// inline empty-match hint elsewhere).
export async function pickRespectingFilters(opts: {
  fallbackTier: Tier;
  excludeIds: ReadonlyArray<string>;
}): Promise<Puzzle | null> {
  const filters = loadPersistedFilters();
  if (filters && filters.tiers.length > 0 && filters.themes.length > 0) {
    return pickFromMultiSelect({
      tiers: filters.tiers,
      themes: filters.themes,
      excludeIds: opts.excludeIds,
    });
  }
  const primary = await pickFromCatalog(opts.fallbackTier, {
    excludeIds: opts.excludeIds,
  });
  return (
    primary ??
    (await pickFromCatalog('medium', { excludeIds: opts.excludeIds }))
  );
}
