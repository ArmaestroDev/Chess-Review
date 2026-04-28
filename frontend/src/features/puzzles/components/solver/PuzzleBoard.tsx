import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Board } from '../../../../shared/components/Board';
import type { SessionState } from '../../types';

interface Props {
  state: SessionState;
  fen: string;
  size: number;
  orientation: 'white' | 'black';
  userColor: 'white' | 'black';
  highlights: { square: string; color?: string }[];
  onMove: (uci: string) => void;
  /**
   * When true, the board is read-only regardless of state. Used by the mobile
   * solver's preview navigation so the user can step backward through the
   * line without being able to play moves from a past position.
   */
  frozen?: boolean;
}

type Feedback = { tone: 'correct' | 'wrong'; text: string } | null;
const FEEDBACK_DURATION_MS = 1400;

export function PuzzleBoard({
  state,
  fen,
  size,
  orientation,
  userColor,
  highlights,
  onMove,
  frozen = false,
}: Props) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<Feedback>(null);
  // Drive the toast off state-machine transitions:
  //  - animating-opponent-reply → correct user move
  //  - failed → wrong move
  //  - revealing → solution being walked through
  //  - completed (solve) → solved!
  useEffect(() => {
    if (state.kind === 'animating-opponent-reply') {
      setFeedback({ tone: 'correct', text: t('puzzles.solver.feedback.correct') });
    } else if (state.kind === 'failed') {
      setFeedback({ tone: 'wrong', text: t('puzzles.solver.feedback.wrong') });
    } else if (state.kind === 'revealing') {
      setFeedback({ tone: 'wrong', text: t('puzzles.solver.feedback.solution') });
    } else if (state.kind === 'completed' && state.result === 'solve') {
      setFeedback({ tone: 'correct', text: t('puzzles.solver.feedback.solved') });
    }
  }, [state.kind]);

  useEffect(() => {
    if (!feedback) return;
    const tm = window.setTimeout(
      () => setFeedback(null),
      FEEDBACK_DURATION_MS,
    );
    return () => window.clearTimeout(tm);
  }, [feedback]);

  const playable = !frozen && state.kind === 'awaiting-user-move';
  const playableColor: 'w' | 'b' = userColor === 'white' ? 'w' : 'b';

  return (
    <div className="pz-board-wrap" style={{ width: size, height: size }}>
      <Board
        fen={fen}
        size={size}
        orientation={orientation}
        highlightedSquares={highlights}
        playableColor={playableColor}
        onMove={playable ? onMove : undefined}
      />
      {feedback && (
        <div className={`pz-feedback ${feedback.tone}`}>{feedback.text}</div>
      )}
    </div>
  );
}
