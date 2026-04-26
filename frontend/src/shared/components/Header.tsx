import { Settings as SettingsIcon, Volume2, VolumeX } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconBtn } from './IconBtn';

interface Props {
  onToggleMute: () => void;
  onOpenSettings: () => void;
  muted: boolean;
}

export function Header({
  onToggleMute,
  onOpenSettings,
  muted,
}: Props) {
  const { t } = useTranslation();
  return (
    <header className="cr-header sticky top-0 z-10 px-7 py-3.5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center max-w-[1600px] mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div
            className="w-[34px] h-[34px] rounded-[9px]"
            role="img"
            aria-label={t('header.brand.logoAlt')}
            style={{
              backgroundColor: '#f3eee2',
              backgroundImage: 'url(/Logo.jpg)',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '120px auto',
              backgroundPosition: '50% 22%',
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 2px rgba(0, 0, 0, 0.5)',
            }}
          />
          <div className="leading-none">
            <div className="font-serif font-semibold text-[17px] tracking-[-0.01em]">
              {t('header.brand.title')}
            </div>
            <div className="text-[10.5px] text-ink-3 mt-[3px] tracking-[0.02em]">
              {t('header.brand.subtitle')}
            </div>
          </div>
        </div>

        <nav className="flex gap-1 p-[3px] bg-wood-dark/70 rounded-full border border-line">
          <NavPill to="/" end>
            {t('header.nav.review')}
          </NavPill>
          <NavPill to="/puzzles">{t('header.nav.puzzles')}</NavPill>
        </nav>

        <div className="flex gap-2 items-center justify-self-end">
          <IconBtn
            onClick={onToggleMute}
            title={muted ? t('header.actions.unmute') : t('header.actions.mute')}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </IconBtn>
          <IconBtn onClick={onOpenSettings} title={t('header.actions.settings')}>
            <SettingsIcon size={16} />
          </IconBtn>
        </div>
      </div>
    </header>
  );
}

const NAV_PILL_BASE =
  'px-4 py-[7px] text-[12.5px] font-medium rounded-full transition-colors cursor-pointer select-none';
const NAV_PILL_INACTIVE = 'text-ink-3 hover:text-ink';
const NAV_PILL_ACTIVE = 'bg-wood-card text-ink shadow-card';

function NavPill({
  to,
  end,
  children,
}: {
  to: string;
  end?: boolean;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `${NAV_PILL_BASE} ${isActive ? NAV_PILL_ACTIVE : NAV_PILL_INACTIVE}`
      }
    >
      {children}
    </NavLink>
  );
}
