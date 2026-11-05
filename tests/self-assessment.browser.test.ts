// Stories 7.2 and 7.3: /self-assessment/ questionnaire and Snapshot in a real browser.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { preview, type PreviewServer } from 'astro';
import { chromium, type Browser, type Page } from 'playwright-chromium';
import { assessment } from '../src/lib/pure/scoring.ts';

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

async function withPage(fn: (page: Page, offsite: string[]) => Promise<void>, { width = 1280, js = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, javaScriptEnabled: js });
  const offsite: string[] = [];
  try {
    const page = await context.newPage();
    page.on('request', (r) => { if (!r.url().startsWith(`http://127.0.0.1:${server.port}/`)) offsite.push(r.url()); });
    await page.goto(`http://127.0.0.1:${server.port}/self-assessment/`, { waitUntil: 'load' });
    await fn(page, offsite);
  } finally {
    await context.close();
  }
}

const visibleSteps = (page: Page) => page.$$eval('[data-sa-step]', (els) => els.filter((e) => !(e as HTMLElement).hidden).map((e) => Number((e as HTMLElement).dataset.saStep)));
const status = (page: Page) => page.textContent('[data-sa-status]');
const next = (page: Page) => page.click('[data-sa-next]');
const pick = (page: Page, name: string, value: string) => page.check(`input[name="${name}"][value="${value}"]`);

/** Answers Q1-Q4; hours via the keyboard. */
async function answerFour(page: Page, { reports = 'spreadsheets', hours = 12, agree = 'sometimes', systems = '4-7' } = {}) {
  await pick(page, 'reports', reports);
  await next(page);
  await page.focus('[data-sa-range]');
  for (let i = 0; i < hours; i++) await page.keyboard.press('ArrowRight');
  await next(page);
  await pick(page, 'agree', agree);
  await next(page);
  await pick(page, 'systems', systems);
  await next(page);
}

test('without JavaScript: intro and all five questions as fieldsets with legends, plus the note', () =>
  withPage(async (page) => {
    assert.deepEqual(await visibleSteps(page), [0, 1, 2, 3, 4]);
    const legends = await page.$$eval('fieldset[data-sa-step] > legend', (ls) => ls.map((l) => l.textContent!.replace(/\s+/g, ' ').trim()));
    assert.deepEqual(legends, assessment.questions.map((q, i) => `Question ${i + 1} of 5 ${q.legend}`));
    assert.ok(await page.isVisible('[data-sa-nojs]'));
    assert.ok(!(await page.isVisible('[data-sa-nav]')));
    assert.ok((await page.textContent('main'))!.includes("you don’t need to give your email"));
    assert.equal(await page.$('form[data-sa] input[type="email"]'), null, 'no email field');
  }, { js: false }));

test('one question at a time, announced progress, required answers, Back keeps answers', () =>
  withPage(async (page) => {
    assert.deepEqual(await visibleSteps(page), [0]);
    assert.equal(await status(page), 'Question 1 of 5');
    assert.equal(await page.getAttribute('[data-sa-status]', 'aria-live'), 'polite');
    assert.ok(!(await page.isVisible('[data-sa-back]')));
    await next(page);
    assert.deepEqual(await visibleSteps(page), [0], 'no answer, no move');
    assert.equal(await page.textContent('[data-sa-error]'), 'Pick an answer to continue.');
    await pick(page, 'reports', 'stitched');
    await next(page);
    assert.equal(await status(page), 'Question 2 of 5');
    assert.equal(await page.textContent('[data-sa-error]'), '');
    await page.click('[data-sa-back]');
    assert.equal(await status(page), 'Question 1 of 5');
    assert.ok(await page.isChecked('input[name="reports"][value="stitched"]'), 'answer kept');
  }));

test('Q2 native slider 0-40, 1-hour steps, value visible and in aria-valuetext', () =>
  withPage(async (page) => {
    await pick(page, 'reports', 'dashboard');
    await next(page);
    const r = '[data-sa-range]';
    assert.deepEqual(await page.$eval(r, (e) => [(e as HTMLInputElement).type, e.getAttribute('min'), e.getAttribute('max'), e.getAttribute('step')]), ['range', '0', '40', '1']);
    await page.focus(r);
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    assert.equal(await page.textContent('[data-sa-range-value]'), '3 hours a week');
    assert.equal(await page.getAttribute(r, 'aria-valuetext'), '3 hours a week');
    await page.keyboard.press('End');
    assert.equal(await page.textContent('[data-sa-range-value]'), '40 or more hours a week');
  }));

test('Snapshot after skipping Q5: time line, level, recommendations, label, CTA; nothing sent', () =>
  withPage(async (page, offsite) => {
    await answerFour(page);
    assert.equal(await status(page), 'Question 5 of 5');
    assert.ok(await page.isVisible('[data-sa-skip]'));
    await page.click('[data-sa-skip]');
    assert.ok(await page.isVisible('[data-sa-snapshot]'));
    assert.ok(!(await page.isVisible('form[data-sa]')));
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'snapshot-heading');
    const snap = (await page.textContent('[data-sa-snapshot]'))!.replace(/\s+/g, ' ');
    assert.ok(snap.includes('about 12 hours a week on manual data work. That’s roughly 576 hours a year (based on 48 working weeks)'), snap);
    assert.ok(!(await page.isVisible('[data-sa-goal]')), 'no goal line when skipped');
    // spreadsheets 0 + 12h 1 + sometimes 1 + 4-7 1 = 3: Early
    assert.equal(await page.textContent('[data-sa-level]'), 'Early');
    const recs = await page.$$eval('[data-sa-recs] li', (l) => l.map((x) => x.textContent));
    assert.deepEqual(recs, [assessment.recommendations[0].text, assessment.recommendations[1].text]);
    assert.ok(snap.includes(assessment.label));
    assert.equal(await page.getAttribute('[data-sa-snapshot] a.btn-primary', 'href'), '/readiness-review/');
    assert.equal((await page.$$('main .btn-primary:visible')).length, 1, 'one primary in view');
    assert.ok(await page.isVisible('[data-closing-cta="snapshot"]'));
    assert.deepEqual(offsite, []);
  }));

test('goal is quoted back as text; zero hours hides the time line', () =>
  withPage(async (page) => {
    await answerFour(page, { reports: 'dashboard', hours: 0, agree: 'always', systems: '1-3' });
    await page.fill('input[name="goal"]', '<img src=x onerror=alert(1)> Hiring for peak season');
    await page.click('[data-sa-next]');
    assert.equal(await page.textContent('[data-sa-goal-text]'), '<img src=x onerror=alert(1)> Hiring for peak season');
    assert.equal(await page.$('[data-sa-goal-text] img'), null);
    assert.ok(!(await page.isVisible('[data-sa-time]')));
    assert.equal(await page.textContent('[data-sa-level]'), 'Ready');
  }));

test('print: only the Snapshot prints, and the flag clears afterwards', () =>
  withPage(async (page) => {
    await answerFour(page);
    await page.click('[data-sa-skip]');
    await page.evaluate(() => {
      (window as any).__flag = null;
      window.print = () => { (window as any).__flag = document.body.dataset.printing; dispatchEvent(new Event('afterprint')); };
    });
    await page.click('[data-sa-print]');
    assert.equal(await page.evaluate(() => (window as any).__flag), 'snapshot');
    assert.equal(await page.evaluate(() => document.body.dataset.printing ?? null), null);
    await page.evaluate(() => (document.body.dataset.printing = 'snapshot'));
    await page.emulateMedia({ media: 'print' });
    const shown = (sel: string) => page.$eval(sel, (e) => getComputedStyle(e).display !== 'none');
    assert.equal(await shown('body > header, header'), false);
    assert.equal(await shown('[data-closing-cta]'), false);
    assert.equal(await shown('[data-sa-snapshot]'), true);
    assert.equal(await shown('.sa-actions'), false);
    await page.evaluate(() => delete document.body.dataset.printing);
    assert.equal(await shown('header'), true, 'normal print without the flag');
  }));

test('refresh restarts at question 1 with nothing selected', () =>
  withPage(async (page) => {
    await pick(page, 'reports', 'dashboard');
    await next(page);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await status(page), 'Question 1 of 5');
    assert.equal(await page.$('input[name="reports"]:checked'), null);
  }));

test('360px: no horizontal scroll; keyboard only reaches the Snapshot', () =>
  withPage(async (page) => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.focus('input[name="reports"]');
    await page.keyboard.press('ArrowDown'); // selects the next radio
    await page.keyboard.press('Enter');
    assert.equal(await status(page), 'Question 2 of 5');
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    assert.ok(await page.isVisible('[data-sa-snapshot]'));
  }, { width: 360 }));

test('server HTML: no form action and no network endpoint', () => {
  const html = readFileSync(fileURLToPath(new URL('../dist/self-assessment/index.html', import.meta.url)), 'utf8');
  const form = html.match(/<form\b[^>]*data-sa[^>]*>/)![0];
  assert.doesNotMatch(form, /\baction=/);
  assert.doesNotMatch(html, /web3forms/);
});
