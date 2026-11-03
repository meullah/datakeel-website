import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { assertHomepageStats, assertNoMarkers, assertRelated, compareEntries, findMarkers, MARKER } from '../src/lib/pure/content-rules.ts';

test('markers: found in nested strings, named by entry and field', () => {
  assert.deepEqual(findMarkers({ a: 'ok', after: ['fine', 'shown to auditors. [confirm]'], visual: { id: '[NOTE: later]' } }), ['after.1', 'visual.id']);
  for (const m of ['[confirm]', '[confirm exact tools]', '[ASSUMPTION: wording]', '[NOTE to self]', '[Confirm]']) {
    assert.deepEqual(findMarkers({ x: `text ${m}` }), ['x'], m);
  }
  assert.deepEqual(findMarkers({ d: new Date(), n: 3, s: 'a [link] and [1]' }), []);
  assert.throws(() => assertNoMarkers([{ id: 'case-a', data: { stack: ['SQL [confirm exact tools]'] } }], 'caseStudies'), /caseStudies\/case-a.*stack\.0/);
  assert.throws(() => assertNoMarkers([{ id: 'case-b', data: {}, body: '[NOTE…]' }], 'caseStudies'), /case-b.*body/);
  assert.doesNotThrow(() => assertNoMarkers([{ id: 'case-c', data: { found: 'clean' } }], 'caseStudies'));
});

const s = (n: number, homepage = true) => Array.from({ length: n }, () => ({ homepage }));

test('homepage stats: 3-4, from at least 2 case studies', () => {
  assert.doesNotThrow(() => assertHomepageStats([{ id: 'a', data: { stats: s(3) } }, { id: 'b', data: { stats: s(1) } }]));
  assert.doesNotThrow(() => assertHomepageStats([{ id: 'a', data: { stats: [...s(2), ...s(5, false)] } }, { id: 'b', data: { stats: s(1) } }, { id: 'c', data: {} }]));
  assert.throws(() => assertHomepageStats([{ id: 'a', data: { stats: s(1) } }, { id: 'b', data: { stats: s(1) } }]), /found 2, need 3 to 4/);
  assert.throws(() => assertHomepageStats([{ id: 'a', data: { stats: s(3) } }, { id: 'b', data: { stats: s(2) } }]), /found 5/);
  assert.throws(() => assertHomepageStats([{ id: 'a', data: { stats: s(3) } }]), /at least 2 case studies/);
  assert.throws(() => assertHomepageStats([]), /found 0/);
});

test('sort: featured order, then published desc, then id; order field first', () => {
  const d = (iso: string) => new Date(iso);
  const entries = [
    { id: 'old', data: { published: d('2026-01-01') } },
    { id: 'b-new', data: { published: d('2026-06-01') } },
    { id: 'a-new', data: { published: d('2026-06-01') } },
    { id: 'feat-2', data: { featured: 2, published: d('2025-01-01') } },
    { id: 'feat-1', data: { featured: 1, published: d('2024-01-01') } },
  ];
  assert.deepEqual(entries.sort(compareEntries).map((e) => e.id), ['feat-1', 'feat-2', 'a-new', 'b-new', 'old']);
  const ordered = [{ id: 'x', data: { order: 2 } }, { id: 'y', data: { order: 1 } }];
  assert.deepEqual(ordered.sort(compareEntries).map((e) => e.id), ['y', 'x']);
});

test('related: only other published case studies', () => {
  const e = (id: string, related?: string[]) => ({ id, data: { related: related?.map((r) => ({ id: r })) } });
  assert.doesNotThrow(() => assertRelated([e('a', ['b']), e('b', ['a'])]));
  assert.throws(() => assertRelated([e('a', ['a'])]), /lists itself/);
  assert.throws(() => assertRelated([e('a', ['draft-case'])]), /"draft-case" is not a published/);
});

test('real content: no editorial markers in published case studies, industries or services', () => {
  const dir = new URL('../src/content/caseStudies/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  assert.equal(files.length, 5);
  for (const f of files) {
    const raw = readFileSync(new URL(f, dir), 'utf8');
    if (/^draft:\s*true\s*$/m.test(raw)) continue;
    assert.doesNotMatch(raw, MARKER, f);
  }
  for (const f of ['industries.json', 'services.json']) assert.doesNotMatch(readFileSync(new URL(`../src/content/${f}`, import.meta.url), 'utf8'), MARKER, f);
});
