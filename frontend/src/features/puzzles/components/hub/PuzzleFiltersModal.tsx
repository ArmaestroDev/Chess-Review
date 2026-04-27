import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PuzzleFilters } from './PuzzleFilters';
import type { useHubFilters } from '../../hooks/useHubFilters';

interface Props {
  open: boolean;
  onClose: () => void;
  filters: ReturnType<typeof useHubFilters>;
  excludeIds: ReadonlyArray<string>;
}

// Modal wrapper around the existing PuzzleFilters panel. Mirrors the
// SettingsModal / DailyCalendarModal pattern: cr-backdrop + cr-card,
// click-out-to-close, Escape-to-close, body click stopPropagation.
export function PuzzleFiltersModal({ open, onClose, filters, excludeIds }: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 cr-backdrop flex items-center justify-center p-6 cr-modal-mobile-fullscreen"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="cr-card w-full max-w-[560px] max-h-[85vh] flex flex-col shadow-card-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
          <div className="font-serif font-semibold text-[17px] tracking-[-0.01em]">
            {t('puzzles.hub.filters.adjustHeader')}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-line bg-wood-card text-ink-2 inline-flex items-center justify-center hover:bg-wood-hover hover:text-ink transition-colors"
            title={t('settings.close')}
            aria-label={t('settings.close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — scrolls internally; PuzzleFilters renders its own cr-card,
            so we wrap it so the inner card's flex-1 can stretch within the
            modal's bounded body. */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <PuzzleFilters filters={filters} excludeIds={excludeIds} />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-line bg-wood-dark/40">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-[7px] border border-line-2 bg-wood-card text-ink-2 text-[12px] font-medium hover:bg-wood-hover hover:text-ink transition-colors"
          >
            {t('settings.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
