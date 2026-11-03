import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const skip = { skip: existsSync(file) ? false : 'dist/index.html not found; run npm run build first' };
const html = existsSync(file) ? readFileSync(file, 'utf8') : '';
const text = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

test('home hero: exact copy, one h1, gradient on "backbone" only', skip, () => {
  const h1s = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/g) ?? [];
  assert.equal(h1s.length, 1);
  assert.equal(text(h1s[0]), 'The data backbone your AI runs on.');
  const grads = [...h1s[0].matchAll(/<span\b[^>]*class="[^"]*\bgradient-text\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => text(m[1]));
  assert.deepEqual(grads, ['backbone']);

  const eyebrow = html.match(/<p\b[^>]*class="[^"]*\beyebrow\b[^"]*"[^>]*>([\s\S]*?)<\/p>/);
  assert.equal(text(eyebrow?.[1] ?? ''), 'Data engineering for AI');
  assert.match(html, /We design, build and run modern data platforms: pipelines, lakehouses and governance, so your reports agree and your AI works on data you can trust\./);
  assert.doesNotMatch(text(html), /\bBook\b/);
});

test('home hero: CTAs and empty, hidden visual area', skip, () => {
  const hero = html.match(/<section\b[^>]*class="[^"]*\bhero\b[\s\S]*?<\/section>/)?.[0] ?? '';
  const link = (cls: string) => hero.match(new RegExp(`<a\\b[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</a>`));
  const primary = link('btn-primary');
  const ghost = link('btn-ghost');
  assert.match(primary?.[0] ?? '', /href="\/readiness-review\/"/);
  assert.equal(text(primary?.[1] ?? ''), 'Request a Data & AI Readiness Review');
  assert.match(ghost?.[0] ?? '', /href="\/contact\/"/);
  assert.equal(text(ghost?.[1] ?? ''), 'Talk to us');
  const visual = hero.match(/<div\b[^>]*data-hero-visual[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(visual, 'visual area present');
  assert.match(visual[0], /aria-hidden="true"/);
  assert.equal(visual[1].trim(), '', 'no text in the visual area');
});
