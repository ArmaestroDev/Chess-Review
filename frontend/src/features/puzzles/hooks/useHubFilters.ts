// Lifted-state hook for the hub's tier/theme picker. The page (not the
// PuzzleFilters panel) owns the selection so the Quick Start button can be
// gated on it — disabled whenever no tier or no theme is selected. The panel
// is rendered conditionally; lifting state above it keeps the gate working
// even when the panel isn't mounted.
//
// Hydrates from localStorage on mount. If nothing was persisted, falls back
// to [defaultTier] (or ALL_TIERS) + ALL_SKILL_THEMES so a fresh user can
// click Start without first opening the panel. Persists user-initiated
// changes only — the initial defaults stay out of localStorage so other
// callers can still distinguish "fresh user" from "user deselected
// everything".

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tier } from '../types';
import { ALL_TIERS } from '../utils/difficulty';
import {
  SKILL_THEMES,
  loadPersistedFilters,
  savePersistedFilters,
} from '../utils/filters';

interface Options {
  /** When set + no persisted state, default tier selection to [defaultTier]. */
  defaultTier?: Tier;
}

export function useHubFilters({ defaultTier }: Options = {}) {
  const [selectedTiers, setSelectedTiers] = useState<ReadonlySet<Tier>>(
    () => new Set<Tier>(),
  );
  const [selectedThemes, setSelectedThemes] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [hydrated, setHydrated] = useState(false);

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const persisted = loadPersistedFilters();
    if (persisted === null) {
      setSelectedTiers(
        defaultTier ? new Set<Tier>([defaultTier]) : new Set<Tier>(ALL_TIERS),
      );
      setSelectedThemes(new Set<string>(SKILL_THEMES));
    } else {
      setSelectedTiers(new Set(persisted.tiers));
      setSelectedThemes(new Set(persisted.themes));
    }
    setHydrated(true);
  }, [defaultTier]);

  // Persist user-initiated changes only — gated on hydrated so the empty
  // initial state never overwrites real saved data.
  useEffect(() => {
    if (!hydrated) return;
    savePersistedFilters({
      tiers: Array.from(selectedTiers),
      themes: Array.from(selectedThemes),
    });
  }, [hydrated, selectedTiers, selectedThemes]);

  const toggleTier = useCallback((tier: Tier) => {
    setSelectedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }, []);

  const toggleTheme = useCallback((theme: string) => {
    setSelectedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return next;
    });
  }, []);

  const selectAllTiers = useCallback(
    () => setSelectedTiers(new Set<Tier>(ALL_TIERS)),
    [],
  );
  const deselectAllTiers = useCallback(
    () => setSelectedTiers(new Set<Tier>()),
    [],
  );
  const selectAllThemes = useCallback(
    () => setSelectedThemes(new Set<string>(SKILL_THEMES)),
    [],
  );
  const deselectAllThemes = useCallback(
    () => setSelectedThemes(new Set<string>()),
    [],
  );

  const ready =
    hydrated && selectedTiers.size > 0 && selectedThemes.size > 0;

  return {
    hydrated,
    /** True when at least one tier AND one theme are selected. Quick Start
     *  is gated on this. */
    ready,
    selectedTiers,
    selectedThemes,
    toggleTier,
    toggleTheme,
    selectAllTiers,
    deselectAllTiers,
    selectAllThemes,
    deselectAllThemes,
  };
}

export type HubFilters = ReturnType<typeof useHubFilters>;
