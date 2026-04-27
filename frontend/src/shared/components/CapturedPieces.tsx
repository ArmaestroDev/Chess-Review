import type { CapturedSet } from '../utils/capturedPieces';

interface Props {
  // Whose label this row sits next to. The captured-piece glyphs rendered are
  // the OPPOSITE color (white captured black pieces → black glyphs shown).
  side: 'white' | 'black';
  captured: CapturedSet;
  // Pawn-equivalent material lead for THIS side. Render the badge only when
  // this side is materially ahead; pass <= 0 to hide it.
  advantage: number;
  // Glyph font-size in px.
  size?: number;
}

const ORDER: Array<keyof CapturedSet> = [
  'queens',
  'rooks',
  'bishops',
  'knights',
  'pawns',
];

const WHITE_GLYPH: Record<keyof CapturedSet, string> = {
  pawns: '♙',
  knights: '♘',
  bishops: '♗',
  rooks: '♖',
  queens: '♕',
};

const BLACK_GLYPH: Record<keyof CapturedSet, string> = {
  pawns: '♟',
  knights: '♞',
  bishops: '♝',
  rooks: '♜',
  queens: '♛',
};

export function CapturedPieces({ side, captured, advantage, size = 13 }: Props) {
  const glyphs = side === 'white' ? BLACK_GLYPH : WHITE_GLYPH;
  const items: string[] = [];
  for (const key of ORDER) {
    for (let i = 0; i < captured[key]; i++) items.push(glyphs[key]);
  }
  if (items.length === 0 && advantage <= 0) return null;
  return (
    <span
      className="cr-captured"
      style={{ fontSize: size }}
      aria-hidden
    >
      {items.length > 0 && (
        <span className="cr-captured-glyphs">{items.join('')}</span>
      )}
      {advantage > 0 && (
        <span className="cr-captured-advantage">+{advantage}</span>
      )}
    </span>
  );
}
