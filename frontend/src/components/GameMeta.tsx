import type { GameMeta as GameMetaT } from '../types';

interface Props {
  meta: GameMetaT;
  hasGame: boolean;
}

export function GameMeta({ meta, hasGame }: Props) {
  if (!hasGame) {
    return (
      <div className="cr-card p-4">
        <div className="cr-card-title mb-2">Game</div>
        <div className="font-serif text-[15px] text-ink-2 leading-snug">
          No game loaded yet.
        </div>
        <div className="text-[11.5px] text-ink-3 mt-1.5">
          Drag pieces to play freely, or load a PGN / chess.com game from the right.
        </div>
      </div>
    );
  }

  return (
    <div className="cr-card p-4">
      <div className="cr-card-title mb-2">Game</div>
      <div className="font-serif font-semibold text-[16px] tracking-[-0.01em] leading-tight">
        {(meta.whiteName ?? 'White') + ' vs ' + (meta.blackName ?? 'Black')}
      </div>
      <div className="text-[11px] text-ink-3 mt-1 tracking-[0.01em]">
        {meta.totalPlies > 0 ? `${meta.totalPlies} plies` : 'Loaded'}
      </div>

      <div className="mt-3.5 p-3 rounded-[10px] bg-wood-dark/60 flex flex-col gap-2">
        <PlayerRow
          color="white"
          name={meta.whiteName ?? 'White'}
          rating={meta.whiteElo}
        />
        <div className="text-[9.5px] text-ink-4 tracking-[0.1em] uppercase self-center">
          vs
        </div>
        <PlayerRow
          color="black"
          name={meta.blackName ?? 'Black'}
          rating={meta.blackElo}
        />
      </div>
    </div>
  );
}

function PlayerRow({
  color,
  name,
  rating,
}: {
  color: 'white' | 'black';
  name: string;
  rating: string | null;
}) {
  return (
    <div className="flex items-center gap-2 text-[12.5px]">
      <span
        className={
          'w-[10px] h-[10px] rounded-full border ' +
          (color === 'white'
            ? 'bg-stone-100 border-stone-700'
            : 'bg-stone-900 border-stone-900')
        }
      />
      <span className="flex-1 font-medium">{name}</span>
      {rating && <span className="font-mono text-[11px] text-ink-3">{rating}</span>}
    </div>
  );
}
