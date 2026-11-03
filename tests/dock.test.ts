import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOCK_PERCENT, logoOpacity, particleAlpha, scrollDockProgress, targetFromRect } from '../src/lib/pure/dock.ts';

test('scrollDockProgress: 0 at the top, linear to 1 at 55% of the viewport, clamped', () => {
  assert.equal(DOCK_PERCENT, 55);
  assert.equal(scrollDockProgress(0, 800), 0);
  assert.ok(Math.abs(scrollDockProgress(220, 800) - 0.5) < 1e-9);
  assert.equal(scrollDockProgress(440, 800), 1);
  assert.equal(scrollDockProgress(396, 720), 1, 'exactly at the distance, no float shortfall');
  assert.equal(scrollDockProgress(5000, 800), 1);
  assert.equal(scrollDockProgress(-40, 800), 0, 'overscroll bounce');
  assert.equal(scrollDockProgress(100, 0), 0, 'zero-height viewport');
  assert.equal(scrollDockProgress(NaN, 800), 0);
});

test('targetFromRect: centre of the mark, scene scaled to fill it (logo scene spans ±0.72)', () => {
  const t = targetFromRect({ left: 24, top: 18, width: 36, height: 36 });
  assert.equal(t.cx, 42);
  assert.equal(t.cy, 36);
  assert.ok(Math.abs(t.half * 0.72 - 18) < 1e-9);
});

test('logoOpacity: full at rest and docked, gone while particles land, complements the particle fade', () => {
  assert.equal(logoOpacity(0), 1);
  assert.equal(logoOpacity(1), 1);
  assert.equal(logoOpacity(0.6), 0);
  for (let k = 0; k <= 9; k++) {
    const p = Math.min(1, 0.82 + k * 0.02); // integer steps, so p = 1 is checked
    assert.ok(Math.abs(logoOpacity(p) + particleAlpha(p) - 1) < 1e-9, `crossfade at ${p}`);
  }
  assert.equal(particleAlpha(0.5), 1);
  assert.equal(particleAlpha(1), 0);
  for (let p = 0; p < 0.4; p += 0.05) assert.ok(logoOpacity(p + 0.05) <= logoOpacity(p), 'dims gradually, no first-pixel drop');
  assert.ok(logoOpacity(0.01) > 0.99);
});
