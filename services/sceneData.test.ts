import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSceneData } from './sceneData';
import { INITIAL_HALL } from '../constants';

const object = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'ROUND_TABLE',
  position: { x: 1, y: 0, z: 2 },
  rotation: { x: 0, y: 0.5, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  color: '#ffffff',
  ...extra,
});

test('repairs transforms that would crash rendering and keeps type-specific fields', () => {
  const result = normalizeSceneData({
    objects: [
      object('a', { position: { x: null, y: 0, z: 3 }, customSize: 8 }),
      { ...object('b'), rotation: undefined },
    ],
  });
  assert.equal(result.objects.length, 2);
  assert.deepEqual(result.objects[0].position, { x: 0, y: 0, z: 3 });
  assert.equal(result.objects[0].customSize, 8);
  assert.deepEqual(result.objects[1].rotation, { x: 0, y: 0, z: 0 });
  assert.ok(result.repaired >= 4);
});

test('drops unknown types and non-objects, and makes duplicate ids unique', () => {
  const result = normalizeSceneData({
    objects: [object('same'), object('same'), { ...object('x'), type: 'NOT_A_TYPE' }, 'garbage', null],
  });
  assert.equal(result.objects.length, 2);
  assert.notEqual(result.objects[0].id, result.objects[1].id);
  assert.equal(result.objects[0].id, 'same');
});

test('clamps hall dimensions and falls back for invalid values', () => {
  const result = normalizeSceneData({ hall: { width: 0, length: 999, height: 'tall', wallColor: 3 } });
  assert.equal(result.hall.width, 1);
  assert.equal(result.hall.length, 200);
  assert.equal(result.hall.height, INITIAL_HALL.height);
  assert.equal(result.hall.wallColor, INITIAL_HALL.wallColor);
});

test('reports which sections were present so absent ones are not treated as empty data', () => {
  const hallOnly = normalizeSceneData({ hall: { width: 12, length: 18, height: 5 } });
  assert.equal(hallOnly.valid, true);
  assert.deepEqual(hallOnly.present, { hall: true, objects: false, drawings: false });

  const empty = normalizeSceneData({});
  assert.equal(empty.valid, false);
  assert.deepEqual(empty.present, { hall: false, objects: false, drawings: false });
});

test('rejects non-scene input', () => {
  for (const raw of [null, [], 'scene', 42, { hello: 'world' }]) {
    assert.equal(normalizeSceneData(raw).valid, false, JSON.stringify(raw));
  }
});

test('keeps drawings only when every point is finite', () => {
  const result = normalizeSceneData({
    drawings: [
      { id: 'ok', color: '#3b82f6', points: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }] },
      { id: 'bad', color: '#3b82f6', points: [{ x: 0, y: null, z: 0 }] },
      { id: 'nocolor', points: [] },
    ],
  });
  assert.deepEqual(result.drawings.map(drawing => drawing.id), ['ok']);
});
