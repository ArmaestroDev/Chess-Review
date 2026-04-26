import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Puzzle } from '../../types';
import { usePuzzleSession } from '../../hooks/usePuzzleSession';
import { useElo } from '../../hooks/useElo';
import { classifyTier } from '../../utils/difficulty';
import { useTierLabel } from '../../utils/i18nHelpers';
import { PuzzleBoard } from './PuzzleBoard';
import { SolverSideRail } from './SolverSideRail';
import { SolverInfoPanel } from './SolverInfoPanel';
import { PuzzleResultPanel } from './PuzzleResultPanel';

interface Props {
  puzzle: Puzzle;
  onNext: () => void;
  onSetOrientation: (o: 'white' | 'black') => void;
  orientation: 'white' | 'black';
}

export function PuzzleSolver({
  puzzle,
  onNext,
  onSetOrientation,
  orientation,
}: Props) {
  const { t } = useTranslation();
  const tierLabel = useTierLabel();
  const session = usePuzzleSession(puzzle);
  const { elo, progress } = useElo();
  const [boardSize, setBoardSize] = useState(560);

  // Retry handler:
  //  - From 'failed': resume at failedAtIdx (NOT move 1)
  //  - From 'completed' (solve / reveal / hint): full restart from move 1
  // ELO doesn't re-commit either way (committedForRef holds this puzzle id).
  const handleRetry = useCallback(() => {
    if (session.state.kind === 'failed') {
      session.retryFromFailure();
    } else {
      session.loadPuzzle(puzzle);
    }
  }, [session, puzzle]);

  // Auto-orient the board to the user's color whenever a new puzzle loads.
  useEffect(() => {
    onSetOrientation(session.userColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.id]);

  // Responsive board sizing — mirror ReviewPage's calculation but with
  // the solver's grid widths (56px rail + 360px right).
  useEffect(() => {
    function update() {
      const railCol = 56;
      const rightCol = 360;
      const gaps = 32;
      const horizPad = 56;
      const usableW = Math.min(window.innerWidth, 1600);
      const availW = usableW - railCol - rightCol - gaps - horizPad;
      const availH = window.innerHeight - 64 - 80 - 40;
      const size = Math.max(320, Math.min(availW, availH, 720));
      setBoardSize(Math.floor(size));
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Solver-scoped keyboard shortcuts. H = hint, R = reveal, Enter / Space = next.
  useEffect(() => {
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
        onNext();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, onNext, handleRetry]);

  const tier = classifyTier(puzzle.rating);
  const isTerminal =
    session.state.kind === 'completed' ||
    session.state.kind === 'failed' ||
    session.state.kind === 'revealing';

  return (
    <div className="pz-solver">
      {/* Top bar */}
      <div className="pz-solver-top">
        <Link to="/puzzles" className="pz-back">
          <ChevronLeft size={14} />
          {t('puzzles.solver.back')}
        </Link>
        <div className="pz-top-meta">
          <span className="pz-top-theme">
            {tierLabel(tier)} · {puzzle.rating}
          </span>
          <span className="pz-top-divider" />
          <span className="cr-pill cr-pill-mono">
            {t('puzzles.solver.rating', { elo })}
          </span>
          <span className="pz-streak">
            <span className="pz-streak-num">{progress.stats.solved}</span>
            <span className="pz-streak-lbl">{t('puzzles.solver.solved')}</span>
          </span>
        </div>
      </div>

      {/* 3-col grid: rail / board / info */}
      <div className="pz-solver-grid">
        <SolverSideRail
          state={session.state}
          onHint={session.requestHint}
          onReveal={session.revealSolution}
          onNext={onNext}
        />

        <div className="flex justify-center min-w-0">
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

        <div className="pz-info">
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
        </div>
      </div>
    </div>
  );
}
