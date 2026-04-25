import type { UciScore } from '../types';
import { formatScoreCompact, scoreToCp, whiteWinProbability } from '../utils/winProb';

interface Props {
  /** Score in WHITE's POV. Positive = white better. */
  evalWhite: UciScore | null;
  height?: number | string;
  /** When black is at the bottom (board flipped), pass orientation = "black". */
  orientation?: 'white' | 'black';
}

/**
 * Vertical eval bar that mirrors the chess.com bar to the left of the board.
 * White fills from the bottom (or top, when flipped); the score sits inside
 * the side that is currently winning.
 */
export function EvalBar({ evalWhite, height = '100%', orientation = 'white' }: Props) {
  const cp = scoreToCp(evalWhite ?? { cp: 0 });
  const wp = clamp(whiteWinProbability(cp), 0, 100);
  const display = formatScoreCompact(evalWhite);

  // White advantage shows the eval inside the WHITE part; black advantage
  // shows it inside the BLACK part. Threshold at 50% WP (no advantage).
  const whiteWinning = cp >= 0;

  // The white slab is always `wp%` tall. It sits at the bottom of the bar
  // when white is at the bottom of the board, and at the top when flipped.
  const whiteAtBottom = orientation === 'white';
  const whiteSlabStyle = whiteAtBottom ? { bottom: 0 } : { top: 0 };

  // The score label sits inside whichever side is currently winning.
  const labelInWhiteSlab = whiteWinning;
  const labelStyle =
    labelInWhiteSlab === whiteAtBottom ? { bottom: 4 } : { top: 4 };

  return (
    <div
      className="relative w-6 rounded-sm overflow-hidden bg-stone-900 shadow-inner"
      style={{ height }}
    >
      {/* black background already from bg-stone-900; white slab anchored
          to the side white is on. */}
      <div
        className="absolute inset-x-0 bg-stone-100 transition-[height] duration-200"
        style={{ ...whiteSlabStyle, height: `${wp}%` }}
      />
      {/* score label — placed inside the side that is winning */}
      <div
        className={
          'absolute left-0 right-0 text-center font-bold tracking-wide pointer-events-none ' +
          (labelInWhiteSlab ? 'text-stone-900' : 'text-stone-100')
        }
        style={{ fontSize: 10, ...labelStyle }}
      >
        {display}
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
