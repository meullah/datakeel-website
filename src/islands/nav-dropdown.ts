// nav-dropdown island: owns the header Industries dropdown (overlay id "industries").
// Opens on click, or on hover after 150ms with a fine pointer; closes on Esc, outside click,
// focus leaving, or another overlay opening.
import { OVERLAY_OPEN } from '../lib/pure/events.ts';

const ID = 'industries';
const HOVER_OPEN_MS = 150;
const HOVER_CLOSE_MS = 200;

for (const root of document.querySelectorAll<HTMLElement>('[data-nav-dropdown]')) {
  const trigger = root.querySelector<HTMLButtonElement>('button[aria-expanded]');
  if (!trigger) continue;
  root.dataset.js = ''; // hand control from the :focus-within fallback to this island
  const finePointer = matchMedia('(any-pointer: fine)');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let byHover = false;

  const isOpen = () => trigger.getAttribute('aria-expanded') === 'true';
  const open = (hover: boolean) => {
    byHover = hover;
    if (isOpen()) return;
    trigger.setAttribute('aria-expanded', 'true');
    document.dispatchEvent(new CustomEvent(OVERLAY_OPEN, { detail: { id: ID } }));
  };
  const close = () => {
    clearTimeout(timer);
    trigger.setAttribute('aria-expanded', 'false');
  };

  trigger.addEventListener('click', (e) => {
    clearTimeout(timer);
    if (isOpen() && byHover && e.detail > 0) byHover = false; // a pointer click after hover-open pins it; keyboard toggles
    else if (isOpen()) close();
    else open(false);
  });

  root.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse' || !finePointer.matches) return;
    clearTimeout(timer);
    if (!isOpen()) timer = setTimeout(() => open(true), HOVER_OPEN_MS);
  });
  root.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(timer);
    if (isOpen() && byHover) timer = setTimeout(close, HOVER_CLOSE_MS);
  });

  root.addEventListener('focusout', (e) => {
    if (isOpen() && !(e.relatedTarget instanceof Node && root.contains(e.relatedTarget))) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    const focusInside = root.contains(document.activeElement);
    close();
    if (focusInside) trigger.focus();
  });
  document.addEventListener('click', (e) => {
    if (isOpen() && e.target instanceof Node && !root.contains(e.target)) close();
  });
  document.addEventListener(OVERLAY_OPEN, (e) => {
    if ((e as CustomEvent<{ id?: string }>).detail?.id !== ID) close();
  });
}
