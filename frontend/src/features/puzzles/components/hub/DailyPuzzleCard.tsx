import { CalendarDays, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Board } from '../../../../components/Board';
import type { Puzzle } from '../../types';
import { applyUci } from '../../utils/validateSolution';
import { useThemeNames } from '../../utils/i18nHelpers';

interface Props {
  puzzle: Puzzle;
  date: string;
  onStart: () => void;
  onViewCalendar: () => void;
}

export function DailyPuzzleCard({
  puzzle,
  date,
  onStart,
  onViewCalendar,
}: Props) {
  const { t, i18n } = useTranslation();
  const prettyTheme = useThemeNames();
  // Show the position the user actually solves from (after opponent's setup).
  const displayFen = applyUci(puzzle.fen, puzzle.moves[0] ?? '') ?? puzzle.fen;
  const userColor = userColorOf(puzzle);

  return (
    <div className="pz-daily">
      <div className="pz-daily-l">
        <div className="pz-daily-eyebrow">
          {t('puzzles.hub.daily.eyebrow', {
            date: formatDate(date, i18n.language),
          })}
        </div>
        <div className="pz-daily-title">{titleFor(puzzle, t)}</div>
        <div className="pz-daily-meta">
          {puzzle.themes.slice(0, 2).map((tag) => (
            <span key={tag} className="cr-chip">
              {prettyTheme(tag)}
            </span>
          ))}
          <span className="cr-pill cr-pill-mono">★ {puzzle.rating}</span>
          <span className="pz-daily-solvers">
            {t('puzzles.hub.daily.solvers', {
              value: puzzle.nbPlays.toLocaleString(localeForCount(i18n.language)),
            })}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={onStart} className="pz-daily-cta">
            <Play size={14} />
            {t('puzzles.hub.daily.start')}
          </button>
          <button
            type="button"
            onClick={onViewCalendar}
            className="inline-flex items-center gap-2 px-3 h-9 mt-2 rounded-[9px] border border-line-2 bg-wood-card text-ink-2 text-[12.5px] font-medium hover:bg-wood-hover hover:text-ink transition-colors"
          >
            <CalendarDays size={14} />
            {t('puzzles.hub.daily.viewCalendar')}
          </button>
        </div>
      </div>
      <div className="pz-daily-board">
        <div>
          <Board fen={displayFen} size={192} orientation={userColor} />
        </div>
      </div>
    </div>
  );
}

function userColorOf(puzzle: Puzzle): 'white' | 'black' {
  const side = puzzle.fen.split(' ')[1];
  return side === 'w' ? 'black' : 'white';
}

function formatDate(yyyymmdd: string, lang: string): string {
  const [y, m, d] = yyyymmdd.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return yyyymmdd;
  const date = new Date(Date.UTC(y, m - 1, d));
  // Render in UTC so users west of UTC don't see the previous day's label —
  // the daily-puzzle key is UTC-anchored and the display should match.
  return date.toLocaleDateString(localeForDate(lang), {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function localeForDate(lang: string): string {
  return lang.startsWith('de') ? 'de-DE' : 'en-US';
}

function localeForCount(lang: string): string {
  return lang.startsWith('de') ? 'de-DE' : 'en-US';
}

function titleFor(
  puzzle: Puzzle,
  t: (key: string) => string,
): string {
  const themes = puzzle.themes;
  if (themes.includes('mateIn1')) return t('puzzles.hub.daily.title.mateIn1');
  if (themes.includes('mateIn2')) return t('puzzles.hub.daily.title.mateIn2');
  if (themes.includes('mateIn3')) return t('puzzles.hub.daily.title.mateIn3');
  if (themes.includes('mateIn4')) return t('puzzles.hub.daily.title.mateIn4');
  if (themes.includes('sacrifice')) return t('puzzles.hub.daily.title.sacrifice');
  if (themes.includes('discoveredAttack')) return t('puzzles.hub.daily.title.discoveredAttack');
  if (themes.includes('fork')) return t('puzzles.hub.daily.title.fork');
  if (themes.includes('pin')) return t('puzzles.hub.daily.title.pin');
  if (themes.includes('skewer')) return t('puzzles.hub.daily.title.skewer');
  if (themes.includes('zugzwang')) return t('puzzles.hub.daily.title.zugzwang');
  if (themes.includes('endgame')) return t('puzzles.hub.daily.title.endgame');
  return t('puzzles.hub.daily.title.default');
}
