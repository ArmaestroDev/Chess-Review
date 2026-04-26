import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DailyPuzzleCard } from '../features/puzzles/components/hub/DailyPuzzleCard';
import { ProgressCard } from '../features/puzzles/components/hub/ProgressCard';
import { ActivityBars } from '../features/puzzles/components/hub/ActivityBars';
import { WeaknessList } from '../features/puzzles/components/hub/WeaknessList';
import { PuzzleFilters } from '../features/puzzles/components/hub/PuzzleFilters';
import { DailyCalendarModal } from '../features/puzzles/components/hub/DailyCalendarModal';
import { useDailyPuzzle } from '../features/puzzles/hooks/useDailyPuzzle';
import { useElo } from '../features/puzzles/hooks/useElo';
import { pickFromCatalog } from '../features/puzzles/api/catalog';

export function PuzzleHubPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { puzzle: dailyPuzzle, date: dailyDate } = useDailyPuzzle();
  const { progress } = useElo();
  const [calendarOpen, setCalendarOpen] = useState(false);

  // The solver redirects to `/puzzles` with `state.openCalendar = true` after
  // a daily-puzzle attempt. Consume that flag once and clear it from history
  // so a refresh doesn't reopen the modal.
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

  const handlePickWeakTheme = useCallback(
    (theme: string) => {
      const pick = pickFromCatalog('medium', {
        theme,
        excludeIds: progress.lastSeenPuzzleIds,
      });
      if (pick) navigate(`/puzzles/${pick.id}`);
    },
    [navigate, progress.lastSeenPuzzleIds],
  );

  return (
    <main className="pz-hub">
      <div className="pz-hub-l">
        <DailyPuzzleCard
          puzzle={dailyPuzzle}
          date={dailyDate}
          onStart={handleStartDaily}
          onViewCalendar={() => setCalendarOpen(true)}
        />
        <PuzzleFilters
          excludeIds={progress.lastSeenPuzzleIds}
          onPick={(p) => navigate(`/puzzles/${p.id}`)}
        />
      </div>

      <div className="pz-hub-r">
        <ProgressCard progress={progress} />
        <ActivityBars history={progress.history} />
        <WeaknessList
          history={progress.history}
          onPickTheme={handlePickWeakTheme}
        />
      </div>

      <DailyCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
      />
    </main>
  );
}
