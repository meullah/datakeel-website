// Logo collapse (Story 2.3): scroll-to-progress math, the header mark as a dock target, and the logo crossfade.

/** Scrolling this percentage of the viewport height docks the Hero Story fully into the header logo. */
export const DOCK_PERCENT = 55;
/** The logo scene spans -0.72..0.72 in unit space (story-scenes `logo()`), so the mark's half width maps to 0.72. */
const LOGO_SCALE = 0.72;

// ponytail: own clamp/smooth (same as story-scenes) so header-scroll, on every page, never pulls in the scene module.
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Dock progress 0..1 for a scroll position; 0 when the viewport has no height or the input is not a number. */
export function scrollDockProgress(scrollY: number, vh: number): number {
  const distance = (vh * DOCK_PERCENT) / 100; // not vh * 0.55, which gives 440.00000000000006 for 800
  if (!(distance > 0) || !Number.isFinite(scrollY)) return 0;
  return clamp01(scrollY / distance);
}

/** Where the logo scene lands: the centre of the mark's box, scaled so the scene fills the mark. */
export function targetFromRect(rect: { left: number; top: number; width: number; height: number }) {
  return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, half: rect.width / 2 / LOGO_SCALE };
}

/** Particle alpha while docking: full until 82%, then fades out over the last 18% so the real logo takes over. */
export function particleAlpha(progress: number): number {
  return 1 - smooth((progress - 0.82) / 0.18);
}

/**
 * Header logo opacity for a dock progress: dims while the particles fly in, then fades back in
 * exactly as the particles fade out (particleAlpha), so the two always add up.
 */
export function logoOpacity(progress: number): number {
  return Math.max(1 - smooth(progress / 0.4), 1 - particleAlpha(progress));
}
