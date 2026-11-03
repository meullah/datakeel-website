// Story 2.1 matrix: all hero copy above the fold, eyebrow clear of the header, no horizontal scroll.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { preview, type PreviewServer } from 'astro';
import { chromium, type Browser } from 'playwright-chromium';

let browser: Browser;
let server: PreviewServer;

before(async () => {
  server = await preview({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  await server?.stop();
});

const cases = [
  { width: 360, height: 640, js: true },
  { width: 820, height: 1180, js: true },
  { width: 1024, height: 768, js: true },
  { width: 1280, height: 620, js: true },
  { width: 1920, height: 1080, js: true },
  { width: 360, height: 640, js: false },
];

for (const { width, height, js } of cases) {
  test(`home hero at ${width}x${height}${js ? '' : ' without JS'}: copy above the fold`, async () => {
    const context = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: js });
    try {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${server.port}/`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(() => {
        const copy = document.querySelector('.hero-copy')!;
        const box = (s: string) => copy.querySelector(s)!.getBoundingClientRect();
        return {
          eyebrowTop: box('.eyebrow').top,
          bottom: Math.max(box('.lead').bottom, box('.hero-ctas').bottom),
          right: Math.max(box('.lead').right, box('.hero-ctas').right),
          padBottom: parseFloat(getComputedStyle(copy).paddingBottom),
          left: box('.eyebrow').left,
          logoLeft: document.querySelector('.header-logo')!.getBoundingClientRect().left,
          header: document.querySelector('[data-header]')!.getBoundingClientRect().bottom,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.ok(m.eyebrowTop >= m.header, `eyebrow (${m.eyebrowTop}) sits under the header (${m.header})`);
      assert.ok(m.bottom <= height, `copy ends at ${m.bottom}, viewport is ${height}`);
      assert.equal(m.overflow, false, 'no horizontal scroll');
      if (js) {
        // Story controls never cover the copy or CTAs.
        await page.locator('[data-hero-story-pause]').waitFor({ state: 'visible' });
        const hits = await page.evaluate(() => {
          const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
          const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          const controls = [r('[data-hero-story-pause]'), r('[data-hero-story-indicator]')];
          const copy = [r('.hero-copy .lead'), r('.hero-ctas')];
          return controls.flatMap((c) => copy.map((t) => hit(c, t)));
        });
        assert.deepEqual(hits, [false, false, false, false], 'pause/indicator clear of the lead and CTAs');
      }
      if (width < 768) {
        // Phones: copy pinned to the bottom, leaving the top for the visual.
        assert.ok(height - m.bottom <= m.padBottom + 2, `copy bottom-aligned (gap ${height - m.bottom})`);
      } else {
        // Copy lines up with the logo and stays inside the shade (transparent at max(58%, pad + 760px)).
        assert.ok(m.right <= Math.max(0.58 * width, m.left + 760), `copy ends at x=${m.right}, inside the shade`);
        assert.ok(Math.abs(m.left - m.logoLeft) <= 1, `copy left ${m.left} lines up with the logo ${m.logoLeft}`);
      }
    } finally {
      await context.close();
    }
  });
}

// Story 2.2 matrix: autoplay, pause, theme recolor, reduced motion.
const home = () => `http://127.0.0.1:${server.port}/`;
const painted = () => {
  const c = document.querySelector<HTMLCanvasElement>('[data-hero-story-canvas]')!;
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  let sum = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i]) (n++, (sum += d[i - 3] + d[i - 2] * 7 + d[i - 1] * 13));
  return { n, sum };
};

test('hero story: plays, pauses with a label that says what it will do, recolors on theme change', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(home(), { waitUntil: 'load' });
    const pause = page.locator('[data-hero-story-pause]');
    await pause.waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-hero-story-name]').textContent(), 'Computation');
    assert.ok((await page.evaluate(painted)).n > 500, 'particles drawn');

    await pause.click();
    assert.equal(await pause.getAttribute('data-paused'), '');
    assert.equal(await pause.getAttribute('aria-label'), 'Play background animation');
    await page.waitForTimeout(150);
    const held = await page.evaluate(painted);
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(painted), held, 'paused frame holds');

    await page.locator('[data-theme-toggle]').first().click();
    assert.notEqual((await page.evaluate(painted)).sum, held.sum, 'particles recolor');

    await pause.click();
    assert.equal(await pause.getAttribute('data-paused'), null);
    assert.equal(await pause.getAttribute('aria-label'), 'Pause background animation');
  } finally {
    await context.close();
  }
});

test('hero story: reduced motion shows the still logo scene, no pause, no loop', async () => {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(home(), { waitUntil: 'load' });
    await page.locator('[data-hero-story-indicator]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-hero-story-name]').textContent(), 'DataKeel');
    assert.equal(await page.locator('[data-hero-story-pause]').isHidden(), true);
    const first = await page.evaluate(painted);
    assert.ok(first.n > 300, 'logo drawn');
    await page.waitForTimeout(400);
    assert.deepEqual(await page.evaluate(painted), first, 'nothing moves');
    await page.setViewportSize({ width: 390, height: 700 }); // resizing clears the canvas bitmap
    await page.waitForTimeout(150);
    assert.ok((await page.evaluate(painted)).n > 300, 'still frame redrawn after resize');
  } finally {
    await context.close();
  }
});

test('hero story: autoplay advances the label and ticks after ~4s', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(home(), { waitUntil: 'load' });
    const name = page.locator('[data-hero-story-name]');
    await page.locator('[data-hero-story-pause]').waitFor({ state: 'visible' });
    assert.equal(await name.textContent(), 'Computation');
    // Label flips past the morph midpoint (~3.2s in); allow for idle start.
    await page.waitForFunction(() => document.querySelector('[data-hero-story-name]')!.textContent === 'Data', null, { timeout: 6000 });
    const current = await page.locator('[data-hero-story-ticks] > i.is-current').count();
    assert.equal(current, 1);
    assert.equal(await page.locator('[data-hero-story-ticks] > i').nth(1).getAttribute('class'), 'is-current');
  } finally {
    await context.close();
  }
});

test('hero story: a hidden tab holds the frame and resumes the same scene', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(home(), { waitUntil: 'load' });
    await page.locator('[data-hero-story-pause]').waitFor({ state: 'visible' });
    const setHidden = (hidden: boolean) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    await page.evaluate(setHidden, true);
    await page.waitForTimeout(100);
    const held = await page.evaluate(painted);
    const label = await page.locator('[data-hero-story-name]').textContent();
    await page.waitForTimeout(4500); // longer than a scene: a running clock would have moved on
    assert.deepEqual(await page.evaluate(painted), held, 'frame holds while hidden');
    await page.evaluate(setHidden, false);
    await page.waitForTimeout(100);
    assert.equal(await page.locator('[data-hero-story-name]').textContent(), label, 'resumes the same scene');
    assert.notDeepEqual(await page.evaluate(painted), held, 'animation runs again');
  } finally {
    await context.close();
  }
});

test('hero story: no 2d context leaves the copy alone and shows no controls', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    await context.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null;
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(home(), { waitUntil: 'load' });
    await page.waitForTimeout(2500); // past the idle-start timeout
    assert.equal(await page.locator('[data-hero-story-pause]').isHidden(), true);
    assert.equal(await page.locator('[data-hero-story-indicator]').isHidden(), true);
    assert.equal(await page.locator('h1').textContent(), 'The data backbone your AI runs on.');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test('hero story: scrolled off-screen, the clock stops; back on screen, the same scene resumes', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(home(), { waitUntil: 'load' });
    await page.locator('[data-hero-story-pause]').waitFor({ state: 'visible' });
    const label = await page.locator('[data-hero-story-name]').textContent();
    // The short Epic 2 page can't scroll the hero fully out of view; add room below it.
    await page.evaluate(() => {
      document.body.append(Object.assign(document.createElement('div'), { style: 'height: 3000px' }));
      scrollTo(0, document.documentElement.scrollHeight);
    });
    assert.ok(await page.evaluate(() => document.querySelector('[data-hero-story]')!.getBoundingClientRect().bottom < 0), 'hero off-screen');
    await page.waitForTimeout(4500); // longer than a scene
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(150);
    assert.equal(await page.locator('[data-hero-story-name]').textContent(), label, 'no scene advanced off-screen');
  } finally {
    await context.close();
  }
});
