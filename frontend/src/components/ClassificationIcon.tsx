import type { MoveClassification } from '../types';

interface Props {
  classification: MoveClassification;
  size?: number;
  className?: string;
}

const COLORS: Record<MoveClassification, string> = {
  brilliant: '#1baca6',
  great: '#5b9bd5',
  best: '#1ea05a',
  good: '#86bf2c',
  ok: '#a3a3a3',
  book: '#a88a59',
  inaccuracy: '#f5b840',
  mistake: '#f08a36',
  blunder: '#d6443a',
};

const GLYPH: Record<MoveClassification, string> = {
  brilliant: '!!',
  great: '!',
  best: '★',
  good: '✓',
  ok: '✓',
  book: '📖',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};

const LABEL: Record<MoveClassification, string> = {
  brilliant: 'Brilliant',
  great: 'Great move',
  best: 'Best move',
  good: 'Good move',
  ok: 'OK move',
  book: 'Book move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

export function classificationLabel(c: MoveClassification): string {
  return LABEL[c];
}

export function classificationColor(c: MoveClassification): string {
  return COLORS[c];
}

export function classificationGlyph(c: MoveClassification): string {
  return GLYPH[c];
}

export function ClassificationIcon({ classification, size = 22, className }: Props) {
  const color = COLORS[classification];
  const glyph = GLYPH[classification];

  // Use a solid colored circle with white glyph; use book icon as text (emoji).
  const isEmoji = classification === 'book';
  return (
    <span
      className={
        'inline-flex items-center justify-center rounded-full ring-2 ring-black/40 select-none ' +
        (className ?? '')
      }
      style={{
        backgroundColor: isEmoji ? '#3b2e1d' : color,
        color: 'white',
        width: size,
        height: size,
        fontSize: Math.round(size * (classification === 'best' ? 0.6 : 0.55)),
        fontWeight: 800,
        lineHeight: 1,
      }}
      title={LABEL[classification]}
    >
      {isEmoji ? '♟' : glyph}
    </span>
  );
}
