// Story 4.2: /readiness-review/ in a real browser.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { preview, type PreviewServer } from 'astro';
import { chromium, type Browser, type Page } from 'playwright-chromium';

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

async function withPage(width: number, fn: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.port}/readiness-review/`, { waitUntil: 'load' });
    await fn(page);
  } finally {
    await context.close();
  }
}

test('hero CTA moves to #request', () =>
  withPage(1280, async (page) => {
    await page.click('[data-hero-cta]');
    await page.waitForFunction(() => location.hash === '#request');
    const top = await page.evaluate(() => document.getElementById('request')!.getBoundingClientRect().top);
    assert.ok(top >= -1 && top < 200, `#request scrolled to the top (top=${top})`);
  }));

for (const width of [360, 1280]) {
  test(`no horizontal scroll at ${width}px`, () =>
    withPage(width, async (page) => {
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }));
}

test('FAQ details open and close with the keyboard', () =>
  withPage(1280, async (page) => {
    const summary = page.locator('[data-faq] summary').first();
    await summary.focus();
    const open = () => page.locator('[data-faq] details').first().evaluate((d) => (d as HTMLDetailsElement).open);
    assert.equal(await open(), false);
    await page.keyboard.press('Enter');
    assert.equal(await open(), true);
    await page.keyboard.press('Space');
    assert.equal(await open(), false);
  }));
