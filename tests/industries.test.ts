import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as u from '../src/lib/urls.ts';
import { caseStudyIds, industries } from './content-data.ts';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const skip = { skip: existsSync(dist) ? false : 'dist/ not found; run npm run build first' };
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const caseIndustry = (id: string) =>
  readFileSync(fileURLToPath(new URL(`../src/content/caseStudies/${id}.md`, import.meta.url)), 'utf8').match(/^industry: ["']?([^"'\s]+)/m)![1];

test('industry copy: every entry has problems, is marked for founder review, and fits SEO limits', () => {
  assert.equal(industries.length, 4);
  for (const i of industries) {
    assert.ok(i.problems.length > 0, `${i.id}: problems`);
    assert.equal(typeof i.reviewed, 'boolean', `${i.id}: reviewed`);
    assert.ok(i.description.length <= 155, `${i.id}: description length`);
    assert.ok(`${i.title} | DataKeel AI`.length <= 60, `${i.id}: title length`);
  }
});

test('every industry page: one h1, problems, its own case cards only, breadcrumb, closing CTA', skip, () => {
  for (const i of industries) {
    const r = u.industryUrl(i.id);
    const html = readFileSync(join(dist, r, 'index.html'), 'utf8');
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${r}: h1 count`);
    assert.equal(decode(main.match(/<h1[^>]*>([^<]*)<\/h1>/)![1]), i.h1, `${r}: h1`);
    assert.equal(decode(main.match(/<p[^>]*class="[^"]*\bintro\b[^"]*"[^>]*>([^<]*)<\/p>/)?.[1] ?? ''), i.intro, `${r}: answer-first intro`);

    const list = main.match(/<ul[^>]*data-industry-problems[^>]*>([\s\S]*?)<\/ul>/)?.[1];
    assert.ok(list, `${r}: no problems list`);
    assert.deepEqual([...list.matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map((m) => decode(m[1])), i.problems, `${r}: problems`);

    const cards = main.match(/<article\b[^>]*data-case-card[\s\S]*?<\/article>/g) ?? [];
    const linked = cards.map((card) => card.match(/href="\/case-studies\/([^/"]+)\/"/)![1]).sort();
    const expected = caseStudyIds.filter((id) => caseIndustry(id) === i.id).sort();
    assert.deepEqual(linked, expected, `${r}: case cards`);
    if (expected.length === 0) assert.match(main, /No case studies here yet\./, `${r}: empty state`);

    const nav = html.match(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav, `${r}: no visible breadcrumb`);
    assert.deepEqual([...nav.matchAll(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]]), [[u.homeUrl(), 'Home']], `${r}: crumb links`);
    assert.equal(decode(nav.match(/aria-current="page"[^>]*>([^<]*)</)?.[1] ?? ''), i.name, `${r}: current crumb`);

    assert.ok(html.includes('data-closing-cta="default"'), `${r}: closing CTA`);
  }
});

test('every built page links all four industry pages from the header and the mobile menu', skip, () => {
  const pages = (readdirSync(dist, { recursive: true }) as string[]).filter((f) => f.endsWith('.html'));
  for (const f of pages) {
    const html = readFileSync(join(dist, f), 'utf8');
    const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
    const menu = html.match(/<dialog[^>]*data-mobile-menu[\s\S]*?<\/dialog>/)?.[0] ?? '';
    for (const i of industries) {
      assert.ok(header.includes(`href="${u.industryUrl(i.id)}"`), `${f}: header link to ${i.id}`);
      assert.ok(menu.includes(`href="${u.industryUrl(i.id)}"`), `${f}: menu link to ${i.id}`);
    }
  }
});
