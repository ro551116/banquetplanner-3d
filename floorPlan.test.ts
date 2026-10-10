import assert from 'node:assert/strict';
import test from 'node:test';
import { Object3D, Vector3 } from 'three';
import { BanquetObject, HallConfig, ObjectType } from './types';
import {
  buildDevicePointCsv,
  buildFloorPlanSvg,
  formatPowerSummary,
  formatSeatingSummary,
  getObjectBounds,
  getObjectFootprint,
  localToWorld,
} from './floorPlan';
import { summarizeSeating } from './planning';

let seq = 0;
const make = (type: ObjectType, overrides: Partial<BanquetObject> = {}): BanquetObject => ({
  id: `obj-${++seq}`,
  type,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  color: '#ffffff',
  ...overrides,
});

const hall: HallConfig = { width: 20, length: 30, height: 5, wallColor: '#ffffff', floorColor: '#cccccc' };

const viewBoxOf = (svg: string) => {
  const match = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  assert.ok(match, 'viewBox present');
  return { width: Number(match[1]), height: Number(match[2]) };
};

/** Reads the `translate(x y) rotate(a)` of the group drawn for an object. */
const transformOf = (svg: string, id: string) => {
  const match = new RegExp(`<g data-id="${id}"[^>]*transform="translate\\((-?[\\d.]+) (-?[\\d.]+)\\) rotate\\((-?[\\d.]+)\\)"`).exec(svg);
  assert.ok(match, `symbol group for ${id}`);
  return { tx: Number(match[1]), ty: Number(match[2]), angle: (Number(match[3]) * Math.PI) / 180 };
};

/** SVG rotate(a): (x, y) ↦ (x·cos a − y·sin a, x·sin a + y·cos a). */
const svgRotate = (angle: number, x: number, y: number) => ({
  x: x * Math.cos(angle) - y * Math.sin(angle),
  y: x * Math.sin(angle) + y * Math.cos(angle),
});

/** Minimal XML well-formedness check: balanced tags, quoted attributes, no raw `<` or bare `&`. */
function assertWellFormed(xml: string) {
  const markup = /<!--[\s\S]*?-->|<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="(?:[^"<&]|&(?:amp|lt|gt|quot|apos);)*")*)\s*(\/?)>/y;
  const stack: string[] = [];
  let i = 0;
  while (i < xml.length) {
    if (xml[i] === '<') {
      markup.lastIndex = i;
      const match = markup.exec(xml);
      assert.ok(match, `malformed markup near: ${xml.slice(i, i + 80)}`);
      i = markup.lastIndex;
      const [whole, closing, name, , selfClosing] = match;
      if (whole.startsWith('<!--')) continue;
      if (closing) assert.equal(stack.pop(), name, `unbalanced </${name}>`);
      else if (!selfClosing) stack.push(name);
    } else {
      const next = xml.indexOf('<', i);
      const chunk = xml.slice(i, next === -1 ? xml.length : next);
      assert.ok(!/&(?!(?:amp|lt|gt|quot|apos);)/.test(chunk), `bare & in text: ${chunk.slice(0, 80)}`);
      i = next === -1 ? xml.length : next;
    }
  }
  assert.deepEqual(stack, [], 'all tags closed');
}

test('a rotated footprint lands where three.js puts it', () => {
  for (const theta of [Math.PI / 2, 0.6, -2.2]) {
    const stage = make(ObjectType.STAGE, { customWidth: 2, customDepth: 1, position: { x: 3, y: 0, z: 2 }, rotation: { x: 0, y: theta, z: 0 } });
    const reference = new Object3D();
    reference.position.set(3, 0, 2);
    reference.rotation.y = theta;
    reference.updateMatrixWorld(true);

    for (const local of [{ x: 1, z: 0 }, { x: 0, z: 0.5 }, { x: -1, z: -0.5 }]) {
      const expected = reference.localToWorld(new Vector3(local.x, 0, local.z));
      const actual = localToWorld(stage, local);
      assert.ok(Math.abs(actual.x - expected.x) < 1e-9 && Math.abs(actual.z - expected.z) < 1e-9, `localToWorld θ=${theta}`);
    }

    // The drawn group maps local px → sheet px the same way (compared as offsets from the object origin).
    const other = make(ObjectType.DECOR, { position: { x: -4, y: 0, z: 7 } });
    const svg = buildFloorPlanSvg({ hall, objects: [stage, other] });
    const own = transformOf(svg, stage.id);
    const base = transformOf(svg, other.id);
    assert.ok(Math.abs(own.tx - base.tx - 7 * 40) < 0.05 && Math.abs(own.ty - base.ty + 5 * 40) < 0.05, 'object origin placement');
    for (const local of [{ x: 1, z: 0 }, { x: 0, z: 0.5 }]) {
      const expected = reference.localToWorld(new Vector3(local.x, 0, local.z)).sub(reference.position);
      const drawn = svgRotate(own.angle, local.x * 40, local.z * 40);
      assert.ok(Math.abs(drawn.x - expected.x * 40) < 0.05 && Math.abs(drawn.y - expected.z * 40) < 0.05, `drawn rotation θ=${theta}`);
    }
  }

  // 2 × 1 m rect turned a quarter: the AABB swaps its sides around the position.
  const quarter = make(ObjectType.STAGE, { customWidth: 2, customDepth: 1, position: { x: 3, y: 0, z: 2 }, rotation: { x: 0, y: Math.PI / 2, z: 0 } });
  const bounds = getObjectBounds(quarter);
  assert.ok(Math.abs(bounds.minX - 2.5) < 1e-9 && Math.abs(bounds.maxX - 3.5) < 1e-9);
  assert.ok(Math.abs(bounds.minZ - 1) < 1e-9 && Math.abs(bounds.maxZ - 3) < 1e-9);
});

test('every object type has a finite footprint', () => {
  for (const type of Object.values(ObjectType)) {
    const fp = getObjectFootprint(make(type));
    switch (fp.kind) {
      case 'circle': assert.ok(fp.r > 0 && Number.isFinite(fp.r), type); break;
      case 'ellipse': assert.ok(fp.rx > 0 && fp.rz > 0, type); break;
      case 'rect': assert.ok(fp.w > 0 && fp.d > 0 && Number.isFinite(fp.w) && Number.isFinite(fp.d), type); break;
      case 'path': assert.deepEqual(fp.points, [], type); break;
    }
  }
  assert.equal(getObjectFootprint(make(ObjectType.CABLE_RAMP, { customWidth: 1.0 })).kind, 'rect');
  assert.deepEqual(getObjectFootprint(make(ObjectType.CABLE_RAMP, { customWidth: 1.0 })), { kind: 'rect', w: 1.8, d: 0.5 });
  assert.deepEqual(getObjectFootprint(make(ObjectType.ZONE, { shape: 'round', customWidth: 4, customDepth: 2 })), { kind: 'ellipse', rx: 2, rz: 1 });
});

test('seating summary skips standby and chairless tables and honours overrides', () => {
  const objects = [
    make(ObjectType.ROUND_TABLE, { label: '1' }), // size 6 → 10 seats
    make(ObjectType.ROUND_TABLE, { label: '2', seatCount: 8, childSeats: 2, vegetarianSeats: 1 }),
    make(ObjectType.ROUND_TABLE, { standby: true }),
    make(ObjectType.RECT_TABLE, { chairLayout: 'none', label: '禮品桌' }),
    make(ObjectType.RECT_TABLE, { chairLayout: 'front' }), // 3 seats
    make(ObjectType.COCKTAIL_TABLE),
  ];
  const summary = summarizeSeating(objects);
  assert.deepEqual(summary, { tables: 3, standbyTables: 1, seats: 21, childSeats: 2, vegetarianSeats: 1 });
  assert.equal(formatSeatingSummary(summary), '共 3 桌＋備 1 桌・座位 21（兒童椅 2）・素食 1');
  assert.ok(buildFloorPlanSvg({ hall, objects }).includes('共 3 桌＋備 1 桌・座位 21（兒童椅 2）・素食 1'));

  assert.equal(formatSeatingSummary(summarizeSeating([])), '');
  assert.equal(formatSeatingSummary(summarizeSeating([make(ObjectType.ROUND_TABLE, { standby: true })])), '備 1 桌');
});

test('power summary groups generators by capacity and counts outlets by voltage', () => {
  const objects = [
    make(ObjectType.GENERATOR, { powerKva: 25 }),
    make(ObjectType.POWER_OUTLET),
    make(ObjectType.POWER_OUTLET, { voltage: '110V' }),
    make(ObjectType.POWER_OUTLET, { voltage: '220V' }),
  ];
  assert.equal(formatPowerSummary(objects), '發電機 25 kVA × 1・110V 電源點 × 2・220V 電源點 × 1');
  assert.equal(formatPowerSummary([make(ObjectType.STAGE)]), '');
});

test('legend lists child and vegetarian markers only when the plan uses them', () => {
  const plain = buildFloorPlanSvg({ hall, objects: [make(ObjectType.ROUND_TABLE, { label: '1' })] });
  assert.ok(plain.includes('data-legend="table"'));
  assert.ok(!plain.includes('data-legend="child"'));
  assert.ok(!plain.includes('data-legend="vegetarian"'));
  assert.ok(!plain.includes('data-legend="standby"'));
  assert.ok(!plain.includes('data-legend="door"'));

  const rich = buildFloorPlanSvg({
    hall,
    objects: [
      make(ObjectType.ROUND_TABLE, { childSeats: 1, vegetarianSeats: 2 }),
      make(ObjectType.ROUND_TABLE, { standby: true }),
      make(ObjectType.DOOR),
    ],
  });
  for (const key of ['table', 'standby', 'child', 'vegetarian', 'door']) assert.ok(rich.includes(`data-legend="${key}"`), key);

  const hidden = buildFloorPlanSvg({ hall, objects: [make(ObjectType.ROUND_TABLE, { childSeats: 1 })] }, { showLegend: false });
  assert.ok(!hidden.includes('id="legend"') && !hidden.includes('data-legend='));
});

test('user text is escaped and the document stays well-formed', () => {
  const nasty = `<&"'>`;
  const svg = buildFloorPlanSvg(
    {
      hall: { ...hall, planInfo: { title: nasty, venue: `A & B <hall>`, date: '2026/10/10', version: '第五版', notes: `line "one"\n<two>` } },
      objects: [
        make(ObjectType.ROUND_TABLE, { id: `t"<&`, label: nasty, note: `5 < 6 & "ok"` }),
        make(ObjectType.ZONE, { label: nasty, note: nasty }),
        make(ObjectType.CABLE_RUN, { label: nasty, points: [{ x: 0, z: 0 }, { x: 3, z: 0 }] }),
        make(ObjectType.DIMENSION, { label: nasty, points: [{ x: 0, z: 1 }, { x: 2, z: 1 }] }),
      ],
    },
    { title: nasty },
  );
  assert.ok(!svg.includes(`<&`) && !svg.includes(`&"`) && !svg.includes(`"'>`));
  assert.ok(svg.includes('&lt;&amp;&quot;&apos;&gt;'));
  assertWellFormed(svg);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('第五版'));
});

test('cable runs print their total length and paths survive rotation', () => {
  const run = make(ObjectType.CABLE_RUN, {
    label: '主線',
    position: { x: 1, y: 0, z: 1 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    points: [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 4 }],
  });
  const svg = buildFloorPlanSvg({ hall, objects: [run] });
  assert.ok(svg.includes('主線 7.0 m'));
  // local (3, 0) → world (1 + 3·cos90°, 1 − 3·sin90°) = (1, −2): x = 40 px, y = −80 px in plan units
  assert.ok(/polyline points="40,40 40,-80 /.test(svg), 'rotated vertices');
  const bounds = getObjectBounds(run);
  assert.ok(Math.abs(bounds.minZ + 2) < 1e-9 && Math.abs(bounds.maxX - 5) < 1e-9);
});

test('an object outside the hall extends the sheet', () => {
  const inside = [make(ObjectType.ROUND_TABLE)];
  const base = viewBoxOf(buildFloorPlanSvg({ hall, objects: inside }));
  const east = viewBoxOf(buildFloorPlanSvg({ hall, objects: [...inside, make(ObjectType.KIOSK, { position: { x: 25, y: 0, z: 0 } })] }));
  const north = viewBoxOf(buildFloorPlanSvg({ hall, objects: [...inside, make(ObjectType.KIOSK, { position: { x: 0, y: 0, z: -25 } })] }));
  assert.ok(east.width > base.width, 'wider when something sits east of the hall');
  assert.equal(east.height, base.height);
  assert.ok(north.height > base.height, 'taller when something sits north of the hall');
  assert.equal(north.width, base.width);
});

test('output is deterministic and carries the title block fallbacks', () => {
  const input = { hall, objects: [make(ObjectType.STAGE, { position: { x: 0, y: 0, z: -12 } })] };
  const first = buildFloorPlanSvg(input, { title: '場景名稱', showGrid: true });
  assert.equal(first, buildFloorPlanSvg(input, { title: '場景名稱', showGrid: true }));
  assert.ok(first.includes('>場景名稱<'));
  assert.ok(first.includes('id="grid"'));
  assert.ok(buildFloorPlanSvg(input).includes('>宴會平面圖<'));
  assert.ok(!buildFloorPlanSvg(input).includes('id="grid"'));
  assert.ok(buildFloorPlanSvg({ hall: { ...hall, planInfo: { title: '婚宴' } }, objects: [] }, { title: '場景名稱' }).includes('>婚宴<'));
  assert.ok(first.includes('600×400cm'), 'stage size text');
});

const L_OUTLINE = [{ x: -10, z: -15 }, { x: 10, z: -15 }, { x: 10, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 15 }, { x: -10, z: 15 }];
const lHall: HallConfig = { ...hall, outline: L_OUTLINE };

/** Wall-length labels: text rotated along the wall, e.g. `<text … transform="rotate(-90 x y)">15 m</text>`. */
const wallLabels = (svg: string) =>
  [...svg.matchAll(/<text [^>]*transform="rotate\((-?[\d.]+) (-?[\d.]+) (-?[\d.]+)\)"[^>]*>([\d.]+) m<\/text>/g)]
    .map(match => ({ angle: Number(match[1]), x: Number(match[2]), y: Number(match[3]), text: match[4] }));

test('an L-shaped hall is drawn as a polygon with one length label per wall', () => {
  const svg = buildFloorPlanSvg({ hall: lHall, objects: [] });
  // 40 px per meter, plan space (world origin at 0,0)
  assert.ok(svg.includes('<path id="hall-walls" d="M-400 -600L400 -600L400 0L0 0L0 600L-400 600Z"'), 'six wall corners');
  assert.ok(svg.includes('<path id="hall-floor" d="M-400 -600L400 -600L400 0L0 0L0 600L-400 600Z"'), 'floor follows the outline');
  assert.ok(!/<rect[^>]*stroke-width="6"/.test(svg), 'no rectangular wall box');

  const labels = wallLabels(svg);
  assert.deepEqual(labels.map(label => label.text), ['20', '15', '10', '15', '10', '30']);
  for (const label of labels) assert.ok(label.angle >= -90 && label.angle <= 90, `upright label ${label.text} (${label.angle}°)`);
  // top wall (z = −15 m): label centred above it, outside the room, parallel to the wall
  assert.deepEqual(labels[0], { angle: 0, x: 0, y: -614, text: '20' });
  // right wall (x = 10 m, upper part): label to its right, rotated along the wall
  assert.ok(Math.abs(labels[1].x - 414) < 1e-6 && Math.abs(Math.abs(labels[1].angle) - 90) < 1e-6);
  // left wall runs bottom-to-top: still upright, label outside (to the left)
  assert.ok(Math.abs(labels[5].x + 414) < 1e-6 && Math.abs(Math.abs(labels[5].angle) - 90) < 1e-6);
  assertWellFormed(svg);
});

test('wall labels stay outside the room whichever way the outline winds', () => {
  const reversed = buildFloorPlanSvg({ hall: { ...hall, outline: [...L_OUTLINE].reverse() }, objects: [] });
  const labels = wallLabels(reversed);
  assert.equal(labels.length, 6);
  assert.ok(labels.some(label => label.text === '30' && Math.abs(label.x + 414) < 1e-6), 'long left wall labelled to the left');
  assert.ok(labels.some(label => label.text === '20' && Math.abs(label.y + 614) < 1e-6), 'top wall labelled above');
});

test('title block reports the polygon area and wall count', () => {
  const l = buildFloorPlanSvg({ hall: lHall, objects: [] });
  assert.ok(l.includes('廳房外框：20 × 30 m（6 邊）・面積 450 m²'));
  assert.ok(!l.includes('廳房尺寸'));

  const pentagon = buildFloorPlanSvg({ hall: { ...hall, outline: [{ x: 2, z: -5 }, { x: 20, z: -5 }, { x: 20, z: 5 }, { x: 8, z: 5 }, { x: 2, z: 0 }] }, objects: [] });
  assert.ok(pentagon.includes('廳房外框：18 × 10 m（5 邊）・面積 165 m²'));
});

test('an off-centre outline still fits inside the sheet', () => {
  const outline = [{ x: 2, z: -5 }, { x: 20, z: -5 }, { x: 20, z: 5 }, { x: 8, z: 5 }, { x: 2, z: 0 }];
  const svg = buildFloorPlanSvg({ hall: { ...hall, width: 18, length: 10, outline }, objects: [make(ObjectType.KIOSK, { position: { x: 12, y: 0, z: 0 } })] });
  const { width, height } = viewBoxOf(svg);
  const shift = /<g id="plan" transform="translate\((-?[\d.]+) (-?[\d.]+)\)"/.exec(svg);
  assert.ok(shift, 'plan group');
  const [tx, ty] = [Number(shift[1]), Number(shift[2])];
  const d = /<path id="hall-walls" d="([^"]+)"/.exec(svg)![1];
  const corners = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(match => ({ x: Number(match[1]) + tx, y: Number(match[2]) + ty }));
  assert.equal(corners.length, 5);
  for (const corner of corners) {
    assert.ok(corner.x >= 0 && corner.x <= width && corner.y >= 0 && corner.y <= height, `corner ${corner.x},${corner.y} inside ${width}×${height}`);
  }
  // wall labels (up to 14 px outside the wall) stay on the sheet as well
  for (const label of wallLabels(svg)) assert.ok(label.x + tx > 10 && label.x + tx < width - 10 && label.y + ty > 10 && label.y + ty < height - 10);
});

test('a rectangular hall keeps its width and length labels and reports its floor area', () => {
  const svg = buildFloorPlanSvg({ hall, objects: [] });
  assert.ok(svg.includes('>20 m</text>') && svg.includes('>30 m</text>'));
  assert.ok(/transform="translate\(-\d+ 0\) rotate\(-90\)"[^>]*>30 m</.test(svg), 'length label on the left, reading bottom-up');
  assert.equal(wallLabels(svg).length, 0, 'no per-wall labels on a rectangle');
  assert.ok(svg.includes('廳房尺寸：20 × 30 m・面積 600 m²'));
  assert.ok(svg.includes('<path id="hall-walls" d="M-400 -600L400 -600L400 600L-400 600Z"'));

  // a 4-corner outline that is just the box is still a rectangle
  const boxOutline = buildFloorPlanSvg({ hall: { ...hall, outline: [{ x: -10, z: -15 }, { x: 10, z: -15 }, { x: 10, z: 15 }, { x: -10, z: 15 }] }, objects: [] });
  assert.ok(boxOutline.includes('廳房尺寸：20 × 30 m・面積 600 m²'));
});

test('a door keeps its wall gap on a slanted wall', () => {
  const slanted: HallConfig = { ...hall, outline: [{ x: -10, z: -15 }, { x: 10, z: -15 }, { x: 10, z: 5 }, { x: 0, z: 15 }, { x: -10, z: 15 }] };
  // wall (10,5)→(0,15): inward normal (−1,−1)/√2 → +Z of the door points that way: rotation.y = atan2(−1, −1) = −3π/4
  const door = make(ObjectType.DOOR, { position: { x: 5, y: 0, z: 10 }, rotation: { x: 0, y: -(3 * Math.PI) / 4, z: 0 } });
  const svg = buildFloorPlanSvg({ hall: slanted, objects: [door] });
  const symbol = transformOf(svg, door.id);
  const gap = /<g transform="translate\((-?[\d.]+) (-?[\d.]+)\) rotate\((-?[\d.]+)\)"><rect [^>]*fill="#ffffff"/.exec(svg);
  assert.ok(gap, 'wall cut for the door');
  assert.ok(Math.abs(Number(gap[1]) - symbol.tx) < 1e-6 && Math.abs(Number(gap[2]) - symbol.ty) < 1e-6);
  assert.ok(Math.abs(Number(gap[3]) * Math.PI / 180 - symbol.angle) < 1e-6, 'gap rotated with the door, along the wall');
});

const point = (system: BanquetObject['system'], label: string, x = 0, z = 0, overrides: Partial<BanquetObject> = {}) =>
  make(ObjectType.DEVICE_POINT, { system, label, position: { x, y: 0, z }, ...overrides });

test('a partition wall is drawn with its thickness and only listed in the legend when present', () => {
  const wall = make(ObjectType.WALL, { customWidth: 0.2, points: [{ x: -5, z: 0 }, { x: 5, z: 0 }] });
  const svg = buildFloorPlanSvg({ hall, objects: [wall] });
  assert.ok(new RegExp(`data-id="${wall.id}" data-type="WALL"><polyline points="-200,0 200,0"[^>]*stroke-width="8"[^>]*stroke-linejoin="miter"`).test(svg), '0.2 m = 8 px band');
  assert.ok(svg.includes('data-legend="partition"') && svg.includes('隔間牆'));
  assert.ok(!buildFloorPlanSvg({ hall, objects: [make(ObjectType.ROUND_TABLE)] }).includes('data-legend="partition"'));

  assert.ok(/data-type="WALL"><polyline [^>]*stroke-width="4.8"/.test(buildFloorPlanSvg({ hall, objects: [make(ObjectType.WALL, { points: [{ x: 0, z: 0 }, { x: 3, z: 0 }] })] })), 'default 0.12 m');
  assert.ok(/data-type="WALL"><polyline [^>]*stroke-width="2"/.test(buildFloorPlanSvg({ hall, objects: [make(ObjectType.WALL, { customWidth: 0.01, points: [{ x: 0, z: 0 }, { x: 3, z: 0 }] })] })), 'never thinner than 2 px');
  assert.deepEqual(getObjectFootprint(wall), { kind: 'path', points: wall.points });
});

test('a closed partition loop is one closed path and rotation moves it like other paths', () => {
  const loop = make(ObjectType.WALL, {
    position: { x: 1, y: 0, z: 1 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    points: [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 2 }, { x: 0, z: 0 }],
  });
  const svg = buildFloorPlanSvg({ hall, objects: [loop] });
  // local (3,0) → world (1, −2); local (3,2) → world (1 + 2, −2) = (3, −2)
  assert.ok(svg.includes('data-type="WALL"><path d="M40 40L40 -80L120 -80Z"'), 'closed path without the repeated first vertex');
});

test('partition walls are painted before furniture and before door cuts', () => {
  const wall = make(ObjectType.WALL, { points: [{ x: -5, z: 0 }, { x: 5, z: 0 }] });
  const door = make(ObjectType.DOOR, { position: { x: 0, y: 0, z: 0 } });
  const table = make(ObjectType.ROUND_TABLE, { position: { x: 0, y: 0, z: 3 } });
  const svg = buildFloorPlanSvg({ hall, objects: [table, door, wall] });
  const wallAt = svg.indexOf('data-type="WALL"');
  const cutAt = svg.indexOf('y="-8" width=');
  assert.ok(wallAt > 0 && cutAt > wallAt, 'door cut drawn after the partition');
  assert.ok(wallAt < svg.indexOf('data-type="ROUND_TABLE"'), 'partition under the furniture');
});

test('device points draw their system symbol and upright code; the filter drops other systems', () => {
  const objects = [
    make(ObjectType.ROUND_TABLE, { label: '7' }),
    point('network', 'MN-01', 1, 2, { rotation: { x: 0, y: 1, z: 0 } }),
    point('wifi', 'AP-01', 3, 2),
    point('camera', 'CAM-1', 5, 2),
  ];
  const all = buildFloorPlanSvg({ hall, objects });
  assert.ok(all.includes('<g transform="translate(40 80)"><rect x="-4.5" y="-4.5" width="9" height="9" fill="#1d4ed8"'), 'network = blue square at the point');
  const code = /<text ([^>]*)>MN-01<\/text>/.exec(all);
  assert.ok(code, 'code printed');
  assert.ok(!code[1].includes('transform'), 'code is never rotated with the point');
  assert.ok(code[1].includes('fill="#1d4ed8"'));
  for (const key of ['network', 'wifi', 'camera']) assert.ok(all.includes(`data-legend="device-${key}"`), key);
  assert.ok(all.includes('網路點（1）') && all.includes('無線 AP（1）'));
  assert.ok(all.includes('點位 3：網路點 1・無線 AP 1・監控攝影機 1'));

  const onlyWifi = buildFloorPlanSvg({ hall, objects }, { deviceSystems: ['wifi'] });
  assert.ok(onlyWifi.includes('>AP-01<') && !onlyWifi.includes('>MN-01<') && !onlyWifi.includes('>CAM-1<'));
  assert.ok(!onlyWifi.includes('fill="#1d4ed8"') && !onlyWifi.includes('data-legend="device-network"') && !onlyWifi.includes('data-legend="device-camera"'));
  assert.ok(onlyWifi.includes('data-legend="device-wifi"'));
  assert.ok(onlyWifi.includes('點位 1：無線 AP 1') && !onlyWifi.includes('網路點 1'));
  assert.ok(onlyWifi.includes('>7<'), 'other objects are unaffected by the filter');

  const none = buildFloorPlanSvg({ hall, objects }, { deviceSystems: [] });
  assert.ok(!none.includes('點位') && !none.includes('device-'));
  assert.ok(none.includes('>7<'));
});

test('device point notes stay out of the notes column', () => {
  const svg = buildFloorPlanSvg({
    hall,
    objects: [
      make(ObjectType.ROUND_TABLE, { label: '3', note: '13:30 撤離' }),
      point('network', 'MN-02', 0, 0, { note: '機房端 RJ45 備註' }),
    ],
  });
  assert.ok(svg.includes('13:30 撤離'));
  assert.ok(!svg.includes('機房端 RJ45 備註'));
});

test('device point CSV sorts by system then natural code and quotes awkward fields', () => {
  const csv = buildDevicePointCsv([
    point('wifi', 'AP-1'),
    point('network', 'MN-10'),
    point('network', 'MN-2'),
    make(ObjectType.ROUND_TABLE, { label: 'not a point' }),
    point('network', 'A,"B"', 0, 0, { note: 'line1\nline2' }),
  ]);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], '編號,系統,X (m),Z (m),高度 (m),備註');
  // `A` sorts before `MN`; the quoted record spans two physical lines
  assert.ok(csv.includes('"A,""B""",網路點,0,0,0,"line1\nline2"'));
  const codes = csv.split(/\r\n(?=(?:[^"]*"[^"]*")*[^"]*$)/).slice(1).map(row => row.split(',')[0]);
  assert.deepEqual(codes.map(code => code.replace(/^"|"$/g, '')), ['A', 'MN-2', 'MN-10', 'AP-1']);
  assert.ok(!csv.includes('not a point'));
  assert.equal(buildDevicePointCsv([]), '編號,系統,X (m),Z (m),高度 (m),備註');
});

test('device point CSV reports world coordinates, height and rounding', () => {
  const csv = buildDevicePointCsv([
    point('camera', 'CAM-3', 1.234, -5.678, { position: { x: 1.234, y: 2.456, z: -5.678 }, rotation: { x: 0, y: Math.PI / 2, z: 0 } }),
    point('other', '', -0.001, 0),
  ]);
  const rows = csv.split('\r\n').slice(1);
  assert.equal(rows[0], 'CAM-3,監控攝影機,1.23,-5.68,2.46,');
  assert.equal(rows[1], ',其他點位,0,0,0,', 'no negative zero for a tiny offset');
});
