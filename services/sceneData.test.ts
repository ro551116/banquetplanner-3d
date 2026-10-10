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

test('drops malformed planning fields and path vertices instead of passing them to models', () => {
  const result = normalizeSceneData({
    objects: [
      object('table', { seatCount: '11', childSeats: 2, standby: 'yes', chairLayout: 'diagonal', note: '13:30 撤離' }),
      { ...object('cable'), type: 'CABLE_RUN', points: [{ x: 0, z: 0 }, { x: 'far', z: 1 }, { x: 4, z: 2 }] },
      { ...object('arrow'), type: 'FLOW_ARROW', points: 'not-a-path' },
    ],
  });
  const [table, cable, arrow] = result.objects;
  assert.equal(table.seatCount, undefined);
  assert.equal(table.standby, undefined);
  assert.equal(table.chairLayout, undefined);
  assert.equal(table.childSeats, 2);
  assert.equal(table.note, '13:30 撤離');
  assert.deepEqual(cable.points, [{ x: 0, z: 0 }, { x: 4, z: 2 }]);
  assert.deepEqual(arrow.points, []);
  assert.ok(result.repaired >= 5);
});

test('keeps only string title-block fields of the hall plan info', () => {
  const result = normalizeSceneData({ hall: { width: 12, length: 18, height: 5, planInfo: { title: '陳李府喜宴', version: 5, venue: '3F Ballroom II' } } });
  assert.deepEqual(result.hall.planInfo, { title: '陳李府喜宴', venue: '3F Ballroom II' });
});

test('a hall outline keeps its finite corners and defines width/length; an unusable outline falls back to the rectangle', () => {
  const shaped = normalizeSceneData({ hall: { width: 99, length: 99, height: 5, outline: [{ x: -6, z: -8 }, { x: 6, z: -8 }, { x: 'x', z: 0 }, { x: 6, z: 8 }, { x: -6, z: 8 }] } });
  assert.deepEqual(shaped.hall.outline, [{ x: -6, z: -8 }, { x: 6, z: -8 }, { x: 6, z: 8 }, { x: -6, z: 8 }]);
  assert.deepEqual([shaped.hall.width, shaped.hall.length], [12, 16]);
  assert.ok(shaped.repaired >= 1);

  const broken = normalizeSceneData({ hall: { width: 14, length: 18, height: 5, outline: [{ x: 0, z: 0 }, { x: 1, z: 1 }] } });
  assert.equal(broken.hall.outline, undefined);
  assert.deepEqual([broken.hall.width, broken.hall.length], [14, 18]);
});
