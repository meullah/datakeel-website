// Story 3.3: the project summary panel is a sticky side panel from 1024px, sized to its content, on the right content edge.
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

test('case detail at 1440px: summary panel sticky, content-height, right-aligned, CTA on one line', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(`http://127.0.0.1:${server.port}/case-studies/health-claims-review-proof-of-concept/`);
    const m = await page.evaluate(() => {
      const side = document.querySelector<HTMLElement>('[aria-label="Project summary"]')!;
      const cta = side.querySelector<HTMLElement>('.btn-primary')!;
      return {
        position: getComputedStyle(side).position,
        sideH: side.getBoundingClientRect().height,
        bodyH: document.querySelector('.case-body')!.getBoundingClientRect().height,
        sideRight: side.getBoundingClientRect().right,
        edge: document.querySelector('.header-cta')!.getBoundingClientRect().right,
        ctaH: cta.getBoundingClientRect().height,
      };
    });
    assert.equal(m.position, 'sticky');
    assert.ok(m.sideH < m.bodyH * 0.8, `panel ${m.sideH}px is sized to its content, not the article (${m.bodyH}px)`);
    assert.ok(Math.abs(m.sideRight - m.edge) <= 1, `panel right ${m.sideRight} on the content edge ${m.edge}`);
    assert.ok(m.ctaH <= 50, `CTA is one line (${m.ctaH}px)`);
    await page.evaluate(() => scrollTo(0, 500)); // mid-article (sticky releases at the article's end)
    const { top, expected } = await page.evaluate(() => ({
      top: document.querySelector('[aria-label="Project summary"]')!.getBoundingClientRect().top,
      expected: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) + 24,
    }));
    assert.ok(Math.abs(top - expected) <= 2, `panel pinned 24px under the header when scrolled (${top}, expected ${expected})`);
  } finally {
    await page.close();
  }
});

test('case detail at 360px: summary is a static block between the title and the article', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  try {
    await page.goto(`http://127.0.0.1:${server.port}/case-studies/health-claims-review-proof-of-concept/`);
    const m = await page.evaluate(() => {
      const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const side = document.querySelector<HTMLElement>('[aria-label="Project summary"]')!;
      return { position: getComputedStyle(side).position, sideTop: side.getBoundingClientRect().top, sideBottom: side.getBoundingClientRect().bottom, headBottom: rect('.case-head').bottom, bodyTop: rect('.case-body').top };
    });
    assert.notEqual(m.position, 'sticky');
    assert.ok(m.sideTop >= m.headBottom, `panel (${m.sideTop}) below the title block (${m.headBottom})`);
    assert.ok(m.sideBottom <= m.bodyTop, `panel (${m.sideBottom}) above the article (${m.bodyTop})`);
  } finally {
    await page.close();
  }
});
