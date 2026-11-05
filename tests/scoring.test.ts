// Story 7.1: self-assessment scoring rules (src/lib/pure/scoring.ts + src/content/self-assessment.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessment, cleanHours, hoursText, score } from '../src/lib/pure/scoring.ts';

const R = Object.fromEntries(['spreadsheets', 'definition', 'automate', 'map', 'ai'].map((k, i) => [k, assessment.recommendations[i].text]));
const FALLBACK = assessment.fallback;
// 8 points, no rule matches except "Ready".
const best = { reports: 'dashboard', hours: 0, agree: 'always', systems: '1-3' };

test('content: five questions, Q2 is a 0-40 slider, Q5 free text; three levels over 0-8', () => {
  assert.deepEqual(assessment.questions.map((q) => q.type), ['choice', 'range', 'choice', 'choice', 'text']);
  assert.deepEqual(assessment.levels.map((l) => [l.name, l.max]), [['Early', 3], ['Developing', 6], ['Ready', 8]]);
});

test('level boundaries: 3 Early, 4 Developing, 6 Developing, 7 Ready, 0 and 8', () => {
  const at = (a: object) => score(a).level.name;
  assert.equal(at({ reports: 'spreadsheets', hours: 40, agree: 'rarely', systems: '8+' }), 'Early'); // 0
  assert.equal(score({ reports: 'spreadsheets', hours: 40, agree: 'rarely', systems: '8+' }).points, 0);
  assert.equal(at({ reports: 'dashboard', hours: 10, agree: 'rarely', systems: '8+' }), 'Early'); // 2+1+0+0 = 3
  assert.equal(at({ reports: 'dashboard', hours: 3, agree: 'rarely', systems: '8+' }), 'Developing'); // 4
  assert.equal(at({ reports: 'dashboard', hours: 3, agree: 'always', systems: '8+' }), 'Developing'); // 6
  assert.equal(at({ reports: 'dashboard', hours: 3, agree: 'always', systems: '4-7' }), 'Ready'); // 7
  assert.equal(score(best).points, 8);
  assert.equal(at(best), 'Ready');
});

test('hours bands: under 5 = 2, 5-15 = 1 (15 included), 16+ = 0', () => {
  const pts = (hours: number) => score({ hours }).points;
  assert.deepEqual([0, 4, 5, 15, 16, 40].map(pts), [2, 2, 1, 1, 0, 0]);
});

test('each recommendation rule, in the documented order, capped at 3', () => {
  assert.deepEqual(score({ reports: 'spreadsheets', hours: 3, agree: 'always', systems: '1-3' }).recommendations, [R.spreadsheets, FALLBACK]);
  assert.deepEqual(score({ reports: 'stitched', hours: 3, agree: 'sometimes', systems: '1-3' }).recommendations, [R.definition, FALLBACK]);
  assert.deepEqual(score({ reports: 'dashboard', hours: 3, agree: 'rarely', systems: '1-3' }).recommendations, [R.definition, FALLBACK]);
  assert.deepEqual(score({ reports: 'dashboard', hours: 16, agree: 'always', systems: '1-3' }).recommendations, [R.automate, FALLBACK]);
  assert.deepEqual(score({ reports: 'dashboard', hours: 15, agree: 'always', systems: '1-3' }).recommendations, [R.ai, FALLBACK], '15 hours is not "over 15"');
  assert.deepEqual(score({ reports: 'dashboard', hours: 3, agree: 'always', systems: '8+' }).recommendations, [R.map, FALLBACK]);
  assert.deepEqual(score(best).recommendations, [R.ai, FALLBACK]);
  assert.deepEqual(score({ reports: 'spreadsheets', hours: 40, agree: 'rarely', systems: '8+' }).recommendations, [R.spreadsheets, R.definition, R.automate]);
});

test('fallback only when fewer than 2 rules match', () => {
  assert.deepEqual(score({ reports: 'spreadsheets', hours: 3, agree: 'rarely', systems: '1-3' }).recommendations, [R.spreadsheets, R.definition]);
  assert.deepEqual(score({ reports: 'stitched', hours: 3, agree: 'always', systems: '4-7' }).recommendations, [FALLBACK], 'no rule at all');
});

test('zero hours: no yearly figure; otherwise hours × 48', () => {
  assert.equal(score(best).yearlyHours, undefined);
  assert.equal(score(best).hours, 0);
  assert.equal(score({ ...best, hours: 12 }).yearlyHours, 12 * 48);
});

test('skipped or blank Q5 gives no goal; answers are trimmed', () => {
  assert.equal(score(best).goal, undefined);
  assert.equal(score({ ...best, goal: '   ' }).goal, undefined);
  assert.equal(score({ ...best, goal: '  Hiring for peak season ' }).goal, 'Hiring for peak season');
});

test('unanswered or junk input scores 0 points and never throws', () => {
  assert.equal(score({}).points, 2, 'only the 0-hour band scores');
  assert.equal(score({ reports: 'x', hours: Number.NaN }).hours, 0);
  assert.deepEqual([cleanHours(-3), cleanHours(41), cleanHours(7.6), cleanHours('9')], [0, 40, 8, 0]);
});

test('hoursText: singular, plural and "40 or more"', () => {
  assert.deepEqual([hoursText(0), hoursText(1), hoursText(12), hoursText(40)], ['0 hours a week', '1 hour a week', '12 hours a week', '40 or more hours a week']);
});
