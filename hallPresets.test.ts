import assert from 'node:assert/strict';
import test from 'node:test';
import { createObjectConfig, INITIAL_HALL } from './constants';
import { buildHallPreset, hallPresetTitle, presetHallFor, withPresetStructures } from './hallPresets';
import { BanquetObject, HallConfig, ObjectType } from './types';

const object = (id: string, type: ObjectType, x = 0): BanquetObject => ({ ...createObjectConfig(type), id, position: { x, y: 0, z: 0 } });

const venueHall: HallConfig = {
  ...INITIAL_HALL,
  width: 16, length: 35, height: 5, floorColor: '#a8423a',
  outline: [{ x: -8, z: -17.5 }, { x: 8, z: -17.5 }, { x: 8, z: 17.5 }, { x: -8, z: 17.5 }],
  planInfo: { title: '陳李府喜宴', venue: '芙洛麗', date: '2026/10/11' },
};

test('a preset keeps the hall and only its doors, columns and partition walls, never the event title block', () => {
  const scene = [object('t', ObjectType.ROUND_TABLE), object('d', ObjectType.DOOR), object('c', ObjectType.COLUMN), object('w', ObjectType.WALL), object('s', ObjectType.STAGE)];
  const preset = buildHallPreset(venueHall, scene, true);
  assert.equal('planInfo' in preset.hall, false);
  assert.deepEqual(preset.hall.outline, venueHall.outline);
  assert.equal(preset.hall.floorColor, '#a8423a');
  assert.deepEqual(preset.objects.map(item => item.id), ['d', 'c', 'w']);
  assert.deepEqual(buildHallPreset(venueHall, scene, false).objects, []);
});

test('applying a preset takes its hall but keeps the scene title block, naming the venue after the preset', () => {
  const current: HallConfig = { ...INITIAL_HALL, outline: [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 0, z: 4 }], planInfo: { title: '尾牙', venue: '舊場地', version: '第二版' } };
  const { planInfo: _ignored, ...presetHall } = venueHall;
  const applied = presetHallFor(current, { ...presetHall, planInfo: { title: 'preset title' } }, hallPresetTitle({ name: '3F Ballroom II', venue: '芙洛麗' }));
  assert.deepEqual(applied.planInfo, { title: '尾牙', venue: '芙洛麗 3F Ballroom II', version: '第二版' });
  assert.deepEqual(applied.outline, venueHall.outline);
  assert.equal(applied.width, 16);
  const rectangle = presetHallFor(current, INITIAL_HALL, hallPresetTitle({ name: 'B 廳', venue: null }));
  assert.equal('outline' in rectangle, false, 'a rectangular preset clears the previous outline');
  assert.equal(rectangle.planInfo?.venue, 'B 廳');
});

test('applying replaces the old structures under fresh ids and leaves every other object in place', () => {
  const scene = [object('table', ObjectType.ROUND_TABLE), object('old-door', ObjectType.DOOR), object('stage', ObjectType.STAGE), object('old-wall', ObjectType.WALL)];
  const presetObjects = [object('door', ObjectType.DOOR, 3), object('column', ObjectType.COLUMN, 5), object('stray', ObjectType.ROUND_TABLE)];
  let next = 0;
  const result = withPresetStructures(scene, presetObjects, () => `new-${++next}`);
  assert.deepEqual(result.map(item => item.id), ['table', 'stage', 'new-1', 'new-2']);
  assert.deepEqual(result.slice(2).map(item => [item.type, item.position.x]), [[ObjectType.DOOR, 3], [ObjectType.COLUMN, 5]]);
  assert.deepEqual(presetObjects.map(item => item.id), ['door', 'column', 'stray'], 'the preset itself is not modified');
});

test('a preset saved without structures keeps the doors, columns and partition walls the scene already has', () => {
  const scene = [object('door', ObjectType.DOOR), object('table', ObjectType.ROUND_TABLE), object('wall', ObjectType.WALL)];
  const hallOnly = buildHallPreset(venueHall, scene, false);
  assert.deepEqual(withPresetStructures(scene, hallOnly.objects, () => 'unused').map(item => item.id), ['door', 'table', 'wall']);
});
