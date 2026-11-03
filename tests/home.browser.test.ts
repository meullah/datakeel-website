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

// Story 2.3 matrix: logo collapse on scroll (desktop and 360px), pause survives, load mid-page, reduced-motion fade.
for (const { width, height } of [
  { width: 1280, height: 800 },
  { width: 360, height: 640 },
]) {
  test(`hero story at ${width}x${height}: scrolling docks into the header logo and back`, async () => {
    const context = await browser.newContext({ viewport: { width, height } });
    try {
      const page = await context.newPage();
      await page.addInitScript(() => {
        (window as any).__dock = [];
        document.addEventListener('dk:hero-story:dock', (e) => (window as any).__dock.push((e as CustomEvent).detail.progress));
      });
      await page.goto(home(), { waitUntil: 'load' });
      const pause = page.locator('[data-hero-story-pause]');
      await pause.waitFor({ state: 'visible' });
      const opacity = () => page.evaluate(() => getComputedStyle(document.querySelector('[data-dock-target]')!).opacity);
      const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      assert.equal(await opacity(), '1');

      // Most of the way: canvas raised above the header, mark dimmed, particles landing on it.
      await page.evaluate((y) => scrollTo(0, y), Math.round(height * 0.55 * 0.75));
      await page.evaluate(frames);
      assert.equal(await page.locator('[data-hero-story-canvas].is-docking').count(), 1);
      assert.ok(Number(await opacity()) < 0.5, 'header mark dimmed mid-dock');
      const nearMark = await page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>('[data-hero-story-canvas]')!;
        const r = document.querySelector('[data-dock-target]')!.getBoundingClientRect();
        const k = c.width / c.clientWidth;
        const d = c.getContext('2d')!.getImageData(Math.floor(r.left * k), Math.floor(r.top * k), Math.ceil(r.width * k), Math.ceil(r.height * k)).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
        return n;
      });
      assert.ok(nearMark > 20, `particles landing on the mark (${nearMark})`);
      // Stacking: nothing on the hero isolates the canvas, and it rises above the header (z 50) while docking.
      const stack = await page.evaluate(() => ({
        isolation: getComputedStyle(document.querySelector('.hero')!).isolation,
        canvas: getComputedStyle(document.querySelector('[data-hero-story-canvas]')!).zIndex,
        header: getComputedStyle(document.querySelector('[data-header]')!).zIndex,
      }));
      assert.equal(stack.isolation, 'auto');
      assert.ok(Number(stack.canvas) > Number(stack.header), `canvas z ${stack.canvas} above header z ${stack.header}`);

      // Fully docked: cleared, logo back, loop stopped (no more events while scrolling further down).
      await page.evaluate((y) => scrollTo(0, y), Math.ceil(height * 0.55) + 5);
      await page.evaluate(frames);
      assert.equal((await page.evaluate(painted)).n, 0, 'canvas cleared');
      assert.equal(await opacity(), '1');
      const events = await page.evaluate(() => (window as any).__dock.length);
      await page.evaluate(() => scrollBy(0, 20));
      await page.evaluate(frames);
      assert.equal(await page.evaluate(() => (window as any).__dock.length), events, 'stopped once docked');
      assert.equal(await page.evaluate(() => (window as any).__dock.at(-1)), 1);
      assert.equal(await page.locator('[data-hero-story-canvas].is-docking').count(), 0, 'cleared canvas drops back below the header');

      // Back to the top while paused: un-docks, stays paused.
      await page.evaluate(() => scrollTo(0, 0));
      await page.evaluate(frames);
      await pause.click();
      // Paused, the dock still follows the scroll.
      await page.evaluate((y) => scrollTo(0, y), Math.round(height * 0.55 * 0.75));
      await page.evaluate(frames);
      assert.equal(await page.locator('[data-hero-story-canvas].is-docking').count(), 1, 'paused story docks');
      assert.ok((await page.evaluate(() => (window as any).__dock.at(-1))) > 0);
      assert.ok(Number(await opacity()) < 0.5, 'mark dimmed while a paused story docks');
      await page.evaluate(() => scrollTo(0, 0));
      await page.evaluate(frames);
      assert.equal(await page.evaluate(() => (window as any).__dock.at(-1)), 0);
      assert.equal(await pause.getAttribute('data-paused'), '', 'still paused');
      const held = await page.evaluate(painted);
      assert.ok(held.n > 500, 'story drawn again at the top');
      await page.waitForTimeout(300);
      assert.deepEqual(await page.evaluate(painted), held, 'paused frame holds after docking');
      assert.equal(await opacity(), '1');
      assert.equal(await page.locator('[data-hero-story-canvas].is-docking').count(), 0);
    } finally {
      await context.close();
    }
  });
}

test('hero story: loading mid-page starts docked, no particles, logo visible', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    // Page already long and scrolled before any script runs, as a restored scroll position would be.
    await context.addInitScript(() =>
      document.addEventListener('DOMContentLoaded', () => {
        document.body.style.minHeight = '400vh'; // Epic 5 sections will make the page this long
        scrollTo(0, 1200);
      }),
    );
    const page = await context.newPage();
    await page.goto(home(), { waitUntil: 'load' });
    assert.ok((await page.evaluate(() => scrollY)) >= 1200, 'scrolled before the island boots');
    await page.locator('[data-hero-story-indicator]').waitFor({ state: 'visible' });
    await page.waitForTimeout(100);
    assert.equal((await page.evaluate(painted)).n, 0);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('[data-dock-target]')!).opacity), '1');
  } finally {
    await context.close();
  }
});

test('hero story: reduced motion fades the still scene on scroll, header logo untouched', async () => {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(home(), { waitUntil: 'load' });
    await page.locator('[data-hero-story-indicator]').waitFor({ state: 'visible' });
    await page.evaluate(() => scrollTo(0, Math.round(innerHeight * 0.55 * 0.5)));
    await page.waitForTimeout(100);
    const m = await page.evaluate(() => ({
      canvas: Number(getComputedStyle(document.querySelector('[data-hero-story-canvas]')!).opacity),
      logo: getComputedStyle(document.querySelector('[data-dock-target]')!).opacity,
      dock: document.documentElement.hasAttribute('data-hero-dock'),
    }));
    assert.ok(Math.abs(m.canvas - 0.5) < 0.05, `canvas half faded (${m.canvas})`);
    assert.equal(m.logo, '1');
    assert.equal(m.dock, false);
  } finally {
    await context.close();
  }
});

test('hero story: resize and theme switch mid-dock still land on the mark; unpaused story resumes at the top', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(home(), { waitUntil: 'load' });
    await page.locator('[data-hero-story-pause]').waitFor({ state: 'visible' });
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const onMark = () =>
      page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>('[data-hero-story-canvas]')!;
        const r = document.querySelector('[data-dock-target]')!.getBoundingClientRect();
        const k = c.width / c.clientWidth;
        const d = c.getContext('2d')!.getImageData(Math.floor(r.left * k), Math.floor(r.top * k), Math.ceil(r.width * k), Math.ceil(r.height * k)).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
        return n;
      });
    const midDock = async () => {
      await page.evaluate(() => scrollTo(0, Math.round(innerHeight * 0.55 * 0.75)));
      await page.evaluate(frames);
    };

    await midDock();
    await page.setViewportSize({ width: 360, height: 640 }); // header logo moves and shrinks
    await midDock();
    assert.ok((await onMark()) > 20, 'lands on the mark after resize');

    await page.evaluate(() => (document.querySelector('[data-theme-toggle]:not([hidden])') as HTMLElement).click());
    await midDock();
    assert.ok((await onMark()) > 20, 'lands on the mark after a theme switch');

    await page.evaluate(() => scrollTo(0, 0));
    await page.evaluate(frames);
    const a = await page.evaluate(painted);
    await page.waitForTimeout(300);
    assert.notDeepEqual(await page.evaluate(painted), a, 'story loops again at the top');
  } finally {
    await context.close();
  }
});

test('hero story: a failure mid-dock hands the header logo back', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(home(), { waitUntil: 'load' });
    await page.locator('[data-hero-story-pause]').waitFor({ state: 'visible' });
    await page.evaluate(() => scrollTo(0, Math.round(innerHeight * 0.55 * 0.6)));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.ok(await page.evaluate(() => document.documentElement.hasAttribute('data-hero-dock')), 'docking');
    await page.evaluate(() => {
      CanvasRenderingContext2D.prototype.fillRect = () => {
        throw new Error('boom');
      };
      scrollBy(0, 10);
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const m = await page.evaluate(() => ({
      hook: document.documentElement.hasAttribute('data-hero-dock'),
      logo: getComputedStyle(document.querySelector('[data-dock-target]')!).opacity,
      canvas: document.querySelector('[data-hero-story-canvas]')!.matches('.is-docking, [data-docking]'),
      pause: document.querySelector<HTMLElement>('[data-hero-story-pause]')!.hidden,
    }));
    assert.deepEqual(m, { hook: false, logo: '1', canvas: false, pause: true });
  } finally {
    await context.close();
  }
});
