// Story 6.2: /how-we-work/ from pages.json (how-we-work) and faqs/how-we-work.json; steps shared with the homepage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readinessReviewUrl } from '../src/lib/urls.ts';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const file = fileURLToPath(new URL('../dist/how-we-work/index.html', import.meta.url));
const home = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const skip = { skip: existsSync(file) ? false : 'dist/ not found; run npm run build first' };
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const text = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const sectionOf = (h: string, key: string) => h.match(new RegExp(`<section\\b[^>]*data-section="${key}"[\\s\\S]*?</section>`))?.[0] ?? '';
const steps = (s: string) => [...s.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => m[0]);

const page = JSON.parse(read('../src/content/pages.json')).find((p: { id: string }) => p.id === 'how-we-work');
const section = (id: string) => page.sections.find((s: { id: string }) => s.id === id);
const faqs: { question: string }[] = JSON.parse(read('../src/content/faqs/how-we-work.json'));

test('order: hero, steps, ownership, engagement, FAQ, closing; one h1; one FAQPage', skip, () => {
  const h = readFileSync(file, 'utf8');
  assert.equal((h.match(/<h1[\s>]/g) ?? []).length, 1);
  const order = ['data-section="hero"', 'data-section="process"', 'data-section="ownership"', 'data-section="engagement"', 'data-faq', 'data-closing-cta'].map((m) => h.indexOf(m));
  assert.ok(order.every((i) => i >= 0), String(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  const summaries = [...h.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)].map((m) => text(m[1]));
  assert.deepEqual(summaries, faqs.map((f) => f.question));
  assert.equal((h.match(/"@type":"FAQPage"/g) ?? []).length, 1);
});

test('Review → Design → Build → Run with a "What you get" line each; same step lines as the homepage', skip, () => {
  const s = sectionOf(readFileSync(file, 'utf8'), 'process');
  assert.equal(text(s.match(/<h2\b[\s\S]*?<\/h2>/)![0]), section('steps').heading);
  const lis = steps(s);
  assert.deepEqual(lis.map((li) => text(li.match(/<h3\b[\s\S]*?<\/h3>/)![0])), ['Review', 'Design', 'Build', 'Run']);
  lis.forEach((li, i) => assert.ok(text(li).includes(section('steps').items[i].detail), `step ${i + 1} detail`));
  assert.ok(lis[0].includes(`href="${readinessReviewUrl()}"`));
  const homeLines = steps(sectionOf(readFileSync(home, 'utf8'), 'process')).map((li) => text(li.match(/<p class="muted"[^>]*>([\s\S]*?)<\/p>/)![1]));
  assert.deepEqual(lis.map((li) => text(li.match(/<p class="muted"[^>]*>([\s\S]*?)<\/p>/)![1])), homeLines);
  assert.ok(!sectionOf(readFileSync(home, 'utf8'), 'process').includes('steps-detail'), 'homepage shows no detail lines');
});

test('ownership states client owns code and documentation and handover; two engagement options', skip, () => {
  const h = readFileSync(file, 'utf8');
  const own = text(sectionOf(h, 'ownership'));
  assert.match(own, /own all the code and documentation/);
  assert.match(own, /hand the platform over/);
  const eng = steps(sectionOf(h, 'engagement')).map((li) => text(li.match(/<h3\b[\s\S]*?<\/h3>/)![0]));
  assert.deepEqual(eng, ['A project', 'Ongoing Run support']);
});
