import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { Header } from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import { ReviewPage } from './pages/ReviewPage';
import {
  applyTheme,
  loadSettings,
  saveSettings,
  type Settings as AppSettings,
} from './utils/settings';
import { isMuted, setMuted } from './utils/sounds';

// Lazy-load the entire puzzles feature. Review-only users never download the
// 90 KB daily catalog + ~115 KB-each tier JSONs; they're code-split into a
// separate chunk that loads on first /puzzles navigation.
const PuzzleHubPage = lazy(() =>
  import('./pages/PuzzleHubPage').then((m) => ({ default: m.PuzzleHubPage })),
);
const PuzzleSolverPage = lazy(() =>
  import('./pages/PuzzleSolverPage').then((m) => ({
    default: m.PuzzleSolverPage,
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
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

function AppLayout() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const toggleOrientation = useCallback(() => {
    setOrientation((o) => (o === 'white' ? 'black' : 'white'));
  }, []);

  return (
    <div className="min-h-screen wood-bg flex flex-col">
      <Header
        onFlipBoard={toggleOrientation}
        onToggleMute={toggleMute}
        onOpenSettings={() => setSettingsOpen(true)}
        muted={muted}
      />

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
              <PuzzleHubPage />
            </Suspense>
          }
        />
        <Route
          path="/puzzles/:id"
          element={
            <Suspense fallback={<PuzzlesFallback />}>
              <PuzzleSolverPage
                orientation={orientation}
                setOrientation={setOrientation}
              />
            </Suspense>
          }
        />
      </Routes>

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
