import assert from 'node:assert/strict';
import test from 'node:test';
import { createObjectConfig, INITIAL_HALL } from './constants';
import {
  attachedObjects, carryAttachedObjects, getHallOutline, getOutlineBounds, getPartitionSegments, getSeating, getTrussBeams,
  getWallSegments, isMountedOn, isSimplePolygon, nextDeviceCode, outlineTemplate, snapToWall, summarizeSeating, trussMountPose,
  withOutline,
} from './planning';
import { BanquetObject, ObjectType, Vector3 } from './types';

const table = (type: ObjectType, extra: Partial<BanquetObject> = {}): BanquetObject => ({ ...createObjectConfig(type), ...extra });

test('seat overrides, child chairs and vegetarian meals are clamped to the chairs at the table', () => {
  assert.deepEqual(getSeating(table(ObjectType.ROUND_TABLE, { seatCount: 11 })), { seats: 11, childSeats: 0, vegetarianSeats: 0 });
  assert.deepEqual(getSeating(table(ObjectType.ROUND_TABLE, { customSize: 4, childSeats: 9, vegetarianSeats: -2 })), { seats: 5, childSeats: 5, vegetarianSeats: 0 });
  assert.equal(getSeating(table(ObjectType.RECT_TABLE, { customSize: 8, chairLayout: 'front' }))?.seats, 4);
  assert.equal(getSeating(table(ObjectType.RECT_TABLE, { chairLayout: 'none' }))?.seats, 0);
  assert.equal(getSeating(table(ObjectType.COCKTAIL_TABLE)), null);
});

test('a banquet plan counts dining tables without the standby table or chairless utility tables', () => {
  const objects = [
    table(ObjectType.ROUND_TABLE, { label: '主', vegetarianSeats: 1 }),
    table(ObjectType.ROUND_TABLE, { label: '9', seatCount: 11 }),
    table(ObjectType.ROUND_TABLE, { label: '10', childSeats: 2 }),
    table(ObjectType.ROUND_TABLE, { label: '備', standby: true }),
    table(ObjectType.RECT_TABLE, { label: '音控', customSize: 8, chairLayout: 'none' }),
    table(ObjectType.RECT_TABLE, { label: '收禮桌', chairLayout: 'front' }),
  ];
  assert.deepEqual(summarizeSeating(objects), { tables: 4, standbyTables: 1, seats: 34, childSeats: 2, vegetarianSeats: 1 });
});

test('doors land on the nearest wall facing into the room; columns snap only when close', () => {
  const hall = getWallSegments(getHallOutline({ width: 15, length: 20 }));
  assert.deepEqual(snapToWall(ObjectType.DOOR, { x: 3, z: 9.2 }, hall), { x: 3, z: 10, rotationY: Math.PI });
  assert.deepEqual(snapToWall(ObjectType.DOOR, { x: -6.9, z: 0 }, hall), { x: -7.5, z: 0, rotationY: Math.PI / 2 });
  assert.deepEqual(snapToWall(ObjectType.COLUMN, { x: 7.2, z: -4 }, hall, 0.6), { x: 7.2, z: -4, rotationY: -Math.PI / 2 });
  assert.equal(snapToWall(ObjectType.COLUMN, { x: 0, z: 0 }, hall, 0.6), null);
  assert.equal(snapToWall(ObjectType.ROUND_TABLE, { x: 7.4, z: 0 }, hall), null);
});

test('wall snapping follows the inner walls of an L-shaped hall regardless of corner order', () => {
  const outline = outlineTemplate('L', 18, 24); // notch at the back-right: walls x = 3 (z -12..-4) and z = -4 (x 3..9)
  for (const corners of [getWallSegments(outline), getWallSegments([...outline].reverse())]) {
    assert.deepEqual(snapToWall(ObjectType.DOOR, { x: 6, z: -3.6 }, corners), { x: 6, z: -4, rotationY: 0 });
    assert.deepEqual(snapToWall(ObjectType.DOOR, { x: 2.7, z: -8 }, corners), { x: 3, z: -8, rotationY: -Math.PI / 2 });
    assert.deepEqual(snapToWall(ObjectType.COLUMN, { x: 8.8, z: 0 }, corners, 0.4), { x: 8.8, z: 0, rotationY: -Math.PI / 2 });
  }
});

test('doors on a partition wall face the side they were placed from; pilasters clear the wall face', () => {
  // A rotated partition: local (0,0)→(4,0) turned 90° about Y runs from world (2,1) to (2,-3).
  const wall: BanquetObject = { ...createObjectConfig(ObjectType.WALL, { x: 2, y: 0, z: 1 }), rotation: { x: 0, y: Math.PI / 2, z: 0 }, points: [{ x: 0, z: 0 }, { x: 4, z: 0 }], customWidth: 0.2 };
  const walls = getPartitionSegments([wall, createObjectConfig(ObjectType.ROUND_TABLE)]);
  assert.equal(walls.length, 1);
  const close = (actual: { x: number; z: number; rotationY: number } | null, expected: [number, number, number]) =>
    assert.ok(actual && [actual.x, actual.z, actual.rotationY].every((value, index) => Math.abs(value - expected[index]) < 1e-9), JSON.stringify(actual));
  close(snapToWall(ObjectType.DOOR, { x: 2.4, z: -1 }, walls), [2, -1, Math.PI / 2]);
  close(snapToWall(ObjectType.DOOR, { x: 1.6, z: -1 }, walls), [2, -1, -Math.PI / 2]);
  close(snapToWall(ObjectType.COLUMN, { x: 2.5, z: -1 }, walls, 0.6), [2.4, -1, Math.PI / 2]);
});

test('device codes continue the prefix a system already uses and ignore hand-written names', () => {
  const point = (label: string, system: BanquetObject['system']): BanquetObject => ({ ...createObjectConfig(ObjectType.DEVICE_POINT), label, system });
  const objects = [point('MN-01', 'network'), point('MN-09', 'network'), point('AP-03', 'wifi'), point('Reception', 'network')];
  assert.equal(nextDeviceCode(objects, 'network'), 'MN-10');
  assert.equal(nextDeviceCode(objects, 'wifi'), 'AP-04');
  assert.equal(nextDeviceCode(objects, 'camera'), 'CAM-01');
  assert.equal(nextDeviceCode([], 'wifi'), 'AP-01');
});

test('outline templates fill the requested box without crossing edges; a bow-tie is rejected', () => {
  for (const kind of ['L', 'chamfer', 'octagon', 'alcove'] as const) {
    const outline = outlineTemplate(kind, 16, 30);
    assert.ok(isSimplePolygon(outline), kind);
    const bounds = getOutlineBounds(outline);
    assert.deepEqual([bounds.width, bounds.length, bounds.centerX, bounds.centerZ], [16, 30, 0, 0], kind);
  }
  assert.equal(isSimplePolygon([{ x: 0, z: 0 }, { x: 4, z: 4 }, { x: 4, z: 0 }, { x: 0, z: 4 }]), false);
});

test('setting an outline keeps width/length equal to its bounding box; clearing returns to the rectangle', () => {
  const shaped = withOutline(INITIAL_HALL, [{ x: 2, z: -3 }, { x: 20, z: -3 }, { x: 20, z: 9 }, { x: 2, z: 9 }]);
  assert.deepEqual([shaped.width, shaped.length], [18, 12]);
  const cleared = withOutline(shaped, undefined);
  assert.equal('outline' in cleared, false);
  assert.deepEqual(getHallOutline(cleared), [{ x: -9, z: -6 }, { x: 9, z: -6 }, { x: 9, z: 6 }, { x: -9, z: 6 }]);
});

test('a number plate travels with the table it stands on, and only that one', () => {
  const table: BanquetObject = { ...createObjectConfig(ObjectType.ROUND_TABLE, { x: 2, y: 0, z: 3 }), id: 'table' };
  const onTable: BanquetObject = { ...createObjectConfig(ObjectType.TABLE_NUMBER, { x: 2.3, y: 0.75, z: 3 }), id: 'plate' };
  const onFloor: BanquetObject = { ...createObjectConfig(ObjectType.TABLE_NUMBER, { x: 2.3, y: 0, z: 3 }), id: 'floor-sign' };
  const elsewhere: BanquetObject = { ...createObjectConfig(ObjectType.TABLE_NUMBER, { x: 9, y: 0.75, z: 9 }), id: 'other' };
  const before = [table, onTable, onFloor, elsewhere];
  assert.deepEqual([...attachedObjects(before, new Set(['table']))], ['plate']);

  // Move the table by (+1, 0, -1) and turn it 90°: the plate keeps its offset in the table's frame.
  const moved = before.map(object => object.id === 'table' ? { ...object, position: { x: 3, y: 0, z: 2 }, rotation: { x: 0, y: Math.PI / 2, z: 0 } } : object);
  const after = carryAttachedObjects(before, moved);
  const plate = after.find(object => object.id === 'plate')!;
  assert.ok(Math.abs(plate.position.x - 3) < 1e-9 && Math.abs(plate.position.z - 1.7) < 1e-9 && plate.position.y === 0.75, JSON.stringify(plate.position));
  assert.ok(Math.abs(plate.rotation.y - Math.PI / 2) < 1e-9);
  assert.equal(after.find(object => object.id === 'floor-sign'), onFloor);
  assert.equal(after.find(object => object.id === 'other'), elsewhere);

  // A plate the same update already moved (dragged along) is not moved twice; no table change → same array.
  const dragged = moved.map(object => object.id === 'plate' ? { ...object, position: { x: 3, y: 0.75, z: 2 } } : object);
  assert.deepEqual(carryAttachedObjects(before, dragged).find(object => object.id === 'plate')!.position, { x: 3, y: 0.75, z: 2 });
  const recoloured = before.map(object => object.id === 'table' ? { ...object, color: '#000000' } : object);
  assert.equal(carryAttachedObjects(before, recoloured), recoloured);
});

const assertNear = (actual: Vector3, expected: Vector3) =>
  assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y, actual.z - expected.z) < 1e-9, JSON.stringify(actual));

test('lights clamp under or on top of a truss beam and travel with the truss', () => {
  const truss: BanquetObject = { ...createObjectConfig(ObjectType.TRUSS_STRAIGHT, { x: 0, y: 3, z: 0 }), id: 'truss', customWidth: 4 };
  const [beam] = getTrussBeams(truss);
  // Hung under the bottom face at the beam point nearest the pointer, front turned to the side it faces (-z).
  const hung = trussMountPose(beam, { x: 1, z: 0.4 }, 'inverted', { x: 0, z: -1 });
  assertNear(hung.position, { x: 1, y: 3, z: 0 });
  assert.ok(Math.abs(Math.abs(hung.rotationY) - Math.PI) < 1e-9);
  // Standing on the top face; a pointer past the end clamps to the beam's end.
  const standing = trussMountPose(beam, { x: 9, z: 0 }, 'upright', { x: 0, z: 1 });
  assertNear(standing.position, { x: 2, y: 3.3, z: 0 });
  assert.ok(Math.abs(standing.rotationY) < 1e-9);

  const par: BanquetObject = { ...createObjectConfig(ObjectType.LIGHT_PAR, hung.position), id: 'par', mount: 'inverted', rotation: { x: 0.3, y: hung.rotationY, z: 0 } };
  const mover: BanquetObject = { ...createObjectConfig(ObjectType.LIGHT_MOVING, standing.position), id: 'mover', mount: 'upright' };
  const loose: BanquetObject = { ...createObjectConfig(ObjectType.LIGHT_PAR, hung.position), id: 'loose' }; // same spot, floor mount
  const upsideDownOnTop: BanquetObject = { ...mover, id: 'wrong-side', mount: 'inverted' };
  const before = [truss, par, mover, loose, upsideDownOnTop];
  assert.deepEqual([...attachedObjects(before, new Set(['truss']))], ['par', 'mover']);

  // Raise the truss 1 m, move it 2 m back and turn it 90°: clamped lights keep their place on the beam and their tilt.
  const moved = before.map(object => object.id === 'truss' ? { ...object, position: { x: 0, y: 4, z: 2 }, rotation: { x: 0, y: Math.PI / 2, z: 0 } } : object);
  const after = carryAttachedObjects(before, moved);
  const parAfter = after.find(object => object.id === 'par')!;
  assertNear(parAfter.position, { x: 0, y: 4, z: 1 });
  assert.equal(parAfter.rotation.x, 0.3);
  assert.ok(Math.abs(parAfter.rotation.y - (hung.rotationY + Math.PI / 2)) < 1e-9);
  assert.ok(isMountedOn(parAfter, after.find(object => object.id === 'truss')!));
  assert.equal(after.find(object => object.id === 'loose'), loose);
  assert.equal(after.find(object => object.id === 'wrong-side'), upsideDownOnTop);
});
