import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OVERLAY_OPEN } from '../src/lib/pure/events.ts';

type Listener = (event: any) => void;

class FakeNode {}
class FakeElement extends FakeNode {
  hidden = false;
  listeners: Record<string, Listener[]> = {};
  addEventListener(type: string, listener: Listener) { (this.listeners[type] ??= []).push(listener); }
  fire(type: string, event: any = {}) { for (const listener of this.listeners[type] ?? []) listener(event); }
  closest(_selector: string) { return null; }
}

test('mobile-menu island covers open, trap, close paths, overlays, resize and pageshow reset', async () => {
  const attrs: Record<string, string> = { 'aria-expanded': 'false', 'aria-label': 'Open menu' };
  const htmlStyle: Record<string, string> = { overflow: '' };
  const bodyStyle: Record<string, string> = { overflow: '', position: '', left: '', top: '', width: '', paddingRight: '' };
  const documentTarget = new FakeElement();
  const windowTarget = new FakeElement();
  const trigger = Object.assign(new FakeElement(), {
    setAttribute(name: string, value: string) { attrs[name] = value; },
    focus() { doc.activeElement = trigger; },
  });
  const closeButton = Object.assign(new FakeElement(), {
    focus() { doc.activeElement = closeButton; },
  });
  const firstLink = Object.assign(new FakeElement(), {
    closest(selector: string) { return selector === 'a[href]' ? firstLink : null; },
    focus() { doc.activeElement = firstLink; },
  });
  const lastLink = Object.assign(new FakeElement(), {
    closest(selector: string) { return selector === 'a[href]' ? lastLink : null; },
    focus() { doc.activeElement = lastLink; },
  });
  const dialog = Object.assign(new FakeElement(), {
    open: false,
    failNextShow: false,
    showCalls: 0,
    closeCalls: 0,
    querySelector: () => closeButton,
    querySelectorAll: () => [closeButton, firstLink, lastLink],
    showModal() {
      if (dialog.failNextShow) {
        dialog.failNextShow = false;
        throw new DOMException('Invalid state', 'InvalidStateError');
      }
      dialog.open = true;
      dialog.showCalls += 1;
    },
    close() { dialog.open = false; dialog.closeCalls += 1; dialog.fire('close'); },
  });
  const dispatched: CustomEvent[] = [];
  const doc = Object.assign(documentTarget, {
    activeElement: null as unknown,
    documentElement: { clientWidth: 980, style: htmlStyle },
    body: { style: bodyStyle },
    querySelector(selector: string) { return selector === '[data-mobile-menu]' ? dialog : trigger; },
    dispatchEvent(event: CustomEvent) { dispatched.push(event); documentTarget.fire(event.type, event); return true; },
  });
  const media = Object.assign(new FakeElement(), { matches: false });
  const scrollCalls: Array<[number, number]> = [];
  const g = globalThis as Record<string, any>;
  g.Node = FakeNode;
  g.Element = FakeElement;
  g.document = doc;
  g.innerWidth = 1000;
  g.scrollX = 35;
  g.scrollY = 120;
  g.scrollTo = (x: number, y: number) => scrollCalls.push([x, y]);
  g.matchMedia = (query: string) => {
    assert.equal(query, '(min-width: 1024px)');
    return media;
  };
  g.requestAnimationFrame = (callback: () => void) => { callback(); return 0; };
  g.addEventListener = windowTarget.addEventListener.bind(windowTarget);

  await import('../src/islands/mobile-menu.ts');
  assert.equal(trigger.hidden, false, 'JS reveals the trigger');
  doc.activeElement = firstLink;
  windowTarget.fire('pageshow');
  assert.equal(doc.activeElement, firstLink, 'normal pageshow does not steal focus');

  trigger.fire('click');
  assert.equal(dialog.showCalls, 1, 'open uses the modal dialog, making the background inert');
  assert.equal(attrs['aria-expanded'], 'true');
  assert.equal(attrs['aria-label'], 'Close menu');
  assert.equal(htmlStyle.overflow, 'hidden');
  assert.equal(bodyStyle.position, 'fixed');
  assert.equal(bodyStyle.left, '-35px');
  assert.equal(bodyStyle.top, '-120px');
  assert.equal(bodyStyle.paddingRight, '20px', 'scrollbar space is retained');
  assert.equal(doc.activeElement, closeButton, 'focus moves inside');
  assert.equal(dispatched.at(-1)?.type, OVERLAY_OPEN);
  assert.deepEqual(dispatched.at(-1)?.detail, { id: 'mobile-menu' });

  doc.activeElement = lastLink;
  let prevented = false;
  dialog.fire('keydown', { key: 'Tab', shiftKey: false, preventDefault: () => { prevented = true; } });
  assert.ok(prevented);
  assert.equal(doc.activeElement, closeButton, 'Tab wraps to first item');
  doc.activeElement = closeButton;
  dialog.fire('keydown', { key: 'Tab', shiftKey: true, preventDefault() {} });
  assert.equal(doc.activeElement, lastLink, 'Shift+Tab wraps to last item');

  dialog.fire('cancel', { preventDefault() {} });
  assert.equal(dialog.open, false, 'Escape/cancel closes');
  assert.equal(attrs['aria-expanded'], 'false');
  assert.equal(htmlStyle.overflow, '');
  assert.deepEqual(scrollCalls.at(-1), [35, 120]);
  assert.equal(doc.activeElement, trigger, 'close returns focus');

  trigger.fire('click');
  closeButton.fire('click');
  assert.equal(dialog.open, false, 'close button closes');

  trigger.fire('click');
  dialog.fire('click', { target: firstLink });
  assert.equal(dialog.open, false, 'link click closes');

  trigger.fire('click');
  doc.activeElement = firstLink;
  doc.dispatchEvent(new CustomEvent(OVERLAY_OPEN, { detail: { id: 'industries' } }));
  assert.equal(dialog.open, false, 'another overlay closes the menu');
  assert.equal(doc.activeElement, firstLink, 'overlay ownership change does not refocus the trigger');

  trigger.fire('click');
  doc.activeElement = firstLink;
  media.matches = true;
  media.fire('change', { matches: true });
  assert.equal(dialog.open, false, 'desktop resize closes the menu');
  assert.equal(doc.activeElement, firstLink, 'desktop transition does not focus a hidden trigger');

  media.matches = false;
  trigger.fire('click');
  windowTarget.fire('pageshow');
  assert.equal(dialog.open, false, 'bfcache return resets the open state');
  assert.equal(attrs['aria-expanded'], 'false');

  dialog.failNextShow = true;
  assert.throws(() => trigger.fire('click'), { name: 'InvalidStateError' });
  assert.equal(htmlStyle.overflow, '', 'failed showModal rolls back the lock');
  assert.equal(bodyStyle.position, '');
  assert.deepEqual(scrollCalls.at(-1), [35, 120]);
});
