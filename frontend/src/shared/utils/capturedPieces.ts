// Pure utilities for deriving captured pieces and material advantage from a FEN.
//
// - Captured glyphs are computed by diffing the starting count for each piece
//   type (clamped at 0 so promotions never produce negative counts).
// - Material advantage is computed from the live material balance of the FEN,
//   which handles promotions correctly even when the captured-glyph view does
//   not (a promoted pawn shows up as "missing pawn" but adds to live material).

export interface CapturedSet {
  pawns: number;
  knights: number;
  bishops: number;
  rooks: number;
  queens: number;
}

export interface CapturedFromFen {
  // Pieces of the opposite color that this side has captured.
  whiteCaptured: CapturedSet;
  blackCaptured: CapturedSet;
  // Pawn-equivalent material balance from White's POV. Positive = white ahead.
  whiteAdvantage: number;
}

const STARTING: CapturedSet = {
  pawns: 8,
  knights: 2,
  bishops: 2,
  rooks: 2,
  queens: 1,
};

const VALUE: Record<keyof CapturedSet, number> = {
  pawns: 1,
  knights: 3,
  bishops: 3,
  rooks: 5,
  queens: 9,
};

function emptySet(): CapturedSet {
  return { pawns: 0, knights: 0, bishops: 0, rooks: 0, queens: 0 };
}

function bumpFromChar(set: CapturedSet, ch: string): void {
  switch (ch) {
    case 'p':
    case 'P':
      set.pawns += 1;
      break;
    case 'n':
    case 'N':
      set.knights += 1;
      break;
    case 'b':
    case 'B':
      set.bishops += 1;
      break;
    case 'r':
    case 'R':
      set.rooks += 1;
      break;
    case 'q':
    case 'Q':
      set.queens += 1;
      break;
    // kings ignored on purpose; they're never captured
  }
}

function materialOf(set: CapturedSet): number {
  return (
    set.pawns * VALUE.pawns +
    set.knights * VALUE.knights +
    set.bishops * VALUE.bishops +
    set.rooks * VALUE.rooks +
    set.queens * VALUE.queens
  );
}

export function computeCapturedFromFen(fen: string): CapturedFromFen {
  const board = fen.split(' ')[0] ?? '';
  const whiteOnBoard = emptySet();
  const blackOnBoard = emptySet();
  for (const ch of board) {
    if (ch === '/' || (ch >= '0' && ch <= '9')) continue;
    if (ch >= 'A' && ch <= 'Z') bumpFromChar(whiteOnBoard, ch);
    else if (ch >= 'a' && ch <= 'z') bumpFromChar(blackOnBoard, ch);
  }
  // Captures are the missing pieces of the opposite color, clamped at 0 so a
  // promoted pawn (which makes the opposing piece type appear "extra") doesn't
  // produce nonsense negatives.
  const whiteCaptured: CapturedSet = {
    pawns: Math.max(0, STARTING.pawns - blackOnBoard.pawns),
    knights: Math.max(0, STARTING.knights - blackOnBoard.knights),
    bishops: Math.max(0, STARTING.bishops - blackOnBoard.bishops),
    rooks: Math.max(0, STARTING.rooks - blackOnBoard.rooks),
    queens: Math.max(0, STARTING.queens - blackOnBoard.queens),
  };
  const blackCaptured: CapturedSet = {
    pawns: Math.max(0, STARTING.pawns - whiteOnBoard.pawns),
    knights: Math.max(0, STARTING.knights - whiteOnBoard.knights),
    bishops: Math.max(0, STARTING.bishops - whiteOnBoard.bishops),
    rooks: Math.max(0, STARTING.rooks - whiteOnBoard.rooks),
    queens: Math.max(0, STARTING.queens - whiteOnBoard.queens),
  };
  const whiteAdvantage = materialOf(whiteOnBoard) - materialOf(blackOnBoard);
  return { whiteCaptured, blackCaptured, whiteAdvantage };
}

export interface StripCaptures {
  topCaptured: CapturedSet;
  topAdvantage: number;
  bottomCaptured: CapturedSet;
  bottomAdvantage: number;
}

// Helper for the review pages: derive captured sets and clamped advantages
// keyed by the two PlayerStrip slots (top + bottom). Both desktop and mobile
// review compute the same shape, so this lives here to avoid duplicating the
// signing logic. Advantages are clamped to >= 0 so the prop name "advantage"
// stays accurate (CapturedPieces hides the badge on <= 0 anyway).
export function deriveStripCaptures(
  fen: string,
  topColor: 'white' | 'black',
  bottomColor: 'white' | 'black',
): StripCaptures {
  const { whiteCaptured, blackCaptured, whiteAdvantage } =
    computeCapturedFromFen(fen);
  const topSigned = topColor === 'white' ? whiteAdvantage : -whiteAdvantage;
  const bottomSigned =
    bottomColor === 'white' ? whiteAdvantage : -whiteAdvantage;
  return {
    topCaptured: topColor === 'white' ? whiteCaptured : blackCaptured,
    topAdvantage: Math.max(0, topSigned),
    bottomCaptured: bottomColor === 'white' ? whiteCaptured : blackCaptured,
    bottomAdvantage: Math.max(0, bottomSigned),
  };
}
