// reveal island: sections marked [data-reveal] that start below the viewport fade up 12px over 400ms, once, on
// first view. Only this island hides anything, so without JS (or under reduced motion) every section just shows.
const sections = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];

// A #fragment, reload or back/forward lands mid-page after this runs, so those visits skip the effect (no flash).
const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
const freshVisit = !location.hash && (!nav || nav.type === 'navigate');

if (sections.length && freshVisit && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target); // once, never replays
        entry.target.classList.add('reveal-in');
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  );
  for (const el of sections) {
    if (el.getBoundingClientRect().top < innerHeight) continue; // already on screen: never hide it
    el.classList.add('reveal-pending');
    observer.observe(el);
  }
}
