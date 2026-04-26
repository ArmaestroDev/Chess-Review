import { useTranslation } from 'react-i18next';
import type { MoveAnalysis } from '../../../shared/types';
import {
  ClassificationIcon,
  useClassificationLabel,
} from '../../../shared/components/ClassificationIcon';
import { formatScore } from '../../../shared/utils/winProb';

interface Props {
  move: MoveAnalysis | null;
  isInitial?: boolean;
}

export function CommentBubble({ move, isInitial }: Props) {
  const { t } = useTranslation();
  const classificationLabel = useClassificationLabel();

  if (isInitial) {
    return (
      <div className="cr-card">
        <div className="cr-card-hd">
          <div className="cr-card-title">{t('review.coach.title')}</div>
        </div>
        <div className="px-4 pb-4 flex gap-3">
          <CoachAvatar />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] leading-[1.5] text-ink-2 m-0">
              {t('review.coach.loadHint')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!move) {
    return (
      <div className="cr-card">
        <div className="cr-card-hd">
          <div className="cr-card-title">{t('review.coach.title')}</div>
        </div>
        <div className="px-4 pb-4 flex gap-3">
          <CoachAvatar />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] leading-[1.5] text-ink-3 m-0 italic">
              {t('review.coach.pickHint')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const flavor = flavorFor(move, t);

  return (
    <div className="cr-card">
      <div className="cr-card-hd">
        <div className="cr-card-title">{t('review.coach.title')}</div>
        <span className="cr-pill cr-pill-mono">
          {formatScore(move.evalAfterWhite)}
        </span>
      </div>
      <div className="px-4 pb-4 flex gap-3">
        <CoachAvatar />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[12px] text-ink-3 mb-1 flex items-center gap-1.5">
            <ClassificationIcon classification={move.classification} size={14} />
            <strong className="text-ink font-semibold">{move.san}</strong>
            <span>
              {t('review.coach.labelSeparator')}
              {classificationLabel(move.classification)}
            </span>
          </div>
          {flavor && (
            <p className="m-0 text-[12.5px] leading-[1.5] text-ink-2 [text-wrap:pretty]">
              {flavor}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function flavorFor(
  m: MoveAnalysis,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  switch (m.classification) {
    case 'brilliant':
      return t('review.flavor.brilliant');
    case 'great':
      return t('review.flavor.great', { san: m.san });
    case 'best':
      return t('review.flavor.best', { san: m.san });
    case 'good':
      return t('review.flavor.good', { san: m.san });
    case 'ok':
      return t('review.flavor.ok');
    case 'book':
      return t('review.flavor.book');
    case 'inaccuracy':
      return appendBetter(t('review.flavor.inaccuracy', { san: m.san }), m, t);
    case 'mistake':
      return appendBetter(t('review.flavor.mistake', { san: m.san }), m, t);
    case 'blunder':
      return appendBetter(t('review.flavor.blunder', { san: m.san }), m, t);
    default:
      return '';
  }
}

function appendBetter(
  prefix: string,
  m: MoveAnalysis,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!m.bestMoveSan) return prefix;
  return `${prefix} ${t('review.flavor.betterWas', { san: m.bestMoveSan })}`;
}

function CoachAvatar() {
  return (
    <div
      className="flex-shrink-0 w-[30px] h-[30px] rounded-lg flex items-center justify-center text-accent-ink"
      style={{
        background:
          'linear-gradient(180deg, rgb(var(--wood-card)), rgb(var(--wood-dark)))',
        boxShadow:
          'inset 0 1px 0 var(--accent-soft), 0 1px 2px rgba(0, 0, 0, 0.3)',
      }}
      aria-hidden
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.5 0 4-2 4-4.5S14.5 3 12 3 8 5 8 7.5 9.5 12 12 12zm0 2c-3.3 0-8 1.6-8 5v2h16v-2c0-3.4-4.7-5-8-5z" />
      </svg>
    </div>
  );
}
