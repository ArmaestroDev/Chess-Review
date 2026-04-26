import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import {
  ArrowUpDown,
  Loader2,
  Settings as SettingsIcon,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { Header } from '../shared/components/Header';
import { IconBtn } from '../shared/components/IconBtn';
import {
  MobileTopBarProvider,
  useMobileTopBar,
} from '../shared/components/MobileTopBarContext';
import { MobileNav } from '../shared/components/MobileNav';
import { SettingsModal } from '../shared/components/SettingsModal';
import { ReviewPage } from '../pages/review/ReviewPage';
import {
  applyTheme,
  loadSettings,
  saveSettings,
  type Settings as AppSettings,
} from '../shared/utils/settings';
import { isMuted, setMuted } from '../shared/utils/sounds';
import { IsMobileProvider, useIsMobileContext } from '../hooks/useIsMobile';

// Lazy-load the entire puzzles feature. Review-only users never download the
// 90 KB daily catalog + ~115 KB-each tier JSONs; they're code-split into a
// separate chunk that loads on first /puzzles navigation.
const PuzzleHubPage = lazy(() =>
  import('../pages/puzzles/hub/PuzzleHubPage').then((m) => ({
    default: m.PuzzleHubPage,
  })),
);

function PuzzlesFallback() {
  const { t } = useTranslation();
  return (
    <main className="max-w-[1600px] mx-auto w-full px-7 py-10">
      <div className="flex items-center justify-center gap-2 text-ink-3 text-[13px]">
        <Loader2 size={16} className="animate-spin" />
        {t('loading.puzzles')}
      </div>
    </main>
  );
}

function App() {
  // IsMobileProvider owns a single matchMedia subscription so every consumer
  // flips in the same render rather than racing on independent useState updates.
  return (
    <IsMobileProvider>
      <MobileTopBarProvider>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </MobileTopBarProvider>
    </IsMobileProvider>
  );
}

function AppLayout() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isMobile = useIsMobileContext();
  const mobileTopBar = useMobileTopBar();

  useEffect(() => {
    applyTheme(settings.theme, settings.mode);
  }, [settings.theme, settings.mode]);

  // Keep the i18n runtime in sync with the saved language. Fires once on mount
  // (in case the saved language differs from i18n's resolved init value) and
  // again whenever the user changes it in Settings.
  useEffect(() => {
    if (i18n.language !== settings.language) {
      void i18n.changeLanguage(settings.language);
    }
  }, [settings.language]);

  const handleSaveSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      const next = !m;
      setMuted(next);
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen wood-bg flex flex-col">
      {isMobile ? (
        <header className="cr-mobile-topbar">
          <div className="flex items-center gap-2">
            <div
              className="w-[28px] h-[28px] rounded-[7px]"
              role="img"
              aria-label={t('header.brand.logoAlt')}
              style={{
                backgroundColor: '#f3eee2',
                backgroundImage: 'url(/Logo.jpg)',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '100px auto',
                backgroundPosition: '50% 22%',
                boxShadow:
                  'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 1px 2px rgba(0, 0, 0, 0.5)',
              }}
            />
            <div className="font-serif font-semibold text-[15px] tracking-[-0.01em]">
              {t('header.brand.title')}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {mobileTopBar.flipAvailable && (
              <IconBtn
                size="md"
                onClick={mobileTopBar.invokeFlip}
                title={t('header.actions.flipBoard')}
              >
                <ArrowUpDown size={16} />
              </IconBtn>
            )}
            {mobileTopBar.clearAvailable && (
              <IconBtn
                size="md"
                onClick={mobileTopBar.invokeClear}
                title={t('review.actions.clear')}
              >
                <Trash2 size={16} />
              </IconBtn>
            )}
            <IconBtn
              size="md"
              onClick={toggleMute}
              title={muted ? t('header.actions.unmute') : t('header.actions.mute')}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </IconBtn>
            <IconBtn
              size="md"
              onClick={() => setSettingsOpen(true)}
              title={t('header.actions.settings')}
            >
              <SettingsIcon size={16} />
            </IconBtn>
          </div>
        </header>
      ) : (
        <Header
          onToggleMute={toggleMute}
          onOpenSettings={() => setSettingsOpen(true)}
          muted={muted}
        />
      )}

      <Routes>
        <Route
          path="/"
          element={
            <ReviewPage
              settings={settings}
              orientation={orientation}
              setOrientation={setOrientation}
            />
          }
        />
        <Route
          path="/puzzles"
          element={
            <Suspense fallback={<PuzzlesFallback />}>
              <PuzzleHubPage
                settings={settings}
                orientation={orientation}
                setOrientation={setOrientation}
              />
            </Suspense>
          }
        />
        <Route
          path="/puzzles/:id"
          element={
            <Suspense fallback={<PuzzlesFallback />}>
              <PuzzleHubPage
                settings={settings}
                orientation={orientation}
                setOrientation={setOrientation}
              />
            </Suspense>
          }
        />
      </Routes>

      {isMobile && <MobileNav onOpenSettings={() => setSettingsOpen(true)} />}

      <SettingsModal
        open={settingsOpen}
        initial={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

export default App;
