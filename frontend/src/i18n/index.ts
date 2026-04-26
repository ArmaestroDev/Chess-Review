import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import de from './de.json';
import { detectBrowserLanguage, loadSettings, type Language } from '../shared/utils/settings';

// Resolve the initial language synchronously: saved setting wins, else browser
// detection. We use the saved-language helper directly (not Settings.language)
// because main.tsx initializes i18n before any component reads settings.
function resolveInitialLanguage(): Language {
  try {
    const saved = loadSettings();
    return saved.language;
  } catch {
    return detectBrowserLanguage();
  }
}

const lang = resolveInitialLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  lng: lang,
  fallbackLng: 'en',
  supportedLngs: ['en', 'de'],
  interpolation: { escapeValue: false },
  // Strings ship with the JS bundle, so no async loading — Suspense not needed.
  react: { useSuspense: false },
  returnNull: false,
});

export default i18n;
