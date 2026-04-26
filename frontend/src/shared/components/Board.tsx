import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import type { MoveClassification } from '../types';
import {
  classificationColor,
  classificationGlyph,
} from './ClassificationIcon';

export interface BoardArrow {
  from: string;
  to: string;
  color: string;
}

interface Props {
  fen: string;
  size: number;
  orientation?: 'white' | 'black';
  /** Squares to highlight (e.g., last-move from / to). */
  highlightedSquares?: { square: string; color?: string }[];
  /** Arrows to draw on the board. */
  arrows?: BoardArrow[];
  /** Optional classification badge anchored to a square (top-right corner). */
  badge?: { square: string; classification: MoveClassification } | null;
  /**
   * Restrict draggable pieces to a specific color. When omitted (review's
   * default) the FEN's side-to-move governs draggability. Puzzle solver
   * passes 'w' or 'b' so the locked side never moves even when it's that
   * side's turn (e.g. while the opponent's reply is animating).
   */
  playableColor?: 'w' | 'b';
  /**
   * If provided, pieces are draggable. The callback receives a UCI string
   * (e.g. "e2e4", "e7e8q") for legal moves only. Returning a Promise from
   * the handler is fine — drag accepts immediately.
   */
  onMove?: (uci: string) => void;
}

export function Board({
  fen,
  size,
  orientation = 'white',
  highlightedSquares,
  arrows,
  badge,
  playableColor,
  onMove,
}: Props) {
  // FEN's second whitespace-separated field is the side to move.
  const sideToMove = (fen.split(' ')[1] ?? 'w') as 'w' | 'b';
  // When playableColor is set, gate by it instead of side-to-move so the
  // locked side never moves (e.g. during an animating opponent reply).
  const draggableColor = playableColor ?? sideToMove;
  const draggable = !!onMove;

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  // Drop the selection whenever the position changes (move committed,
  // navigated to a different ply, or the locked side flipped during an
  // animating reply).
  useEffect(() => {
    setSelectedSquare(null);
  }, [fen, playableColor]);

  const legalDestinations = useMemo<Set<string>>(() => {
    if (!selectedSquare || !draggable) return new Set();
    try {
      const chess = new Chess(fen);
      const moves = chess.moves({ square: selectedSquare as never, verbose: true }) as Array<{
        to: string;
      }>;
      return new Set(moves.map((m) => m.to));
    } catch {
      return new Set();
    }
  }, [selectedSquare, fen, draggable]);

  const customSquareStyles = useMemo<Record<string, CSSProperties>>(() => {
    const styles: Record<string, CSSProperties> = {};
    for (const h of highlightedSquares ?? []) {
      styles[h.square] = {
        backgroundColor: h.color ?? 'rgba(246, 224, 122, 0.55)',
      };
    }
    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        backgroundColor: 'rgba(120, 200, 120, 0.55)',
      };
    }
    for (const dest of legalDestinations) {
      styles[dest] = {
        ...styles[dest],
        backgroundImage:
          'radial-gradient(circle, rgba(0,0,0,0.22) 18%, transparent 22%)',
      };
    }
    return styles;
  }, [highlightedSquares, selectedSquare, legalDestinations]);

  const customArrows = useMemo<[string, string, string?][]>(() => {
    return (arrows ?? []).map((a) => [a.from, a.to, a.color]);
  }, [arrows]);

  const badgePos = useMemo(() => {
    if (!badge) return null;
    return squareToPixel(badge.square, size, orientation);
  }, [badge, size, orientation]);

  function handleSquareClick(square: string, piece: string | undefined) {
    if (!onMove) return;

    if (selectedSquare === null) {
      if (!piece || piece[0] !== draggableColor) return;
      setSelectedSquare(square);
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    const chess = new Chess(fen);
    let applied: ReturnType<typeof chess.move> | null = null;
    try {
      applied = chess.move({ from: selectedSquare, to: square, promotion: 'q' });
    } catch {
      applied = null;
    }

    if (!applied) {
      // Illegal move: switch selection to the clicked piece if it's our own,
      // otherwise drop the selection entirely.
      if (piece && piece[0] === draggableColor) {
        setSelectedSquare(square);
      } else {
        setSelectedSquare(null);
      }
      return;
    }

    const uci = selectedSquare + square + (applied.promotion ?? '');
    setSelectedSquare(null);
    onMove(uci);
  }

  return (
    <div
      className="relative board-wrap rounded-[10px] overflow-hidden"
      style={{ width: size, height: size }}
    >
      <Chessboard
        id="review-board"
        position={fen}
        boardWidth={size}
        boardOrientation={orientation}
        arePiecesDraggable={draggable}
        animationDuration={150}
        customDarkSquareStyle={{ backgroundColor: 'var(--board-dark)' }}
        customLightSquareStyle={{ backgroundColor: 'var(--board-light)' }}
        customSquareStyles={customSquareStyles}
        customArrows={customArrows as any}
        customBoardStyle={{
          borderRadius: 10,
          boxShadow: 'none',
        }}
        isDraggablePiece={
          draggable
            ? ({ piece }: { piece: string }) => piece?.[0] === draggableColor
            : undefined
        }
        onSquareClick={
          draggable
            ? ((square: string, piece: string | undefined) =>
                handleSquareClick(square, piece)) as never
            : undefined
        }
        onPieceDrop={
          draggable
            ? (source: string, target: string) => {
                if (!onMove) return false;
                if (source === target) return false;
                // Promotion moves are intercepted by onPromotionCheck below
                // and committed in onPromotionPieceSelect, so we never need
                // to handle promotion here.
                const chess = new Chess(fen);
                let applied;
                try {
                  applied = chess.move({ from: source, to: target });
                } catch {
                  return false;
                }
                if (!applied) return false;
                const uci = source + target + (applied.promotion ?? '');
                onMove(uci);
                return true;
              }
            : undefined
        }
        onPromotionCheck={
          draggable
            ? (_source: string, target: string, piece: string) =>
                (piece === 'wP' && target[1] === '8') ||
                (piece === 'bP' && target[1] === '1')
            : undefined
        }
        onPromotionPieceSelect={
          draggable
            ? (
                piece?: string,
                promoteFromSquare?: string,
                promoteToSquare?: string,
              ) => {
                if (!onMove || !piece || !promoteFromSquare || !promoteToSquare) {
                  return false;
                }
                // `piece` is in 'wQ' / 'bN' form — second char is the type.
                const promotion = piece[1]?.toLowerCase();
                if (!promotion) return false;
                const chess = new Chess(fen);
                let applied;
                try {
                  applied = chess.move({
                    from: promoteFromSquare,
                    to: promoteToSquare,
                    promotion,
                  });
                } catch {
                  return false;
                }
                if (!applied) return false;
                const uci =
                  promoteFromSquare + promoteToSquare + (applied.promotion ?? '');
                onMove(uci);
                return true;
              }
            : undefined
        }
      />
      {badge && badgePos && (
        <div
          className="absolute pointer-events-none flex items-center justify-center rounded-full ring-2 ring-black/40 shadow-md"
          style={{
            left: badgePos.x + badgePos.squareSize - badgePos.squareSize * 0.35,
            top: badgePos.y - badgePos.squareSize * 0.15,
            width: badgePos.squareSize * 0.55,
            height: badgePos.squareSize * 0.55,
            backgroundColor: classificationColor(badge.classification),
            color: 'white',
            fontWeight: 800,
            fontSize: badgePos.squareSize * 0.28,
            lineHeight: 1,
          }}
          aria-label={badge.classification}
        >
          {classificationGlyph(badge.classification)}
        </div>
      )}
    </div>
  );
}

function squareToPixel(square: string, boardSize: number, orientation: 'white' | 'black') {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(square[1] ?? '1', 10) - 1;
  const squareSize = boardSize / 8;
  const x = (orientation === 'white' ? file : 7 - file) * squareSize;
  const y = (orientation === 'white' ? 7 - rank : rank) * squareSize;
  return { x, y, squareSize };
}
