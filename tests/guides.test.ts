// Story 8.1: /guides/ and /guides/{id}/ from the guides and authors collections.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ORGANIZATION_ID } from '../src/lib/seo.ts';
import { guideUrl } from '../src/lib/urls.ts';

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const skip = { skip: existsSync(root('dist/guides/index.html')) ? false : 'dist/ not found; run npm run build first' };
const decode = (s: string) => s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const text = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const graph = (h: string) => JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])['@graph'] as Record<string, any>[];
const published = readdirSync(root('src/content/guides'))
  .filter((f) => f.endsWith('.md') && /^draft:\s*false\s*$/m.test(readFileSync(root(`src/content/guides/${f}`), 'utf8')))
  .map((f) => f.slice(0, -3));

test('at least 3 published guides, each with an author and 3+ related links', () => {
  assert.ok(published.length >= 3, String(published));
  for (const id of published) {
    const src = readFileSync(root(`src/content/guides/${id}.md`), 'utf8');
    assert.match(src, /^author: \S+/m, id);
    assert.ok((src.match(/^\s+- \{ label: /gm) ?? []).length >= 3, `${id} related`);
  }
});

test('index lists every published guide with its link', skip, () => {
  const h = readFileSync(root('dist/guides/index.html'), 'utf8');
  const links = [...h.matchAll(/data-guide-card[\s\S]*?href="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(links, published.map(guideUrl).sort());
});

test('guide pages: one h1, author + updated date, "In this guide" lists every h2, related links, Article node', skip, () => {
  for (const id of published) {
    const h = readFileSync(root(`dist/guides/${id}/index.html`), 'utf8');
    const main = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
    assert.equal((main.match(/<h1[\s>]/g) ?? []).length, 1, id);
    assert.match(text(main.match(/data-guide-meta[^>]*>([\s\S]*?)<\/p>/)![1]), /^By DataKeel AI · Updated [A-Z][a-z]+ \d{1,2}, \d{4}$/);
    const body = main.match(/class="guide-body"[\s\S]*?<\/div>\s*<aside/)![0];
    const h2s = [...body.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => [m[1], text(m[2])]);
    assert.ok(h2s.length >= 3, `${id}: h2s`);
    const toc = [...main.match(/data-guide-toc[\s\S]*?<\/nav>/)![0].matchAll(/<a href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], text(m[2])]);
    assert.deepEqual(toc, h2s, `${id}: toc matches h2s`);
    // Answer-first: the body opens with a paragraph before the first h2.
    assert.match(body, /^class="guide-body"[^>]*>\s*<p>/, `${id}: opening answer`);
    assert.ok([...main.match(/data-guide-related[\s\S]*?<\/aside>/)![0].matchAll(/<a href="\//g)].length >= 3, `${id}: related`);
    assert.match(main, /data-closing-cta/);
    const art = graph(h).filter((n) => n['@type'] === 'Article');
    assert.equal(art.length, 1);
    assert.deepEqual(art[0].author, { '@id': ORGANIZATION_ID }, 'company author');
    assert.deepEqual(art[0].publisher, { '@id': ORGANIZATION_ID });
    assert.match(art[0].dateModified, /^\d{4}-\d{2}-\d{2}$/);
  }
});
