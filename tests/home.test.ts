import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

test('home hero: CTAs, text-free hidden visual area, pause button outside it', skip, () => {
  const hero = html.match(/<section\b[^>]*class="[^"]*\bhero\b[\s\S]*?<\/section>/)?.[0] ?? '';
  const link = (cls: string) => hero.match(new RegExp(`<a\\b[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</a>`));
  const primary = link('btn-primary');
  const ghost = link('btn-ghost');
  assert.match(primary?.[0] ?? '', /href="\/readiness-review\/"/);
  assert.equal(text(primary?.[1] ?? ''), 'Request a Data & AI Readiness Review');
  assert.match(ghost?.[0] ?? '', /href="\/contact\/"/);
  assert.equal(text(ghost?.[1] ?? ''), 'Talk to us');
  const visual = hero.match(/<div\b[^>]*data-hero-visual[^>]*>([\s\S]*?)<\/div>/);
  // The visual area holds no <div>, so the lazy match ends at its own closing tag.
  assert.ok(visual, 'visual area present');
  assert.match(visual[0], /aria-hidden="true"/);
  assert.match(visual[1], /<canvas\b/);
  assert.equal(text(visual[1]), '', 'no text in the visual area');
  assert.doesNotMatch(visual[1], /<(button|a)\b/, 'nothing focusable under aria-hidden');
  const pause = hero.match(/<button\b[^>]*data-hero-story-pause[^>]*>/)?.[0] ?? '';
  assert.doesNotMatch(pause, /aria-pressed/, "label alone carries the state");
  assert.match(pause, /aria-label="Pause background animation"/);
  assert.match(pause, /\shidden\b/, 'pause stays hidden until the island runs');
});

// Homepage stats straight from the case files (frontmatter stats lines with homepage: true), in getPublished order.
import { compareEntries } from '../src/lib/pure/content-rules.ts';
import { formatStat } from '../src/lib/pure/stat-counter.ts';
const caseDir = new URL('../src/content/caseStudies/', import.meta.url);
const caseFiles = readdirSync(caseDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const front = readFileSync(new URL(f, caseDir), 'utf8').split(/^---\s*$/m)[1] ?? '';
    const featured = front.match(/^featured:\s*(\d+)/m)?.[1];
    const published = front.match(/^published:\s*(\S+)/m)?.[1];
    return { id: f.slice(0, -3), front, data: { featured: featured ? Number(featured) : undefined, published: published ? new Date(published) : undefined } };
  })
  .filter((c) => !/^draft:\s*true\s*$/m.test(c.front))
  .sort(compareEntries);
// Each stat line is a YAML flow map with plain keys, so quoting the keys makes it JSON.
type Stat = { value: number | null; prefix?: string; suffix?: string; display: string; label: string; homepage?: boolean };
const homepageStats: Stat[] = caseFiles
  .flatMap((c) => [...c.front.matchAll(/^\s*- (\{.*\})\s*$/gm)].map((m) => JSON.parse(m[1].replace(/(\w+):/g, '"$1":')) as Stat))
  .filter((st) => st.homepage);

test('homepage stats: every countable value formats to exactly its display (the count ends where the HTML is)', () => {
  assert.ok(homepageStats.length >= 3);
  for (const st of homepageStats) if (st.value !== null) assert.equal(formatStat(st.value, st.prefix, st.suffix), st.display, st.label);
});

test('home stats strip: right after the hero, heading, answer line, every homepage stat with its final value', skip, () => {
  const main = html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';
  const sections = [...main.matchAll(/<section\b[^>]*>/g)].map((m) => m[0]);
  assert.match(sections[0], /\bhero\b/);
  assert.match(sections[1], /data-section="stats"/);
  const strip = main.match(/<section\b[^>]*data-section="stats"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.equal(text(strip.match(/<h2\b[\s\S]*?<\/h2>/)?.[0] ?? ''), 'Real platforms, running every day');
  assert.match(text(strip), /Every number here comes from a platform we built that runs in production today\./);
  const items = [...strip.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => m[0]);
  assert.ok(items.length >= 3 && items.length <= 4, `stat count ${items.length}`);
  const shown = items.map((li) => ({
    display: text(li.match(/<span data-stat-final[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '').replace(/&gt;/g, '>'),
    label: text(li.match(/<p class="small muted"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''),
  }));
  const key = (s: { display: string; label: string }) => `${s.display} | ${s.label}`;
  assert.deepEqual(shown.map(key), homepageStats.map(key));
  for (const li of items) assert.match(li, /class="stat\b/);
});

const sectionOf = (key: string) => [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)].map((m) => m[0]).find((sec) => sec.includes(`data-section="${key}"`)) ?? '';
const services: { id: string; order: number; name: string; summary: string }[] = JSON.parse(readFileSync(new URL('../src/content/services.json', import.meta.url), 'utf8'));

test('home: sections in the fixed order so far, and headings go h1 → h2 → h3', skip, () => {
  const main = html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';
  const order = [...main.matchAll(/data-section="([^"]+)"/g)].map((m) => m[1]).filter((k) => k !== 'hero');
  assert.deepEqual(order.slice(0, 3), ['stats', 'problem', 'services']);
  const levels = [...main.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  assert.equal(levels[0], 1);
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i] <= levels[i - 1] + 1, `heading jumps to h${levels[i]}`);
});

test('home problem section: approved h2, answer line, four pain cards with the accent bar', skip, () => {
  const s = sectionOf('problem');
  assert.ok(s, 'problem section missing');
  assert.equal(text(s.match(/<h2\b[\s\S]*?<\/h2>/)?.[0] ?? ''), 'You can’t sail on chaotic data. Let’s build your keel.');
  assert.match(text(s), /Most companies don’t have an AI problem\. They have a data problem that shows up as one\./);
  const cards = [...s.matchAll(/<li\b[^>]*class="[^"]*\bpain-card\b[\s\S]*?<\/li>/g)].map((m) => m[0]);
  assert.deepEqual(cards.map((c) => text(c.match(/<h3\b[\s\S]*?<\/h3>/)?.[0] ?? '')), [
    'Spreadsheets everywhere',
    'Reports that disagree',
    'AI pilots that give wrong answers',
    'Slow, manual reporting',
  ]);
  for (const c of cards) assert.doesNotMatch(c, /<a\b/, 'pain cards are not links');
});

test('home services: one card per services.json entry, name + summary, one link to /what-we-do/', skip, () => {
  const s = sectionOf('services');
  assert.ok(s, 'services section missing');
  assert.equal(text(s.match(/<h2\b[\s\S]*?<\/h2>/)?.[0] ?? ''), 'What we do');
  const cards = [...s.matchAll(/<li\b[^>]*class="[^"]*\bservice-card\b[\s\S]*?<\/li>/g)].map((m) => m[0]);
  assert.ok(cards.length > 0, 'no service cards');
  assert.equal(cards.length, services.length);
  const sorted = [...services].sort((a, b) => a.order - b.order);
  cards.forEach((c, i) => {
    const links = [...c.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(links, ['/what-we-do/']);
    assert.equal(text(c.match(/<h3\b[\s\S]*?<\/h3>/)?.[0] ?? ''), sorted[i].name);
    assert.ok(text(c).includes(sorted[i].summary), sorted[i].id);
  });
});
