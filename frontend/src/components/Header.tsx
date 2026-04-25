import { ArrowUpDown, Settings as SettingsIcon, Volume2, VolumeX } from 'lucide-react';

interface Props {
  onReset: () => void;
  onFlipBoard: () => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  muted: boolean;
  hasGame: boolean;
}

export function Header({
  onReset,
  onFlipBoard,
  onToggleMute,
  onOpenSettings,
  muted,
  hasGame,
}: Props) {
  return (
    <header className="cr-header sticky top-0 z-10 px-7 py-3.5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center max-w-[1600px] mx-auto w-full">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center text-accent-ink"
            style={{
              background:
                'linear-gradient(180deg, rgb(var(--wood-card)), rgb(var(--wood-dark)))',
              boxShadow:
                'inset 0 1px 0 var(--accent-soft), 0 1px 2px rgba(0, 0, 0, 0.5)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2 L8 6 v3 H6 v3 h3 v8 h6 v-8 h3 v-3 h-2 V6 z" />
            </svg>
          </div>
          <div className="leading-none">
            <div className="font-serif font-semibold text-[17px] tracking-[-0.01em]">
              Chess Review
            </div>
            <div className="text-[10.5px] text-ink-3 mt-[3px] tracking-[0.02em]">
              Stockfish-powered analysis
            </div>
          </div>
        </div>

        {/* Nav (pill) */}
        <nav className="flex gap-1 p-[3px] bg-wood-dark/70 rounded-full border border-line">
          <NavLink active>Review</NavLink>
          <NavLink onClick={onReset} disabled={!hasGame}>
            New game
          </NavLink>
        </nav>

        {/* Actions */}
        <div className="flex gap-2 items-center justify-self-end">
          <IconBtn onClick={onFlipBoard} title="Flip board">
            <ArrowUpDown size={16} />
          </IconBtn>
          <IconBtn onClick={onToggleMute} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </IconBtn>
          <IconBtn onClick={onOpenSettings} title="Settings">
            <SettingsIcon size={16} />
          </IconBtn>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  children,
  active,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'px-4 py-[7px] text-[12.5px] font-medium rounded-full transition-colors cursor-pointer select-none ' +
        (active
          ? 'bg-wood-card text-ink shadow-card'
          : 'text-ink-3 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed')
      }
    >
      {children}
    </button>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="w-8 h-8 rounded-lg border border-line bg-wood-card text-ink-2 inline-flex items-center justify-center hover:bg-wood-hover hover:text-ink transition-colors"
    >
      {children}
    </button>
  );
}
