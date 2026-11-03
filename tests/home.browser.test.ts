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
