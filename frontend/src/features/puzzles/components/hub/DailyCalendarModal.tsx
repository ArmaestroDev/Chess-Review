import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useElo } from '../../hooks/useElo';
import {
  puzzleIdForDate,
  todayDateKey,
} from '../../hooks/useDailyPuzzle';
import type { PuzzleAttempt } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface DayCell {
  key: string;
  day: number;
  isFuture: boolean;
  isToday: boolean;
  attempt: PuzzleAttempt | null;
}

export function DailyCalendarModal({ open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { progress } = useElo();

  const [viewMonth, setViewMonth] = useState<Date>(() => firstOfThisUtcMonth());

  // Reset to current month each time the modal opens — otherwise it sticks on
  // whatever month was last viewed across opens, which is rarely what's wanted.
  useEffect(() => {
    if (open) setViewMonth(firstOfThisUtcMonth());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const todayKey = todayDateKey();
  const todayMonthFirst = firstOfThisUtcMonth();
  const isAtCurrentMonth = sameUtcMonth(viewMonth, todayMonthFirst);

  const cells = useMemo(
    () => buildCells(viewMonth, todayKey, progress.dailyHistory),
    [viewMonth, todayKey, progress.dailyHistory],
  );

  const monthLabel = useMemo(() => {
    const locale = i18n.language.startsWith('de') ? 'de-DE' : 'en-US';
    return viewMonth.toLocaleDateString(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }, [viewMonth, i18n.language]);

  function shiftMonth(delta: number) {
    setViewMonth((m) => {
      const next = new Date(
        Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + delta, 1),
      );
      if (delta > 0 && next > todayMonthFirst) return m;
      return next;
    });
  }

  function handleDay(cell: DayCell) {
    if (cell.isFuture) return;
    onClose();
    navigate(`/puzzles/${puzzleIdForDate(cell.key)}`);
  }

  if (!open) return null;

  const weekdays = [
    t('puzzles.calendar.weekday.mon'),
    t('puzzles.calendar.weekday.tue'),
    t('puzzles.calendar.weekday.wed'),
    t('puzzles.calendar.weekday.thu'),
    t('puzzles.calendar.weekday.fri'),
    t('puzzles.calendar.weekday.sat'),
    t('puzzles.calendar.weekday.sun'),
  ];

  return (
    <div
      className="fixed inset-0 z-50 cr-backdrop flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="cr-card w-full max-w-[400px] shadow-card-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-line">
          <div className="font-serif font-semibold text-[15px] tracking-[-0.01em]">
            {t('puzzles.calendar.title')}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md text-ink-3 hover:bg-wood-hover hover:text-ink inline-flex items-center justify-center transition-colors"
            title={t('puzzles.calendar.close')}
            aria-label={t('puzzles.calendar.close')}
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="w-8 h-8 rounded-md text-ink-2 hover:bg-wood-hover hover:text-ink inline-flex items-center justify-center transition-colors"
            title={t('puzzles.calendar.prevMonth')}
            aria-label={t('puzzles.calendar.prevMonth')}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="font-semibold text-[14px] text-ink">{monthLabel}</div>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={isAtCurrentMonth}
            className="w-8 h-8 rounded-md text-ink-2 hover:bg-wood-hover hover:text-ink inline-flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink-2"
            title={t('puzzles.calendar.nextMonth')}
            aria-label={t('puzzles.calendar.nextMonth')}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 px-3">
          {weekdays.map((wd, i) => (
            <div
              key={i}
              className="text-[10.5px] text-ink-4 text-center font-medium tracking-[0.04em] uppercase pb-2"
            >
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 px-3 pb-4">
          {cells.map((cell, i) =>
            cell === null ? (
              <div key={`b-${i}`} className="aspect-square" />
            ) : (
              <DayButton
                key={cell.key}
                cell={cell}
                onClick={() => handleDay(cell)}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function DayButton({
  cell,
  onClick,
}: {
  cell: DayCell;
  onClick: () => void;
}) {
  const hasAttempt = !!cell.attempt;
  const isSolve =
    !!cell.attempt &&
    (cell.attempt.result === 'solve' || cell.attempt.result === 'hint');

  const base =
    'relative aspect-square inline-flex items-center justify-center text-[13px] font-medium rounded-full transition-colors';
  const className = cell.isFuture
    ? `${base} text-ink-5 cursor-not-allowed`
    : cell.isToday
      ? `${base} ring-1 ring-accent text-ink hover:bg-accent-soft`
      : `${base} text-ink-2 hover:bg-wood-hover hover:text-ink`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cell.isFuture}
      className={className}
    >
      <span>{cell.day}</span>
      {hasAttempt && (
        <span
          className={
            'absolute top-0.5 right-0.5 w-3 h-3 rounded-full inline-flex items-center justify-center ' +
            (isSolve
              ? 'bg-emerald-600/85 text-white'
              : 'bg-rose-600/80 text-white')
          }
          aria-hidden
        >
          <Check size={8} strokeWidth={3.5} />
        </span>
      )}
    </button>
  );
}

function firstOfThisUtcMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function sameUtcMonth(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth()
  );
}

function buildCells(
  monthFirst: Date,
  todayKey: string,
  dailyHistory: Record<string, PuzzleAttempt>,
): (DayCell | null)[] {
  const year = monthFirst.getUTCFullYear();
  const month = monthFirst.getUTCMonth();
  // Shift JS Sunday=0..Saturday=6 → Monday=0..Sunday=6 so the column order matches
  // the weekday header.
  const firstDow = (monthFirst.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = formatKey(year, month, d);
    cells.push({
      key,
      day: d,
      isFuture: key > todayKey,
      isToday: key === todayKey,
      attempt: dailyHistory[key] ?? null,
    });
  }
  return cells;
}

function formatKey(year: number, monthIdx: number, day: number): string {
  return [
    year,
    String(monthIdx + 1).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}
