import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { escapeHtml, inlineMd } from '../src/lib/pure/inline-md.ts';
import { pickRelated } from '../src/lib/pure/related.ts';
import { defaultOgImage } from '../src/lib/config.ts';
import { ORGANIZATION_ID } from '../src/lib/seo.ts';
import * as u from '../src/lib/urls.ts';
import { caseStudyIds, industries } from './content-data.ts';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const skip = { skip: existsSync(dist) ? false : 'dist/ not found; run npm run build first' };

const c = (id: string, industry: string, related?: string[]) => ({ id, data: { industry: { id: industry }, ...(related ? { related: related.map((r) => ({ id: r })) } : {}) } });
const ids = (list: { id: string }[]) => list.map((e) => e.id);

test('pickRelated: explicit related wins, exactly those two', () => {
  const a = c('a', 'x'), b = c('b', 'y'), s = c('s', 'z'), cur = c('cur', 'z', ['b', 'a']);
  assert.deepEqual(ids(pickRelated(cur, [s, a, cur, b])), ['b', 'a']);
});

test('pickRelated: fallback is the same-industry case, then one other, never itself', () => {
  const cur = c('cur', 'health'), same = c('same', 'health'), o1 = c('o1', 'cars'), o2 = c('o2', 'money');
  assert.deepEqual(ids(pickRelated(cur, [cur, o1, same, o2])), ['same', 'o1']);
  assert.deepEqual(ids(pickRelated(c('lone', 'ins'), [c('lone', 'ins'), o2, o1])), ['o2', 'o1']);
});

test('pickRelated: one explicit is topped up; explicit ids missing from the list (drafts) are skipped', () => {
  const cur = c('cur', 'health', ['draft', 'o1']), same = c('same', 'health'), o1 = c('o1', 'cars');
  assert.deepEqual(ids(pickRelated(cur, [cur, same, o1])), ['o1', 'same']);
});

test('pickRelated: fewer candidates than count, self and duplicates in explicit related', () => {
  assert.deepEqual(pickRelated(c('only', 'x'), [c('only', 'x')]), []);
  const cur = c('cur', 'x', ['cur', 'a', 'a']), a = c('a', 'y');
  assert.deepEqual(ids(pickRelated(cur, [cur, a])), ['a']);
  assert.deepEqual(ids(pickRelated(cur, [cur, a, c('b', 'x')])), ['a', 'b']);
});

test('inlineMd: escapes HTML, renders hugging emphasis only', () => {
  assert.equal(escapeHtml('<a & "b">'), '&lt;a &amp; &quot;b&quot;&gt;');
  assert.equal(inlineMd('<b> & "q"'), '&lt;b&gt; &amp; &quot;q&quot;');
  assert.equal(inlineMd('shows *why*: x'), 'shows <em>why</em>: x');
  assert.equal(inlineMd('a **x** b'), 'a <strong>x</strong> b');
  assert.equal(inlineMd('2 * 3 * 4'), '2 * 3 * 4');
  assert.equal(inlineMd('a lone * star'), 'a lone * star');
  assert.equal(inlineMd('*open only'), '*open only');
});

test('draft case studies get no page', skip, () => {
  const all = readdirSync(fileURLToPath(new URL('../src/content/caseStudies/', import.meta.url))).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  for (const id of all) assert.equal(existsSync(`${dist}${u.caseStudyUrl(id).slice(1)}index.html`), caseStudyIds.includes(id), id);
});

const entry = (id: string) => readFileSync(fileURLToPath(new URL(`../src/content/caseStudies/${id}.md`, import.meta.url)), 'utf8');
const field = (src: string, key: string) => {
  const raw = src.match(new RegExp(`^${key}: (.*)$`, 'm'))?.[1];
  return raw === undefined ? undefined : (/^["']/.test(raw) ? raw.slice(1, -1) : raw);
};
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

test('every case study page: sections, one h1, SEO, Article, related, CTA', skip, () => {
  assert.equal(caseStudyIds.length, 5);
  for (const id of caseStudyIds) {
    const r = u.caseStudyUrl(id);
    const html = readFileSync(`${dist}${r.slice(1)}index.html`, 'utf8');
    const src = entry(id);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${r}: h1 count`);

    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    const h2s = [...main.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => decode(m[1]));
    assert.deepEqual(h2s.slice(0, 5), ['Before', 'What we built', 'What we found', 'After', 'Stack'], `${r}: section order`);
    assert.equal(h2s[5], 'More case studies', r);

    assert.equal(decode(html.match(/<title>([^<]*)<\/title>/)![1]), field(src, 'seoTitle'), `${r}: title`);
    assert.equal(decode(html.match(/<meta name="description" content="([^"]*)"/)![1]), field(src, 'metaDescription'), `${r}: description`);
    assert.equal(decode(html.match(/<meta property="og:description" content="([^"]*)"/)![1]), field(src, 'cardSummary'), `${r}: og:description`);

    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]*)<\/script>/)![1])['@graph'];
    const article = graph.find((n: { '@type': string }) => n['@type'] === 'Article');
    assert.ok(article, `${r}: no Article`);
    assert.equal(article.datePublished, field(src, 'published'), r);
    assert.equal(article.dateModified, field(src, 'updated'), r);
    assert.equal(article.headline, field(src, 'headline'), r);
    assert.equal(article.description, field(src, 'metaDescription'), r);
    assert.equal(article.author['@id'], ORGANIZATION_ID, r);
    assert.equal(article.publisher['@id'], ORGANIZATION_ID, r);
    assert.equal(article.image, u.absoluteUrl(defaultOgImage), r);
    assert.equal(article.inLanguage, 'en', r);
    assert.equal(article.mainEntityOfPage['@id'], `${u.absoluteUrl(r)}#webpage`, r);

    const nav = html.match(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav, `${r}: no visible breadcrumb`);
    const crumbLinks = [...nav.matchAll(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(crumbLinks, [[u.homeUrl(), 'Home'], [u.caseStudiesUrl(), 'Case studies']], `${r}: breadcrumb links`);
    assert.equal(decode(nav.match(/aria-current="page"[^>]*>([^<]*)</)?.[1] ?? ''), field(src, 'headline'), `${r}: current crumb`);

    const industryName = industries.find((i) => i.id === field(src, 'industry'))!.name;
    const serviceLabel = field(src, 'serviceLabel')!;
    const stack: string[] = JSON.parse(field(src, 'stack')!);
    assert.equal(decode(html.match(/class="case-tags[^"]*"[^>]*>([^<]*)</)?.[1] ?? ''), `${industryName} · ${serviceLabel}`, `${r}: tags`);

    const aside = html.match(/<aside[^>]*aria-label="Project summary"[\s\S]*?<\/aside>/)?.[0];
    assert.ok(aside, `${r}: no Project summary panel`);
    assert.ok(aside.includes(`href="${u.readinessReviewUrl()}"`), `${r}: panel CTA`);
    assert.ok(aside.includes(`>${industryName}<`), `${r}: panel industry`);
    assert.ok(decode(aside).includes(`>${serviceLabel}<`), `${r}: panel service`);
    const chips = [...aside.matchAll(/<li class="chip[^"]*"[^>]*>([^<]*)<\/li>/g)].map((m) => decode(m[1]));
    assert.deepEqual(chips, stack, `${r}: panel stack chips`);
    const framing = field(src, 'framingLabel');
    assert.equal(aside.includes('class="pill'), !!framing, `${r}: panel pill only with a framing label`);
    assert.equal(aside.includes('Key outcomes'), /^stats:/m.test(src), `${r}: Key outcomes only with stats`);

    const cards = html.match(/<article\b[^>]*data-case-card[\s\S]*?<\/article>/g) ?? [];
    assert.equal(cards.length, 2, `${r}: related cards`);
    for (const card of cards) assert.ok(!card.includes(`href="${r}"`), `${r}: related to itself`);
    assert.ok(html.includes('data-closing-cta="default"'), `${r}: closing CTA`);
    assert.doesNotMatch(main, /\*[^*\s][^*]*\*/, `${r}: raw markdown emphasis`);
  }
});

test('framing label and client line', skip, () => {
  const read = (id: string) => readFileSync(`${dist}${u.caseStudyUrl(id).slice(1)}index.html`, 'utf8');
  const poc = read('health-claims-review-proof-of-concept');
  assert.equal((poc.match(/class="pill[^"]*"[^>]*>Proof of concept</g) ?? []).length, 2, 'pill near headline and in panel');
  assert.match(poc, /Client:<\/strong>/);
  assert.match(poc, /<em>why<\/em>/);
  const dealer = read('dealer-inventory-google-vehicle-ads');
  assert.doesNotMatch(dealer.slice(dealer.indexOf('<main'), dealer.indexOf('data-case-card')), /class="pill/);
});
