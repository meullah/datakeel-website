// Nav rules shared by the Header, the header-scroll island and tests.

/** aria-current for a nav href: "page" on an exact match, "true" inside its section, else undefined. Home matches only itself. */
export function isCurrent(path: string, href: string): 'page' | 'true' | undefined {
  if (path === href) return 'page';
  if (href !== '/' && path.startsWith(href)) return 'true';
  return undefined;
}

/** Progress from a dk:hero-story:dock detail, clamped to 0..1; null when missing or not a number. */
export function dockProgress(detail: unknown): number | null {
  const p = (detail as { progress?: unknown } | null | undefined)?.progress;
  if (typeof p !== 'number' || !Number.isFinite(p)) return null;
  return Math.min(1, Math.max(0, p));
}

/** Scroll distance after which the transparent homepage header turns solid. */
export const SOLID_AFTER = 8;
