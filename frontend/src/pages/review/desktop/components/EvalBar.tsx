import type { UciScore } from '../../../../shared/types';
import { formatScoreCompact, scoreToCp, whiteWinProbability } from '../../../../shared/utils/winProb';

interface Props {
  evalWhite: UciScore | null;
  orientation?: 'white' | 'black';
  layout?: 'vertical' | 'horizontal';
  height?: number | string;
}

export function EvalBar({
  evalWhite,
  orientation = 'white',
  layout = 'vertical',
  height = '100%',
}: Props) {
  const cp = scoreToCp(evalWhite ?? { cp: 0 });
  const wp = clamp(whiteWinProbability(cp), 0, 100);
  const display = formatScoreCompact(evalWhite);
  const whiteWinning = cp >= 0;
  const labelInWhiteSlab = whiteWinning;

  if (layout === 'horizontal') {
    return (
      <HorizontalBar
        wp={wp}
        whiteOnRight={orientation === 'white'}
        display={display}
        labelInWhiteSlab={labelInWhiteSlab}
      />
    );
  }

  return (
    <VerticalBar
      wp={wp}
      whiteAtBottom={orientation === 'white'}
      display={display}
      labelInWhiteSlab={labelInWhiteSlab}
      height={height}
    />
  );
}

function VerticalBar({
  wp,
  whiteAtBottom,
  display,
  labelInWhiteSlab,
  height,
}: {
  wp: number;
  whiteAtBottom: boolean;
  display: string;
  labelInWhiteSlab: boolean;
  height: number | string;
}) {
  const whiteSlabStyle = whiteAtBottom ? { bottom: 0 } : { top: 0 };
  const labelStyle = labelInWhiteSlab === whiteAtBottom ? { bottom: 4 } : { top: 4 };
  return (
    <div
      className="cr-evalbar relative w-[22px] rounded-md overflow-hidden"
      style={{
        height,
        background: '#000',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }}
    >
      <div
        className="absolute inset-x-0 transition-[height] duration-300"
        style={{
          ...whiteSlabStyle,
          height: `${wp}%`,
          background: '#fff',
        }}
      />
      <div
        className="absolute inset-x-0 top-1/2 h-px bg-white/40 pointer-events-none"
      />
      <Label display={display} labelInWhiteSlab={labelInWhiteSlab} style={{ left: 0, right: 0, textAlign: 'center', ...labelStyle }} />
    </div>
  );
}

function HorizontalBar({
  wp,
  whiteOnRight,
  display,
  labelInWhiteSlab,
}: {
  wp: number;
  whiteOnRight: boolean;
  display: string;
  labelInWhiteSlab: boolean;
}) {
  const whiteSlabStyle = whiteOnRight
    ? { right: 0, top: 0, bottom: 0, width: `${wp}%` }
    : { left: 0, top: 0, bottom: 0, width: `${wp}%` };
  const labelOnRight = labelInWhiteSlab === whiteOnRight;
  const labelStyle = labelOnRight ? { right: 8 } : { left: 8 };
  return (
    <div
      className="cr-evalbar relative w-full rounded-md overflow-hidden"
      style={{
        height: 22,
        background: '#000',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }}
    >
      <div
        className="absolute transition-[width] duration-300"
        style={{
          ...whiteSlabStyle,
          background: '#fff',
        }}
      />
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/40 pointer-events-none" />
      <Label
        display={display}
        labelInWhiteSlab={labelInWhiteSlab}
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
          ...labelStyle,
        }}
      />
    </div>
  );
}

function Label({
  display,
  labelInWhiteSlab,
  style,
}: {
  display: string;
  labelInWhiteSlab: boolean;
  style: React.CSSProperties;
}) {
  return (
    <div
      className={
        'absolute font-mono font-semibold pointer-events-none cr-evalbar-label ' +
        (labelInWhiteSlab
          ? 'cr-evalbar-label-on-bright'
          : 'cr-evalbar-label-on-dark')
      }
      style={{ fontSize: 9.5, ...style }}
    >
      {display}
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
