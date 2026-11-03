import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright-chromium';

let browser: Browser;
let staticServer: Server;
let origin: string;

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const contentTypes: Record<string, string> = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

before(async () => {
  staticServer = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const relative = pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1);
    const file = join(dist, relative);
    if (!file.startsWith(dist)) {
      response.writeHead(400).end();
      return;
    }
    try {
      response.setHeader('content-type', contentTypes[extname(file)] ?? 'application/octet-stream');
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    staticServer.once('error', reject);
    staticServer.listen(0, '127.0.0.1', resolve);
  });
  const address = staticServer.address();
  if (!address || typeof address === 'string') throw new Error('Could not start the static test server');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  await new Promise<void>((resolve, reject) => staticServer?.close((error) => error ? reject(error) : resolve()));
});

test('360px modal is full-screen, inert, focus-safe, and keeps controls pinned', async () => {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  await page.goto(origin);
  const trigger = page.locator('[data-mobile-menu-trigger]');
  const dialog = page.locator('[data-mobile-menu]');
  const primary = page.locator('.menu-primary');
  const cta = page.locator('.menu-cta');

  await assert.doesNotReject(trigger.click());
  assert.equal(await dialog.getAttribute('open'), '');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-mobile-menu-close')), '');

  const dialogBox = await dialog.boundingBox();
  assert.deepEqual(dialogBox, { x: 0, y: 0, width: 360, height: 800 });
  const targetHeights = await dialog.locator('a, button').evaluateAll((targets) => targets.map((target) => target.getBoundingClientRect().height));
  assert.ok(targetHeights.every((height) => height >= 44), `target heights: ${targetHeights.join(', ')}`);
  assert.equal(await page.evaluate(() => document.body.style.position), 'fixed');
  await assert.rejects(page.locator('main').click({ trial: true, timeout: 250 }), /intercepts pointer events|not visible/);

  const ctaBefore = await cta.boundingBox();
  assert.ok(ctaBefore && ctaBefore.y + ctaBefore.height <= 800, `CTA is visible in the viewport: ${JSON.stringify(ctaBefore)}`);
  await primary.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const ctaAfter = await cta.boundingBox();
  assert.deepEqual(ctaAfter, ctaBefore, 'CTA stays pinned while primary links scroll');

  const focusable = dialog.locator('a, button');
  await focusable.last().focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'DataKeel AI home');
  await page.keyboard.press('Escape');
  assert.equal(await dialog.getAttribute('open'), null);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-mobile-menu-trigger')), '');
  await context.close();
});

test('without JavaScript the trigger stays hidden and menu content remains in HTML', async () => {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(origin);
  assert.equal(await page.locator('[data-mobile-menu-trigger]').isVisible(), false);
  assert.equal(await page.locator('[data-mobile-menu] a').count(), 14);
  await context.close();
});
