import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { countLabel, parseIndustry } from '../src/lib/pure/case-filter.ts';
import * as u from '../src/lib/urls.ts';
import { caseStudyIds, industries } from './content-data.ts';

const ids = industries.map((i) => i.id);

test('parseIndustry: known id, unknown id, no query', () => {
  assert.equal(parseIndustry('?industry=finance', ids), 'finance');
  assert.equal(parseIndustry('industry=healthcare&x=1', ids), 'healthcare');
  assert.equal(parseIndustry('?industry=space', ids), null);
  assert.equal(parseIndustry('?industry=', ids), null);
  assert.equal(parseIndustry('', ids), null);
});

test('countLabel: singular for 1', () => {
  assert.equal(countLabel(0), 'Showing 0 case studies');
  assert.equal(countLabel(1), 'Showing 1 case study');
  assert.equal(countLabel(2), 'Showing 2 case studies');
});

const file = fileURLToPath(new URL('../dist/case-studies/index.html', import.meta.url));
const skip = { skip: existsSync(file) ? false : 'dist/case-studies/index.html not found; run npm run build first' };
const html = existsSync(file) ? readFileSync(file, 'utf8') : '';

test('index: one card link per published case, chips are real links, canonical fixed', skip, () => {
  const cards = html.match(/<article\b[^>]*data-case-card[\s\S]*?<\/article>/g) ?? [];
  assert.equal(cards.length, caseStudyIds.length);
  assert.equal(caseStudyIds.length, 5);
  const cardHrefs = cards.map((c) => {
    const hrefs = [...c.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1]);
    assert.equal(hrefs.length, 1, 'exactly one link per card');
    return hrefs[0];
  });
  assert.deepEqual(cardHrefs.sort(), caseStudyIds.map(u.caseStudyUrl).sort());

  const chips = [...html.matchAll(/<a\b[^>]*\sdata-chip\b[^>]*>/g)].map((m) => m[0].match(/href="([^"]*)"/)?.[1]);
  assert.deepEqual(chips, [u.caseStudiesUrl(), ...industries.map((i) => u.industryUrl(i.id))]);
  assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+\/case-studies\/"/);
  assert.match(html, /aria-live="polite"/);
});
