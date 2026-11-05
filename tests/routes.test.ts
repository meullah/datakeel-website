import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as u from '../src/lib/urls.ts';
import { caseStudyIds, guideIds, industries } from './content-data.ts';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const skip = { skip: existsSync(dist) ? false : 'dist/ not found; run npm run build first' };

/** Route -> crumb name after Home (the page's h1 wording; industry pages use the industry name); null for Home. */
const trails = new Map<string, string | null>([
  [u.homeUrl(), null],
  [u.whatWeDoUrl(), 'What we do'],
  [u.howWeWorkUrl(), 'How we work'],
  [u.caseStudiesUrl(), 'Case studies'],
  ...industries.map((i) => [u.industryUrl(i.id), i.name] as [string, string]),
  [u.standardUrl(), 'The DataKeel Standard'],
  [u.readinessReviewUrl(), 'Data & AI Readiness Review'],
  [u.selfAssessmentUrl(), 'Where does your week go?'],
  [u.guidesUrl(), 'Guides'],
  [u.aboutUrl(), 'About DataKeel AI'],
  [u.contactUrl(), 'Talk to us'],
  [u.privacyUrl(), 'Privacy policy'],
  [u.termsUrl(), 'Terms of use'],
]);
const routes = [...trails.keys()];
const read = (r: string) => readFileSync(join(dist, r, 'index.html'), 'utf8');
const match = (html: string, re: RegExp, what: string, r: string) => {
  const m = html.match(re)?.[1];
  assert.ok(m !== undefined, `${r}: no ${what}`);
  return m;
};

test('all 16 sitemap routes are built', skip, () => {
  assert.equal(routes.length, 16);
  for (const r of routes) assert.ok(existsSync(join(dist, r, 'index.html')), `missing ${r}`);
});

test('each route has one h1, a unique title and description, no noindex and no placeholder copy', skip, () => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const r of routes) {
    const html = read(r);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${r}: h1 count`);
    const title = match(html, /<title>([^<]*)<\/title>/, 'title', r);
    const description = match(html, /<meta name="description" content="([^"]*)"/, 'description', r);
    assert.ok(!titles.has(title), `${r}: duplicate title "${title}"`);
    assert.ok(!descriptions.has(description), `${r}: duplicate description`);
    titles.add(title);
    descriptions.add(description);
    assert.ok(!html.includes('<meta name="robots" content="noindex"'), `${r}: noindex`);
    assert.doesNotMatch(html, /lorem|coming soon|under construction/i, r);
  }
});

const breadcrumbList = (r: string) => {
  const ld = JSON.parse(match(read(r), /<script type="application\/ld\+json">([^<]*)<\/script>/, 'JSON-LD', r));
  const list = ld['@graph'].find((n: { '@type': string }) => n['@type'] === 'BreadcrumbList');
  assert.ok(list, `${r}: no BreadcrumbList`);
  return list.itemListElement.map((i: { name: string; item: string }) => [i.name, i.item]);
};

test('non-home BreadcrumbList is exactly Home / {page}', skip, () => {
  for (const [r, name] of trails) {
    if (name === null) continue;
    assert.deepEqual(breadcrumbList(r), [['Home', u.absoluteUrl('/')], [name, u.absoluteUrl(r)]], r);
  }
});

test('case study BreadcrumbList is exactly Home / Case studies / {headline}', skip, () => {
  for (const id of caseStudyIds) {
    const r = u.caseStudyUrl(id);
    const headline = match(read(r), /<h1[^>]*>([^<]*)<\/h1>/, 'h1', r);
    assert.deepEqual(breadcrumbList(r), [
      ['Home', u.absoluteUrl('/')],
      ['Case studies', u.absoluteUrl(u.caseStudiesUrl())],
      [headline, u.absoluteUrl(r)],
    ], r);
  }
});

test('sitemap lists exactly the 16 routes plus each published case study and guide', skip, () => {
  const xml = readFileSync(join(dist, 'sitemap-0.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  assert.deepEqual(locs, [...routes, ...caseStudyIds.map(u.caseStudyUrl), ...guideIds.map(u.guideUrl)].map(u.absoluteUrl).sort());
});
