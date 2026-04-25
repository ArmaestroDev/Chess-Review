import type { UciScore } from '../types';
import { formatScoreCompact, scoreToCp, whiteWinProbability } from '../utils/winProb';

interface Props {
  evalWhite: UciScore | null;
  height?: number | string;
  orientation?: 'white' | 'black';
}

/**
 * Vertical eval bar — light slab fills from the side that's winning. Mirrors
 * the chess.com-style bar; we expose `orientation` so a flipped board still
 * shows "white at the bottom" semantics.
 */
export function EvalBar({ evalWhite, height = '100%', orientation = 'white' }: Props) {
  const cp = scoreToCp(evalWhite ?? { cp: 0 });
  const wp = clamp(whiteWinProbability(cp), 0, 100);
  const display = formatScoreCompact(evalWhite);
  const whiteWinning = cp >= 0;
  const whiteAtBottom = orientation === 'white';
  const whiteSlabStyle = whiteAtBottom ? { bottom: 0 } : { top: 0 };
  const labelInWhiteSlab = whiteWinning;
  const labelStyle = labelInWhiteSlab === whiteAtBottom ? { bottom: 4 } : { top: 4 };

  return (
    <div
      className="relative w-[22px] rounded-md overflow-hidden bg-wood-dark shadow-inner"
      style={{
        height,
        boxShadow:
          'inset 0 0 0 0.5px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.15)',
      }}
    >
      <div
        className="absolute inset-x-0 transition-[height] duration-300"
        style={{
          ...whiteSlabStyle,
          height: `${wp}%`,
          background: 'linear-gradient(180deg, #fdfbf5, #ede5d0)',
        }}
      />
      {/* mid-line marker */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-accent/60 pointer-events-none" />
      <div
        className={
          'absolute left-0 right-0 text-center font-mono font-semibold pointer-events-none ' +
          (labelInWhiteSlab ? 'text-stone-900' : 'text-stone-100')
        }
        style={{ fontSize: 9.5, ...labelStyle }}
      >
        {display}
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
