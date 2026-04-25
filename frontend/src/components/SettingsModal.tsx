import { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import { type Settings, type ThemeId, THEMES } from '../utils/settings';

interface Props {
  open: boolean;
  initial: Settings;
  onClose: () => void;
  onSave: (next: Settings) => void;
}

export function SettingsModal({ open, initial, onClose, onSave }: Props) {
  const [theme, setTheme] = useState<ThemeId>(initial.theme);
  const [username, setUsername] = useState(initial.chessComUsername);

  // Re-sync local form state if the dialog re-opens with different initial values.
  useEffect(() => {
    if (open) {
      setTheme(initial.theme);
      setUsername(initial.chessComUsername);
    }
  }, [open, initial.theme, initial.chessComUsername]);

  // Close on Esc.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSave() {
    onSave({ theme, chessComUsername: username.trim() });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 cr-backdrop flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="cr-card w-full max-w-[520px] shadow-card-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
          <div>
            <div className="font-serif font-semibold text-[18px] tracking-[-0.01em]">
              Settings
            </div>
            <div className="text-[11.5px] text-ink-3 mt-0.5">
              Saved on this device
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-line bg-wood-card text-ink-2 inline-flex items-center justify-center hover:bg-wood-hover hover:text-ink transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-5">
          {/* Theme */}
          <section>
            <div className="cr-card-title mb-2.5">Theme</div>
            <div className="grid grid-cols-2 gap-2.5">
              {THEMES.map((t) => (
                <ThemeOption
                  key={t.id}
                  theme={t}
                  selected={t.id === theme}
                  onClick={() => setTheme(t.id)}
                />
              ))}
            </div>
          </section>

          {/* Default chess.com username */}
          <section>
            <div className="cr-card-title mb-2">Default chess.com user</div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username (leave empty for none)"
              className="w-full h-9 px-2.5 rounded-[7px] border border-line-2 bg-wood-dark/60 text-[12.5px] text-ink outline-none focus:border-accent focus:bg-wood-card focus:ring-2 focus:ring-accent-soft transition-all"
              spellCheck={false}
              autoComplete="off"
            />
            <div className="text-[11px] text-ink-3 mt-1.5 leading-snug">
              When set, the home screen pre-fills this username and loads the recent
              games automatically.
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-line bg-wood-dark/40">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 rounded-[7px] border border-line-2 bg-wood-card text-ink-2 text-[12px] font-medium hover:bg-wood-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="h-8 px-4 rounded-[7px] text-[12px] font-semibold accent-grad text-wood-dark"
            style={{
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 1px 2px rgba(0, 0, 0, 0.3)',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeOption({
  theme,
  selected,
  onClick,
}: {
  theme: (typeof THEMES)[number];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'relative text-left rounded-[10px] border p-3 transition-all ' +
        (selected
          ? 'border-accent shadow-[0_0_0_2px_var(--accent-soft)]'
          : 'border-line hover:border-line-2')
      }
      style={{
        background: theme.card,
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-md border flex-shrink-0"
          style={{
            background: theme.bg,
            borderColor: 'rgba(245, 232, 200, 0.18)',
          }}
        />
        <div
          className="w-9 h-9 rounded-md border flex-shrink-0"
          style={{
            background: theme.accent,
            borderColor: 'rgba(0, 0, 0, 0.2)',
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold" style={{ color: '#f4ecd8' }}>
            {theme.label}
          </div>
          <div className="text-[10.5px] mt-0.5 leading-snug" style={{ color: 'rgba(244, 236, 216, 0.6)' }}>
            {theme.description}
          </div>
        </div>
      </div>
      {selected && (
        <div
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: theme.accent, color: '#1d1a14' }}
        >
          <Check size={12} strokeWidth={3} />
        </div>
      )}
    </button>
  );
}
