import type { MoveAnalysis } from '../types';
import {
  ClassificationIcon,
  classificationLabel,
} from './ClassificationIcon';
import { formatScore } from '../utils/winProb';

interface Props {
  move: MoveAnalysis | null;
  isInitial: boolean;
}

const FLAVOR: Record<string, (m: MoveAnalysis) => string> = {
  brilliant: () => 'A brilliant find — material on offer but the position justifies it.',
  great: (m) => `${m.san} was the only move keeping the position together.`,
  best: (m) => `${m.san} is the engine’s top choice.`,
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
      <div className="flex items-start gap-3 px-4 pt-4">
        <Avatar />
        <div className="flex-1 rounded-2xl bg-stone-100 text-stone-900 px-4 py-3 shadow">
          <div className="font-bold">Game Review</div>
          <div className="text-sm text-stone-700">
            Load a PGN to see every move classified.
          </div>
        </div>
      </div>
    );
  }
  if (!move) return null;

  const flavor = FLAVOR[move.classification]?.(move) ?? '';

  return (
    <div className="flex items-start gap-3 px-4 pt-4">
      <Avatar />
      <div className="flex-1 rounded-2xl bg-stone-100 text-stone-900 px-4 py-3 shadow relative">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClassificationIcon classification={move.classification} size={20} />
            <span className="font-bold">
              {move.san}{' '}
              <span className="font-medium text-stone-700">
                is {indefinite(classificationLabel(move.classification).toLowerCase())}.
              </span>
            </span>
          </div>
          <span className="text-stone-700 font-bold tabular-nums">
            {formatScore(move.evalAfterWhite)}
          </span>
        </div>
        {flavor && <div className="text-sm text-stone-700 mt-0.5">{flavor}</div>}
      </div>
    </div>
  );
}

function indefinite(word: string) {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

function Avatar() {
  return (
    <div className="shrink-0 w-12 h-12 rounded-full bg-stone-700 ring-2 ring-stone-900/40 flex items-center justify-center text-stone-200 text-xl shadow">
      <span aria-hidden>🧔</span>
    </div>
  );
}
