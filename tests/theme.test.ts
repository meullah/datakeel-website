import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { THEME_CHANGE } from '../src/lib/pure/events.ts';
import { resolveTheme, THEME_KEY } from '../src/lib/pure/theme.ts';

test('theme contract names', () => {
  assert.equal(THEME_KEY, 'dk-theme');
  assert.equal(THEME_CHANGE, 'dk:theme:change');
});

test('resolveTheme: saved choice, then system, then light', () => {
  assert.equal(resolveTheme(null, false), 'light'); // first visit, light system
  assert.equal(resolveTheme(null, true), 'dark'); // first visit, dark system
  assert.equal(resolveTheme('light', true), 'light'); // saved choice wins
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('blue', true), 'dark'); // invalid → system
  assert.equal(resolveTheme('blue', false), 'light');
  assert.equal(resolveTheme(undefined, false), 'light'); // storage blocked → system
});

const html = new URL('../dist/index.html', import.meta.url);
test('built head runs the inline theme script right after meta charset', { skip: existsSync(html) ? false : 'dist/ not found; run npm run build first' }, () => {
  const headMatch = readFileSync(html, 'utf8').match(/<head>([\s\S]*?)<\/head>/);
  assert.ok(headMatch, 'no <head> in dist/index.html');
  const head = headMatch[1];
  assert.match(head, /^\s*<meta charset="utf-8"\s*\/?>\s*<script>[^<]*dk-theme[^<]*dataset\.theme=t[^<]*<\/script>/);
  // Same rule as resolveTheme: run the inline copy against the matrix.
  const srcMatch = head.match(/<script>([^<]*dk-theme[^<]*)<\/script>/);
  assert.ok(srcMatch, 'no inline theme script');
  const src = srcMatch[1];
  const run = (saved: string | null, dark: boolean, blocked = false) => {
    const el = { dataset: {} as Record<string, string> };
    const ls = { getItem: () => { if (blocked) throw new Error('blocked'); return saved; } };
    const mm = () => ({ matches: dark });
    new Function('localStorage', 'window', 'matchMedia', 'document', src)(ls, { matchMedia: mm }, mm, { documentElement: el });
    return el.dataset.theme;
  };
  for (const [saved, dark] of [[null, false], [null, true], ['light', true], ['dark', false], ['blue', true]] as const) {
    assert.equal(run(saved, dark), resolveTheme(saved, dark), `${saved}/${dark}`);
  }
  assert.equal(run('dark', true, true), 'dark');
  assert.equal(run('dark', false, true), 'light');
});

test('theme island: clicks flip, save, sync and reveal every toggle, one event each', async () => {
  class FakeElement {
    attrs: Record<string, string> = {};
    hidden = true;
    setAttribute(k: string, v: string) { this.attrs[k] = v; }
    closest() { return this; }
  }
  const toggles = [new FakeElement(), new FakeElement()];
  const listeners: Record<string, (e: unknown) => void> = {};
  const events: CustomEvent[] = [];
  const store: Record<string, string> = {};
  let blockSave = false;
  const g = globalThis as Record<string, unknown>;
  g.Element = FakeElement;
  g.document = {
    documentElement: { dataset: { theme: 'light' } as Record<string, string> },
    querySelectorAll: () => toggles,
    addEventListener: (type: string, fn: (e: unknown) => void) => { listeners[type] = fn; },
    dispatchEvent: (e: CustomEvent) => { events.push(e); return true; },
  };
  g.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { if (blockSave) throw new Error('blocked'); store[k] = v; },
  };
  g.matchMedia = () => ({ matches: false, addEventListener() {} });
  g.addEventListener = () => {};
  await import('../src/islands/theme.ts');
  const doc = g.document as { documentElement: { dataset: Record<string, string> } };

  assert.ok(toggles.every((t) => !t.hidden && t.attrs['aria-pressed'] === 'false'), 'revealed and synced on load');
  for (const [i, theme] of (['dark', 'light'] as const).entries()) {
    listeners.click({ target: toggles[0] });
    assert.equal(doc.documentElement.dataset.theme, theme);
    assert.equal(store[THEME_KEY], theme);
    assert.ok(toggles.every((t) => t.attrs['aria-pressed'] === String(theme === 'dark')), 'every toggle synced');
    assert.equal(events.length, i + 1, 'exactly one event per click');
    assert.equal(events[i].type, THEME_CHANGE);
    assert.equal(events[i].detail.theme, theme);
  }

  blockSave = true;
  listeners.click({ target: toggles[1] });
  assert.equal(doc.documentElement.dataset.theme, 'dark', 'switches even when saving throws');
  assert.equal(store[THEME_KEY], 'light', 'blocked save leaves storage untouched');
});
