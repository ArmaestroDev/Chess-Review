import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { THEMES, pickFromMultiSelect } from '../../api/catalog';
import { ALL_TIERS } from '../../utils/difficulty';
import { useThemeNames, useTierLabel } from '../../utils/i18nHelpers';
import type { Tier } from '../../types';

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

// Returns null when nothing has been persisted — lets the caller distinguish
// "fresh user" (apply auto-defaults) from "user explicitly deselected
// everything" (honor the empty selection).
function loadFilters(validThemes: ReadonlyArray<string>): PersistedFilters | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
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
    return null;
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
  /** When set + no persisted state, default tier selection to [defaultTier]. */
  defaultTier?: Tier;
}

export function PuzzleFilters({ excludeIds, defaultTier }: Props) {
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

  // Hydrate once on mount. If no localStorage entry exists, fall back to
  // sensible defaults: the user's current tier (if provided) and every theme
  // selected, so the page-level Start CTA works on first paint.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const persisted = loadFilters(skillThemes);
    if (persisted === null) {
      setSelectedTiers(
        defaultTier ? new Set<Tier>([defaultTier]) : new Set<Tier>(ALL_TIERS),
      );
      setSelectedThemes(new Set<string>(skillThemes));
    } else {
      setSelectedTiers(new Set(persisted.tiers));
      setSelectedThemes(new Set(persisted.themes));
    }
    setHydrated(true);
  }, [skillThemes, defaultTier]);

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

  // Surface the "no puzzles match" hint when the user's selection probes
  // empty. The page-level Start CTA owns the actual pick; this component only
  // manages selection state + persistence.
  const [probeNoMatch, setProbeNoMatch] = useState(false);
  useEffect(() => {
    if (selectedTiers.size === 0 || selectedThemes.size === 0) {
      setProbeNoMatch(false);
      return;
    }
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
        setProbeNoMatch(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTiers, selectedThemes, excludeIds]);

  const showEmptyHint =
    selectedTiers.size > 0 && selectedThemes.size > 0 && probeNoMatch;

  return (
    <div className="cr-card">
      <div className="px-4 pt-4 pb-4 flex flex-col gap-4">
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
