import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStory, POINTS, position, SCENE_LABELS, SCENE_NAMES, timeline } from '../src/lib/pure/story-scenes.ts';

test('story: 9 scenes in order, labels to match', () => {
  assert.deepEqual(SCENE_NAMES, ['computer', 'data', 'intelligence', 'datakeel', 'pipelines', 'lakehouse', 'governance', 'aiReady', 'logo']);
  assert.deepEqual(SCENE_LABELS, ['Computation', 'Data', 'AI', 'The keel', 'Pipelines', 'Lakehouse', 'Governance', 'AI-ready', 'DataKeel']);
  const { scenes, dockLogo, stagger } = createStory();
  assert.equal(scenes.length, 9);
  for (const scene of [...scenes, dockLogo]) assert.equal(scene.length, POINTS);
  assert.equal(stagger.length, POINTS);
});

test('story: deterministic for seed 7, finite and inside the scene box', () => {
  const coords = () => createStory(7).scenes.flatMap((s) => s.flatMap((slot) => [...position(slot, 0), ...position(slot, 3.7)]));
  const a = coords();
  assert.deepEqual(a, coords());
  assert.notDeepEqual(a, createStory(8).scenes.flatMap((s) => s.flatMap((slot) => [...position(slot, 0), ...position(slot, 3.7)])));
  // Unit space is roughly -1..1; the governance rain and the waves reach out to 1.65 (prototype geometry).
  for (const v of a) assert.ok(Number.isFinite(v) && Math.abs(v) <= 1.7, `coordinate ${v}`);
});

test('timeline: 4s per scene, morph in the last 40%, loops', () => {
  assert.deepEqual(timeline(0, 4, 9), { from: 0, to: 1, mix: 0, nearest: 0 });
  assert.equal(timeline(2.4, 4, 9).mix, 0); // still holding at 60%
  assert.equal(timeline(3.3, 4, 9).nearest, 1); // past halfway through the morph
  assert.deepEqual(timeline(32, 4, 9), { from: 8, to: 0, mix: 0, nearest: 8 }); // logo scene, reduced motion's still frame
  assert.equal(timeline(36, 4, 9).from, 0); // loops
});
