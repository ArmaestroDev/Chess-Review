import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { THEMES, pickFromMultiSelect } from '../../api/catalog';
import { ALL_TIERS } from '../../utils/difficulty';
import { useThemeNames, useTierLabel } from '../../utils/i18nHelpers';
import type { Puzzle, Tier } from '../../types';

// Descriptor themes that aren't useful as filters — same set as the old
// ThemeGrid filtered out.
const FILTER_THEMES = new Set([
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

const STORAGE_KEY = 'chess-engine-puzzle-filters';

interface PersistedFilters {
  tiers: Tier[];
  themes: string[];
}

function loadFilters(validThemes: ReadonlyArray<string>): PersistedFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tiers: [], themes: [] };
    const parsed = JSON.parse(raw) as Partial<PersistedFilters>;
    const tierSet = new Set(ALL_TIERS as ReadonlyArray<string>);
    const themeSet = new Set(validThemes);
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
    return { tiers: [], themes: [] };
  }
}

function saveFilters(f: PersistedFilters): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

interface Props {
  excludeIds: ReadonlyArray<string>;
  onPick: (puzzle: Puzzle) => void;
}

export function PuzzleFilters({ excludeIds, onPick }: Props) {
  const { t } = useTranslation();
  const tierLabel = useTierLabel();
  const themeName = useThemeNames();

  const skillThemes = useMemo(
    () => THEMES.filter((th) => !FILTER_THEMES.has(th.name)).map((th) => th.name),
    [],
  );

  const [selectedTiers, setSelectedTiers] = useState<ReadonlySet<Tier>>(
    () => new Set<Tier>(),
  );
  const [selectedThemes, setSelectedThemes] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [hydrated, setHydrated] = useState(false);

  // Hydrate once on mount; defer to avoid SSR pitfalls and to keep the first
  // render cheap.
  useEffect(() => {
    const persisted = loadFilters(skillThemes);
    setSelectedTiers(new Set(persisted.tiers));
    setSelectedThemes(new Set(persisted.themes));
    setHydrated(true);
  }, [skillThemes]);

  // Persist whenever the user toggles something — but only after hydration so
  // we don't immediately overwrite saved state with the empty initial set.
  useEffect(() => {
    if (!hydrated) return;
    saveFilters({
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
    () => setSelectedThemes(new Set<string>(skillThemes)),
    [skillThemes],
  );
  const deselectAllThemes = useCallback(
    () => setSelectedThemes(new Set<string>()),
    [],
  );

  // Disable Start when either set is empty OR when no puzzle matches the
  // selected combination. We probe pickFromMultiSelect (now async — tier
  // chunks are dynamic-imported) and stash the result in state. While probing,
  // we treat the button as "tentatively enabled" if both selections are
  // non-empty so the UI doesn't flicker every time the user toggles a chip.
  const [probeNoMatch, setProbeNoMatch] = useState(false);
  useEffect(() => {
    if (selectedTiers.size === 0 || selectedThemes.size === 0) {
      setProbeNoMatch(false);
      return;
    }
    // Reset to "tentatively enabled" while probing so a stale verdict from
    // the previous selection doesn't keep the button disabled mid-probe.
    setProbeNoMatch(false);
    let cancelled = false;
    pickFromMultiSelect({
      tiers: Array.from(selectedTiers),
      themes: Array.from(selectedThemes),
      excludeIds,
    })
      .then((pick) => {
        if (!cancelled) setProbeNoMatch(pick === null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[PuzzleFilters] probe failed', err);
        // Don't permanently disable on import failure — handleStart's
        // null-check is the real guard.
        setProbeNoMatch(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTiers, selectedThemes, excludeIds]);

  const startDisabled =
    selectedTiers.size === 0 || selectedThemes.size === 0 || probeNoMatch;

  const showEmptyHint =
    selectedTiers.size > 0 && selectedThemes.size > 0 && probeNoMatch;

  async function handleStart() {
    if (startDisabled) return;
    const pick = await pickFromMultiSelect({
      tiers: Array.from(selectedTiers),
      themes: Array.from(selectedThemes),
      excludeIds,
    });
    // Re-check guards against a race where excludeIds shifted under us.
    if (pick) onPick(pick);
  }

  return (
    <div className="cr-card">
      <div className="cr-card-hd">
        <div className="cr-card-title">{t('puzzles.hub.filters.title')}</div>
        <button
          type="button"
          onClick={handleStart}
          disabled={startDisabled}
          className="pz-filter-cta"
        >
          <Play size={13} />
          {t('puzzles.hub.filters.start')}
        </button>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-4">
        <section>
          <div className="pz-filter-section-hd">
            <div className="pz-filter-section-lbl">
              {t('puzzles.hub.filters.difficulties')}
            </div>
            <SelectAllControls
              allOn={selectedTiers.size === ALL_TIERS.length}
              onSelectAll={selectAllTiers}
              onDeselectAll={deselectAllTiers}
            />
          </div>
          <div className="pz-filter-tiers">
            {ALL_TIERS.map((tier) => (
              <TierPill
                key={tier}
                label={tierLabel(tier)}
                selected={selectedTiers.has(tier)}
                onClick={() => toggleTier(tier)}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="pz-filter-section-hd">
            <div className="pz-filter-section-lbl">
              {t('puzzles.hub.filters.themes')}
            </div>
            <SelectAllControls
              allOn={selectedThemes.size === skillThemes.length}
              onSelectAll={selectAllThemes}
              onDeselectAll={deselectAllThemes}
            />
          </div>
          <div className="pz-filter-themes">
            {skillThemes.map((theme) => (
              <ThemeTile
                key={theme}
                label={themeName(theme)}
                selected={selectedThemes.has(theme)}
                onClick={() => toggleTheme(theme)}
              />
            ))}
          </div>
        </section>

        {showEmptyHint && (
          <div className="pz-filter-empty">{t('puzzles.hub.filters.empty')}</div>
        )}
      </div>
    </div>
  );
}

function TierPill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`pz-filter-pill${selected ? ' on' : ''}`}
    >
      {label}
    </button>
  );
}

function ThemeTile({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`pz-filter-theme${selected ? ' on' : ''}`}
    >
      <span className="pz-filter-theme-check" aria-hidden="true">
        {selected ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      <span className="pz-filter-theme-label">{label}</span>
    </button>
  );
}

function SelectAllControls({
  allOn,
  onSelectAll,
  onDeselectAll,
}: {
  allOn: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={allOn ? onDeselectAll : onSelectAll}
      className="pz-filter-selectall"
    >
      {allOn
        ? t('puzzles.hub.filters.deselectAll')
        : t('puzzles.hub.filters.selectAll')}
    </button>
  );
}
