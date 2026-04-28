import { Eye, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SessionState } from '../../types';

interface Props {
  state: SessionState;
  onHint: () => void;
  onReveal: () => void;
}

export function SolverSideRail({ state, onHint, onReveal }: Props) {
  const { t } = useTranslation();
  const solving =
    state.kind === 'awaiting-user-move' ||
    state.kind === 'animating-opponent-reply';
  const hintActive =
    state.kind === 'awaiting-user-move' && state.hintLevel > 0;

  return (
    <div className="pz-actions-bar">
      <button
        type="button"
        onClick={onHint}
        disabled={!solving || state.kind !== 'awaiting-user-move'}
        className={`pz-action-btn ${hintActive ? 'active' : ''}`}
        title={t('puzzles.solver.rail.hintTitle')}
      >
        <Lightbulb size={16} />
        <span>{t('puzzles.solver.rail.hint')}</span>
      </button>

      <button
        type="button"
        onClick={onReveal}
        disabled={!solving}
        className="pz-action-btn"
        title={t('puzzles.solver.rail.revealTitle')}
      >
        <Eye size={16} />
        <span>{t('puzzles.solver.rail.reveal')}</span>
      </button>
    </div>
  );
}
