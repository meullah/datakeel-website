import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as u from '../src/lib/urls.ts';
import { caseStudyIds } from './content-data.ts';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const skip = { skip: existsSync(dist) ? false : 'dist/ not found; run npm run build first' };
const visualsDir = new URL('../src/components/visuals/', import.meta.url);

const visualOf = (id: string) => {
  const src = readFileSync(new URL(`../src/content/caseStudies/${id}.md`, import.meta.url), 'utf8');
  const m = src.match(/^visual: \{ kind: (diagram|dashboard), id: ([a-z0-9-]+) \}\s*$/m);
  return m ? { kind: m[1], id: m[2] } : undefined;
};

test('every published visual.id has a component file', () => {
  for (const id of caseStudyIds) {
    const v = visualOf(id);
    if (!v) continue; // visual is optional
    assert.ok(existsSync(new URL(`${v.id}.astro`, visualsDir)), `${id}: no visual component "${v.id}"`);
  }
});

test('every case page: one inline-SVG figure when a visual is set, titled, no images or hex colors', skip, () => {
  for (const id of caseStudyIds) {
    const r = u.caseStudyUrl(id);
    const html = readFileSync(`${dist}${r.slice(1)}index.html`, 'utf8');
    const figures = html.match(/<figure\b[^>]*class="[^"]*case-visual[\s\S]*?<\/figure>/g) ?? [];
    const v = visualOf(id);
    assert.equal(figures.length, v ? 1 : 0, `${r}: visual figure count`);
    if (!v) continue;
    const fig = figures[0]!;
    assert.equal((fig.match(/<svg\b[^>]*role="img"/g) ?? []).length, 1, `${r}: one svg[role=img]`);
    assert.match(fig, /<svg\b[\s\S]*<title\b[^>]*>[^<]+<\/title>/, `${r}: svg title`);
    assert.match(fig, /<desc\b[^>]*>[^<]+<\/desc>/, `${r}: svg description`);
    const svgTag = fig.match(/<svg\b[^>]*>/)![0];
    for (const [attr, tag] of [['aria-labelledby', 'title'], ['aria-describedby', 'desc']]) {
      const ref = svgTag.match(new RegExp(`${attr}="([^"]+)"`))?.[1];
      assert.ok(ref, `${r}: svg ${attr}`);
      assert.match(fig, new RegExp(`<${tag}\\b[^>]*\\bid="${ref}"[^>]*>[^<]+</${tag}>`), `${r}: ${attr} resolves to its own <${tag}>`);
    }
    assert.match(fig, /<figcaption\b[^>]*>[^<]+<\/figcaption>/, `${r}: figcaption`);
    assert.match(fig, /<text\b/, `${r}: labels are real text`);
    assert.doesNotMatch(fig, /<img\b/, `${r}: no <img> in the figure`);
    const svg = fig.slice(fig.indexOf('<svg'), fig.lastIndexOf('</svg>'));
    assert.doesNotMatch(svg, /(?<!url\()#[0-9a-f]{3,8}\b/i, `${r}: no hex color literals in the SVG`);
    assert.doesNotMatch(svg, /\b(rgb|hsl)a?\(/i, `${r}: no color functions in the SVG`);
    assert.equal(/>Illustrative</.test(fig), v.kind === 'dashboard', `${r}: "Illustrative" only on dashboards`);
  }
});
