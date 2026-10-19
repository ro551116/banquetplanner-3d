import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTrussBom, getMemberLength, getTrussDimensions, splitMemberIntoBays } from './trussConfig';
import { createFourPostFrame, TRUSS_TEMPLATES } from './trussTemplates';

test('a four-post frame stands on four base plates with one coupler per top corner', () => {
  const frame = createFourPostFrame('四柱燈架', 600, 400, 400);
  const bom = calculateTrussBom(frame);
  assert.equal(bom.basePlates, 4);
  assert.equal(bom.couplers, 4);
  assert.deepEqual(getTrussDimensions(frame), { widthCm: 600, heightCm: 400, depthCm: 400 });
  const totalCm = Object.entries(bom.segments).reduce((sum, [length, count]) => sum + Number(length) * count, 0);
  assert.equal(totalCm, 4 * 400 + 2 * 600 + 2 * 400);
});

test('every common style comes out in whole sections, without 10/20 cm fillers', () => {
  for (const template of TRUSS_TEMPLATES) {
    const bom = calculateTrussBom(template.build());
    assert.equal(bom.segments[10] + bom.segments[20], 0, template.id);
  }
});

test('the multi-bay rig spaces its legs evenly', () => {
  const rig = TRUSS_TEMPLATES.find(template => template.id === 'lighting-rig')!.build();
  const bays = splitMemberIntoBays(rig.beam, rig.bayCount).map(bay => getMemberLength(bay));
  assert.equal(bays.length, 3);
  assert.equal(new Set(bays).size, 1);
  assert.equal(calculateTrussBom(rig).basePlates, 4);
});
