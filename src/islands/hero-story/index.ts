// hero-story island: boots the Hero Story canvas once the page is idle, and owns its scene label, ticks and pause button.
// Fails silently: the indicator and pause button stay hidden and the copy is unaffected.
import { tablet } from '../../lib/pure/breakpoints.ts';
import { scrollDockProgress, targetFromRect } from '../../lib/pure/dock.ts';
import { HERO_STORY_DOCK, THEME_CHANGE } from '../../lib/pure/events.ts';
import { SCENE_LABELS } from '../../lib/pure/story-scenes.ts';
import { createEngine } from './engine.ts';

function boot() {
  const root = document.querySelector<HTMLElement>('[data-hero-story]');
  const canvas = root?.querySelector<HTMLCanvasElement>('[data-hero-story-canvas]');
  const indicator = root?.querySelector<HTMLElement>('[data-hero-story-indicator]');
  const name = indicator?.querySelector<HTMLElement>('[data-hero-story-name]');
  const ticks = [...(indicator?.querySelectorAll<HTMLElement>('[data-hero-story-ticks] > i') ?? [])];
  const pause = root?.querySelector<HTMLButtonElement>('[data-hero-story-pause]');
  if (!root || !canvas || !indicator || !name || !pause) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Right edge of the copy's actual text (line boxes, not block width), re-measured when the width changes.
  const copy = root.querySelector('.hero-copy');
  let measuredAt = -1;
  let textRight = 0;
  const textEdge = (w: number) => {
    if (w !== measuredAt && copy) {
      measuredAt = w;
      const range = document.createRange();
      range.selectNodeContents(copy);
      textRight = range.getBoundingClientRect().right - root.getBoundingClientRect().left;
    }
    return textRight;
  };
  // Desktop: prototype placement, pushed right (and shrunk to at most 70%) so the scene clears the copy.
  // ponytail: below that size it overlaps, as in the prototype; the shade keeps the copy readable.
  const desktopLayout = (w: number, h: number) => {
    const full = Math.min(w * 0.42, h * 0.68);
    const left = textEdge(w) + 32;
    const size = Math.max(full * 0.7, Math.min(full, w - 16 - left));
    return { cx: Math.min(Math.max(w * 0.69, left + size / 2), w - 16 - size / 2), cy: h * 0.53, size };
  };
  // Logo collapse: the header mark, measured once and again only after resize, theme change or scroll end.
  const mark = reduced ? null : document.querySelector('[data-dock-target]');
  let target: ReturnType<typeof targetFromRect> | null = null;
  const remeasure = () => (target = null);
  const dock = mark && {
    progress: () => scrollDockProgress(scrollY, innerHeight),
    target: () => (target ??= targetFromRect(mark.getBoundingClientRect())),
  };
  // Docking draws on a fixed, viewport-anchored canvas (CSS: [data-docking]) so it can rise above the header.
  if (dock) {
    // Before the engine's own resize listener, so its redraw already sees the new position.
    addEventListener('resize', remeasure);
    addEventListener('scrollend', remeasure);
  }

  const engine = createEngine({
    canvas,
    autoplay: 4, // one loop is about 36 seconds
    reduced,
    dock,
    onDock: (progress) => document.dispatchEvent(new CustomEvent(HERO_STORY_DOCK, { detail: { progress } })),
    // Same test as the CSS breakpoint (viewport width, scrollbar included), not the canvas width.
    layout: (w, h) => (innerWidth < tablet ? { cx: w * 0.5, cy: h * 0.27, size: Math.min(w * 0.78, h * 0.4) } : desktopLayout(w, h)),
    onFail() {
      indicator.hidden = pause.hidden = true;
      canvas.removeAttribute('data-docking');
    },
    onStep(index) {
      name.textContent = SCENE_LABELS[index];
      ticks.forEach((tick, i) => tick.classList.toggle('is-current', i === index));
    },
  });
  // Only once the engine is up, so a broken first frame leaves the canvas in its server-rendered place.
  if (dock) canvas.toggleAttribute('data-docking', true);
  indicator.hidden = false;
  document.addEventListener(THEME_CHANGE, () => {
    remeasure();
    engine.syncTones();
  });
  if (reduced) {
    // Static logo scene: nothing moves, so nothing to pause. On scroll it simply fades out (no swarm, no dock events).
    let queued = false;
    const fade = () => {
      queued = false;
      canvas.style.opacity = String(1 - scrollDockProgress(scrollY, innerHeight));
    };
    addEventListener(
      'scroll',
      () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(fade);
      },
      { passive: true },
    );
    addEventListener('resize', fade);
    fade();
    return;
  }

  // Moving content longer than 5 seconds needs a pause control (WCAG 2.2.2). Not remembered between visits.
  pause.hidden = false;
  pause.addEventListener('click', () => {
    const paused = !pause.hasAttribute('data-paused');
    engine.setPaused(paused);
    pause.toggleAttribute('data-paused', paused); // founder decision 2026-11-03: label only, no aria-pressed (it read "Play..., pressed")
    pause.setAttribute('aria-label', paused ? 'Play background animation' : 'Pause background animation');
  });
  new IntersectionObserver(([entry]) => engine.setVisible(entry.isIntersecting)).observe(root);
}

function run() {
  try {
    boot();
  } catch {
    // No canvas or a broken first frame: leave the server HTML as it is.
  }
}
const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(run, { timeout: 2000 }) : setTimeout(run, 200));
if (document.readyState === 'complete') idle();
else addEventListener('load', idle, { once: true });
