import { useId } from 'react';
import { Check, Flame, Target, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PuzzleProgress } from '../../types';
import { classifyTier } from '../../utils/difficulty';
import { useTierLabel } from '../../utils/i18nHelpers';
import {
  accuracyPct,
  dayStreak,
  ratingTrend,
  todayStats,
} from '../../utils/progressStats';

interface Props {
  progress: PuzzleProgress;
}

export function ProgressCard({ progress }: Props) {
  const { t } = useTranslation();
  const tierLabel = useTierLabel();
  const { elo, history, stats } = progress;
  const today = todayStats(history);
  const streak = dayStreak(history);
  const accuracy = accuracyPct(stats);
  const trend = ratingTrend(history);
  const tier = classifyTier(elo);

  return (
    <div className="cr-card pz-progress">
      <div className="cr-card-hd">
        <div className="cr-card-title">{t('puzzles.hub.progress.title')}</div>
        <span className={`pz-tier-pill tier-${tier}`}>{tierLabel(tier)}</span>
      </div>

      <div className="pz-rating-row">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <div className="pz-rating-num">{elo}</div>
            {today.delta !== 0 && (
              <span
                className={`pz-rating-delta ${today.delta > 0 ? 'up' : 'down'}`}
                title={t('puzzles.hub.progress.todayDelta')}
              >
                {today.delta > 0 ? `+${today.delta}` : today.delta}
              </span>
            )}
          </div>
          <div className="pz-rating-label">{t('puzzles.hub.progress.rating')}</div>
        </div>
        <Sparkline values={trend} />
      </div>

      <div className="pz-stat-grid">
        <div
          className={`pz-stat pz-stat--streak ${streak.activeToday ? '' : 'is-pending'}`}
          title={
            streak.days > 0 && !streak.activeToday
              ? t('puzzles.hub.progress.streakPending')
              : undefined
          }
        >
          <div className="pz-stat-num">
            <Flame size={16} className="pz-stat-icon" />
            {streak.days}
          </div>
          <div className="pz-stat-lbl">{t('puzzles.hub.progress.streak')}</div>
        </div>

        <div className="pz-stat pz-stat--today">
          <div className="pz-stat-num pz-today">
            <span className="pz-today-ok" title={t('puzzles.hub.progress.solved')}>
              <Check size={13} strokeWidth={3} />
              {today.solved}
            </span>
            <span className="pz-today-bad" title={t('puzzles.hub.progress.failed')}>
              <X size={13} strokeWidth={3} />
              {today.failed}
            </span>
          </div>
          <div className="pz-stat-lbl">{t('puzzles.hub.progress.today')}</div>
        </div>

        <div className="pz-stat pz-stat--acc">
          <div className="pz-stat-num">
            <Target size={15} className="pz-stat-icon" />
            {accuracy}%
          </div>
          <div className="pz-acc-track" aria-hidden>
            <span className="pz-acc-fill" style={{ width: `${accuracy}%` }} />
          </div>
          <div className="pz-stat-lbl">{t('puzzles.hub.progress.accuracy')}</div>
        </div>
      </div>
    </div>
  );
}

const SPARK_W = 112;
const SPARK_H = 40;

/** Rating after each recent attempt. Hidden until there are ≥2 points. */
function Sparkline({ values }: { values: number[] }) {
  // React's ids contain ':' which breaks the url(#…) reference in some engines.
  const gradId = `pz-spark-${useId().replace(/:/g, '')}`;
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * SPARK_W,
    3 + (1 - (v - min) / span) * (SPARK_H - 6),
  ]);
  const line = pts.map(([x, y]) => `${x!.toFixed(1)},${y!.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1]!;
  const up = values[values.length - 1]! >= values[0]!;

  return (
    <svg
      className={`pz-spark ${up ? 'up' : 'down'}`}
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${SPARK_H} ${line} ${SPARK_W},${SPARK_H}`}
        fill={`url(#${gradId})`}
      />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.75" fill="currentColor" />
    </svg>
  );
}
