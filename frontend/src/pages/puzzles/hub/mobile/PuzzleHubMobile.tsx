import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DailyPuzzleCard } from '../../../../features/puzzles/components/hub/DailyPuzzleCard';
import { ProgressCard } from '../../../../features/puzzles/components/hub/ProgressCard';
import { ActivityBars } from '../../../../features/puzzles/components/hub/ActivityBars';
import { RecentAttemptsCard } from '../../../../features/puzzles/components/hub/RecentAttemptsCard';
import { PuzzleFilters } from '../../../../features/puzzles/components/hub/PuzzleFilters';
import { DailyCalendarModal } from '../../../../features/puzzles/components/hub/DailyCalendarModal';
import { useDailyPuzzle } from '../../../../features/puzzles/hooks/useDailyPuzzle';
import { useElo } from '../../../../features/puzzles/hooks/useElo';
import { useHubFilters } from '../../../../features/puzzles/hooks/useHubFilters';
import { pickFromMultiSelect } from '../../../../features/puzzles/api/catalog';
import { classifyTier } from '../../../../features/puzzles/utils/difficulty';
import { usePublishMobileTopBarActions } from '../../../../shared/components/MobileTopBarContext';

export function PuzzleHubMobile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { puzzle: dailyPuzzle, date: dailyDate } = useDailyPuzzle();
  const { progress } = useElo();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = useHubFilters({ defaultTier: classifyTier(progress.elo) });

  // Hub has no flip/clear targets — explicitly null so a stale solver action
  // doesn't linger in the topbar after navigating back here.
  usePublishMobileTopBarActions({ flipBoard: null, clearBoard: null });

  // Mirrors PuzzleHubDesktop: consume the openCalendar flag once and clear it.
  useEffect(() => {
    const state = location.state as { openCalendar?: boolean } | null;
    if (state?.openCalendar) {
      setCalendarOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  const handleStartDaily = useCallback(() => {
    navigate(`/puzzles/${dailyPuzzle.id}`);
  }, [navigate, dailyPuzzle.id]);

  const handleReplay = useCallback(
    (puzzleId: string) => navigate(`/puzzles/${puzzleId}`),
    [navigate],
  );

  const handleQuickStart = useCallback(async () => {
    if (!filters.ready) return;
    try {
      const pick = await pickFromMultiSelect({
        tiers: Array.from(filters.selectedTiers),
        themes: Array.from(filters.selectedThemes),
        excludeIds: progress.lastSeenPuzzleIds,
      });
      if (pick) navigate(`/puzzles/${pick.id}`);
    } catch (err) {
      console.warn('quickstart pick failed', err);
    }
  }, [
    filters.ready,
    filters.selectedTiers,
    filters.selectedThemes,
    navigate,
    progress.lastSeenPuzzleIds,
  ]);

  return (
    <main className="cr-mobile-main">
      <div className="cr-mobile-page">
        <DailyPuzzleCard
          puzzle={dailyPuzzle}
          date={dailyDate}
          onStart={handleStartDaily}
          onViewCalendar={() => setCalendarOpen(true)}
        />

        <div className="pz-quick-card">
          <div className="pz-quick-card-body">
            <button
              type="button"
              onClick={handleQuickStart}
              disabled={!filters.ready}
              className="pz-hero-cta w-full"
            >
              <Play size={16} />
              {t('puzzles.hub.quickStart')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="pz-quick-card-trigger"
            aria-expanded={filtersOpen}
          >
            <span>{t('puzzles.hub.filters.adjustHeader')}</span>
            {filtersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {filtersOpen && (
          <PuzzleFilters
            filters={filters}
            excludeIds={progress.lastSeenPuzzleIds}
          />
        )}

        <ProgressCard progress={progress} />
        <ActivityBars history={progress.history} />
        <RecentAttemptsCard
          history={progress.history}
          onPickAttempt={handleReplay}
        />

        <DailyCalendarModal
          open={calendarOpen}
          onClose={() => setCalendarOpen(false)}
        />
      </div>
    </main>
  );
}
