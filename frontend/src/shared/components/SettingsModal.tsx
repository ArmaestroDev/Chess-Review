import { useEffect, useState } from 'react';
import { X, Check, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  type Language,
  type Settings,
  type ThemeId,
  type ThemeMode,
  THEMES,
} from '../utils/settings';

interface Props {
  open: boolean;
  initial: Settings;
  onClose: () => void;
  onSave: (next: Settings) => void;
}

export function SettingsModal({
  open,
  initial,
  onClose,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<ThemeId>(initial.theme);
  const [mode, setMode] = useState<ThemeMode>(initial.mode);
  const [language, setLanguage] = useState<Language>(initial.language);
  const [username, setUsername] = useState(initial.chessComUsername);

  // Re-sync local form state if the dialog re-opens with different initial values.
  useEffect(() => {
    if (open) {
      setTheme(initial.theme);
      setMode(initial.mode);
      setLanguage(initial.language);
      setUsername(initial.chessComUsername);
    }
  }, [open, initial.theme, initial.mode, initial.language, initial.chessComUsername]);

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
    onSave({ theme, mode, language, chessComUsername: username.trim() });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 cr-backdrop flex items-center justify-center p-6 cr-modal-mobile-fullscreen"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="cr-card w-full max-w-[520px] shadow-card-md overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
          <div>
            <div className="font-serif font-semibold text-[18px] tracking-[-0.01em]">
              {t('settings.title')}
            </div>
            <div className="text-[11.5px] text-ink-3 mt-0.5">
              {t('settings.subtitle')}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-line bg-wood-card text-ink-2 inline-flex items-center justify-center hover:bg-wood-hover hover:text-ink transition-colors"
            title={t('settings.close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-5">
          {/* Mode (light/dark) */}
          <section>
            <div className="cr-card-title mb-2.5">{t('settings.mode.title')}</div>
            <div className="grid grid-cols-2 gap-2">
              <ToggleOption
                label={t('settings.mode.light')}
                icon={<Sun size={14} />}
                selected={mode === 'light'}
                onClick={() => setMode('light')}
              />
              <ToggleOption
                label={t('settings.mode.dark')}
                icon={<Moon size={14} />}
                selected={mode === 'dark'}
                onClick={() => setMode('dark')}
              />
            </div>
          </section>

          {/* Language */}
          <section>
            <div className="cr-card-title mb-2.5">{t('settings.language.title')}</div>
            <div className="grid grid-cols-2 gap-2">
              <ToggleOption
                label={t('settings.language.en')}
                selected={language === 'en'}
                onClick={() => setLanguage('en')}
              />
              <ToggleOption
                label={t('settings.language.de')}
                selected={language === 'de'}
                onClick={() => setLanguage('de')}
              />
            </div>
          </section>

          {/* Theme */}
          <section>
            <div className="cr-card-title mb-2.5">{t('settings.theme.title')}</div>
            <div className="grid grid-cols-2 gap-2.5">
              {THEMES.map((th) => (
                <ThemeOption
                  key={th.id}
                  theme={th}
                  mode={initial.mode}
                  label={t(`settings.theme.${th.id}.label`)}
                  description={t(`settings.theme.${th.id}.description`)}
                  selected={th.id === theme}
                  onClick={() => setTheme(th.id)}
                />
              ))}
            </div>
          </section>

          {/* Default chess.com username */}
          <section>
            <div className="cr-card-title mb-2">{t('settings.chessCom.title')}</div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('settings.chessCom.placeholder')}
              className="w-full h-9 px-2.5 rounded-[7px] border border-line-2 bg-wood-dark/60 text-[12.5px] text-ink outline-none focus:border-accent focus:bg-wood-card focus:ring-2 focus:ring-accent-soft transition-all"
              spellCheck={false}
              autoComplete="off"
            />
            <div className="text-[11px] text-ink-3 mt-1.5 leading-snug">
              {t('settings.chessCom.hint')}
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
            {t('settings.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="h-8 px-4 rounded-[7px] text-[12px] font-semibold accent-grad"
            style={{
              color: initial.mode === 'light' ? '#fff' : '#1d1a14',
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 1px 2px rgba(0, 0, 0, 0.3)',
            }}
          >
            {t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleOption({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex items-center justify-center gap-2 h-10 rounded-[8px] border text-[12.5px] font-medium transition-colors ' +
        (selected
          ? 'border-accent bg-accent-soft text-accent-ink'
          : 'border-line bg-wood-card text-ink-2 hover:border-line-2 hover:text-ink')
      }
    >
      {icon}
      {label}
    </button>
  );
}

function ThemeOption({
  theme,
  mode,
  label,
  description,
  selected,
  onClick,
}: {
  theme: (typeof THEMES)[number];
  mode: ThemeMode;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  const palette = mode === 'light' ? theme.light : theme.dark;
  const isLight = mode === 'light';
  const titleColor = isLight ? '#1d1a14' : '#f4ecd8';
  const descColor = isLight ? 'rgba(29, 26, 20, 0.65)' : 'rgba(244, 236, 216, 0.6)';
  const swatchBorder = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(245, 232, 200, 0.18)';
  const checkColor = isLight ? '#fff' : '#1d1a14';
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
        background: palette.card,
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-md border flex-shrink-0"
          style={{ background: palette.bg, borderColor: swatchBorder }}
        />
        <div
          className="w-9 h-9 rounded-md border flex-shrink-0"
          style={{ background: palette.accent, borderColor: 'rgba(0, 0, 0, 0.2)' }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold" style={{ color: titleColor }}>
            {label}
          </div>
          <div className="text-[10.5px] mt-0.5 leading-snug" style={{ color: descColor }}>
            {description}
          </div>
        </div>
      </div>
      {selected && (
        <div
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: palette.accent, color: checkColor }}
        >
          <Check size={12} strokeWidth={3} />
        </div>
      )}
    </button>
  );
}
