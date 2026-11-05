// stat-counter island: counts countable stats up once when half visible. The real value stays in the DOM for
// assistive tech and layout; the count runs in an aria-hidden overlay. No JS, reduced motion or no observer: static.
import { easeOut, formatStat } from '../lib/pure/stat-counter.ts';

const DURATION = 1200;
const stats = [...document.querySelectorAll<HTMLElement>('[data-stat-value]')];

if (stats.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const run = (el: HTMLElement) => {
    const target = Number(el.dataset.statValue);
    const real = el.querySelector<HTMLElement>('[data-stat-final]');
    if (!real || !Number.isFinite(target)) return;
    const { statPrefix: prefix = '', statSuffix: suffix = '' } = el.dataset;
    const overlay = document.createElement('span');
    overlay.className = 'stat-count';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.textContent = formatStat(0, prefix, suffix);
    el.append(overlay);
    real.style.opacity = '0';
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / DURATION;
      if (t >= 1) {
        overlay.remove();
        real.style.opacity = '';
        return;
      }
      overlay.textContent = formatStat(target * easeOut(t), prefix, suffix);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target); // once, never on scroll back
        run(entry.target as HTMLElement);
      }
    },
    { threshold: 0.5 },
  );
  for (const el of stats) observer.observe(el);
}
