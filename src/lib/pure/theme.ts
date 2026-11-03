// Theme rule shared by the theme island and tests. BaseLayout's inline head script duplicates resolveTheme.
export const THEME_KEY = 'dk-theme';
export type Theme = 'light' | 'dark';

/** Saved choice wins; anything else (missing, invalid) falls back to the system setting, then light. */
export function resolveTheme(saved: string | null | undefined, systemDark: boolean): Theme {
  if (saved === 'light' || saved === 'dark') return saved;
  return systemDark ? 'dark' : 'light';
}
