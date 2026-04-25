interface Props {
  whiteAccuracy: number | null;
  blackAccuracy: number | null;
}

export function AccuracyCard({ whiteAccuracy, blackAccuracy }: Props) {
  if (whiteAccuracy === null && blackAccuracy === null) return null;
  return (
    <div className="cr-card pb-3">
      <div className="cr-card-hd">
        <div className="cr-card-title">Accuracy</div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 px-4">
        <AccBar
          label="White"
          score={whiteAccuracy ?? 0}
          tone="light"
        />
        <AccBar
          label="Black"
          score={blackAccuracy ?? 0}
          tone="dark"
        />
      </div>
    </div>
  );
}

function AccBar({
  label,
  score,
  tone,
}: {
  label: string;
  score: number;
  tone: 'light' | 'dark';
}) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div
      className={
        'p-2.5 rounded-[9px] border ' +
        (tone === 'light'
          ? 'bg-wood-dark/60 border-line'
          : 'bg-wood-dark border-line')
      }
    >
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] uppercase tracking-[0.06em] font-semibold text-ink-3">
          {label}
        </span>
        <span className="font-mono text-[18px] font-semibold">{pct.toFixed(1)}</span>
      </div>
      <div className="h-1 rounded-[2px] bg-line mt-2 overflow-hidden">
        <div
          className="h-full rounded-[2px] accent-grad transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
