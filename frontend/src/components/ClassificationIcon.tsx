import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
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

/**
 * Hook form: returns a function that resolves a classification to its
 * localized label, reactive to language changes.
 */
export function useClassificationLabel(): (c: MoveClassification) => string {
  const { t } = useTranslation();
  return (c) => t(`classification.${c}`);
}

/**
 * Non-hook form for code outside React (or where hooks aren't convenient).
 * Reads the active i18n instance synchronously — fine for one-off strings,
 * not reactive to language changes.
 */
export function classificationLabel(c: MoveClassification): string {
  return i18n.t(`classification.${c}`);
}

export function classificationColor(c: MoveClassification): string {
  return COLORS[c];
}

export function classificationGlyph(c: MoveClassification): string {
  return GLYPH[c];
}

export function ClassificationIcon({ classification, size = 22, className }: Props) {
  const { t } = useTranslation();
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
        backgroundColor: isEmoji ? 'rgb(var(--wood-card))' : color,
        color: 'white',
        width: size,
        height: size,
        fontSize: Math.round(size * (classification === 'best' ? 0.6 : 0.55)),
        fontWeight: 800,
        lineHeight: 1,
      }}
      title={t(`classification.${classification}`)}
    >
      {isEmoji ? '♟' : glyph}
    </span>
  );
}
