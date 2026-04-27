import { useTranslation } from 'react-i18next';
import type { Puzzle, SessionState } from '../../types';
import { classifyTier } from '../../utils/difficulty';
import { useTierLabel } from '../../utils/i18nHelpers';

interface Props {
  state: SessionState;
  puzzle: Puzzle;
  userColor: 'white' | 'black';
}

export function SolverInfoPanel({ state, puzzle, userColor }: Props) {
  const { t } = useTranslation();
  const tierLabel = useTierLabel();
  const tier = classifyTier(puzzle.rating);
  const sideToMove = userColorPrompt(state, userColor, t);
  const hintText = hintFor(state, puzzle, t);

  return (
    <div className="cr-card pz-info-card">
      <div className="cr-card-hd">
        <div className="cr-card-title">{t('puzzles.solver.info.title')}</div>
        <span className="cr-pill cr-pill-mono">
          {tierLabel(tier)} · {puzzle.rating}
        </span>
      </div>

      <div className="pz-info-body">
        <div className="pz-prompt">
          {state.kind === 'awaiting-user-move' ? (
            <span
              className={
                'inline-flex items-center justify-center w-4 h-4 rounded-[4px] text-[12px] font-semibold border border-line-2 mt-0.5 shrink-0 ' +
                (userColor === 'white'
                  ? 'bg-stone-100 text-stone-900'
                  : 'bg-stone-900 text-stone-100')
              }
              aria-hidden
            >
              {userColor === 'white' ? '♔' : '♚'}
            </span>
          ) : (
            <span className="pz-prompt-bullet" />
          )}
          <span>{sideToMove}</span>
        </div>

        {hintText && (
          <div className="pz-hint">
            <div className="pz-hint-label">{t('puzzles.solver.hint.label')}</div>
            <div className="pz-hint-text">{hintText}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function userColorPrompt(
  state: SessionState,
  userColor: 'white' | 'black',
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  switch (state.kind) {
    case 'awaiting-user-move':
      return userColor === 'white'
        ? t('puzzles.solver.prompt.yourMoveWhite')
        : t('puzzles.solver.prompt.yourMoveBlack');
    case 'animating-opponent-reply':
      return t('puzzles.solver.prompt.opponentMoving');
    case 'completed':
      return t('puzzles.solver.prompt.complete');
    case 'loading':
      return t('puzzles.solver.prompt.loading');
    case 'error':
      return state.message;
    default:
      return '';
  }
}

function hintFor(
  state: SessionState,
  puzzle: { moves: string[] },
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  if (state.kind !== 'awaiting-user-move') return null;
  if (state.hintLevel < 1) return null;
  const expected = puzzle.moves[state.nextMoveIdx];
  if (!expected) return null;
  if (state.hintLevel === 1) {
    return t('puzzles.solver.hint.level1', { square: expected.slice(0, 2) });
  }
  if (state.hintLevel === 2) {
    return t('puzzles.solver.hint.level2', {
      from: expected.slice(0, 2),
      to: expected.slice(2, 4),
    });
  }
  return t('puzzles.solver.hint.level3', { move: expected });
}
