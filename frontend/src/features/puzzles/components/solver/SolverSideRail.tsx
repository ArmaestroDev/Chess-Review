import { ChevronRight, Eye, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SessionState } from '../../types';

interface Props {
  state: SessionState;
  onHint: () => void;
  onReveal: () => void;
  onNext: () => void;
}

export function SolverSideRail({ state, onHint, onReveal, onNext }: Props) {
  const { t } = useTranslation();
  const solving =
    state.kind === 'awaiting-user-move' ||
    state.kind === 'animating-opponent-reply';
  // Next is enabled in any terminal state, but only AFTER the punisher
  // animation has resolved (so the user actually sees it before advancing).
  const punisherPending =
    state.kind === 'failed' && state.punisherStatus === 'fetching';
  const isTerminal =
    state.kind === 'completed' ||
    state.kind === 'failed' ||
    state.kind === 'revealing';
  const nextEnabled = isTerminal && !punisherPending;
  const hintActive =
    state.kind === 'awaiting-user-move' && state.hintLevel > 0;

  return (
    <div className="pz-rail-l">
      <button
        type="button"
        onClick={onHint}
        disabled={!solving || state.kind !== 'awaiting-user-move'}
        className={`pz-rail-btn ${hintActive ? 'active' : ''}`}
        title={t('puzzles.solver.rail.hintTitle')}
      >
        <Lightbulb size={18} />
        <span>{t('puzzles.solver.rail.hint')}</span>
      </button>

      <button
        type="button"
        onClick={onReveal}
        disabled={!solving}
        className="pz-rail-btn"
        title={t('puzzles.solver.rail.revealTitle')}
      >
        <Eye size={18} />
        <span>{t('puzzles.solver.rail.reveal')}</span>
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={!nextEnabled}
        className="pz-rail-btn"
        title={t('puzzles.solver.rail.nextTitle')}
      >
        <ChevronRight size={18} />
        <span>{t('puzzles.solver.rail.next')}</span>
      </button>
    </div>
  );
}
