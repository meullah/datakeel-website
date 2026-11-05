// Story 8.2: robots.txt, llms.txt and the sitemap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { companyName, positioningLine } from '../src/lib/config.ts';
import { absoluteUrl, isNoindexPath } from '../src/lib/urls.ts';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const skip = { skip: existsSync(join(dist, 'llms.txt')) ? false : 'dist/ not found; run npm run build first' };
const read = (f: string) => readFileSync(join(dist, f), 'utf8');

/** Every built HTML page as a path ("/", "/guides/x/"). */
const builtPages = (dir = dist, base = '/'): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name.startsWith('_') || e.name.startsWith('.') ? [] : builtPages(join(dir, e.name), `${base}${e.name}/`)) : e.name === 'index.html' ? [base] : [],
  );
const indexable = () => builtPages().filter((p) => !isNoindexPath(p) && !/<meta name="robots" content="noindex/.test(read(join(p, 'index.html'))));

test('robots.txt allows every named crawler and links the sitemap', skip, () => {
  const txt = read('robots.txt');
  for (const bot of ['Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'])
    assert.match(txt, new RegExp(`User-agent: ${bot}\nAllow: /\n`), bot);
  assert.doesNotMatch(txt, /Disallow: \/\s*$/m);
  assert.ok(txt.includes(`Sitemap: ${absoluteUrl('/sitemap-index.xml')}`));
});

test('sitemap: every indexable page, no noindex page', skip, () => {
  const xml = readdirSync(dist).filter((f) => /^sitemap-\d+\.xml$/.test(f)).map(read).join('');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname).sort();
  assert.deepEqual(urls, indexable().sort());
  for (const p of urls) assert.ok(!isNoindexPath(p), p);
});

test('llms.txt: name, positioning line, and a summary line for every indexable page', skip, () => {
  const txt = read('llms.txt');
  assert.ok(txt.startsWith(`# ${companyName}\n\n> ${positioningLine}\n`));
  const listed = new Set([...txt.matchAll(/^- \[[^\]]+\]\(([^)#]+)[^)]*\): \S/gm)].map((m) => new URL(m[1]).pathname));
  const missing = indexable().filter((p) => !listed.has(p));
  assert.deepEqual(missing, [], 'pages without an llms.txt line');
  assert.doesNotMatch(txt, /undefined|\[object/);
  const links = [...txt.matchAll(/^- \[[^\]]+\]\(([^)]+)\)/gm)].map((m) => m[1]);
  assert.equal(new Set(links).size, links.length, 'each link listed once');
  assert.match(txt, /\(Proof of concept\)\]/, 'framing labels kept');
});
