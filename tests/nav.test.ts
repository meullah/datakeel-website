import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as u from '../src/lib/urls.ts';
import { industries } from '../src/lib/industries.ts';
import { dockProgress, isCurrent, SOLID_AFTER } from '../src/lib/pure/nav.ts';
import { HERO_STORY_DOCK, OVERLAY_OPEN } from '../src/lib/pure/events.ts';

test('isCurrent: exact, section parent and home', () => {
  assert.equal(isCurrent('/about/', '/about/'), 'page');
  assert.equal(isCurrent('/case-studies/', '/case-studies/'), 'page');
  assert.equal(isCurrent('/case-studies/some-study/', '/case-studies/'), 'true');
  assert.equal(isCurrent('/industries/finance/', '/industries/finance/'), 'page');
  assert.equal(isCurrent('/guides/', '/case-studies/'), undefined);
  assert.equal(isCurrent('/', '/'), 'page');
  assert.equal(isCurrent('/about/', '/'), undefined, 'home never matches as a section parent');
  assert.equal(isCurrent('/', '/about/'), undefined);
});

test('dockProgress: clamps numbers, ignores missing detail', () => {
  assert.equal(dockProgress({ progress: 0.6 }), 0.6);
  assert.equal(dockProgress({ progress: 2 }), 1);
  assert.equal(dockProgress({ progress: -1 }), 0);
  for (const d of [undefined, null, {}, { progress: '0.5' }, { progress: NaN }]) assert.equal(dockProgress(d), null);
  assert.equal(SOLID_AFTER, 8);
});

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const skip = { skip: existsSync(dist) ? false : 'dist/ not found; run npm run build first' };
const pages = existsSync(dist)
  ? (readdirSync(dist, { recursive: true }) as string[]).filter((f) => f.endsWith('.html')).map((f) => f.split(sep).join('/'))
  : [];
const pathOf = (f: string) => '/' + f.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '/');

const navHrefs = [u.whatWeDoUrl(), u.howWeWorkUrl(), u.caseStudiesUrl(), ...industries.map((i) => u.industryUrl(i.id)), u.guidesUrl(), u.standardUrl(), u.aboutUrl(), u.readinessReviewUrl()];
/** Paths the header can mark current: home (logo), each nav item and its section, the CTA target. */
const markable = (p: string) => p === u.homeUrl() || navHrefs.some((h) => isCurrent(p, h));

test('every built page has one header with every nav link, one dock target and the right aria-current', skip, () => {
  assert.ok(pages.length >= 16, 'expected the built pages');
  for (const f of pages) {
    const html = readFileSync(join(dist, f), 'utf8');
    assert.equal((html.match(/<header[\s>]/g) ?? []).length, 1, `${f}: header landmarks`);
    assert.equal((html.match(/data-dock-target/g) ?? []).length, 1, `${f}: [data-dock-target] count`);
    const header = html.match(/<header[\s\S]*?<\/header>/)![0];
    const hrefs = [...header.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    for (const h of [u.homeUrl(), ...navHrefs]) assert.ok(hrefs.includes(h), `${f}: missing ${h}`);
    for (const h of hrefs) assert.match(h, /\/$/, `${f}: ${h} has no trailing slash`);
    const p = pathOf(f);
    const currents = (header.match(/aria-current=/g) ?? []).length;
    // Industry pages mark the Industries trigger (section parent) and their own dropdown link.
    const expected = industries.some((i) => p === u.industryUrl(i.id)) ? 2 : markable(p) ? 1 : 0;
    assert.equal(currents, expected, `${f} (${p}): aria-current count`);
  }
});

test('industry pages mark the Industries trigger and their own dropdown link', skip, () => {
  for (const i of industries) {
    const file = join(dist, 'industries', i.id, 'index.html');
    assert.ok(existsSync(file), `missing ${file}`);
    const header = readFileSync(file, 'utf8').match(/<header[\s\S]*?<\/header>/)![0];
    assert.match(header, /<button[^>]*aria-current="true"[^>]*>\s*Industries/);
    assert.match(header, new RegExp(`<a[^>]*href="${u.industryUrl(i.id)}"[^>]*aria-current="page"`));
  }
});

test('only the homepage header is transparent', skip, () => {
  for (const f of pages) {
    const transparent = /<header[^>]*data-transparent/.test(readFileSync(join(dist, f), 'utf8'));
    assert.equal(transparent, f === 'index.html', f);
  }
});

// ---- Islands, run against fake globals (same approach as theme.test.ts) ----

type Listener = (e: any) => void;
class FakeNode {}
class FakeTarget extends FakeNode {
  listeners: Record<string, Listener[]> = {};
  addEventListener(type: string, fn: Listener) { (this.listeners[type] ??= []).push(fn); }
  fire(type: string, e: any = {}) { for (const fn of this.listeners[type] ?? []) fn(e); }
}
const g = globalThis as Record<string, any>;

test('nav-dropdown island: click, Esc, outside click, overlays, hover and keyboard', async () => {
  const attrs: Record<string, string> = { 'aria-expanded': 'false' };
  const inner = new FakeNode(); // a link inside the dropdown
  const outside = new FakeNode();
  const doc = Object.assign(new FakeTarget(), {
    activeElement: null as unknown,
    querySelectorAll: () => [root],
    dispatchEvent(e: CustomEvent) { events.push(e); doc.fire(e.type, e); return true; },
  });
  const trigger = Object.assign(new FakeTarget(), {
    getAttribute: (k: string) => attrs[k] ?? null,
    setAttribute: (k: string, v: string) => { attrs[k] = v; },
    focus() { doc.activeElement = trigger; },
  });
  const root: FakeTarget & { dataset: Record<string, string>; querySelector: () => unknown; contains: (n: unknown) => boolean } = Object.assign(new FakeTarget(), {
    dataset: {} as Record<string, string>,
    querySelector: () => trigger,
    contains: (n: unknown) => n === root || n === trigger || n === inner,
  });
  const events: CustomEvent[] = [];
  let fine = true;
  g.Node = FakeNode;
  g.document = doc;
  g.matchMedia = (q: string) => {
    assert.equal(q, '(any-pointer: fine)');
    return { get matches() { return fine; } };
  };
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    await import('../src/islands/nav-dropdown.ts');
    const expanded = () => attrs['aria-expanded'];
    const overlay = (id: string) => doc.dispatchEvent(new CustomEvent(OVERLAY_OPEN, { detail: { id } }));
    assert.ok('js' in root.dataset, 'island takes over from the CSS fallback');

    trigger.fire('click', { detail: 1 });
    assert.equal(expanded(), 'true');
    assert.equal(events.length, 1);
    assert.equal(events[0].type, OVERLAY_OPEN);
    assert.deepEqual(events[0].detail, { id: 'industries' });

    doc.activeElement = inner;
    doc.fire('keydown', { key: 'Escape' });
    assert.equal(expanded(), 'false');
    assert.equal(doc.activeElement, trigger, 'Esc with focus inside refocuses the trigger');

    trigger.fire('click', { detail: 1 });
    doc.activeElement = outside;
    doc.fire('keydown', { key: 'Escape' });
    assert.equal(expanded(), 'false');
    assert.equal(doc.activeElement, outside, 'Esc with focus elsewhere leaves focus alone');

    trigger.fire('click', { detail: 1 });
    doc.fire('click', { target: inner });
    assert.equal(expanded(), 'true', 'click inside keeps it open');
    doc.fire('click', { target: outside });
    assert.equal(expanded(), 'false', 'outside click closes');

    trigger.fire('click', { detail: 1 });
    overlay('industries');
    assert.equal(expanded(), 'true', 'own overlay id does not close');
    overlay('mobile-menu');
    assert.equal(expanded(), 'false', 'another overlay closes');

    trigger.fire('click', { detail: 1 });
    root.fire('focusout', { relatedTarget: inner });
    assert.equal(expanded(), 'true', 'focus moving inside keeps it open');
    root.fire('focusout', { relatedTarget: null });
    assert.equal(expanded(), 'false', 'focus leaving to nowhere closes');

    root.fire('pointerenter', { pointerType: 'touch' });
    mock.timers.tick(500);
    assert.equal(expanded(), 'false', 'touch hover never opens');
    fine = false;
    root.fire('pointerenter', { pointerType: 'mouse' });
    mock.timers.tick(500);
    assert.equal(expanded(), 'false', 'no fine pointer, no hover open');
    fine = true;

    const before = events.length;
    root.fire('pointerenter', { pointerType: 'mouse' });
    mock.timers.tick(149);
    assert.equal(expanded(), 'false', 'not before 150ms');
    mock.timers.tick(1);
    assert.equal(expanded(), 'true', 'hover opens at 150ms');
    assert.equal(events.length, before + 1, 'hover open fires the overlay event');

    trigger.fire('click', { detail: 0 });
    assert.equal(expanded(), 'false', 'keyboard toggle closes a hover-open menu');

    root.fire('pointerenter', { pointerType: 'mouse' });
    mock.timers.tick(150);
    trigger.fire('click', { detail: 1 });
    assert.equal(expanded(), 'true', 'pointer click pins a hover-open menu');
    root.fire('pointerleave', { pointerType: 'mouse' });
    mock.timers.tick(500);
    assert.equal(expanded(), 'true', 'pinned menu ignores pointer leave');

    trigger.fire('click', { detail: 1 });
    root.fire('pointerenter', { pointerType: 'mouse' });
    mock.timers.tick(150);
    root.fire('pointerleave', { pointerType: 'mouse' });
    mock.timers.tick(500);
    assert.equal(expanded(), 'false', 'hover-open menu closes after pointer leave');
  } finally {
    mock.timers.reset();
  }
});

async function loadHeaderScroll(transparent: boolean, tag: string) {
  const attrs = new Set<string>(transparent ? ['data-transparent'] : []);
  const style: Record<string, string> = {};
  const header = {
    hasAttribute: (k: string) => attrs.has(k),
    toggleAttribute: (k: string, on: boolean) => { if (on) attrs.add(k); else attrs.delete(k); },
    style: {
      setProperty: (k: string, v: string) => { style[k] = v; },
      removeProperty: (k: string) => { delete style[k]; },
    },
  };
  const win = new FakeTarget();
  const doc = Object.assign(new FakeTarget(), {
    documentElement: { dataset: {} as Record<string, string> },
    querySelector: () => header,
  });
  g.document = doc;
  g.scrollY = 0;
  g.addEventListener = win.addEventListener.bind(win);
  g.requestAnimationFrame = (fn: () => void) => { fn(); return 0; };
  await import(`../src/islands/header-scroll.ts?${tag}`);
  const scrollTo = (y: number) => { g.scrollY = y; win.fire('scroll'); };
  const dock = (detail?: unknown) => doc.fire(HERO_STORY_DOCK, { detail });
  return { attrs, style, win, doc, scrollTo, dock };
}

test('header-scroll island: solid after 8px only on a transparent header', async () => {
  const h = await loadHeaderScroll(true, 'transparent');
  assert.ok(!h.attrs.has('data-solid'), 'transparent at the top');
  h.scrollTo(SOLID_AFTER);
  assert.ok(!h.attrs.has('data-solid'), 'still transparent at exactly 8px');
  h.scrollTo(9);
  assert.ok(h.attrs.has('data-solid'), 'solid at 9px');
  h.scrollTo(0);
  assert.ok(!h.attrs.has('data-solid'), 'transparent again at 0');

  const solid = await loadHeaderScroll(false, 'solid');
  assert.equal(solid.win.listeners.scroll, undefined, 'no scroll listener without data-transparent');
});

test('header-scroll island: dock hook sets and clears html[data-hero-dock] and --hero-dock', async () => {
  const h = await loadHeaderScroll(false, 'dock');
  const dataset = h.doc.documentElement.dataset;
  h.dock({ progress: 0.6 });
  assert.ok('heroDock' in dataset);
  assert.equal(h.style['--hero-dock'], '0.6');
  h.dock({ progress: 'x' });
  assert.ok(!('heroDock' in dataset), 'invalid detail clears the hook');
  assert.equal(h.style['--hero-dock'], undefined);
  h.dock({ progress: 0.6 });
  h.dock({ progress: 0 });
  assert.ok(!('heroDock' in dataset), 'progress 0 clears the hook');
  assert.equal(h.style['--hero-dock'], undefined);
  h.dock();
  assert.ok(!('heroDock' in dataset), 'missing detail leaves it cleared');
});
