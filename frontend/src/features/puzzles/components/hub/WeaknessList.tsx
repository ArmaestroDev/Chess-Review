import { useTranslation } from 'react-i18next';
import type { PuzzleProgress } from '../../types';
import { useThemeNames } from '../../utils/i18nHelpers';

interface Props {
  history: PuzzleProgress['history'];
  onPickTheme: (theme: string) => void;
}

interface ThemeStat {
  theme: string;
  attempts: number;
  fails: number;
  failRate: number;
}

const MIN_ATTEMPTS_TO_QUALIFY = 2;
const VISIBLE = 3;

export function WeaknessList({ history, onPickTheme }: Props) {
  const { t } = useTranslation();
  const prettyTheme = useThemeNames();
  const stats = aggregateByTheme(history);
  const top = stats
    .filter((s) => s.attempts >= MIN_ATTEMPTS_TO_QUALIFY)
    .sort((a, b) => b.failRate - a.failRate)
    .slice(0, VISIBLE);

  return (
    <div className="cr-card pz-weakness">
      <div className="cr-card-hd">
        <div className="cr-card-title">{t('puzzles.hub.weakness.title')}</div>
      </div>

      {top.length === 0 ? (
        <div className="px-4 pt-1 pb-2 text-[11.5px] text-ink-3 leading-snug">
          {t('puzzles.hub.weakness.empty')}
        </div>
      ) : (
        <div className="pz-weak-list">
          {top.map((s) => (
            <button
              key={s.theme}
              type="button"
              onClick={() => onPickTheme(s.theme)}
              className="pz-weak-row"
              title={t('puzzles.hub.weakness.tooltip', {
                fails: s.fails,
                attempts: s.attempts,
              })}
            >
              <span className="pz-weak-theme">{prettyTheme(s.theme)}</span>
              <span className="pz-weak-track">
                <span
                  className="pz-weak-fill"
                  style={{ width: `${Math.round(s.failRate * 100)}%` }}
                />
              </span>
              <span className="pz-weak-pct">{Math.round(s.failRate * 100)}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function aggregateByTheme(history: PuzzleProgress['history']): ThemeStat[] {
  const byTheme = new Map<string, { attempts: number; fails: number }>();
  for (const a of history) {
    const themes = a.themes ?? [];
    const isFail = a.result !== 'solve';
    for (const tag of themes) {
      const cur = byTheme.get(tag) ?? { attempts: 0, fails: 0 };
      cur.attempts += 1;
      if (isFail) cur.fails += 1;
      byTheme.set(tag, cur);
    }
  }
  const out: ThemeStat[] = [];
  for (const [theme, { attempts, fails }] of byTheme) {
    out.push({ theme, attempts, fails, failRate: fails / attempts });
  }
  return out;
}
