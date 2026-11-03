import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

// Color tokens (hex or var(--color-…) reference) declared in the first block whose selector matches.
function block(selector: RegExp): Record<string, string> {
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!selector.test(sel)) continue;
    const out: Record<string, string> = {};
    for (const [, name, value] of body.matchAll(/--color-([\w-]+):\s*([^;]+);/g)) out[name] = value.trim();
    return out;
  }
  throw new Error(`no block for ${selector}`);
}

// Follow var(--color-…) references until a hex value.
function resolve(t: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of Object.keys(t)) {
    let v = t[name];
    for (let i = 0; i < 10 && v.startsWith('var('); i++) v = t[v.match(/var\(--color-([\w-]+)\)/)![1]];
    assert.match(v, /^#[0-9a-f]{6}$/i, `--color-${name} does not resolve to a hex color`);
    out[name] = v;
  }
  return out;
}

const lightRaw = block(/:root/);
const light = resolve(lightRaw);
const dark = resolve({ ...lightRaw, ...block(/^\s*\[data-theme="dark"\]\s*$/) });

// Gradient-text end colors per theme, from --gradient-text (var(--gradient-brand) means brand ends).
function gradientTextEnds(selector: RegExp): string[] {
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!selector.test(sel)) continue;
    const g = body.match(/--gradient-text:\s*([^;]+);/)?.[1];
    if (!g) break;
    const src = g.includes('var(--gradient-brand)') ? body.match(/--gradient-brand:\s*([^;]+);/)?.[1] ?? css.match(/--gradient-brand:\s*([^;]+);/)![1] : g;
    return [...src.matchAll(/var\(--color-([\w-]+)\)/g)].map((m) => m[1]);
  }
  throw new Error(`no --gradient-text for ${selector}`);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function assertPairs(theme: string, t: Record<string, string>, fgs: string[], bgs: string[], min = 4.5) {
  for (const fg of fgs) {
    for (const bg of bgs) {
      assert.ok(t[fg] && t[bg], `${theme}: missing token ${fg} or ${bg}`);
      const ratio = contrast(t[fg], t[bg]);
      assert.ok(ratio >= min, `${theme}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${min}:1`);
    }
  }
}

const surfaces = ['background', 'surface', 'card'];

// --logo-wordmark from a theme block, following a var(--color-…) reference.
function logoWordmark(selector: RegExp, t: Record<string, string>): string {
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!selector.test(sel)) continue;
    const v = body.match(/--logo-wordmark:\s*([^;]+);/)?.[1].trim();
    assert.ok(v, `no --logo-wordmark for ${selector}`);
    const ref = v.match(/^var\(--color-([\w-]+)\)$/);
    return ref ? t[ref[1]] : v;
  }
  throw new Error(`no block for ${selector}`);
}

for (const [theme, t, sel] of [
  ['light', light, /:root/],
  ['dark', dark, /^\s*\[data-theme="dark"\]\s*$/],
] as const) {
  test(`${theme}: logo wordmark is at least 3:1 on the background`, () => {
    const wm = logoWordmark(sel, t);
    assert.match(wm, /^#[0-9a-f]{6}$/i);
    const ratio = contrast(wm, t.background);
    assert.ok(ratio >= 3, `${theme}: wordmark ${wm} on background is ${ratio.toFixed(2)}:1`);
  });
}

test('contrast function matches known WCAG values', () => {
  assert.equal(contrast('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contrast('#777777', '#FFFFFF').toFixed(2), '4.48');
});

for (const [theme, t, sel] of [
  ['light', light, /:root/],
  ['dark', dark, /^\s*\[data-theme="dark"\]\s*$/],
] as const) {
  test(`${theme}: text, text-muted and accent-text pass AA on every surface`, () => {
    assertPairs(theme, t, ['text', 'text-muted', 'accent-text'], surfaces);
  });
  test(`${theme}: form error and success pass AA on every surface`, () => {
    assertPairs(theme, t, ['error', 'success'], surfaces);
  });
  test(`${theme}: focus ring is at least 3:1 on every surface`, () => {
    assertPairs(theme, t, ['focus'], surfaces, 3);
  });
  test(`${theme}: diagram graphics are at least 3:1 on surface and card`, () => {
    assertPairs(theme, t, ['brand-hot', 'graphic-warm', 'text-muted'], ['surface', 'card'], 3);
  });
  test(`${theme}: gradient text ends are at least 3:1 on background`, () => {
    const ends = gradientTextEnds(sel);
    assert.equal(ends.length, 2, `${theme}: --gradient-text needs two color tokens`);
    assertPairs(`${theme} gradient-text`, t, ends, ['background'], 3);
  });
}

test('button text passes AA on both gradient ends', () => {
  assertPairs('brand', light, ['on-gradient'], ['brand-hot', 'brand-warm']);
});
