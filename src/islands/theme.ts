// theme island: owns html[data-theme], the dk-theme key and every [data-theme-toggle] button.
import { THEME_CHANGE } from '../lib/pure/events.ts';
import { resolveTheme, THEME_KEY, type Theme } from '../lib/pure/theme.ts';

const root = document.documentElement;
const system = matchMedia('(prefers-color-scheme: dark)');

function saved(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null; // storage blocked: behave as unsaved
  }
}

function sync(theme: Theme) {
  for (const btn of document.querySelectorAll<HTMLElement>('[data-theme-toggle]')) {
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
    btn.hidden = false;
  }
}

function apply(theme: Theme) {
  root.dataset.theme = theme;
  sync(theme);
  document.dispatchEvent(new CustomEvent(THEME_CHANGE, { detail: { theme } }));
}

sync(root.dataset.theme === 'dark' ? 'dark' : 'light');

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element) || !event.target.closest('[data-theme-toggle]')) return;
  const theme: Theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // storage blocked: switched for this session only
  }
  apply(theme);
});

// No saved choice: follow the system live.
system.addEventListener('change', (e) => {
  const s = saved();
  if (s !== 'light' && s !== 'dark') apply(resolveTheme(null, e.matches));
});

// Another tab saved a choice.
addEventListener('storage', (e) => {
  if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')) apply(e.newValue);
});
