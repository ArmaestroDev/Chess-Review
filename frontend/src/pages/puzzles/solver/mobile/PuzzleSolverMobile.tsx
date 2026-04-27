import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, Lightbulb, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchPuzzleById } from '../../../../features/puzzles/api/fetchPuzzle';
import { pickRespectingFilters } from '../../../../features/puzzles/utils/filters';
import { useElo } from '../../../../features/puzzles/hooks/useElo';
import { isDailyPuzzleId } from '../../../../features/puzzles/hooks/useDailyPuzzle';
import { usePuzzleSession } from '../../../../features/puzzles/hooks/usePuzzleSession';
import { PuzzleBoard } from '../../../../features/puzzles/components/solver/PuzzleBoard';
import { SolverInfoPanel } from '../../../../features/puzzles/components/solver/SolverInfoPanel';
import { PuzzleResultPanel } from '../../../../features/puzzles/components/solver/PuzzleResultPanel';
import {
  usePublishMobileTopBarActions,
  useHideMobileBottomNav,
} from '../../../../shared/components/MobileTopBarContext';
import type { Puzzle } from '../../../../features/puzzles/types';

interface Props {
  orientation: 'white' | 'black';
  setOrientation: (o: 'white' | 'black') => void;
}

export function PuzzleSolverMobile({ orientation, setOrientation }: Props) {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { progress } = useElo();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Same load-by-id flow as the desktop variant.
  useEffect(() => {
    if (!id) return;
    setPuzzle(null);
    setError(null);
    let cancelled = false;
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
    if (isDailyPuzzleId(puzzle.id)) {
      navigate('/puzzles', { state: { openCalendar: true } });
      return;
    }
    const pick = await pickRespectingFilters({
      excludeIds: progress.lastSeenPuzzleIds,
    });
    if (pick) navigate(`/puzzles/${pick.id}`);
    else navigate('/puzzles');
  }, [puzzle, progress.lastSeenPuzzleIds, navigate]);

  if (error) {
    return (
      <main className="cr-mobile-main">
        <div className="cr-mobile-page">
          <div className="cr-card p-6 text-center">
            <div className="font-serif text-[16px] font-semibold mb-2">
              {t('puzzles.solver.errors.title')}
            </div>
            <div className="text-ink-3 text-[13px]">{error}</div>
          </div>
        </div>
      </main>
    );
  }

  if (!puzzle) {
    return (
      <main className="cr-mobile-main">
        <div className="cr-mobile-page">
          <div className="flex items-center justify-center gap-2 text-ink-3 text-[13px] py-10">
            <Loader2 size={16} className="animate-spin" />
            {t('loading.puzzle')}
          </div>
        </div>
      </main>
    );
  }

  return (
    <PuzzleSolverMobileInner
      puzzle={puzzle}
      onNext={handleNext}
      orientation={orientation}
      setOrientation={setOrientation}
    />
  );
}

interface InnerProps {
  puzzle: Puzzle;
  onNext: () => void;
  orientation: 'white' | 'black';
  setOrientation: (o: 'white' | 'black') => void;
}

function PuzzleSolverMobileInner({
  puzzle,
  onNext,
  orientation,
  setOrientation,
}: InnerProps) {
  const { t } = useTranslation();
  const session = usePuzzleSession(puzzle);
  const { elo, progress } = useElo();

  // Clear is not applicable — Reset lives inside the result panel instead.
  usePublishMobileTopBarActions({
    flipBoard: () => setOrientation(orientation === 'white' ? 'black' : 'white'),
    clearBoard: null,
  });

  // Hide the bottom MobileNav while solving — the action row below replaces it.
  useHideMobileBottomNav(true);

  const handleRetry = useCallback(() => {
    if (session.state.kind === 'failed') {
      session.retryFromFailure();
    } else {
      session.loadPuzzle(puzzle);
    }
  }, [session, puzzle]);

  // Auto-orient the board to the user's color whenever a new puzzle loads.
  useEffect(() => {
    setOrientation(session.userColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.id]);

  // Mobile board: fill available width, but also clamp by available height so
  // the board doesn't overflow on short viewports. Reserves are approximate
  // (topbar, page padding, meta row, info panel, solved footer, action
  // buttons, gaps, safe area) — we deliberately don't measure the DOM. The
  // 220px floor prefers a shrunken board over vertical overflow on landscape
  // phones / split screens.
  const [boardSize, setBoardSize] = useState(320);
  useEffect(() => {
    function update() {
      const availW = Math.min(window.innerWidth - 20, 720);
      // Chrome reserve when bottom nav is hidden + buttons are bigger:
      // ~50 topbar + 16 page padding + 26 meta row + 120 info panel +
      // 16 solved footer + 56 bottom buttons + 40 gaps + 16 safe-area ≈ 340
      const availH = window.innerHeight - 340;
      const size = Math.max(220, Math.min(availW, availH));
      setBoardSize(Math.floor(size));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const isTerminal =
    session.state.kind === 'completed' ||
    session.state.kind === 'failed' ||
    session.state.kind === 'revealing';
  const punisherPending =
    session.state.kind === 'failed' &&
    session.state.punisherStatus === 'fetching';
  const solving =
    session.state.kind === 'awaiting-user-move' ||
    session.state.kind === 'animating-opponent-reply';
  const hintActive =
    session.state.kind === 'awaiting-user-move' && session.state.hintLevel > 0;

  return (
    <main
      className="cr-mobile-main"
      style={{ overflow: 'hidden', paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      <div
        className="cr-mobile-page"
        style={{ gap: 8, padding: '8px 10px', flex: 1, minHeight: 0 }}
      >
        {/* Top meta row */}
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/puzzles"
            className="inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink"
          >
            <ChevronLeft size={14} />
            {t('puzzles.solver.back')}
          </Link>
          <span className="cr-pill cr-pill-mono text-[11px] text-ink-3">
            {t('puzzles.solver.rating', { elo })}
          </span>
        </div>

        {/* Info / result panel */}
        {isTerminal && session.state.kind === 'completed' ? (
          <PuzzleResultPanel
            puzzle={session.state.puzzle}
            result={session.state.result}
            delta={session.state.delta}
            hintUsed={session.state.hintUsed}
            onNext={onNext}
            onRetry={handleRetry}
          />
        ) : isTerminal && session.state.kind === 'failed' ? (
          <PuzzleResultPanel
            puzzle={session.state.puzzle}
            result={session.state.hintUsed ? 'hint' : 'fail'}
            delta={session.state.delta}
            hintUsed={session.state.hintUsed}
            onNext={onNext}
            onRetry={handleRetry}
            punisherPending={session.state.punisherStatus === 'fetching'}
          />
        ) : isTerminal && session.state.kind === 'revealing' ? (
          <PuzzleResultPanel
            puzzle={session.state.puzzle}
            result="reveal"
            delta={session.state.delta}
            hintUsed={session.state.hintUsed}
            onNext={onNext}
            onRetry={handleRetry}
          />
        ) : (
          <SolverInfoPanel
            state={session.state}
            puzzle={puzzle}
            userColor={session.userColor}
          />
        )}

        {/* Board — flex-grow wrapper centers it in the freed vertical space */}
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div
            className="cr-mobile-board-wrap"
            style={{ width: boardSize }}
          >
            <PuzzleBoard
              state={session.state}
              fen={session.displayFen}
              size={boardSize}
              orientation={orientation}
              userColor={session.userColor}
              highlights={session.highlights}
              onMove={session.submitMove}
            />
          </div>
        </div>

        {/* Solved counter — small, above the action row */}
        <div className="text-[10.5px] text-ink-3 text-center">
          {t('puzzles.solver.solved')}: {progress.stats.solved}
        </div>

        {/* Bottom action row — bigger buttons replacing the hidden MobileNav */}
        <div
          className="grid grid-cols-3 gap-2"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        >
          <button
            type="button"
            onClick={session.requestHint}
            disabled={!solving || session.state.kind !== 'awaiting-user-move'}
            className={
              'h-14 inline-flex items-center justify-center gap-2 rounded-[12px] border text-[14px] font-semibold transition-colors ' +
              (hintActive
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-wood-card text-ink-2 hover:bg-wood-hover hover:text-ink disabled:opacity-45')
            }
          >
            <Lightbulb size={20} />
            {t('puzzles.solver.rail.hint')}
          </button>
          <button
            type="button"
            onClick={session.revealSolution}
            disabled={!solving}
            className="h-14 inline-flex items-center justify-center gap-2 rounded-[12px] border border-line bg-wood-card text-ink-2 text-[14px] font-semibold hover:bg-wood-hover hover:text-ink disabled:opacity-45 transition-colors"
          >
            <Eye size={20} />
            {t('puzzles.solver.rail.reveal')}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!isTerminal || punisherPending}
            className="h-14 inline-flex items-center justify-center gap-2 rounded-[12px] border border-line bg-wood-card text-ink-2 text-[14px] font-semibold hover:bg-wood-hover hover:text-ink disabled:opacity-45 transition-colors"
          >
            {t('puzzles.solver.rail.next')}
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </main>
  );
}
