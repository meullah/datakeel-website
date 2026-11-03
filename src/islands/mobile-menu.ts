// mobile-menu island: enhances the server-rendered dialog below the desktop breakpoint.
import { desktop } from '../lib/pure/breakpoints.ts';
import { OVERLAY_OPEN } from '../lib/pure/events.ts';

const ID = 'mobile-menu';
const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const dialog = document.querySelector<HTMLDialogElement>('[data-mobile-menu]');
const trigger = document.querySelector<HTMLButtonElement>('[data-mobile-menu-trigger]');

if (dialog && trigger) {
  const closeButton = dialog.querySelector<HTMLButtonElement>('[data-mobile-menu-close]');
  const desktopQuery = matchMedia(`(min-width: ${desktop}px)`);
  let scrollLeft = 0;
  let scrollTop = 0;
  let locked = false;
  let restoreFocus = true;
  let savedHtmlOverflow = '';
  let savedBodyOverflow = '';
  let savedBodyPosition = '';
  let savedBodyLeft = '';
  let savedBodyTop = '';
  let savedBodyWidth = '';
  let savedBodyPaddingRight = '';

  const lockScroll = () => {
    if (locked) return;
    const scrollbarWidth = Math.max(0, innerWidth - document.documentElement.clientWidth);
    scrollLeft = scrollX;
    scrollTop = scrollY;
    savedHtmlOverflow = document.documentElement.style.overflow;
    savedBodyOverflow = document.body.style.overflow;
    savedBodyPosition = document.body.style.position;
    savedBodyLeft = document.body.style.left;
    savedBodyTop = document.body.style.top;
    savedBodyWidth = document.body.style.width;
    savedBodyPaddingRight = document.body.style.paddingRight;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.left = `-${scrollLeft}px`;
    document.body.style.top = `-${scrollTop}px`;
    document.body.style.width = '100%';
    if (scrollbarWidth) document.body.style.paddingRight = `${scrollbarWidth}px`;
    locked = true;
  };

  const unlockScroll = () => {
    if (!locked) return;
    document.documentElement.style.overflow = savedHtmlOverflow;
    document.body.style.overflow = savedBodyOverflow;
    document.body.style.position = savedBodyPosition;
    document.body.style.left = savedBodyLeft;
    document.body.style.top = savedBodyTop;
    document.body.style.width = savedBodyWidth;
    document.body.style.paddingRight = savedBodyPaddingRight;
    locked = false;
    scrollTo(scrollLeft, scrollTop);
  };

  const finishClose = () => {
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'Open menu');
    unlockScroll();
    if (restoreFocus) trigger.focus();
    restoreFocus = true;
  };

  const closeMenu = (focusTrigger = true) => {
    restoreFocus = focusTrigger;
    if (dialog.open) dialog.close();
    else finishClose();
  };

  const openMenu = () => {
    if (dialog.open || desktopQuery.matches) return;
    restoreFocus = true;
    lockScroll();
    try {
      dialog.showModal();
    } catch (error) {
      unlockScroll();
      throw error;
    }
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-label', 'Close menu');
    document.dispatchEvent(new CustomEvent(OVERLAY_OPEN, { detail: { id: ID } }));
    requestAnimationFrame(() => closeButton?.focus());
  };

  trigger.hidden = false;
  trigger.addEventListener('click', () => (dialog.open ? closeMenu() : openMenu()));
  closeButton?.addEventListener('click', () => closeMenu());
  dialog.addEventListener('close', finishClose);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeMenu();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a[href]')) closeMenu();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)].filter((item) => !item.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener(OVERLAY_OPEN, (event) => {
    if ((event as CustomEvent<{ id?: string }>).detail?.id !== ID && dialog.open) closeMenu(false);
  });
  desktopQuery.addEventListener('change', (event) => {
    if (event.matches && dialog.open) closeMenu(false);
  });
  addEventListener('pageshow', () => {
    if (dialog.open) closeMenu(false);
    else {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-label', 'Open menu');
      unlockScroll();
    }
  });
}
