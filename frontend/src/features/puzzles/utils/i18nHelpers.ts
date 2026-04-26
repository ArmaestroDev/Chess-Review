import { useTranslation } from 'react-i18next';
import type { Tier } from '../types';

/**
 * Localized "pretty theme" name lookup. Falls back to a humanized version of
 * the camelCase tag if the translation key is missing — keeps unknown themes
 * from rendering as raw keys.
 */
export function useThemeNames() {
  const { t, i18n } = useTranslation();
  return (theme: string): string => {
    const key = `puzzles.themeNames.${theme}`;
    // i18n.exists checks the loaded resources; avoids returning the key itself.
    if (i18n.exists(key)) return t(key);
    return humanize(theme);
  };
}

export function useTierLabel() {
  const { t } = useTranslation();
  return (tier: Tier): string => t(`puzzles.hub.difficulty.${tier}`);
}

function humanize(theme: string): string {
  return theme
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
