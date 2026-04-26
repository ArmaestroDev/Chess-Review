import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PuzzleSolver } from '../features/puzzles/components/solver/PuzzleSolver';
import { fetchPuzzleById } from '../features/puzzles/api/fetchPuzzle';
import { pickFromCatalog } from '../features/puzzles/api/catalog';
import { classifyTier } from '../features/puzzles/utils/difficulty';
import { useElo } from '../features/puzzles/hooks/useElo';
import { isDailyPuzzleId } from '../features/puzzles/hooks/useDailyPuzzle';
import type { Puzzle } from '../features/puzzles/types';

interface Props {
  orientation: 'white' | 'black';
  setOrientation: (o: 'white' | 'black') => void;
}

export function PuzzleSolverPage({ orientation, setOrientation }: Props) {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { progress } = useElo();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load whenever the route id changes.
  useEffect(() => {
    if (!id) return;
    setPuzzle(null);
    setError(null);

    let cancelled = false;
    // findInCatalog is async (awaits each tier chunk); fetchPuzzleById
    // already calls findInCatalog internally before falling back to /api.
    fetchPuzzleById(id)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          setError(t('puzzles.solver.errors.notFound'));
          return;
        }
        setPuzzle(p);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : t('puzzles.solver.errors.loadFailed'),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  const handleNext = useCallback(async () => {
    if (!puzzle) return;
    // Daily puzzles funnel back to the calendar so the user always
    // continues from a single, predictable home for daily progression.
    if (isDailyPuzzleId(puzzle.id)) {
      navigate('/puzzles', { state: { openCalendar: true } });
      return;
    }
    const tier = classifyTier(puzzle.rating);
    const next = await pickFromCatalog(tier, {
      excludeIds: progress.lastSeenPuzzleIds,
    });
    if (!next) {
      // Catalog miss for this tier — fall back to medium, then to the hub
      // if even medium can't produce a pick (chunk load failure or empty pool).
      const fallback = await pickFromCatalog('medium', {
        excludeIds: progress.lastSeenPuzzleIds,
      });
      if (fallback) {
        navigate(`/puzzles/${fallback.id}`);
      } else {
        navigate('/puzzles');
      }
      return;
    }
    navigate(`/puzzles/${next.id}`);
  }, [puzzle, progress.lastSeenPuzzleIds, navigate]);

  if (error) {
    return (
      <main className="max-w-[1600px] mx-auto w-full px-7 py-10">
        <div className="cr-card p-8 text-center">
          <div className="font-serif text-[18px] font-semibold mb-2">
            {t('puzzles.solver.errors.title')}
          </div>
          <div className="text-ink-3 text-[13px]">{error}</div>
        </div>
      </main>
    );
  }

  if (!puzzle) {
    return (
      <main className="max-w-[1600px] mx-auto w-full px-7 py-10">
        <div className="flex items-center justify-center gap-2 text-ink-3 text-[13px]">
          <Loader2 size={16} className="animate-spin" />
          {t('loading.puzzle')}
        </div>
      </main>
    );
  }

  return (
    <PuzzleSolver
      puzzle={puzzle}
      onNext={handleNext}
      orientation={orientation}
      onSetOrientation={setOrientation}
    />
  );
}
