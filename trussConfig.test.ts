import assert from 'node:assert/strict';
import test from 'node:test';
import type { TrussStructureConfig, TrussStructureKind } from './types';
import {
  calculateTrussBom,
  convertPresetToMembers,
  createDefaultTrussConfig,
  detectCustomJoints,
  fitSegmentsForBays,
  getEffectiveBeamAttachCm,
  getMemberLength,
  getTrussDimensions,
  isCustomCouplerJoint,
  splitMemberIntoBays,
} from './trussConfig';

const asCustom = (preset: TrussStructureConfig): TrussStructureConfig => ({
  kind: 'CUSTOM',
  title: preset.title,
  quantity: preset.quantity,
  members: convertPresetToMembers(preset),
});

test('converting connected planar presets preserves their complete material list', () => {
  const kinds: TrussStructureKind[] = ['TOWER', 'GOALPOST', 'BOX', 'LSHAPE', 'TSHAPE', 'MULTI_BAY'];
  for (const kind of kinds) {
    const preset = createDefaultTrussConfig(kind, 'fixture', 550, 375, 125, 3);
    assert.deepEqual(calculateTrussBom(asCustom(preset)), calculateTrussBom(preset), kind);
  }
});

test('converted backdrop columns meet their beams rather than floating below them', () => {
  const preset = createDefaultTrussConfig('BACKDROP');
  const custom = asCustom(preset);
  const members = custom.members!;
  const joints = detectCustomJoints(members).filter(joint => isCustomCouplerJoint(joint, members));
  for (const member of members.filter(member => member.orientation === 'VERTICAL')) {
    assert.ok(joints.some(joint => joint.memberIds.includes(member.id)), `${member.label} has no beam connection`);
  }
  assert.deepEqual(calculateTrussBom(custom).segments, calculateTrussBom(preset).segments);
  assert.equal(calculateTrussBom(custom).basePlates, calculateTrussBom(preset).basePlates);
});

test('cantilever attachment cannot float above the column or inflate lowered-beam height', () => {
  for (const kind of ['LSHAPE', 'TSHAPE'] as const) {
    const preset = createDefaultTrussConfig(kind);
    const columnHeight = getMemberLength(preset.legs);
    const high = { ...preset, beamAttachCm: columnHeight + 150 };
    assert.equal(getEffectiveBeamAttachCm(high), columnHeight);
    assert.equal(getTrussDimensions(high).heightCm, columnHeight + 25);
    assert.equal(getTrussDimensions({ ...preset, beamAttachCm: 100 }).heightCm, columnHeight);
  }
});

test('automatic multi-bay fitting balances every bay without changing the fitted inventory', () => {
  for (let bayCount = 2; bayCount <= 6; bayCount += 1) {
    const beam = { segments: fitSegmentsForBays(825, bayCount) };
    const bays = splitMemberIntoBays(beam, bayCount);
    assert.equal(getMemberLength(beam), 820);
    assert.equal(bays.length, bayCount);
    assert.ok(bays.every(bay => getMemberLength(bay) > 0));
    assert.deepEqual(bays.flatMap(bay => bay.segments), beam.segments);
    const lengths = bays.map(bay => getMemberLength(bay));
    assert.ok(Math.max(...lengths) - Math.min(...lengths) <= 10, `unbalanced bays: ${lengths.join(', ')}`);
  }
  const minimum = { segments: fitSegmentsForBays(10, 6) };
  assert.equal(getMemberLength(minimum), 60);
  assert.ok(splitMemberIntoBays(minimum, 6).every(bay => getMemberLength(bay) === 10));
});

test('custom depth includes separated member planes even without a depth-oriented rod', () => {
  const config: TrussStructureConfig = {
    kind: 'CUSTOM',
    title: 'offset columns',
    quantity: 1,
    members: [
      { id: 'front', orientation: 'VERTICAL', segments: [200], origin: { xCm: 0, yCm: 0, zCm: 10 } },
      { id: 'back', orientation: 'VERTICAL', segments: [200], origin: { xCm: 100, yCm: 0, zCm: 110 } },
    ],
  };
  assert.deepEqual(getTrussDimensions(config), { widthCm: 100, heightCm: 200, depthCm: 100 });
});
