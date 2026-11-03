// Hero Story canvas engine, ported from prototypes/landing-story/story-engine.js (autoplay mode only).
// The clock only advances while playing, visible and the tab is shown, so the story never jumps ahead.
import { clamp, createStory, easeInOut, logoT, POINTS, position, smooth, timeline, TONE_NAMES, type Slot, type ToneName } from '../../lib/pure/story-scenes.ts';

type RGB = number[];
export interface Layout {
  cx: number;
  cy: number;
  size: number;
}
/** Kept for Story 2.3 (logo collapse): scrolling `distance()` px shrinks the cloud into `target()`. */
export interface Dock {
  distance(): number;
  target(): { cx: number; cy: number; half: number };
}
export interface EngineOptions {
  canvas: HTMLCanvasElement;
  layout(width: number, height: number): Layout;
  onStep?(index: number): void;
  onFail?(): void;
  autoplay?: number; // seconds per scene
  reduced?: boolean; // hold the logo scene, never animate
  dock?: Dock | null;
}

export function createEngine({ canvas, layout, onStep, onFail, autoplay = 4, reduced = false, dock = null }: EngineOptions) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('hero-story: no 2d context');
  const { scenes, dockLogo, stagger } = createStory();
  const count = scenes.length;

  // Every tone comes from CSS --tone-<name> ("r g b"), so the story follows the theme.
  const tones = Object.fromEntries(TONE_NAMES.map((n) => [n, [0, 0, 0]])) as Record<ToneName, RGB>;
  let colors: RGB[][] = [];
  let logoColors: RGB[] = [];
  const colorFor = (s: Slot): RGB => {
    if (s.path.tone !== 'logo') return tones[s.path.tone];
    const t = logoT(s);
    return tones.warm.map((c, i) => c + (tones.hot[i] - c) * t);
  };
  function syncTones() {
    const css = getComputedStyle(document.documentElement);
    for (const name of TONE_NAMES) {
      const value = css.getPropertyValue(`--tone-${name}`).trim().split(/[\s,]+/).map(Number);
      if (value.length === 3 && value.every((n) => !isNaN(n))) tones[name] = value;
    }
    colors = scenes.map((scene) => scene.map(colorFor));
    logoColors = dockLogo.map(colorFor);
  }

  let width = 0,
    height = 0,
    current = -1;
  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context!.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  let clock = 0,
    last = 0,
    raf = 0,
    paused = false,
    visible = true,
    dead = false;

  function draw() {
    const ctx = context!;
    const time = reduced ? 0 : clock / 1000;
    const { from, to, mix, nearest } = timeline(reduced ? (count - 1) * autoplay : time, autoplay, count);
    if (nearest !== current) {
      current = nearest;
      onStep?.(nearest);
    }
    let docked = 0,
      target = null;
    if (dock) {
      docked = clamp(scrollY / dock.distance(), 0, 1);
      canvas.classList.toggle('is-docking', docked > 0);
      if (docked > 0) target = dock.target();
    }
    const { cx, cy, size } = layout(width, height);
    const half = size / 2;
    ctx.clearRect(0, 0, width, height);
    // Fade out over the last stretch of docking so the real logo takes over.
    ctx.globalAlpha = docked > 0.82 ? 1 - smooth((docked - 0.82) / 0.18) : 1;
    const a = scenes[from],
      b = scenes[to],
      colorA = colors[from],
      colorB = colors[to];
    for (let i = 0; i < POINTS; i++) {
      const g = easeInOut(clamp(mix * 1.6 - stagger[i] * 0.6, 0, 1));
      const pa = position(a[i], time),
        pb = position(b[i], time);
      const swirl = Math.sin(g * Math.PI) * 0.12;
      const x = pa[0] + (pb[0] - pa[0]) * g + Math.sin(stagger[i] * 40 + time) * swirl;
      const y = pa[1] + (pb[1] - pa[1]) * g + Math.cos(stagger[i] * 40 + time) * swirl;
      const ca = colorA[i],
        cb = colorB[i];
      let r = ca[0] + (cb[0] - ca[0]) * g,
        gr = ca[1] + (cb[1] - ca[1]) * g,
        bl = ca[2] + (cb[2] - ca[2]) * g;
      let sx = cx + x * half,
        sy = cy + y * half,
        dot = 2;
      if (target) {
        const k = easeInOut(clamp(docked * 1.5 - stagger[i] * 0.5, 0, 1));
        const [lx, ly] = position(dockLogo[i], 0),
          lc = logoColors[i];
        sx += (target.cx + lx * target.half - sx) * k;
        sy += (target.cy + ly * target.half - sy) * k;
        r += (lc[0] - r) * k;
        gr += (lc[1] - gr) * k;
        bl += (lc[2] - bl) * k;
        dot = 2 - k * 0.8;
      }
      ctx.fillStyle = `rgb(${r | 0},${gr | 0},${bl | 0})`;
      ctx.fillRect(sx - dot / 2, sy - dot / 2, dot, dot);
    }
  }

  // Any runtime error: stop and leave the canvas empty (the server HTML is untouched).
  function fail() {
    dead = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    context!.clearRect(0, 0, width, height);
    onFail?.();
  }
  function paint() {
    if (dead) return;
    try {
      draw();
    } catch {
      fail();
    }
  }

  // Docking keeps running while paused so a paused story still collapses on scroll (2.3).
  const wanted = () => !dead && !reduced && visible && !document.hidden && (!paused || !!dock);
  function frame(now: number) {
    raf = 0;
    // ponytail: delta capped at 100ms, so a stall or a hidden tab never jumps the story ahead.
    if (!paused && !document.hidden) clock += clamp(now - last, 0, 100);
    last = now;
    if (dock && scrollY >= dock.distance()) {
      // Fully collapsed into the logo: clear and stop until the visitor scrolls back up.
      context!.clearRect(0, 0, width, height);
      return;
    }
    paint();
    if (wanted()) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !wanted()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  // Redraw a held frame (paused, reduced motion, off-screen) after a resize or theme change.
  function refresh() {
    if (!raf) paint();
  }

  syncTones();
  resize();
  draw(); // throws on a broken first frame, so the caller can leave the server HTML alone
  start();

  addEventListener('resize', () => {
    resize();
    refresh();
  });
  document.addEventListener('visibilitychange', start);
  if (dock) addEventListener('scroll', start, { passive: true });

  return {
    count,
    setPaused(value: boolean) {
      paused = value;
      start();
    },
    setVisible(value: boolean) {
      visible = value;
      start();
    },
    syncTones() {
      try {
        syncTones();
      } catch {
        return fail();
      }
      refresh();
    },
  };
}
