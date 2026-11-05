// Story 5.4: the homepage sections after the Stack Diagram, the home FAQ and the faqs loader.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const skip = { skip: existsSync(file) ? false : 'dist/index.html not found; run npm run build first' };
const html = existsSync(file) ? readFileSync(file, 'utf8') : '';
const text = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const main = html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';
const sectionOf = (key: string) => {
  const s = [...main.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)].map((m) => m[0]).find((sec) => sec.includes(`data-section="${key}"`));
  assert.ok(s, `section ${key} missing`);
  return s;
};
const h2 = (s: string) => text(s.match(/<h2\b[\s\S]*?<\/h2>/)?.[0] ?? '');
const hrefs = (s: string) => [...s.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1]);
const built = (href: string) => existsSync(fileURLToPath(new URL(`../dist${href}index.html`, import.meta.url)));

const caseDir = new URL('../src/content/caseStudies/', import.meta.url);
const featured = readdirSync(caseDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const front = readFileSync(new URL(f, caseDir), 'utf8').split(/^---\s*$/m)[1] ?? '';
    return { id: f.slice(0, -3), front, featured: Number(front.match(/^featured:\s*(\d+)/m)?.[1] ?? NaN) };
  })
  .filter((c) => !Number.isNaN(c.featured) && !/^draft:\s*true\s*$/m.test(c.front))
  .sort((a, b) => a.featured - b.featured);
const homeFaq: { question: string; answer: string }[] = JSON.parse(readFileSync(new URL('../src/content/faqs/home.json', import.meta.url), 'utf8'));

test('home: every section in the fixed order, ending with the FAQ and the closing CTA', skip, () => {
  const order = [...main.matchAll(/<section\b[^>]*>/g)].map((m) => m[0].match(/data-section="([^"]+)"/)?.[1] ?? (/data-faq/.test(m[0]) ? 'faq' : /data-closing-cta/.test(m[0]) ? 'closing' : 'hero'));
  assert.deepEqual(order, ['hero', 'stats', 'problem', 'services', 'helps', 'stack', 'featured', 'process', 'teaser', 'tech', 'explore', 'faq', 'closing']);
  // Backgrounds alternate: surface on stats, services, stack, process, tech and the FAQ.
  const surface = [...main.matchAll(/<section\b[^>]*>/g)].map((m) => /\bsection-surface\b/.test(m[0]));
  assert.deepEqual(surface.slice(1, 12), [true, false, true, false, true, false, true, false, true, false, true]);
});

test('home featured cases: 3-4 in featured order, platform case first, an AI-outcome case, see-all link', skip, () => {
  const s = sectionOf('featured');
  assert.equal(h2(s), 'Case studies');
  const cards = [...s.matchAll(/<article\b[\s\S]*?<\/article>/g)].map((m) => m[0]);
  assert.ok(cards.length >= 3 && cards.length <= 4, `featured count ${cards.length}`);
  assert.deepEqual(cards.map((c) => hrefs(c)[0]), featured.map((c) => `/case-studies/${c.id}/`));
  assert.match(featured[0].front, /^service:\s*data-platforms\s*$/m, 'a platform case comes first');
  assert.ok(featured.some((c) => /seasonal-surge-forecasting|claims/.test(c.id)), 'an AI-outcome case is featured');
  const all = s.match(/<a\b[^>]*>See all case studies<\/a>/)?.[0] ?? '';
  assert.match(all, /href="\/case-studies\/"/);
});

test('home How We Work: 01-04 with approved text, step 01 links to the Readiness Review', skip, () => {
  const s = sectionOf('process');
  assert.equal(h2(s), 'How do we work?');
  const steps = [...s.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => m[0]);
  assert.deepEqual(steps.map((li) => text(li.match(/<h3\b[\s\S]*?<\/h3>/)?.[0] ?? '')), ['Review', 'Design', 'Build', 'Run']);
  assert.deepEqual(steps.map((li) => text(li.match(/<p class="steps-num"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '')), ['01', '02', '03', '04']);
  assert.deepEqual(hrefs(steps[0]), ['/readiness-review/']);
  for (const li of steps.slice(1)) assert.deepEqual(hrefs(li), []);
  assert.ok(text(steps[2]).includes('testing every change before it reaches production'));
});

test('home teaser, technologies and Still exploring?: approved headings, links that exist', skip, () => {
  const teaser = sectionOf('teaser');
  assert.equal(h2(teaser), 'Where does your week go?');
  assert.deepEqual(hrefs(teaser), ['/self-assessment/']);
  assert.doesNotMatch(teaser, /btn-primary/, 'one primary per view: the closing band has it');

  const tech = sectionOf('tech');
  assert.equal(h2(tech), 'Technologies we work with');
  assert.deepEqual([...tech.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1])), ['Microsoft Fabric', 'Databricks', 'Azure', 'dbt', 'Power BI', 'Delta Lake']);
  assert.doesNotMatch(tech, /<img\b/);

  const explore = sectionOf('explore');
  assert.equal(h2(explore), 'Still exploring?');
  const links = hrefs(explore);
  assert.deepEqual(links, ['/standard/', '/case-studies/', '/self-assessment/']);
  for (const href of links) assert.ok(built(href), `${href} not built`);
});

test('home FAQ: every question and answer in the HTML, exactly one FAQPage matching home.json', skip, () => {
  const faq = main.match(/<section\b[^>]*data-faq[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.equal(h2(faq), 'Questions about DataKeel AI');
  const details = [...faq.matchAll(/<details\b[\s\S]*?<\/details>/g)].map((m) => m[0]);
  assert.equal(details.length, homeFaq.length);
  details.forEach((d, i) => assert.equal(text(d.match(/<summary\b[\s\S]*?<\/summary>/)?.[0] ?? ''), homeFaq[i].question));
  assert.match(faq, /<a href="\/readiness-review\/">Data &amp; AI Readiness Review<\/a>/);

  const graph = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1])['@graph'] ?? []);
  const pages = graph.filter((n: { '@type': string }) => n['@type'] === 'FAQPage');
  assert.equal(pages.length, 1);
  assert.deepEqual(pages[0].mainEntity.map((q: { name: string }) => q.name), homeFaq.map((q) => q.question));
  assert.doesNotMatch(JSON.stringify(pages[0]), /\]\(/, 'answers are plain text in JSON-LD');
});

test('home reveal: Epic 5 sections carry data-reveal, the hero and closing band do not, nothing hidden in the HTML', skip, () => {
  for (const key of ['stats', 'problem', 'services', 'helps', 'stack', 'featured', 'process', 'teaser', 'tech', 'explore'])
    assert.match(sectionOf(key).match(/<section\b[^>]*>/)![0], /data-reveal/, key);
  assert.match(main.match(/<section\b[^>]*data-faq[^>]*>/)?.[0] ?? '', /data-reveal/);
  assert.doesNotMatch(main.match(/<section\b[^>]*class="hero[^>]*>/)?.[0] ?? '', /data-reveal/);
  assert.doesNotMatch(main, /reveal-pending/, 'only the island hides sections');
});
