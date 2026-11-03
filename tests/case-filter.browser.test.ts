// Story 3.2 matrix: chip filtering with and without JS, deep link, unknown id.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { preview, type PreviewServer } from 'astro';
import { chromium, type Browser, type Page } from 'playwright-chromium';

let browser: Browser;
let server: PreviewServer;
const url = (q = '') => `http://127.0.0.1:${server.port}/case-studies/${q}`;

before(async () => {
  server = await preview({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
  await server?.stop();
});

const visible = (page: Page) => page.$$eval('[data-case-card]', (cards) => cards.filter((c) => !(c as HTMLElement).hidden).map((c) => (c as HTMLElement).dataset.industry));
const current = (page: Page) => page.$$eval('a[data-chip][aria-current="true"]', (c) => c.map((x) => (x as HTMLElement).dataset.chip));
const selected = (page: Page) => page.$$eval('a[data-chip].is-selected', (c) => c.map((x) => (x as HTMLElement).dataset.chip));

test('case filter without JS: a chip is a link to its industry page', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(url());
    await page.click('a[data-chip="healthcare"]');
    assert.equal(new URL(page.url()).pathname, '/industries/healthcare/');
  } finally {
    await context.close();
  }
});

test('case filter with JS: chip filters in place, All resets, count announced', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(url(), { waitUntil: 'load' });
    assert.equal((await visible(page)).length, 5);
    await page.click('a[data-chip="healthcare"]');
    assert.equal(new URL(page.url()).pathname, '/case-studies/', 'stays on the index');
    assert.deepEqual(await visible(page), ['healthcare', 'healthcare']);
    assert.deepEqual(await selected(page), ['healthcare']);
    assert.deepEqual(await current(page), ['healthcare'], 'aria-current moves with the selection');
    assert.equal(new URL(page.url()).search, '?industry=healthcare');
    assert.equal(await page.textContent('[data-case-filter-status]'), 'Showing 2 case studies');
    await page.click('a[data-chip=""]');
    assert.equal((await visible(page)).length, 5);
    assert.equal(new URL(page.url()).search, '');
  } finally {
    await context.close();
  }
});

test('case filter: deep link applies on load; unknown id is All with the query removed', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(url('?industry=finance'), { waitUntil: 'load' });
    assert.deepEqual(await visible(page), ['finance']);
    assert.deepEqual(await selected(page), ['finance']);
    assert.deepEqual(await current(page), ['finance']);
    assert.equal(await page.textContent('[data-case-filter-status]'), '', 'nothing announced on load');
    await page.goto(url('?industry=space'), { waitUntil: 'load' });
    assert.equal((await visible(page)).length, 5);
    assert.equal(new URL(page.url()).search, '');
    assert.deepEqual(await current(page), [''], 'All is current');
    await page.goto(url('?utm_source=linkedin&industry=finance'), { waitUntil: 'load' });
    await page.click('a[data-chip=""]');
    assert.equal(new URL(page.url()).search, '?utm_source=linkedin', 'other params kept');
  } finally {
    await context.close();
  }
});

test('case filter: Ctrl+click leaves the index alone and opens the industry page', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(url(), { waitUntil: 'load' });
    const popup = context.waitForEvent('page');
    await page.click('a[data-chip="healthcare"]', { modifiers: ['Control'] });
    const opened = await popup;
    await opened.waitForLoadState();
    assert.equal(new URL(opened.url()).pathname, '/industries/healthcare/');
    assert.equal((await visible(page)).length, 5);
    assert.equal(new URL(page.url()).search, '');
  } finally {
    await context.close();
  }
});
