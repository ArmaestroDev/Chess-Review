import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  done: number;
  total: number;
  onCancel: () => void;
}

export function AnalyzingCard({ done, total, onCancel }: Props) {
  const { t } = useTranslation();
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="cr-card">
      <div className="cr-card-hd">
        <div className="cr-card-title">{t('review.analyzing.title')}</div>
        <span className="cr-pill cr-pill-mono">
          {done}/{total > 0 ? total : '…'}
        </span>
      </div>
      <div className="px-4 pb-4 flex flex-col items-center gap-3.5 text-center">
        <Loader2 size={32} className="animate-spin text-accent" />
        <div className="text-[12.5px] text-ink-2 leading-snug">
          {t('review.analyzing.description')}
        </div>
        <div className="w-full">
          <div className="h-1.5 bg-wood-dark/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full accent-grad transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11.5px] text-ink-3 hover:text-ink underline-offset-2 hover:underline"
        >
          {t('review.analyzing.cancel')}
        </button>
      </div>
    </div>
  );
}
