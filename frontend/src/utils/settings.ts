// User-facing settings persisted to localStorage. Cheap, no auth required.

export type ThemeId = 'wood' | 'purple' | 'ocean' | 'lagoon';
export type ThemeMode = 'light' | 'dark';
export type Language = 'en' | 'de';

export interface Settings {
  theme: ThemeId;
  mode: ThemeMode;
  chessComUsername: string;
  language: Language;
}

const KEY = 'chess-engine-settings';

const VALID_LANGUAGES: Language[] = ['en', 'de'];

/** Pick the initial language from the browser if no saved value exists. */
export function detectBrowserLanguage(): Language {
  const navLang =
    typeof navigator !== 'undefined' ? navigator.language ?? '' : '';
  return navLang.toLowerCase().startsWith('de') ? 'de' : 'en';
}

const DEFAULT: Settings = {
  theme: 'wood',
  mode: 'light',
  chessComUsername: '',
  language: 'de',
};

const VALID_MODES: ThemeMode[] = ['light', 'dark'];

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return { ...DEFAULT, language: detectBrowserLanguage() };
    }
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: VALID_THEMES.includes(parsed.theme as ThemeId)
        ? (parsed.theme as ThemeId)
        : DEFAULT.theme,
      mode: VALID_MODES.includes(parsed.mode as ThemeMode)
        ? (parsed.mode as ThemeMode)
        : DEFAULT.mode,
      chessComUsername:
        typeof parsed.chessComUsername === 'string'
          ? parsed.chessComUsername
          : DEFAULT.chessComUsername,
      language: VALID_LANGUAGES.includes(parsed.language as Language)
        ? (parsed.language as Language)
        : detectBrowserLanguage(),
    };
  } catch {
    return { ...DEFAULT, language: detectBrowserLanguage() };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* localStorage unavailable — silent */
  }
}

export interface ThemePreview {
  id: ThemeId;
  label: string;
  description: string;
  bg: string;
  card: string;
  accent: string;
}

export const THEMES: ThemePreview[] = [
  {
    id: 'wood',
    label: 'Wood',
    description: 'Warm brown with amber accents',
    bg: '#3b2317',
    card: '#33201a',
    accent: '#d8b56a',
  },
  {
    id: 'purple',
    label: 'Midnight',
    description: 'Deep violet with lavender accents',
    bg: '#2d1f4a',
    card: '#2a1d44',
    accent: '#b594f5',
  },
  {
    id: 'ocean',
    label: 'Glass',
    description: 'Cool slate-blue with cyan accents',
    bg: '#1e2a3a',
    card: '#1d2a3e',
    accent: '#7ec3e0',
  },
  {
    id: 'lagoon',
    label: 'Lagoon',
    description: 'Deep teal with mint accents',
    bg: '#0f4a4a',
    card: '#0e4040',
    accent: '#5eebca',
  },
];

const VALID_THEMES: ThemeId[] = THEMES.map((t) => t.id);

/** Apply the chosen theme + mode to <html> by setting two classes. */
export function applyTheme(theme: ThemeId, mode: ThemeMode): void {
  const root = document.documentElement;
  for (const t of VALID_THEMES) {
    root.classList.remove(`theme-${t}`);
  }
  for (const m of VALID_MODES) {
    root.classList.remove(`mode-${m}`);
  }
  root.classList.add(`theme-${theme}`);
  root.classList.add(`mode-${mode}`);
}
