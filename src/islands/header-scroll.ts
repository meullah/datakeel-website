// header-scroll island: owns the header's solid/transparent state, and the Hero Story dock hook (Epic 2).
import { HERO_STORY_DOCK } from '../lib/pure/events.ts';
import { logoOpacity } from '../lib/pure/dock.ts';
import { dockProgress, SOLID_AFTER } from '../lib/pure/nav.ts';

const header = document.querySelector<HTMLElement>('[data-header]');

if (header?.hasAttribute('data-transparent')) {
  let queued = false;
  const update = () => {
    queued = false;
    header.toggleAttribute('data-solid', scrollY > SOLID_AFTER);
  };
  addEventListener(
    'scroll',
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

// Hero Story logo collapse: the logo dims while the particles fly in and fades back in as they land.
// Only ever changes in response to the event, so without a running story the logo stays fully visible.
document.addEventListener(HERO_STORY_DOCK, (e) => {
  if (!header) return;
  const progress = dockProgress((e as CustomEvent).detail);
  if (!progress) {
    // 0 or invalid: not docking, show the logo normally.
    delete document.documentElement.dataset.heroDock;
    header.style.removeProperty('--hero-dock');
    return;
  }
  document.documentElement.dataset.heroDock = '';
  header.style.setProperty('--hero-dock', String(logoOpacity(progress)));
});
