// Bundled-catalog selector. Each tier's puzzles are imported eagerly as
// JSON — total payload is ~570KB uncompressed (~120KB gzipped) which is
// well under the dynamic-import-per-tier threshold.

import type { Puzzle, Tier } from '../types';
import beginnerData from '../data/catalog/beginner.json';
import easyData from '../data/catalog/easy.json';
import mediumData from '../data/catalog/medium.json';
import hardData from '../data/catalog/hard.json';
import expertData from '../data/catalog/expert.json';
import dailyData from '../data/daily.json';
import themesMeta from '../data/themes.json';

const CATALOG: Record<Tier, Puzzle[]> = {
  beginner: beginnerData as Puzzle[],
  easy: easyData as Puzzle[],
  medium: mediumData as Puzzle[],
  hard: hardData as Puzzle[],
  expert: expertData as Puzzle[],
};

// Daily entries are sampled independently from the tier reservoirs, so a
// daily ID won't necessarily appear in any tier catalog. findInCatalog
// must also check this set or the solver will fall through to the API
// proxy (and 503 if RAPIDAPI_KEY isn't configured).
const DAILY_ENTRIES: Puzzle[] = (
  dailyData as { entries: Puzzle[] }
).entries;

export interface ThemeInfo {
  name: string;
  count: number;
}

/** Top themes by total puzzle count across the full Lichess DB. */
export const THEMES: ReadonlyArray<ThemeInfo> = (
  themesMeta as { themes: ThemeInfo[] }
).themes;

/** Per-tier eligible counts before sampling — drives the hub's stat tiles. */
export const TIER_TOTALS: Record<Tier, number> = (
  themesMeta as { tierCounts: Record<Tier, number> }
).tierCounts;

export interface PickOptions {
  /** Optional theme name; when set, only puzzles tagged with this theme are eligible. */
  theme?: string;
  /** IDs to avoid (e.g. recently-seen ids from localStorage). */
  excludeIds?: ReadonlyArray<string>;
}

export interface MultiPickOptions {
  tiers: ReadonlyArray<Tier>;
  themes: ReadonlyArray<string>;
  excludeIds?: ReadonlyArray<string>;
}

/**
 * Pick a single puzzle from the local catalog matching tier + optional
 * theme, biased away from recently-seen IDs. Returns null only if the
 * tier+theme combo has zero puzzles in the catalog (rare — the catalog is
 * sampled to cover every theme that has ≥1 puzzle in the tier).
 */
export function pickFromCatalog(
  tier: Tier,
  opts: PickOptions = {},
): Puzzle | null {
  const pool = CATALOG[tier];
  const excludeSet = new Set(opts.excludeIds ?? []);
  const themed = opts.theme
    ? pool.filter((p) => p.themes.includes(opts.theme!))
    : pool;
  if (themed.length === 0) return null;

  // Prefer un-seen puzzles; fall back to the full themed pool if everything's
  // been seen recently. Random index (Math.random is fine — variety bias only).
  const fresh = themed.filter((p) => !excludeSet.has(p.id));
  const candidates = fresh.length > 0 ? fresh : themed;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

/**
 * Pick a puzzle from the union of all selected tiers, restricted to those
 * tagged with at least one of the selected themes. Returns null if the
 * intersection is empty after filtering.
 */
export function pickFromMultiSelect(opts: MultiPickOptions): Puzzle | null {
  if (opts.tiers.length === 0 || opts.themes.length === 0) return null;
  const themeSet = new Set(opts.themes);
  const excludeSet = new Set(opts.excludeIds ?? []);

  const pool: Puzzle[] = [];
  for (const tier of opts.tiers) {
    for (const p of CATALOG[tier]) {
      if (p.themes.some((th) => themeSet.has(th))) pool.push(p);
    }
  }
  if (pool.length === 0) return null;

  const fresh = pool.filter((p) => !excludeSet.has(p.id));
  const candidates = fresh.length > 0 ? fresh : pool;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

/** Find a specific puzzle by ID across tier catalogs + daily set. */
export function findInCatalog(id: string): Puzzle | null {
  for (const tier of Object.keys(CATALOG) as Tier[]) {
    const hit = CATALOG[tier].find((p) => p.id === id);
    if (hit) return hit;
  }
  return DAILY_ENTRIES.find((p) => p.id === id) ?? null;
}

/** All puzzles in a tier — used for stats / per-theme counts in the hub. */
export function getCatalogTier(tier: Tier): ReadonlyArray<Puzzle> {
  return CATALOG[tier];
}

/** Per-theme count from the bundled sample (NOT the full Lichess total). */
export function countByTheme(tier: Tier, theme: string): number {
  return CATALOG[tier].filter((p) => p.themes.includes(theme)).length;
}

// Pre-computed theme → dominant tier map. Computed once at module load by
// scanning the bundled catalog. Drives the color of the theme glyph chip in
// the hub.
const ALL_TIERS_LOCAL: Tier[] = ['beginner', 'easy', 'medium', 'hard', 'expert'];
const THEME_DIFFICULTIES: Map<string, Tier> = (() => {
  const map = new Map<string, Tier>();
  for (const { name } of THEMES) {
    let bestTier: Tier = 'medium';
    let bestCount = 0;
    for (const tier of ALL_TIERS_LOCAL) {
      const c = countByTheme(tier, name);
      if (c > bestCount) {
        bestCount = c;
        bestTier = tier;
      }
    }
    map.set(name, bestTier);
  }
  return map;
})();

export function getThemeDifficulty(theme: string): Tier {
  return THEME_DIFFICULTIES.get(theme) ?? 'medium';
}
