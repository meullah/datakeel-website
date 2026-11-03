import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as seo from '../src/lib/seo.ts';
import { themeColor, themeColorDark } from '../src/lib/config.ts';

const page = (over: Partial<seo.PageSeo> = {}): seo.PageSeo => ({
  path: '/about/',
  title: 'About | DataKeel AI',
  description: 'About DataKeel AI.',
  breadcrumbs: [{ name: 'About', url: '/about/' }],
  ...over,
});
const types = (g: ReturnType<typeof seo.buildGraph>) => g['@graph'].map((n) => n['@type']);

test('fullTitle appends the suffix and fails over 60 chars naming the page', () => {
  assert.equal(seo.fullTitle('About', '/about/'), 'About | DataKeel AI');
  const ok = 'x'.repeat(60 - seo.TITLE_SUFFIX.length);
  assert.equal(seo.fullTitle(ok, '/a/').length, 60);
  assert.throws(() => seo.fullTitle(ok + 'x', '/long/'), /\/long\/.*61 chars/);
});

test('blank or missing titles fail before the suffix is added', () => {
  for (const bad of ['', '   ', undefined]) {
    assert.throws(() => seo.fullTitle(bad, '/about/'), /\/about\/.*missing or blank/);
    assert.throws(() => seo.assertTitle(bad, '/'), /missing or blank/);
  }
});

test('custom full title (Home) is guarded at 60 chars', () => {
  assert.equal(seo.assertTitle('DataKeel AI', '/'), 'DataKeel AI');
  assert.throws(() => seo.assertTitle('x'.repeat(61), '/'), /61 chars/);
});

test('description fails over 155 chars naming the page', () => {
  assert.equal(seo.assertDescription('d'.repeat(155), '/a/').length, 155);
  assert.throws(() => seo.assertDescription('d'.repeat(156), '/about/'), /\/about\/.*156 chars/);
  assert.throws(() => seo.assertDescription('  ', '/about/'), /blank/);
});

test('breadcrumbs are required only on indexable non-home pages', () => {
  assert.throws(() => seo.buildGraph(page({ breadcrumbs: undefined })), /\/about\/.*breadcrumbs/);
  assert.throws(() => seo.buildGraph(page({ breadcrumbs: [] })), /breadcrumbs/);
  assert.deepEqual(types(seo.buildGraph(page({ path: '/', breadcrumbs: undefined }))), ['Organization', 'WebSite', 'WebPage']);
  assert.deepEqual(
    types(seo.buildGraph(page({ path: '/404/', breadcrumbs: undefined, noindex: true }))),
    ['Organization', 'WebSite', 'WebPage'],
  );
});

test('breadcrumb urls must be internal slash paths ending at the current page', () => {
  for (const url of ['/about', 'about/', 'https://datakeelai.com/about/', '//evil.com/']) {
    assert.throws(() => seo.buildGraph(page({ breadcrumbs: [{ name: 'About', url }] })), /must be an internal path/, url);
  }
  assert.throws(
    () => seo.buildGraph(page({ breadcrumbs: [{ name: 'Guides', url: '/guides/' }] })),
    /last breadcrumb url "\/guides\/" must be the current path/,
  );
});

test('normal page graph: Organization, WebSite, WebPage, BreadcrumbList(Home -> About)', () => {
  const g = seo.buildGraph(page());
  assert.equal(g['@context'], 'https://schema.org');
  const [org, site, webPage, crumbs] = g['@graph'];
  assert.equal(org['@id'], 'https://datakeelai.com/#organization');
  assert.ok(!('sameAs' in org), 'sameAs omitted while config is empty');
  assert.deepEqual(site.publisher, { '@id': org['@id'] });
  assert.deepEqual(webPage, {
    '@type': 'WebPage',
    '@id': 'https://datakeelai.com/about/#webpage',
    url: 'https://datakeelai.com/about/',
    name: 'About | DataKeel AI',
    description: 'About DataKeel AI.',
    inLanguage: 'en',
    isPartOf: { '@id': site['@id'] },
    about: { '@id': org['@id'] },
    publisher: { '@id': org['@id'] },
    breadcrumb: { '@id': 'https://datakeelai.com/about/#breadcrumb' },
  });
  assert.deepEqual(crumbs, {
    '@type': 'BreadcrumbList',
    '@id': 'https://datakeelai.com/about/#breadcrumb',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://datakeelai.com/' },
      { '@type': 'ListItem', position: 2, name: 'About', item: 'https://datakeelai.com/about/' },
    ],
  });
});

test('extra nodes are appended to the same @graph', () => {
  const faq = { '@type': 'FAQPage', mainEntity: [] };
  const g = seo.buildGraph(page({ path: '/', breadcrumbs: undefined, extraNodes: [faq] }));
  assert.equal(g['@graph'].length, 4);
  assert.equal(g['@graph'][3], faq);
});

test('serialized graph cannot close its script tag', () => {
  assert.ok(!seo.serializeGraph({ x: '</script>' }).includes('<'));
});

test('theme colors and manifest match the background tokens', () => {
  const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  const [light, dark] = [...tokens.matchAll(/--color-background:\s*(#[0-9A-Fa-f]{6})/g)].map((m) => m[1]);
  const manifest = JSON.parse(readFileSync(new URL('../public/site.webmanifest', import.meta.url), 'utf8'));
  assert.equal(themeColor, light);
  assert.equal(themeColorDark, dark);
  assert.equal(manifest.theme_color, light);
  assert.equal(manifest.background_color, light);
});
