import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { absoluteUrl, isNoindexPath, noindexPaths } from '../src/lib/urls.ts';

const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const hasDist = existsSync(dist);
const files = hasDist ? (readdirSync(dist, { recursive: true }) as string[]).map((f) => join(dist, f)) : [];
const textFiles = files.filter((f) => /\.(html|css|js|xml|txt|json|svg)$/.test(f));

test('built site self-hosts Geist and makes no font requests elsewhere', { skip: hasDist ? false : 'dist/ not found; run npm run build first' }, () => {
  assert.ok(files.some((f) => /\.woff2$/.test(f)), 'no .woff2 file in dist');
  for (const f of textFiles) {
    const body = readFileSync(f, 'utf8');
    for (const banned of ['googleapis', 'gstatic', 'monospace']) {
      assert.ok(!body.includes(banned), `${f} contains ${banned}`);
    }
  }
  assert.ok(
    textFiles.some((f) => /\.(css|html)$/.test(f) && readFileSync(f, 'utf8').includes('--font-geist:')),
    'no built CSS declares --font-geist',
  );
});

const skipNoDist = { skip: hasDist ? false : 'dist/ not found; run npm run build first' };
const pages = [
  { path: '/', file: 'index.html', crumbs: false, noindex: false },
  { path: '/styleguide/', file: 'styleguide/index.html', crumbs: true, noindex: true },
];

for (const p of pages) {
  test(`dist ${p.file} has the single SEO head`, skipNoDist, () => {
    const html = readFileSync(join(dist, p.file), 'utf8');
    const count = (re: RegExp) => (html.match(re) ?? []).length;
    assert.equal(count(/<title>/g), 1, 'title');
    const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(canonicals, [absoluteUrl(p.path)]);
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)];
    assert.equal(scripts.length, 1, 'JSON-LD scripts');
    const graphTypes = JSON.parse(scripts[0][1])['@graph'].map((n: { '@type': string }) => n['@type']);
    for (const t of ['Organization', 'WebSite', 'WebPage']) assert.ok(graphTypes.includes(t), t);
    assert.equal(graphTypes.includes('BreadcrumbList'), p.crumbs, 'BreadcrumbList');
    const outsideMain = html.replace(/<main[\s\S]*<\/main>/, '');
    assert.ok(!outsideMain.includes('<h1'), 'layout renders an <h1>');
    assert.equal(count(/<meta name="robots" content="noindex"/g), p.noindex ? 1 : 0, 'robots noindex');
  });
}

test('sitemap lists home and no noindex path', skipNoDist, () => {
  const xml = readFileSync(join(dist, 'sitemap-0.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  assert.ok(locs.includes('/'), 'home missing');
  for (const l of locs) assert.ok(!isNoindexPath(l), `${l} is noindex`);
  for (const p of noindexPaths) assert.ok(!locs.includes(p), p);
});
