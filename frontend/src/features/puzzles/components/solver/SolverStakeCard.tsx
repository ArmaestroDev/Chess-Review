import { TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Puzzle, PuzzleProgress, SessionState } from '../../types';
import { computeDelta } from '../../utils/elo';
import { useThemeNames } from '../../utils/i18nHelpers';

interface Props {
  puzzle: Puzzle;
  state: SessionState;
  progress: PuzzleProgress;
}

/**
 * Fills the solver's right column between the puzzle prompt and the action
 * bar: what a solve / miss is worth while solving, then the puzzle's themes
 * once it's over (hidden before, since tags like "mateIn2" spoil the answer).
 */
export function SolverStakeCard({ puzzle, state, progress }: Props) {
  const { t } = useTranslation();
  const prettyTheme = useThemeNames();
  if (
    state.kind === 'completed' ||
    state.kind === 'failed' ||
    state.kind === 'revealing'
  ) {
    if (puzzle.themes.length === 0) return null;
    return (
      <div className="cr-card pz-stake">
        <div className="cr-card-hd">
          <div className="cr-card-title">{t('puzzles.solver.stake.themes')}</div>
        </div>
        <div className="pz-stake-themes">
          {puzzle.themes.map((tag) => (
            <span key={tag} className="cr-chip">
              {prettyTheme(tag)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (
    state.kind !== 'awaiting-user-move' &&
    state.kind !== 'animating-opponent-reply'
  ) {
    return null;
  }

  const hintUsed = state.hintUsed;
  const unrated = progress.scoredPuzzleIds.includes(puzzle.id);
  // A hinted attempt commits as 'hint' whether it ends solved or failed.
  const gain = unrated
    ? 0
    : computeDelta(hintUsed ? 'hint' : 'solve', puzzle.rating, progress.elo);
  const loss = unrated
    ? 0
    : computeDelta(hintUsed ? 'hint' : 'fail', puzzle.rating, progress.elo);

  return (
    <div className="cr-card pz-stake">
      <div className="cr-card-hd">
        <div className="cr-card-title">{t('puzzles.solver.stake.title')}</div>
        {(unrated || hintUsed) && (
          <span className="cr-pill">
            {unrated ? t('puzzles.solver.stake.unrated') : t('puzzles.solver.stake.hinted')}
          </span>
        )}
      </div>
      <div className="pz-stake-grid">
        <div className={`pz-stake-tile win ${gain <= 0 ? 'is-zero' : ''}`}>
          <TrendingUp size={16} />
          <div className="pz-stake-num">{formatDelta(gain)}</div>
          <div className="pz-stake-lbl">{t('puzzles.solver.stake.solve')}</div>
        </div>
        <div className={`pz-stake-tile lose ${loss === 0 ? 'is-zero' : ''}`}>
          <TrendingDown size={16} />
          <div className="pz-stake-num">{formatDelta(loss)}</div>
          <div className="pz-stake-lbl">{t('puzzles.solver.stake.miss')}</div>
        </div>
      </div>
      <div className="pz-stake-foot">
        <span>{t('puzzles.solver.stake.you', { elo: progress.elo })}</span>
        <span className="pz-stake-vs">vs</span>
        <span>{t('puzzles.solver.stake.puzzle', { rating: puzzle.rating })}</span>
      </div>
    </div>
  );
}

function formatDelta(n: number): string {
  if (n > 0) return `+${n}`;
  return `−${Math.abs(n)}`;
}
