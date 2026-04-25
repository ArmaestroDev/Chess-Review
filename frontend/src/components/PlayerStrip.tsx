interface Props {
  color: 'white' | 'black';
  name: string;
  rating: string | null;
  active?: boolean;
  accuracy?: number | null;
}

export function PlayerStrip({ color, name, rating, active, accuracy }: Props) {
  return (
    <div
      className={
        'flex items-center justify-between px-3.5 py-2.5 rounded-[10px] border bg-wood-card transition-all shadow-card ' +
        (active
          ? 'border-accent shadow-[0_0_0_3px_rgba(216,181,106,0.16),0_1px_2px_rgba(0,0,0,0.25)]'
          : 'border-line')
      }
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={
            'w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-[13px] flex-shrink-0 border border-line-2 ' +
            (color === 'white'
              ? 'bg-stone-100 text-stone-900'
              : 'bg-stone-900 text-stone-100')
          }
          aria-hidden
        >
          {color === 'white' ? '♔' : '♚'}
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="text-[13px] font-semibold flex items-baseline gap-1.5">
            <span className="truncate">{name}</span>
            {rating && (
              <span className="font-mono text-[11px] text-ink-3 font-normal">
                {rating}
              </span>
            )}
          </div>
          {accuracy !== undefined && accuracy !== null && (
            <div className="text-[11px] text-ink-3">
              Accuracy{' '}
              <span className="font-mono text-ink-2 font-medium">
                {accuracy.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
