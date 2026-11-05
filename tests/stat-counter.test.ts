import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easeOut, formatStat } from '../src/lib/pure/stat-counter.ts';

test('formatStat groups whole numbers and keeps prefix/suffix', () => {
  assert.equal(formatStat(10500, '', '+'), '10,500+');
  assert.equal(formatStat(219.6, '', '+'), '220+');
  assert.equal(formatStat(0, '$', 'k'), '$0k');
});

test('easeOut clamps and ends exactly at 1', () => {
  assert.equal(easeOut(-1), 0);
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  assert.equal(easeOut(2), 1);
  assert.ok(easeOut(0.5) > 0.5);
});
