import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pickFromMultiSelect } from '../../api/catalog';
import { ALL_TIERS } from '../../utils/difficulty';
import { SKILL_THEMES } from '../../utils/filters';
import { useThemeNames, useTierLabel } from '../../utils/i18nHelpers';
import type { HubFilters } from '../../hooks/useHubFilters';
import type { Tier } from '../../types';

interface Props {
  filters: HubFilters;
  excludeIds: ReadonlyArray<string>;
}

export function PuzzleFilters({ filters, excludeIds }: Props) {
  const { t } = useTranslation();
  const tierLabel = useTierLabel();
  const themeName = useThemeNames();
  const {
    selectedTiers,
    selectedThemes,
    toggleTier,
    toggleTheme,
    selectAllTiers,
    deselectAllTiers,
    selectAllThemes,
    deselectAllThemes,
  } = filters;

  // Surface the "no puzzles match" hint when the user's selection probes
  // empty. The page-level Start CTA owns the actual pick; this component only
  // surfaces the hint in the panel.
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
    // flex-1 + min-h-0 lets the panel grow to fill the right column's
    // remaining space (AppLayout pins the page to the viewport). The inner
    // wrapper gets the y-scroll so the panel itself stops at the visible
    // bottom and the user scrolls *inside* it.
    <div className="cr-card flex flex-col flex-1 min-h-0">
      <div className="px-4 pt-4 pb-4 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
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
              allOn={selectedThemes.size === SKILL_THEMES.length}
              onSelectAll={selectAllThemes}
              onDeselectAll={deselectAllThemes}
            />
          </div>
          <div className="pz-filter-themes">
            {SKILL_THEMES.map((theme) => (
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

// Re-exported for callers that still want the bare type.
export type { Tier };
