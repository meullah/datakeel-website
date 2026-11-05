// Story 8.4: Privacy, Terms and the cookieless analytics beacon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudflareAnalyticsToken } from '../src/lib/config.ts';

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const skip = { skip: existsSync(root('dist/privacy/index.html')) ? false : 'dist/ not found; run npm run build first' };
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const mainText = (p: string) => { const h = readFileSync(root(`dist/${p}/index.html`), 'utf8'); return decode(h.slice(h.indexOf('<main'), h.indexOf('</main>')).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' '); };
const pages = JSON.parse(readFileSync(root('src/content/pages.json'), 'utf8')) as { id: string; reviewed: boolean }[];

test('privacy: every required law, every processor, the dk-theme preference, no cookies', skip, () => {
  const t = mainText('privacy');
  for (const k of ['UK GDPR', 'EU GDPR', 'CCPA/CPRA', 'PDPA', 'Privacy Act 1988', 'UAE', 'Saudi Arabia', 'Qatar', 'Web3Forms', 'Cloudflare Web Analytics', 'GitHub Pages', 'dk-theme'])
    assert.ok(t.includes(k), k);
  assert.match(t, /don’t use cookies/);
});

test('privacy and terms say they await legal review until reviewed is true', skip, () => {
  for (const id of ['privacy', 'terms']) {
    const reviewed = pages.find((p) => p.id === id)!.reviewed;
    assert.equal(mainText(id).includes('Draft: this page is waiting for legal review.'), !reviewed, id);
    assert.match(mainText(id), /Last updated [A-Z][a-z]+ \d{1,2}, \d{4}/);
  }
});

test('analytics: no beacon in this build while the token is empty; the beacon is gated on PROD and the live host', skip, () => {
  const layout = readFileSync(root('src/layouts/BaseLayout.astro'), 'utf8');
  assert.match(layout, /import\.meta\.env\.PROD && cloudflareAnalyticsToken &&/);
  assert.match(layout, /location\.hostname === host/);
  if (!cloudflareAnalyticsToken) {
    const html = readdirSync(root('dist'), { recursive: true }).filter((f) => String(f).endsWith('.html')).map((f) => readFileSync(join(root('dist'), String(f)), 'utf8'));
    assert.ok(html.every((h) => !h.includes('cloudflareinsights')));
  }
  assert.doesNotMatch(layout, /document\.cookie/);
});
