// Story 6.1: /what-we-do/ built from pages.json, services.json and faqs/what-we-do.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { plainMd } from '../src/lib/pure/inline-md.ts';
import { caseStudyUrl } from '../src/lib/urls.ts';
import { caseStudyIds } from './content-data.ts';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const file = fileURLToPath(new URL('../dist/what-we-do/index.html', import.meta.url));
const skip = { skip: existsSync(file) ? false : 'dist/ not found; run npm run build first' };
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const text = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const graph = (h: string) => JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])['@graph'] as Record<string, any>[];

type Service = { id: string; order: number; name: string; description: string; problems: string[]; technologies: string[]; caseStudy: string };
const services: Service[] = JSON.parse(read('../src/content/services.json')).sort((a: Service, b: Service) => a.order - b.order);
const page = JSON.parse(read('../src/content/pages.json')).find((p: { id: string }) => p.id === 'what-we-do');
const faqs: { question: string; answer: string }[] = JSON.parse(read('../src/content/faqs/what-we-do.json'));

test('content: every service links a published case study; page has a summary', () => {
  for (const s of services) assert.ok(caseStudyIds.includes(s.caseStudy), `${s.id} → ${s.caseStudy}`);
  assert.ok(page?.summary?.length > 0);
});

test('one h1 and title/description from pages.json', skip, () => {
  const h = readFileSync(file, 'utf8');
  assert.equal((h.match(/<h1[\s>]/g) ?? []).length, 1);
  assert.equal(text(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)![1]), page.h1);
  assert.ok(decode(h.match(/<title>([^<]*)<\/title>/)![1]).startsWith(page.title));
  assert.equal(decode(h.match(/<meta name="description" content="([^"]*)"/)![1]), page.description);
});

test('one section per service, in order, answer-first, with problems, technologies and its case link', skip, () => {
  const h = readFileSync(file, 'utf8');
  const sections = [...h.matchAll(/<section\b[^>]*data-section="service"[^>]*>[\s\S]*?<\/section>/g)].map((m) => m[0]);
  assert.equal(sections.length, services.length);
  sections.forEach((sec, i) => {
    const s = services[i];
    assert.match(sec, new RegExp(`id="${s.id}"`));
    assert.equal(text(sec.match(/<h2\b[\s\S]*?<\/h2>/)![0]), s.name);
    const afterH2 = sec.slice(sec.indexOf('</h2>'));
    assert.equal(text(afterH2.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)![1]), s.description, `${s.id}: answer right after h2`);
    for (const p of s.problems) assert.ok(text(sec).includes(p), `${s.id} problem`);
    const tech = [...sec.match(/data-technologies[\s\S]*?<\/ul>/)![0].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
    assert.deepEqual(tech, s.technologies);
    assert.ok(sec.includes(`href="${caseStudyUrl(s.caseStudy)}"`), `${s.id} case link`);
  });
});

test('stack diagram, FAQ matches JSON, one FAQPage and one Service node per service', skip, () => {
  const h = readFileSync(file, 'utf8');
  assert.match(h, /data-section="stack"[\s\S]*?class="stack"/);
  const summaries = [...h.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)].map((m) => text(m[1]));
  assert.deepEqual(summaries, faqs.map((f) => f.question));
  const g = graph(h);
  const faqNodes = g.filter((n) => n['@type'] === 'FAQPage');
  assert.equal(faqNodes.length, 1);
  assert.deepEqual(faqNodes[0].mainEntity.map((q: any) => q.acceptedAnswer.text), faqs.map((f) => plainMd(f.answer)));
  const svc = g.filter((n) => n['@type'] === 'Service');
  assert.deepEqual(svc.map((n) => n.name), services.map((s) => s.name));
  assert.equal(new Set(svc.map((n) => n['@id'])).size, services.length, 'unique @ids');
});
