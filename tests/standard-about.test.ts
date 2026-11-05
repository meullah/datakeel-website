// Stories 6.3 and 6.4: /standard/ and /about/ from pages.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { caseStudiesUrl, caseStudyUrl, howWeWorkUrl, standardUrl } from '../src/lib/urls.ts';

const dist = (p: string) => fileURLToPath(new URL(`../dist/${p}/index.html`, import.meta.url));
const skip = { skip: existsSync(dist('standard')) ? false : 'dist/ not found; run npm run build first' };
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const text = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const mainOf = (p: string) => { const h = readFileSync(dist(p), 'utf8'); return h.slice(h.indexOf('<main'), h.indexOf('</main>')); };
const sectionOf = (h: string, key: string) => h.match(new RegExp(`<section\\b[^>]*data-section="${key}"[\\s\\S]*?</section>`))?.[0] ?? '';
const items = (s: string) => [...s.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => text(m[0]));
/** Background of each section in main, in order (the last is the closing band): true = surface. */
const surfaces = (main: string) => [...main.matchAll(/<section\b[^>]*>/g)].map((m) => /\bsection-surface\b/.test(m[0]));
const CERT = /\b(certified|certification|ISO ?27001|SOC ?2|HIPAA[- ]compliant|GDPR[- ]certified)\b/i;
const TEAM = /\b(small team|team of \d+|\d+\s+(people|engineers|employees|experts)|headcount|our founder)\b/i;

test('standard: five checklist items, each with a "why it matters to you" line', skip, () => {
  const list = items(sectionOf(mainOf('standard'), 'checklist'));
  assert.equal(list.length, 5);
  for (const li of list) assert.match(li, /Why it matters to you: \S/);
  for (const k of ['tested and monitored', 'documented', 'quality checks before data reaches AI', 'automated pipelines across separate environments', 'own all the code and documentation'])
    assert.ok(list.some((li) => li.includes(k)), k);
});

test('standard: data location, trust & security, case evidence, no certification claims', skip, () => {
  const main = mainOf('standard');
  const loc = text(sectionOf(main, 'location'));
  assert.match(loc, /Your data stays where you want it/);
  assert.match(loc, /Cloudera/);
  const sec = items(sectionOf(main, 'security'));
  assert.equal(sec.length, 4);
  assert.match(sec.join(' '), /Azure Key Vault/);
  const ev = sectionOf(main, 'evidence');
  for (const id of ['labor-cost-finance-microsoft-fabric', 'hospital-network-governed-lakehouse'])
    assert.ok(ev.includes(`href="${caseStudyUrl(id)}"`), `${id} linked as evidence`);
  assert.doesNotMatch(text(main), CERT);
  assert.deepEqual(surfaces(main), [false, true, false, true, false, false]);
});

test('about: mission, three values, approach, related links; no team size or photos', skip, () => {
  const main = mainOf('about');
  assert.equal((main.match(/<h1[\s>]/g) ?? []).length, 1);
  assert.match(text(sectionOf(main, 'mission')), /backbone/);
  assert.deepEqual([...sectionOf(main, 'values').matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => text(m[1])), ['Quality', 'Clarity', 'Ownership']);
  assert.ok(sectionOf(main, 'approach'));
  const links = new Set([...main.matchAll(/<a\b[^>]*href="(\/[^"#]*)"/g)].map((m) => m[1]));
  assert.ok(links.size >= 3, `related links: ${[...links]}`);
  assert.doesNotMatch(text(main), TEAM);
  assert.doesNotMatch(main, /<img\b/);
  assert.deepEqual(surfaces(main), [false, true, false, true, false, false]);
});

test('how we work: backgrounds alternate', skip, () => {
  assert.deepEqual(surfaces(mainOf('how-we-work')), [false, true, false, true, false, false]);
});
