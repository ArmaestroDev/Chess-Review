import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, BookOpen, Puzzle } from 'lucide-react';

interface Props {
  onOpenSettings: () => void;
}

/**
 * Bottom tab bar shown only on mobile. Two route tabs (Review, Puzzles)
 * plus a Settings button that opens the modal owned by App.
 */
export function MobileNav({ onOpenSettings }: Props) {
  const { t } = useTranslation();
  return (
    <nav
      className="cr-mobile-nav"
      role="navigation"
      aria-label={t('header.mobileNav.label')}
    >
      <NavLink to="/" end className="cr-mobile-nav-tab">
        {({ isActive }) => (
          <>
            <BookOpen
              size={20}
              className={isActive ? 'cr-mobile-nav-icon-active' : ''}
            />
            <span
              className={
                isActive
                  ? 'cr-mobile-nav-label-active'
                  : 'cr-mobile-nav-label'
              }
            >
              {t('header.mobileNav.review')}
            </span>
          </>
        )}
      </NavLink>
      <NavLink to="/puzzles" className="cr-mobile-nav-tab">
        {({ isActive }) => (
          <>
            <Puzzle
              size={20}
              className={isActive ? 'cr-mobile-nav-icon-active' : ''}
            />
            <span
              className={
                isActive
                  ? 'cr-mobile-nav-label-active'
                  : 'cr-mobile-nav-label'
              }
            >
              {t('header.mobileNav.puzzles')}
            </span>
          </>
        )}
      </NavLink>
      <button
        type="button"
        onClick={onOpenSettings}
        className="cr-mobile-nav-tab"
        aria-label={t('header.mobileNav.settings')}
      >
        <SettingsIcon size={20} />
        <span className="cr-mobile-nav-label">
          {t('header.mobileNav.settings')}
        </span>
      </button>
    </nav>
  );
}
