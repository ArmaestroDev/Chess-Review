import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PuzzleAttempt, PuzzleProgress } from '../../types';
import { useThemeNames } from '../../utils/i18nHelpers';

interface Props {
  history: PuzzleProgress['history'];
  onPickAttempt: (puzzleId: string) => void;
  limit?: number;
}

export function RecentAttemptsCard({ history, onPickAttempt, limit = 8 }: Props) {
  const { t, i18n } = useTranslation();
  const prettyTheme = useThemeNames();

  const recent = useMemo(() => {
    return [...history]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }, [history, limit]);

  return (
    <div className="cr-card pz-recent">
      <div className="cr-card-hd">
        <div className="cr-card-title">{t('puzzles.hub.recent.title')}</div>
      </div>

      {recent.length === 0 ? (
        <div className="px-4 pt-1 pb-3 text-[11.5px] text-ink-3 leading-snug">
          {t('puzzles.hub.recent.empty')}
        </div>
      ) : (
        <div className="pz-recent-list" role="list">
          {recent.map((a) => (
            <button
              key={`${a.puzzleId}-${a.timestamp}`}
              type="button"
              onClick={() => onPickAttempt(a.puzzleId)}
              className="pz-recent-row"
              role="listitem"
            >
              <ResultBadge result={a.result} />
              <span className="pz-recent-theme">{prettyTheme(bestThemeOf(a.themes))}</span>
              <span className="pz-recent-meta">
                <span
                  className={
                    'pz-recent-delta ' +
                    (a.delta >= 0 ? 'pz-recent-delta--pos' : 'pz-recent-delta--neg')
                  }
                >
                  {a.delta >= 0 ? `+${a.delta}` : a.delta}
                </span>
                <span className="pz-recent-when">
                  {formatRelative(a.timestamp, i18n.language)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultBadge({ result }: { result: PuzzleAttempt['result'] }) {
  const solved = result === 'solve';
  return (
    <span
      className={
        'pz-recent-badge ' +
        (solved ? 'pz-recent-badge--solved' : 'pz-recent-badge--failed')
      }
      aria-label={solved ? 'solved' : 'failed'}
    >
      {solved ? <Check size={12} /> : <X size={12} />}
    </span>
  );
}

const PRIORITY_THEMES = [
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'mateIn4',
  'mateIn5',
  'sacrifice',
  'discoveredAttack',
  'fork',
  'pin',
  'skewer',
  'doubleCheck',
  'zugzwang',
  'endgame',
  'opening',
  'middlegame',
  'queensideAttack',
  'kingsideAttack',
];

function bestThemeOf(themes: string[]): string {
  for (const k of PRIORITY_THEMES) if (themes.includes(k)) return k;
  return themes[0] ?? 'tactic';
}

function formatRelative(ms: number, lang: string): string {
  const rtf = new Intl.RelativeTimeFormat(lang, {
    numeric: 'always',
    style: 'short',
  });
  const diff = Date.now() - ms;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return rtf.format(0, 'minute');
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  return rtf.format(-days, 'day');
}
