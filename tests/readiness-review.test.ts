// Story 4.2: built /readiness-review/ page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cta, email } from '../src/lib/config.ts';
import { inlineMd, plainMd } from '../src/lib/pure/inline-md.ts';
import { ORGANIZATION_ID } from '../src/lib/seo.ts';
import { absoluteUrl, readinessReviewUrl, standardUrl } from '../src/lib/urls.ts';

const file = fileURLToPath(new URL('../dist/readiness-review/index.html', import.meta.url));
const skip = { skip: existsSync(file) ? false : 'dist/ not found; run npm run build first' };
const html = () => readFileSync(file, 'utf8');
const mainOf = (h: string) => h.slice(h.indexOf('<main'), h.indexOf('</main>'));
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const text = (s: string) => decode(s.replace(/<[^>]+>/g, '')).trim();
const faqs: { question: string; answer: string }[] = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/content/faqs/readiness-review.json', import.meta.url)), 'utf8'),
);
const graph = (h: string) => JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])['@graph'] as Record<string, any>[];

test('inlineMd: internal links only; plainMd keeps link text', () => {
  assert.equal(inlineMd('see [the Standard](/standard/) now'), 'see <a href="/standard/">the Standard</a> now');
  assert.equal(inlineMd('[x](https://evil.com/)'), '[x](https://evil.com/)');
  assert.equal(inlineMd('[x](//evil.com/)'), '[x](//evil.com/)');
  assert.equal(inlineMd('[x](/\\evil.com)'), '[x](/\\evil.com)');
  assert.equal(inlineMd('[x](/a/"onclick=)'), '<a href="/a/&quot;onclick=">x</a>', 'quotes stay escaped inside href');
  assert.equal(plainMd('see [the Standard](/standard/) and **this**'), 'see the Standard and this');
});

test('FAQ JSON: 4 to 8 items, the Standard answer links standardUrl()', () => {
  assert.ok(faqs.length >= 4 && faqs.length <= 8);
  assert.ok(faqs.some((f) => f.answer.includes(`](${standardUrl()})`)));
});

test('sections in order, one h1, two primaries, form inside #request, review closing band', skip, () => {
  const h = html();
  const main = mainOf(h);
  assert.equal((h.match(/<h1[\s>]/g) ?? []).length, 1);
  const order = ['data-section="hero"', 'data-section="timeline"', 'data-section="report"', 'data-faq', 'data-section="request"', 'data-closing-cta="review"'].map((m) => main.indexOf(m));
  assert.ok(order.every((i) => i >= 0), `all sections present: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'section order');

  const hero = main.slice(order[0], order[1]);
  assert.match(hero, /class="eyebrow"[^>]*>The first step</);
  assert.equal(text(hero.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)![1]), 'Data & AI Readiness Review');
  for (const fact of ['Fixed price', 'About 10 days', 'Written plan at the end']) assert.ok(hero.includes(`>${fact}</li>`), fact);
  assert.match(hero, /<a class="btn btn-primary" href="#request"[^>]*>/);
  assert.ok(hero.includes(`Prefer email? <a href="mailto:${email}"`), 'mailto link');

  assert.equal((main.match(/\bbtn-primary\b/g) ?? []).length, 2, 'hero CTA and form submit are the only primaries');

  const request = main.match(/<section[^>]*id="request"[\s\S]*?<\/section>/)![0];
  assert.equal(text(request.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)![1]), cta.primary);
  assert.match(request, /<form[^>]*data-form="readiness-review"/);
  assert.match(main.slice(order[5]), /Not ready for a review yet\?/);
});

test('timeline: <ol> of 3 steps, Day 10 node filled', skip, () => {
  const main = mainOf(html());
  const ol = main.match(/<ol class="timeline[^"]*"[^>]*>([\s\S]*?)<\/ol>/)![1];
  const items = ol.match(/<li[\s>][\s\S]*?<\/li>/g)!;
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((li) => text(li.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)![1])), ['Kickoff', 'Data walkthrough', 'Plan delivered']);
  assert.ok(items[2].includes('Day 10') && items[2].includes('timeline-node-final'));
  assert.ok(!items[0].includes('timeline-node-final') && !items[1].includes('timeline-node-final'));
});

test('report: four headings as text, preview hidden from assistive tech', skip, () => {
  const main = mainOf(html());
  const section = main.match(/<section[^>]*data-section="report"[\s\S]*?<\/section>/)![0];
  const heads = [...section.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => text(m[1]));
  assert.deepEqual(heads, ['Data readiness score', 'Top 3 data risks', 'AI use cases for the next 90 days', 'Phased roadmap with costs']);
  assert.match(section, /class="report-preview[^"]*"[^>]*aria-hidden="true"/);
  assert.ok(!/<a\s/.test(section), 'nothing clickable');
  assert.match(section, /Sample report, blurred\./);
});

test('FAQ: one details per JSON item, answers in the HTML, no JSON-LD in the block', skip, () => {
  const main = mainOf(html());
  const block = main.match(/<section[^>]*data-faq[\s\S]*?<\/section>/)![0];
  assert.match(block, /<h2[^>]*>Questions about the review<\/h2>/);
  const details = block.match(/<details[\s>][\s\S]*?<\/details>/g)!;
  assert.equal(details.length, faqs.length);
  details.forEach((d, i) => {
    assert.equal(text(d.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)![1]), faqs[i].question);
    assert.equal(text(d.match(/<p[^>]*>([\s\S]*?)<\/p>/)![1]), plainMd(faqs[i].answer));
  });
  assert.match(block, new RegExp(`<a href="${standardUrl()}">The DataKeel Standard</a>`));
  assert.ok(!block.includes('application/ld+json'));
});

test('JSON-LD: exactly one FAQPage matching the JSON, a Service with no price', skip, () => {
  const h = html();
  assert.equal((h.match(/application\/ld\+json/g) ?? []).length, 1);
  const nodes = graph(h);
  const faqPages = nodes.filter((n) => n['@type'] === 'FAQPage');
  assert.equal(faqPages.length, 1);
  assert.deepEqual(
    faqPages[0].mainEntity.map((q: any) => [q.name, q.acceptedAnswer.text]),
    faqs.map((f) => [f.question, plainMd(f.answer)]),
  );
  const webPage = nodes.find((n) => n['@type'] === 'WebPage')!;
  assert.equal(faqPages[0].isPartOf['@id'], webPage['@id']);
  const services = nodes.filter((n) => n['@type'] === 'Service');
  assert.equal(services.length, 1);
  const url = absoluteUrl(readinessReviewUrl());
  assert.equal(services[0].url, url);
  assert.ok(services[0]['@id'].startsWith(url), services[0]['@id']);
  assert.deepEqual(services[0].provider, { '@id': ORGANIZATION_ID });
  assert.equal(services[0].name, 'Data & AI Readiness Review');
  for (const k of ['offers', 'price', 'priceRange', 'areaServed']) assert.ok(!(k in services[0]), k);
});

test('no price anywhere: no currency symbols or amounts in main or JSON-LD', skip, () => {
  const h = html();
  const ld = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1];
  for (const [label, s] of [['main', text(mainOf(h).replace(/<script[\s\S]*?<\/script>/g, ''))], ['JSON-LD', ld]]) {
    assert.ok(!/[$€£¥]|\b(USD|EUR|GBP|dollars?)\b/i.test(s), `${label}: currency`);
  }
  // Amounts like "5,000" or "5k". The form's company-size options ("1,000+ people") are sizes, not prices, so they are stripped.
  const copy = text(mainOf(h).replace(/<script[\s\S]*?<\/script>|<select[\s\S]*?<\/select>/g, ''));
  const amount = copy.match(/\b\d{1,3}(,\d{3})+\b|\b\d+(\.\d+)?\s?k\b/i);
  assert.equal(amount, null, `amount in main: ${amount?.[0]}`);
  for (const ok of ['10 days', 'Day 3', 'Top 3', '90 days']) assert.ok(copy.includes(ok), ok);
});
