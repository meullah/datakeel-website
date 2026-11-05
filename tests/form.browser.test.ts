// Story 4.1 matrix on /styleguide/. Web3Forms is always intercepted with page.route; nothing real is sent.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { preview, type PreviewServer } from 'astro';
import { chromium, type Browser, type BrowserContext, type Page, type Request, type Route } from 'playwright-chromium';

let browser: Browser;
let server: PreviewServer;
const url = () => `http://127.0.0.1:${server.port}/styleguide/`;
const API = 'https://api.web3forms.com/**';

before(async () => {
  server = await preview({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } });
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
  await server?.stop();
});

async function withPage(fn: (page: Page, requests: Request[], context: BrowserContext) => Promise<void>, opts: { js?: boolean; respond?: (route: Route) => Promise<void> } = {}) {
  const context = await browser.newContext({ javaScriptEnabled: opts.js ?? true });
  const requests: Request[] = [];
  await context.route(API, async (route) => {
    requests.push(route.request());
    await (opts.respond ?? ((r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' })))(route);
  });
  try {
    const page = await context.newPage();
    await page.goto(url(), { waitUntil: 'load' });
    await fn(page, requests, context);
  } finally {
    await context.close();
  }
}

const rr = '#sg-light-rr';
async function fillRequest(page: Page, name = '  Sara  Collins ') {
  await page.fill(`${rr}-name`, name);
  await page.fill(`${rr}-email`, 'sara@lakeside.com');
  await page.fill(`${rr}-company`, 'Lakeside Logistics');
  await page.fill(`${rr}-role`, 'COO');
  await page.selectOption(`${rr}-companySize`, '50–249 people');
  await page.selectOption(`${rr}-country`, 'United States');
  await page.fill(`${rr}-message`, 'Reports from different teams don’t agree.');
}
const submit = (page: Page, prefix = rr) => page.click(`form:has(${prefix}-name) button[type="submit"]`);
const focused = (page: Page) => page.evaluate(() => ({ role: document.activeElement?.getAttribute('role'), id: document.activeElement?.id, text: document.activeElement?.textContent ?? '' }));

test('form with JS: valid submit posts JSON, focuses the success block and pushes /sent/', () =>
  withPage(async (page, requests) => {
    await fillRequest(page);
    await submit(page);
    await page.waitForSelector('.form-success');
    assert.equal(requests.length, 1);
    const req = requests[0];
    assert.equal(req.method(), 'POST');
    assert.equal(req.headers()['content-type'], 'application/json');
    assert.equal(req.headers()['accept'], 'application/json');
    const body = req.postDataJSON();
    assert.equal(body.form_type, 'readiness-review');
    assert.equal(body.subject, 'New Readiness Review request');
    assert.equal(body.redirect, 'https://datakeelai.com/readiness-review/sent/');
    assert.equal(body.companySize, '50–249 people');
    assert.equal(body.message, 'Reports from different teams don’t agree.');
    assert.ok(body.access_key);
    assert.equal(body.botcheck, undefined);
    const f = await focused(page);
    assert.equal(f.role, 'status');
    assert.match(f.text, /Request sent/);
    assert.equal(await page.textContent('.form-success h3'), 'Thanks, Sara. We’ll reply within one business day with details and pricing.');
    assert.equal(new URL(page.url()).pathname, '/readiness-review/sent/');
    assert.equal(await page.locator(`${rr}-name`).count(), 0, 'form replaced');
  }));

test('form with JS: contact variant pushes /contact/sent/', () =>
  withPage(async (page, requests) => {
    const c = '#sg-light-contact';
    await page.fill(`${c}-name`, 'Omar');
    await page.fill(`${c}-email`, 'omar@x.io');
    await page.fill(`${c}-company`, 'X');
    await page.fill(`${c}-message`, 'Hello');
    await submit(page, c);
    await page.waitForSelector('.form-success');
    assert.equal(requests[0].postDataJSON().subject, 'New contact message');
    assert.match((await page.textContent('.form-success-label')) ?? '', /^Message sent$/);
    assert.equal(await page.textContent('.form-success h3'), 'Thanks, Omar. We’ll get back to you within one business day.');
    assert.equal(new URL(page.url()).pathname, '/contact/sent/');
    const reload = await page.reload();
    assert.equal(reload?.status(), 200, 'pushed URL is a real page');
    assert.equal(await page.textContent('h1'), 'Thanks. We’ll get back to you within one business day.');
  }));

test('form with JS: invalid email errors on blur and on submit; no POST; first error focused', () =>
  withPage(async (page, requests) => {
    const err = `${rr}-email-error`;
    assert.equal(await page.isVisible(err), false, 'no error at rest');
    await page.focus(`${rr}-email`);
    await page.focus(`${rr}-company`); // blur email while empty
    assert.equal(await page.isVisible(err), true);
    assert.equal(await page.textContent(err).then((t) => t?.trim()), 'Please add your work email so we can reply.');
    assert.equal(await page.getAttribute(`${rr}-email`, 'aria-invalid'), 'true');
    assert.equal(await page.getAttribute(`${rr}-email`, 'aria-describedby'), err.slice(1));
    await fillRequest(page);
    assert.equal(await page.isVisible(err), false, 'error clears once fixed');
    assert.equal(await page.getAttribute(`${rr}-email`, 'aria-invalid'), null);
    assert.equal(await page.getAttribute(`${rr}-email`, 'aria-describedby'), null);
    await page.fill(`${rr}-email`, 'sara@');
    await submit(page);
    assert.equal(requests.length, 0);
    assert.equal((await focused(page)).id, 'sg-light-rr-email');
    const summary = page.locator(`form:has(${rr}-name) [data-form-summary]`);
    await page.waitForFunction((el) => el?.textContent === 'One field needs your attention: Work email.', await summary.elementHandle());
    await page.fill(`${rr}-email`, 'sara@lakeside.com');
    assert.equal(await summary.textContent(), '', 'summary follows the fix');
    assert.equal(await page.getAttribute(`form:has(${rr}-name) [data-form-summary]`, 'aria-live'), 'polite');
  }));

for (const [label, respond] of [
  ['server error', (r: Route) => r.fulfill({ status: 500, body: '{"success":false}' })],
  ['network error', (r: Route) => r.abort('failed')],
  ['200 with success false', (r: Route) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false}' })],
] as const) {
  test(`form with JS: ${label} shows the banner, keeps input, re-enables the button`, () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    return withPage(
      async (page) => {
        await fillRequest(page);
        await submit(page);
        const button = page.locator(`form:has(${rr}-name) button[type="submit"]`);
        assert.equal(await button.textContent(), 'Sending…');
        assert.equal(await button.isDisabled(), true);
        assert.equal(await page.isVisible(`${rr}-name`), true, 'form stays visible while sending');
        release();
        const banner = page.locator(`form:has(${rr}-name) [data-form-failure]`);
        await banner.waitFor({ state: 'visible' });
        assert.match((await banner.textContent()) ?? '', /Something went wrong on our side\. Your message is still here/);
        assert.equal(await button.isDisabled(), false);
        assert.equal(await button.textContent(), 'Request a Data & AI Readiness Review');
        assert.equal(await page.inputValue(`${rr}-email`), 'sara@lakeside.com');
        assert.equal(await page.inputValue(`${rr}-message`), 'Reports from different teams don’t agree.');
        assert.equal(new URL(page.url()).pathname, '/styleguide/');
      },
      { respond: async (r) => (await held, respond(r)) },
    );
  });
}

test('form with JS: honeypot ticked shows success without a request', () =>
  withPage(async (page, requests) => {
    await page.evaluate((sel) => {
      (document.querySelector(sel)!.closest('form')!.querySelector('[name="botcheck"]') as HTMLInputElement).checked = true;
    }, `${rr}-name`);
    await submit(page);
    await page.waitForSelector('.form-success');
    assert.equal(requests.length, 0);
    assert.equal(await page.textContent('.form-success h3'), 'Thanks. We’ll reply within one business day with details and pricing.');
    assert.equal(new URL(page.url()).pathname, '/styleguide/', 'spam is not counted as a conversion');
  }));

test('form without JS: native POST is form-encoded with the hidden fields', () =>
  withPage(
    async (page, requests) => {
      await fillRequest(page);
      await Promise.all([page.waitForEvent('requestfinished', (r) => r.url().startsWith('https://api.web3forms.com/')), submit(page)]);
      assert.equal(requests.length, 1);
      const req = requests[0];
      assert.equal(req.method(), 'POST');
      assert.equal(req.headers()['content-type'], 'application/x-www-form-urlencoded');
      const body = new URLSearchParams(req.postData() ?? '');
      assert.equal(body.get('form_type'), 'readiness-review');
      assert.equal(body.get('subject'), 'New Readiness Review request');
      assert.equal(body.get('redirect'), 'https://datakeelai.com/readiness-review/sent/');
      assert.equal(body.get('name'), '  Sara  Collins ');
      assert.equal(body.get('companySize'), '50–249 people');
      assert.ok(body.get('access_key'));
      assert.equal(body.has('botcheck'), false);
    },
    { js: false, respond: (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>ok</p>' }) },
  ));
