// Story 8.3: discoverability rules over every built, indexable page. `npm run audit` runs `npm test`, so these gate
// the audit too. Structural JSON-LD checks stand in for the Rich Results Test, which needs the live site (Epic 9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { companyName, positioningLine } from '../src/lib/config.ts';
import { isNoindexPath } from '../src/lib/urls.ts';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const skip = { skip: existsSync(join(dist, 'index.html')) ? false : 'dist/ not found; run npm run build first' };
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const text = (s: string) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const builtPages = (dir = dist, base = '/'): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (/^[._]/.test(e.name) ? [] : builtPages(join(dir, e.name), `${base}${e.name}/`)) : e.name === 'index.html' ? [base] : [],
  );
const html = (p: string) => readFileSync(join(dist, p, 'index.html'), 'utf8');
const pages = () => builtPages().filter((p) => !isNoindexPath(p) && !/<meta name="robots" content="noindex/.test(html(p)));
const mainOf = (h: string) => h.slice(h.indexOf('<main'), h.indexOf('</main>'));
/** Pages that must carry a 4-8 question FAQ and answer-first h2 sections. */
const faqPages = () => ['/', '/what-we-do/', '/how-we-work/', '/readiness-review/', ...pages().filter((p) => p.startsWith('/industries/'))];

type Node = Record<string, any>;
const REQUIRED: Record<string, string[]> = {
  Organization: ['name', 'url', 'logo'],
  WebSite: ['name', 'url', 'publisher'],
  WebPage: ['name', 'url', 'isPartOf'],
  BreadcrumbList: ['itemListElement'],
  FAQPage: ['mainEntity'],
  Article: ['headline', 'datePublished', 'dateModified', 'author', 'publisher'],
  Service: ['name', 'provider'],
  Person: ['name'],
};
/** Every { "@id": x } reference anywhere inside a node. */
const refs = (v: unknown): string[] =>
  Array.isArray(v) ? v.flatMap(refs)
  : v && typeof v === 'object' ? (Object.keys(v).length === 1 && '@id' in v ? [(v as Node)['@id']] : Object.values(v).flatMap(refs))
  : [];

test('JSON-LD: one graph per page, unique @ids, one Organization, required fields, every reference resolves', skip, () => {
  for (const p of pages()) {
    const scripts = [...html(p).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1, `${p}: one JSON-LD script`);
    const graph: Node[] = JSON.parse(scripts[0][1])['@graph'];
    const ids = graph.map((n) => n['@id']);
    assert.equal(new Set(ids).size, ids.length, `${p}: duplicate @id`);
    const orgs = graph.filter((n) => n['@type'] === 'Organization');
    assert.equal(orgs.length, 1, `${p}: Organization nodes`);
    assert.equal(orgs[0].name, companyName, p);
    assert.equal(orgs[0].description, positioningLine, p);
    assert.ok(graph.filter((n) => n['@type'] === 'FAQPage').length <= 1, `${p}: FAQPage nodes`);
    for (const n of graph) {
      for (const f of REQUIRED[n['@type']] ?? []) assert.ok(n[f] !== undefined && n[f] !== '', `${p}: ${n['@type']} needs ${f}`);
      if (n['@type'] === 'FAQPage')
        for (const q of n.mainEntity) assert.ok(q.name && q.acceptedAnswer?.text, `${p}: FAQ question needs name and answer`);
      for (const r of refs(Object.fromEntries(Object.entries(n).filter(([k]) => k !== '@id'))))
        assert.ok(ids.includes(r), `${p}: ${n['@type']} references missing ${r}`);
    }
  }
});

test('headings: one h1 per page, and heading levels never skip inside main', skip, () => {
  for (const p of pages()) {
    const h = html(p);
    assert.equal((h.match(/<h1[\s>]/g) ?? []).length, 1, `${p}: h1 count`);
    const levels = [...mainOf(h).matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    levels.reduce((prev, lvl) => {
      assert.ok(lvl <= prev + 1, `${p}: h${prev} → h${lvl}`);
      return lvl;
    }, 1);
  }
});

test('FAQ pages: 4-8 questions in the block and the same questions in one FAQPage', skip, () => {
  for (const p of faqPages()) {
    const h = html(p);
    const block = h.match(/<section\b[^>]*data-faq[\s\S]*?<\/section>/)?.[0];
    assert.ok(block, `${p}: FAQ block`);
    const qs = [...block.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)].map((m) => text(m[1]));
    assert.ok(qs.length >= 4 && qs.length <= 8, `${p}: ${qs.length} questions`);
    const faq = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])['@graph'].find((n: Node) => n['@type'] === 'FAQPage');
    assert.deepEqual(faq?.mainEntity.map((q: Node) => q.name), qs, `${p}: FAQPage matches`);
  }
});

test('answer-first: on FAQ pages every h2 is followed by a short direct answer paragraph', skip, () => {
  const errors: string[] = [];
  for (const p of faqPages()) {
    // The closing band is a call to action, not an answer section.
    const main = mainOf(html(p)).replace(/<section\b[^>]*data-closing-cta[\s\S]*?<\/section>/, '');
    for (const m of main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>\s*(<(\w+)[^>]*>([\s\S]*?)<\/\3>)?/g)) {
      const [, heading, , tag, body = ''] = m;
      if (tag !== 'p') { errors.push(`${p}: "${text(heading)}" is not followed by a paragraph`); continue; }
      const answer = text(body);
      const sentences = answer.split(/(?<=[.!?])\s+/).filter(Boolean).length;
      const words = answer.split(' ').length;
      if (sentences > 3 || words > 70) errors.push(`${p}: "${text(heading)}" answer is ${sentences} sentences / ${words} words`);
    }
  }
  assert.deepEqual(errors, []);
});

test('links: every page links to 3+ other pages from main, and every page is linked from another page', skip, () => {
  const all = pages();
  const inbound = new Map(all.map((p) => [p, 0]));
  const errors: string[] = [];
  for (const p of all) {
    const h = html(p);
    const out = (s: string) => new Set([...s.matchAll(/<a\b[^>]*href="(\/[^"#?]*)/g)].map((m) => m[1]).filter((u) => u !== p));
    if (out(mainOf(h)).size < 3) errors.push(`${p}: ${out(mainOf(h)).size} related links in main`);
    for (const u of out(h)) if (inbound.has(u)) inbound.set(u, inbound.get(u)! + 1);
  }
  for (const [p, n] of inbound) if (p !== '/' && n === 0) errors.push(`${p}: orphan (no page links to it)`);
  assert.deepEqual(errors, []);
});

test('company name and positioning line: same in every footer', skip, () => {
  for (const p of pages()) {
    const footer = html(p).match(/<footer\b[\s\S]*?<\/footer>/)?.[0] ?? '';
    assert.ok(decode(footer).includes(positioningLine), `${p}: footer positioning line`);
    assert.ok(decode(footer).includes(companyName), `${p}: footer company name`);
  }
});
