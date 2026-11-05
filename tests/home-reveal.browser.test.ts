// Story 5.4 reveal island: below-fold sections fade up once; nothing hidden without JS or under reduced motion.
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

const home = () => `http://127.0.0.1:${server.port}/`;
const opacity = (key: string) => `getComputedStyle(document.querySelector('[data-section="${key}"]')).opacity`;

test('reveal: below-fold sections start hidden, fade in on scroll, and never hide again', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(home(), { waitUntil: 'load' });
    const tech = page.locator('[data-section="tech"]');
    assert.match((await tech.getAttribute('class')) ?? '', /reveal-pending/);
    assert.equal(await page.evaluate(opacity('tech')), '0');
    await tech.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('[data-section="tech"]')!.classList.contains('reveal-in'));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-section="tech"]')!).opacity === '1');
    // Once revealed, the observer is gone: strip the class and scroll back; the island must not add it again.
    await page.evaluate(() => document.querySelector('[data-section="tech"]')!.classList.remove('reveal-in'));
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(() => scrollY === 0);
    await tech.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    assert.doesNotMatch((await tech.getAttribute('class')) ?? '', /reveal-in/, 'no replay');
    // The hero is never marked.
    assert.doesNotMatch((await page.locator('.hero').getAttribute('class')) ?? '', /reveal/);
  } finally {
    await context.close();
  }
});

test('reveal: fragment links and reloads land mid-page with nothing hidden', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(`${home()}#faq-heading`, { waitUntil: 'load' });
    assert.equal(await page.locator('.reveal-pending').count(), 0, 'fragment visits skip the effect');
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.locator('.reveal-pending').count(), 0, 'reloads skip the effect');
  } finally {
    await context.close();
  }
});

for (const [name, options] of [
  ['without JS', { javaScriptEnabled: false }],
  ['under reduced motion', { reducedMotion: 'reduce' as const }],
] as const) {
  test(`reveal: nothing is hidden ${name}`, async () => {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, ...options });
    try {
      const page = await context.newPage();
      await page.goto(home(), { waitUntil: 'load' });
      assert.equal(await page.locator('.reveal-pending').count(), 0);
      assert.equal(await page.evaluate(opacity('explore')), '1');
    } finally {
      await context.close();
    }
  });
}
