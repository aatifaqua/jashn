/**
 * Light and dark themes. With no saved choice the page follows the system setting through
 * CSS alone; a choice made with the toggle is saved and set as `data-theme` on <html>.
 */

type Theme = 'light' | 'dark';

/** Separate from the plans key so clearing plans never resets the theme, and vice versa. */
export const THEME_KEY = 'jashn.theme';

/** The saved theme, or null to follow the system. */
export function savedTheme(storage: Storage | null): Theme | null {
  try {
    const value = storage?.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** The theme in effect: the saved one, else the system preference. */
export function currentTheme(storage: Storage | null): Theme {
  const saved = savedTheme(storage);
  if (saved !== null) return saved;
  const query =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  return query?.matches === true ? 'dark' : 'light';
}

/** Applies a theme to the document and saves it (saving is best effort). */
export function setTheme(theme: Theme, storage: Storage | null, root: HTMLElement): void {
  root.dataset.theme = theme;
  try {
    storage?.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked or full: the theme still applies for this visit.
  }
}
