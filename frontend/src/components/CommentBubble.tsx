import type { MoveAnalysis } from '../types';
import {
  ClassificationIcon,
  classificationLabel,
} from './ClassificationIcon';
import { formatScore } from '../utils/winProb';

interface Props {
  move: MoveAnalysis | null;
  isInitial?: boolean;
}

const FLAVOR: Record<string, (m: MoveAnalysis) => string> = {
  brilliant: () => 'A brilliant find — material on offer but the position justifies it.',
  great: (m) => `${m.san} was the only move keeping the position together.`,
  best: (m) => `${m.san} is the engine's top choice.`,
  good: (m) => `${m.san} is a solid choice; the eval barely budges.`,
  ok: () => 'Reasonable, but a stronger move was available.',
  book: () => 'Theory — a known opening continuation.',
  inaccuracy: (m) => `${m.san} is an inaccuracy. ${pointAtBest(m)}`,
  mistake: (m) => `${m.san} is a mistake. ${pointAtBest(m)}`,
  blunder: (m) => `${m.san} is a blunder. ${pointAtBest(m)}`,
};

function pointAtBest(m: MoveAnalysis): string {
  if (!m.bestMoveSan) return '';
  return `Better was ${m.bestMoveSan}.`;
}

export function CommentBubble({ move, isInitial }: Props) {
  if (isInitial) {
    return (
      <div className="cr-card">
        <div className="cr-card-hd">
          <div className="cr-card-title">Coach</div>
        </div>
        <div className="px-4 pb-4 flex gap-3">
          <CoachAvatar />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] leading-[1.5] text-ink-2 m-0">
              Load a PGN to see every move classified, or drag a piece on the board to start a free-play game.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!move) {
    return (
      <div className="cr-card">
        <div className="cr-card-hd">
          <div className="cr-card-title">Coach</div>
        </div>
        <div className="px-4 pb-4 flex gap-3">
          <CoachAvatar />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] leading-[1.5] text-ink-3 m-0 italic">
              Pick a move from the list to see commentary.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const flavor = FLAVOR[move.classification]?.(move) ?? '';

  return (
    <div className="cr-card">
      <div className="cr-card-hd">
        <div className="cr-card-title">Coach</div>
        <span className="cr-pill cr-pill-mono">
          {formatScore(move.evalAfterWhite)}
        </span>
      </div>
      <div className="px-4 pb-4 flex gap-3">
        <CoachAvatar />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[12px] text-ink-3 mb-1 flex items-center gap-1.5">
            <ClassificationIcon classification={move.classification} size={14} />
            <strong className="text-ink font-semibold">{move.san}</strong>
            <span>· {classificationLabel(move.classification)}</span>
          </div>
          {flavor && (
            <p className="m-0 text-[12.5px] leading-[1.5] text-ink-2 [text-wrap:pretty]">
              {flavor}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CoachAvatar() {
  return (
    <div
      className="flex-shrink-0 w-[30px] h-[30px] rounded-lg flex items-center justify-center text-accent-ink"
      style={{
        background: 'linear-gradient(180deg, #2a2418, #1d1a14)',
        boxShadow:
          'inset 0 1px 0 rgba(255, 220, 150, 0.18), 0 1px 2px rgba(0, 0, 0, 0.3)',
      }}
      aria-hidden
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.5 0 4-2 4-4.5S14.5 3 12 3 8 5 8 7.5 9.5 12 12 12zm0 2c-3.3 0-8 1.6-8 5v2h16v-2c0-3.4-4.7-5-8-5z" />
      </svg>
    </div>
  );
}
