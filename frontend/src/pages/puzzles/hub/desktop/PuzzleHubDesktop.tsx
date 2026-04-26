import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Board } from '../../../../shared/components/Board';
import { IconBtn } from '../../../../shared/components/IconBtn';
import { PlayerStrip } from '../../../../shared/components/PlayerStrip';
import { DailyPuzzleCard } from '../../../../features/puzzles/components/hub/DailyPuzzleCard';
import { ProgressCard } from '../../../../features/puzzles/components/hub/ProgressCard';
import { ActivityBars } from '../../../../features/puzzles/components/hub/ActivityBars';
import { RecentAttemptsCard } from '../../../../features/puzzles/components/hub/RecentAttemptsCard';
import { PuzzleFilters } from '../../../../features/puzzles/components/hub/PuzzleFilters';
import { DailyCalendarModal } from '../../../../features/puzzles/components/hub/DailyCalendarModal';
import { SolverSideRail } from '../../../../features/puzzles/components/solver/SolverSideRail';
import { SolverInfoPanel } from '../../../../features/puzzles/components/solver/SolverInfoPanel';
import { PuzzleResultPanel } from '../../../../features/puzzles/components/solver/PuzzleResultPanel';
import { PuzzleBoard } from '../../../../features/puzzles/components/solver/PuzzleBoard';
import {
  isDailyPuzzleId,
  useDailyPuzzle,
} from '../../../../features/puzzles/hooks/useDailyPuzzle';
import { useElo } from '../../../../features/puzzles/hooks/useElo';
import { usePuzzleSession } from '../../../../features/puzzles/hooks/usePuzzleSession';
import { fetchPuzzleById } from '../../../../features/puzzles/api/fetchPuzzle';
import { pickRespectingFilters } from '../../../../features/puzzles/utils/filters';
import { classifyTier } from '../../../../features/puzzles/utils/difficulty';
import type { Puzzle } from '../../../../features/puzzles/types';
import type { Settings } from '../../../../shared/utils/settings';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface Props {
  settings: Settings;
  orientation: 'white' | 'black';
  setOrientation: (o: 'white' | 'black') => void;
}

export function PuzzleHubDesktop({ settings, orientation, setOrientation }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { puzzle: dailyPuzzle, date: dailyDate } = useDailyPuzzle();
  const { progress } = useElo();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Same-component routing means the openCalendar handoff fires here too.
  useEffect(() => {
    const state = location.state as { openCalendar?: boolean } | null;
    if (state?.openCalendar) {
      setCalendarOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  // Centerpiece board sizing — mirrors ReviewDesktop's formula minus the
  // eval-bar gap. Stays in sync with the .pz-hub-grid track widths.
  const [boardSize, setBoardSize] = useState(560);
  useEffect(() => {
    function update() {
      const leftCol = 320;
      const rightCol = 360;
      const gaps = 40;
      const horizPad = 56;
      const usableW = Math.min(window.innerWidth, 1600);
      const availW = usableW - leftCol - rightCol - gaps - horizPad;
      const availH = window.innerHeight - 64 - 120 - 40;
      const size = Math.max(320, Math.min(availW, availH, 720));
      setBoardSize(Math.floor(size));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Solver-mode puzzle loading. Null in hub mode (id undefined).
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [solverError, setSolverError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) {
      setPuzzle(null);
      setSolverError(null);
      return;
    }
    setPuzzle(null);
    setSolverError(null);
    let cancelled = false;
    fetchPuzzleById(id)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          setSolverError(t('puzzles.solver.errors.notFound'));
          return;
        }
        setPuzzle(p);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSolverError(
          err instanceof Error
            ? err.message
            : t('puzzles.solver.errors.loadFailed'),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  const session = usePuzzleSession(puzzle);

  // When a new puzzle loads, snap orientation to the user's color.
  useEffect(() => {
    if (puzzle) setOrientation(session.userColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle?.id]);

  // Solver-only keyboard shortcuts (H = hint, R = reveal/retry, Enter = next).
  useEffect(() => {
    if (!puzzle) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      const isTerminal =
        session.state.kind === 'completed' || session.state.kind === 'failed';
      const punisherPending =
        session.state.kind === 'failed' &&
        session.state.punisherStatus === 'fetching';
      if (k === 'h' && session.state.kind === 'awaiting-user-move') {
        e.preventDefault();
        session.requestHint();
      } else if (k === 'r' && session.state.kind === 'awaiting-user-move') {
        e.preventDefault();
        session.revealSolution();
      } else if (k === 'r' && isTerminal && !punisherPending) {
        e.preventDefault();
        handleRetry();
      } else if (
        (k === 'enter' || k === ' ') &&
        isTerminal &&
        !punisherPending
      ) {
        e.preventDefault();
        handleNext();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, puzzle]);

  const flipBoard = useCallback(() => {
    setOrientation(orientation === 'white' ? 'black' : 'white');
  }, [orientation, setOrientation]);

  const handleStartDaily = useCallback(() => {
    navigate(`/puzzles/${dailyPuzzle.id}`);
  }, [navigate, dailyPuzzle.id]);

  const handleQuickStart = useCallback(async () => {
    try {
      const pick = await pickRespectingFilters({
        fallbackTier: classifyTier(progress.elo),
        excludeIds: progress.lastSeenPuzzleIds,
      });
      if (pick) navigate(`/puzzles/${pick.id}`);
    } catch (err) {
      console.warn('quickstart pick failed', err);
    }
  }, [navigate, progress.elo, progress.lastSeenPuzzleIds]);

  const handleReplay = useCallback(
    (puzzleId: string) => navigate(`/puzzles/${puzzleId}`),
    [navigate],
  );

  const handleBackToHub = useCallback(() => navigate('/puzzles'), [navigate]);

  const handleNext = useCallback(async () => {
    if (!puzzle) return;
    if (isDailyPuzzleId(puzzle.id)) {
      navigate('/puzzles', { state: { openCalendar: true } });
      return;
    }
    const pick = await pickRespectingFilters({
      fallbackTier: classifyTier(puzzle.rating),
      excludeIds: progress.lastSeenPuzzleIds,
    });
    if (pick) navigate(`/puzzles/${pick.id}`);
    else navigate('/puzzles');
  }, [puzzle, progress.lastSeenPuzzleIds, navigate]);

  const handleRetry = useCallback(() => {
    if (!puzzle) return;
    if (session.state.kind === 'failed') session.retryFromFailure();
    else session.loadPuzzle(puzzle);
  }, [session, puzzle]);

  const inSolver = !!id;
  const centerFen = inSolver ? session.displayFen : STARTING_FEN;
  const sideToMove: 'white' | 'black' =
    centerFen.split(' ')[1] === 'w' ? 'white' : 'black';
  const centerOrientation = orientation;
  const centerHighlights = inSolver ? session.highlights : [];

  return (
    <main className="pz-hub-grid">
      <div className="pz-hub-col">
        {/* Slot above the panels — greeting on the hub, back-to-hub label in
            solver mode. Both share .pz-hub-slot so the column never shifts
            between the two states. */}
        {inSolver ? (
          <button
            type="button"
            onClick={handleBackToHub}
            className="pz-hub-slot pz-hub-slot--back"
          >
            <ArrowLeft size={14} />
            {t('puzzles.hub.actions.backToHub')}
          </button>
        ) : (
          <div className="pz-hub-slot">
            {t('puzzles.hub.greeting', {
              name:
                settings.chessComUsername.trim() ||
                t('puzzles.hub.unknownUser'),
            })}
          </div>
        )}
        <ProgressCard progress={progress} />
        <ActivityBars history={progress.history} />
        <RecentAttemptsCard
          history={progress.history}
          onPickAttempt={handleReplay}
        />
      </div>

      <div className="pz-hub-center">
        <div
          className="flex flex-col gap-2.5 items-stretch"
          style={{ width: boardSize }}
        >
          <PlayerStrip
            color={centerOrientation === 'white' ? 'black' : 'white'}
            name={
              centerOrientation === 'white'
                ? t('review.color.black')
                : t('review.color.white')
            }
            rating={null}
            active={
              inSolver &&
              sideToMove === (centerOrientation === 'white' ? 'black' : 'white')
            }
          />
          <div
            className="relative"
            style={{ width: boardSize, height: boardSize }}
          >
            {inSolver && puzzle ? (
              <PuzzleBoard
                state={session.state}
                fen={centerFen}
                size={boardSize}
                orientation={centerOrientation}
                userColor={session.userColor}
                highlights={centerHighlights}
                onMove={session.submitMove}
              />
            ) : (
              <Board
                fen={centerFen}
                size={boardSize}
                orientation={centerOrientation}
              />
            )}

            {inSolver && !puzzle && !solverError && (
              <div className="absolute inset-0 flex items-center justify-center bg-wood-card/60 rounded-[10px]">
                <Loader2 size={20} className="animate-spin text-ink-3" />
              </div>
            )}

            <div
              className="absolute flex flex-col gap-1.5"
              style={{ left: 'calc(100% + 8px)', top: 0 }}
            >
              <IconBtn onClick={flipBoard} title={t('header.actions.flipBoard')}>
                <ArrowUpDown size={16} />
              </IconBtn>
            </div>
          </div>
          <PlayerStrip
            color={centerOrientation === 'white' ? 'white' : 'black'}
            name={
              centerOrientation === 'white'
                ? t('review.color.white')
                : t('review.color.black')
            }
            rating={null}
            active={
              inSolver &&
              sideToMove === (centerOrientation === 'white' ? 'white' : 'black')
            }
          />
        </div>
      </div>

      <div className="pz-hub-col">
        {inSolver ? (
          <>
            <SolverRightPanel
              puzzle={puzzle}
              session={session}
              error={solverError}
              onNext={handleNext}
              onRetry={handleRetry}
            />
            {puzzle && !solverError && (
              <SolverSideRail
                state={session.state}
                onHint={session.requestHint}
                onReveal={session.revealSolution}
                onNext={handleNext}
              />
            )}
          </>
        ) : (
          <>
            <DailyPuzzleCard
              puzzle={dailyPuzzle}
              date={dailyDate}
              onStart={handleStartDaily}
              onViewCalendar={() => setCalendarOpen(true)}
              showBoard={false}
            />

            <div className="pz-quick-card">
              <div className="pz-quick-card-body">
                <button
                  type="button"
                  onClick={handleQuickStart}
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
                excludeIds={progress.lastSeenPuzzleIds}
                defaultTier={classifyTier(progress.elo)}
              />
            )}
          </>
        )}
      </div>

      <DailyCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
      />
    </main>
  );
}

function SolverRightPanel({
  puzzle,
  session,
  error,
  onNext,
  onRetry,
}: {
  puzzle: Puzzle | null;
  session: ReturnType<typeof usePuzzleSession>;
  error: string | null;
  onNext: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  if (error) {
    return (
      <div className="cr-card p-5">
        <div className="font-serif text-[15px] font-semibold mb-1">
          {t('puzzles.solver.errors.title')}
        </div>
        <div className="text-ink-3 text-[12px]">{error}</div>
      </div>
    );
  }
  if (!puzzle) return null;
  const s = session.state;
  if (s.kind === 'completed') {
    return (
      <PuzzleResultPanel
        puzzle={s.puzzle}
        result={s.result}
        delta={s.delta}
        hintUsed={s.hintUsed}
        onNext={onNext}
        onRetry={onRetry}
      />
    );
  }
  if (s.kind === 'failed') {
    return (
      <PuzzleResultPanel
        puzzle={s.puzzle}
        result={s.hintUsed ? 'hint' : 'fail'}
        delta={s.delta}
        hintUsed={s.hintUsed}
        onNext={onNext}
        onRetry={onRetry}
        punisherPending={s.punisherStatus === 'fetching'}
      />
    );
  }
  if (s.kind === 'revealing') {
    return (
      <PuzzleResultPanel
        puzzle={s.puzzle}
        result="reveal"
        delta={s.delta}
        hintUsed={s.hintUsed}
        onNext={onNext}
        onRetry={onRetry}
      />
    );
  }
  return (
    <SolverInfoPanel
      state={s}
      puzzle={puzzle}
      userColor={session.userColor}
    />
  );
}
