import { useMemo } from 'react';
import type { MoveAnalysis } from '../types';
import { scoreToCp, whiteWinProbability } from '../utils/winProb';
import { classificationColor } from './ClassificationIcon';

interface Props {
  moves: MoveAnalysis[];
  totalPlies: number; // expected length, for proper x-axis scaling while streaming
  currentPly: number;
  onSelect: (ply: number) => void;
  width?: number;
  height?: number;
}

const PADDING_X = 4;
const PADDING_Y = 2;

export function EvalChart({
  moves,
  totalPlies,
  currentPly,
  onSelect,
  width = 320,
  height = 70,
}: Props) {
  const innerW = width - PADDING_X * 2;
  const innerH = height - PADDING_Y * 2;

  const denom = Math.max(totalPlies - 1, moves.length - 1, 1);

  const points = useMemo(() => {
    return moves.map((m) => {
      const x = PADDING_X + (m.ply / denom) * innerW;
      const wp = whiteWinProbability(scoreToCp(m.evalAfterWhite));
      const y = PADDING_Y + (1 - wp / 100) * innerH;
      return { x, y, m };
    });
  }, [moves, denom, innerW, innerH]);

  // Build white-fill polygon (under the line, down to the bottom)
  const path = useMemo(() => {
    if (points.length === 0) return '';
    const top = `M ${PADDING_X} ${PADDING_Y + innerH} ` +
      points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${points[points.length - 1].x} ${PADDING_Y + innerH} Z`;
    return top;
  }, [points, innerH]);

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [points]);

  const cursorX =
    moves.length > 0
      ? PADDING_X + (Math.min(currentPly, moves.length - 1) / denom) * innerW
      : PADDING_X;

  return (
    <div className="relative bg-black/60 rounded">
      <svg
        width={width}
        height={height}
        className="block"
        onClick={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          const ply = Math.round(((x - PADDING_X) / innerW) * denom);
          onSelect(Math.max(0, Math.min(moves.length - 1, ply)));
        }}
      >
        {/* mid line (50% WP) */}
        <line
          x1={PADDING_X}
          x2={PADDING_X + innerW}
          y1={PADDING_Y + innerH / 2}
          y2={PADDING_Y + innerH / 2}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
        />
        {/* fill (white wins area) */}
        <path d={path} fill="rgba(245,245,245,0.92)" />
        <path d={linePath} stroke="rgba(0,0,0,0.6)" strokeWidth={1} fill="none" />
        {/* points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={classificationColor(p.m.classification)}
            stroke="rgba(0,0,0,0.4)"
            strokeWidth={0.5}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(p.m.ply);
            }}
            className="cursor-pointer"
          >
            <title>{`${p.m.moveNumber}${p.m.color === 'w' ? '.' : '...'} ${p.m.san}`}</title>
          </circle>
        ))}
        {/* current ply cursor */}
        <line
          x1={cursorX}
          x2={cursorX}
          y1={PADDING_Y}
          y2={PADDING_Y + innerH}
          stroke="#f5b840"
          strokeWidth={2}
        />
      </svg>
    </div>
  );
}
