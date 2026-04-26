import { useTranslation } from 'react-i18next';
import type { PuzzleProgress } from '../../types';

interface Props {
  history: PuzzleProgress['history'];
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export function ActivityBars({ history }: Props) {
  const { t, i18n } = useTranslation();

  // Build the last 7 UTC days, oldest first.
  const today = startOfTodayUTC();
  const days: { ts: number; count: number; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const ts = today - i * DAY_MS;
    // (Mon = 0 reordering to match DAY_KEYS' Mon-first layout.)
    const idx = (new Date(ts).getUTCDay() + 6) % 7;
    days.push({
      ts,
      count: 0,
      label: t(`puzzles.hub.days.${DAY_KEYS[idx]!}`),
    });
  }

  for (const a of history) {
    const dayIdx = Math.floor((a.timestamp - days[0]!.ts) / DAY_MS);
    if (dayIdx >= 0 && dayIdx < 7) {
      days[dayIdx]!.count += 1;
    }
  }

  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="cr-card pz-activity">
      <div className="cr-card-hd">
        <div className="cr-card-title">{t('puzzles.hub.activity.title')}</div>
        <span className="cr-pill cr-pill-mono">
          {t('puzzles.hub.activity.solved', { count: total })}
        </span>
      </div>
      <div className="pz-bars">
        {days.map((d, i) => (
          <div key={i} className="pz-bar-col">
            <div className="pz-bar-track">
              <div
                className="pz-bar-fill"
                style={{ height: `${(d.count / max) * 100}%` }}
                title={t('puzzles.hub.activity.tooltip', {
                  count: d.count,
                  date: formatDay(d.ts, i18n.language),
                })}
              />
            </div>
            <div className="pz-bar-day">{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function startOfTodayUTC(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function formatDay(ts: number, lang: string): string {
  const d = new Date(ts);
  // ts comes from startOfTodayUTC() which is UTC-anchored; format in UTC
  // so the bar label matches the day the count belongs to.
  return d.toLocaleDateString(lang.startsWith('de') ? 'de-DE' : 'en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
