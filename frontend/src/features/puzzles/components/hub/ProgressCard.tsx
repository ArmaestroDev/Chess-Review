import { useTranslation } from 'react-i18next';
import type { PuzzleProgress } from '../../types';

interface Props {
  progress: PuzzleProgress;
}

export function ProgressCard({ progress }: Props) {
  const { t } = useTranslation();
  const { elo, history, stats } = progress;
  const today = todayStats(history);
  const accuracyPct = stats.solved + stats.failed > 0
    ? Math.round((stats.solved / (stats.solved + stats.failed)) * 100)
    : 0;
  const streak = currentDayStreak(history);

  return (
    <div className="cr-card pz-progress">
      <div className="cr-card-hd">
        <div className="cr-card-title">{t('puzzles.hub.progress.title')}</div>
      </div>

      <div className="pz-rating-row">
        <div className="pz-rating-num">{elo}</div>
      </div>
      <div className="pz-rating-label">{t('puzzles.hub.progress.rating')}</div>

      <div className="pz-stat-grid">
        <div className="pz-stat">
          <div className="pz-stat-num">{streak}</div>
          <div className="pz-stat-lbl">{t('puzzles.hub.progress.streak')}</div>
        </div>
        <div className="pz-stat">
          <div className="pz-stat-num">{today}</div>
          <div className="pz-stat-lbl">{t('puzzles.hub.progress.today')}</div>
        </div>
        <div className="pz-stat">
          <div className="pz-stat-num">{accuracyPct}%</div>
          <div className="pz-stat-lbl">{t('puzzles.hub.progress.accuracy')}</div>
        </div>
      </div>
    </div>
  );
}

function todayStats(history: PuzzleProgress['history']): number {
  const start = startOfTodayUTCms();
  return history.filter((a) => a.timestamp >= start).length;
}

function startOfTodayUTCms(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Count consecutive UTC days ending today on which the user attempted ≥1 puzzle. */
function currentDayStreak(history: PuzzleProgress['history']): number {
  if (history.length === 0) return 0;
  const days = new Set<string>();
  for (const a of history) {
    days.add(dayKey(a.timestamp));
  }
  let n = 0;
  let cursor = new Date();
  // Anchor to UTC midnight today.
  cursor = new Date(
    Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()),
  );
  while (days.has(dayKey(cursor.getTime()))) {
    n += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return n;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}
