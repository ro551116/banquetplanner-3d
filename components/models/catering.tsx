import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Highlight, TableClothMaterial, mergeParts } from './shared';
import { SoftBox, createTubeGeometry } from './details';
import { getRectTableClothGeometry } from './cloth';
import type { ObjectModelProps } from './modelProps';

// ---------------------------------------------------------------------------
// Shared helpers (module-level, never disposed)
// ---------------------------------------------------------------------------

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Deterministic pseudo-random 0..1 so layouts never change between renders. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Box geometry positioned in the part's local space; caller owns the result. */
const boxAt = (w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) => {
  const geometry = new THREE.BoxGeometry(w, h, d);
  if (ry) geometry.rotateY(ry);
  return geometry.translate(x, y, z);
};

/** Lathe from (radius, y) pairs; profiles run outer-bottom → lip → inner-bottom so normals face out. */
const lathe = (profile: Array<[number, number]>, segments = 18) =>
  new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);

interface Placement {
  p: [number, number, number];
  /** Euler XYZ (radians). */
  r?: [number, number, number];
  s?: number;
  /** Per-instance tint (multiplies the material colour). When any placement has one, all must. */
  c?: string;
}

/** One instanced draw call for repeated parts (transforms are written once per placements change). */
function InstancedParts({ geometry, material, placements, castShadow = true }: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  placements: Placement[];
  castShadow?: boolean;
}) {
  const invalidate = useThree(state => state.invalidate);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    placements.forEach((placement, index) => {
      dummy.position.set(...placement.p);
      dummy.rotation.set(placement.r?.[0] ?? 0, placement.r?.[1] ?? 0, placement.r?.[2] ?? 0);
      dummy.scale.setScalar(placement.s ?? 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (placement.c) mesh.setColorAt(index, tint.set(placement.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [placements, invalidate]);
  if (placements.length === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, placements.length]} castShadow={castShadow} receiveShadow />;
}

// --- materials ---
const porcelain = new THREE.MeshStandardMaterial({ color: '#fafafa', roughness: 0.22, metalness: 0, side: THREE.DoubleSide });
const stainless = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.3, metalness: 0.85, side: THREE.DoubleSide });
const cutleryMat = new THREE.MeshStandardMaterial({ color: '#e5e7eb', roughness: 0.2, metalness: 0.92 });
const darkPlastic = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.6, metalness: 0.1 });
const rubber = new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.85, metalness: 0.02 });
const clearGlass = new THREE.MeshPhysicalMaterial({
  color: '#e8f4fb', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false,
});
const waterMat = new THREE.MeshPhysicalMaterial({ color: '#9ccbf0', roughness: 0.05, transparent: true, opacity: 0.5, depthWrite: false });
const greenGlass = new THREE.MeshPhysicalMaterial({ color: '#0b2e1d', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
const foilGold = new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.3, metalness: 0.85 });
/** White glass tinted per instance (drinks, spirits). */
const tintedGlass = new THREE.MeshPhysicalMaterial({
  color: '#ffffff', roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.88, side: THREE.DoubleSide,
});
const capMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, metalness: 0.1 });
const iceMat = new THREE.MeshPhysicalMaterial({ color: '#e0f2fe', roughness: 0.15, transparent: true, opacity: 0.72, depthWrite: false });
const brass = new THREE.MeshStandardMaterial({ color: '#c9a050', roughness: 0.25, metalness: 0.95 });

// --- fixed-size geometry ---
const plateGeometry = lathe([[0, 0], [0.07, 0], [0.085, 0.006], [0.13, 0.017], [0.133, 0.019], [0.128, 0.019], [0.085, 0.008], [0, 0.008]], 24);

const pitcherGeometry = mergeParts([
  lathe([[0, 0], [0.052, 0], [0.058, 0.01], [0.062, 0.19], [0.06, 0.2], [0.056, 0.2], [0.054, 0.19], [0.05, 0.01], [0, 0.008]], 18),
  new THREE.TorusGeometry(0.05, 0.007, 6, 12, Math.PI).rotateZ(-Math.PI / 2).translate(0.058, 0.115, 0),
]);
const pitcherWaterGeometry = lathe([[0, 0.01], [0.05, 0.011], [0.0535, 0.16], [0, 0.16]], 18);

const tumblerHeight = 0.09;
/** Glass opening downwards. */
const upturnedGlassGeometry = lathe([[0, 0], [0.026, 0], [0.028, 0.004], [0.036, tumblerHeight], [0.034, tumblerHeight], [0.027, 0.008], [0, 0.007]], 14)
  .rotateX(Math.PI)
  .translate(0, tumblerHeight, 0);
/** Glass opening upwards (bar glassware). */
const tumblerGeometry = lathe([[0, 0], [0.026, 0], [0.028, 0.004], [0.036, tumblerHeight], [0.034, tumblerHeight], [0.027, 0.008], [0, 0.007]], 14);
const highballGeometry = lathe([[0, 0], [0.025, 0], [0.027, 0.004], [0.031, 0.15], [0.029, 0.15], [0.025, 0.009], [0, 0.007]], 14);

const trayWidth = 0.42;
const cutleryTrayGeometry = mergeParts([
  boxAt(trayWidth, 0.006, 0.22, 0, 0.003, 0),
  boxAt(trayWidth, 0.07, 0.006, 0, 0.035, 0.107),
  boxAt(trayWidth, 0.07, 0.006, 0, 0.035, -0.107),
  boxAt(0.006, 0.07, 0.22, trayWidth / 2 - 0.003, 0.035, 0),
  boxAt(0.006, 0.07, 0.22, -trayWidth / 2 + 0.003, 0.035, 0),
  boxAt(0.004, 0.06, 0.2, -0.07, 0.03, 0),
  boxAt(0.004, 0.06, 0.2, 0.07, 0.03, 0),
]);
const cutleryGeometry = (() => {
  const parts: THREE.BufferGeometry[] = [];
  [-0.14, 0, 0.14].forEach((cx, bay) => {
    for (let i = 0; i < 4; i++) {
      const x = cx + (i - 1.5) * 0.026;
      const y = 0.012 + (i % 2) * 0.009;
      const yaw = (hash(bay * 10 + i) - 0.5) * 0.06;
      parts.push(boxAt(0.011, 0.007, 0.17, x, y, 0, yaw));
      parts.push(boxAt(0.022, 0.006, 0.045, x, y, 0.065, yaw));
    }
  });
  return mergeParts(parts);
})();

const rackGeometry = mergeParts([
  boxAt(0.36, 0.012, 0.28, 0, 0.006, 0),
  boxAt(0.36, 0.02, 0.01, 0, 0.01, 0.135),
  boxAt(0.36, 0.02, 0.01, 0, 0.01, -0.135),
  boxAt(0.01, 0.02, 0.28, 0.175, 0.01, 0),
  boxAt(0.01, 0.02, 0.28, -0.175, 0.01, 0),
]);

const napkinGeometry = new THREE.BoxGeometry(0.2, 0.01, 0.2);

// Wine/champagne bottle (neck up) and its gold foil; the foil shares the bottle's local frame.
const wineBottleGeometry = lathe([[0, 0], [0.038, 0], [0.039, 0.01], [0.039, 0.19], [0.03, 0.22], [0.014, 0.25], [0.0125, 0.3], [0, 0.3]], 14);
const wineFoilGeometry = new THREE.CylinderGeometry(0.0155, 0.0155, 0.065, 10).translate(0, 0.2675, 0);
const sodaBottleGeometry = lathe([[0, 0], [0.03, 0], [0.032, 0.012], [0.032, 0.15], [0.026, 0.18], [0.013, 0.2], [0.013, 0.215], [0, 0.215]], 12);
const sodaCapGeometry = new THREE.CylinderGeometry(0.0155, 0.0155, 0.022, 10).translate(0, 0.213, 0);
const spiritBottleGeometry = lathe([[0, 0], [0.04, 0], [0.042, 0.01], [0.042, 0.17], [0.036, 0.195], [0.016, 0.22], [0.015, 0.27], [0, 0.27]], 14);
const spiritCapGeometry = new THREE.CylinderGeometry(0.0175, 0.0175, 0.035, 10).translate(0, 0.255, 0);
const iceGeometry = new THREE.BoxGeometry(0.03, 0.03, 0.03);
const bucketGeometry = lathe([[0, 0], [0.07, 0], [0.095, 0.2], [0.088, 0.2], [0.064, 0.014], [0, 0.014]], 24);

// ---------------------------------------------------------------------------
// ServiceStation (備餐台)
// ---------------------------------------------------------------------------

const STATION_DEPTH = 0.6;
const STATION_HEIGHT = 0.75;
const ON_TOP = STATION_HEIGHT + 0.002;

const stack = (x: number, z: number, count: number, pitch: number, scale: number, seed: number): Placement[] =>
  Array.from({ length: count }, (_, i) => ({
    p: [x + (hash(seed + i) - 0.5) * 0.004, ON_TOP + i * pitch, z + (hash(seed + i + 50) - 0.5) * 0.004],
    s: scale,
  }));

export function ServiceStation({ color, customWidth, tableCloth, selected, isEditMode }: ObjectModelProps) {
  const width = clamp(customWidth ?? 1.8, 1, 4);
  const clothGeometry = useMemo(() => getRectTableClothGeometry(width, STATION_DEPTH, STATION_HEIGHT), [width]);

  const napkinTint = useMemo(() => new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.75).getStyle(), [color]);
  const layout = useMemo(() => {
    const k = clamp(width / 1.8, 0.8, 1.35);
    const plates = [
      ...stack(-0.7 * k, 0.08, 12, 0.016, 1, 1),
      ...stack(-0.43 * k, 0.08, 12, 0.016, 1, 20),
      ...stack(-0.57 * k, -0.17, 10, 0.0115, 0.72, 40),
    ];
    const napkins: Placement[] = Array.from({ length: 6 }, (_, i) => ({
      p: [-0.1 * k, ON_TOP + 0.005 + i * 0.0105, -0.18],
      r: [0, (hash(i + 70) - 0.5) * 0.2, 0],
      c: napkinTint,
    }));
    const pitchers: Placement[] = [
      { p: [0.2 * k, ON_TOP, 0.06], r: [0, 0.6, 0] },
      { p: [0.38 * k, ON_TOP, 0.06], r: [0, 2.4, 0] },
    ];
    const rackX = 0.68 * k;
    const glasses: Placement[] = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) glasses.push({ p: [rackX + (col - 1.5) * 0.085, ON_TOP + 0.012, (row - 1) * 0.085] });
    }
    return { k, plates, napkins, pitchers, glasses, rackX };
  }, [width, napkinTint]);

  return (
    <group>
      {/* Cloth-skirted table to the floor */}
      <mesh geometry={clothGeometry} castShadow receiveShadow>
        <TableClothMaterial color={color} tableCloth={tableCloth ?? 'linen'} />
        {selected && isEditMode && <Highlight />}
      </mesh>

      {/* Plate stacks (dinner ×2, dessert ×1) */}
      <InstancedParts geometry={plateGeometry} material={porcelain} placements={layout.plates} />

      {/* Cutlery tray with cutlery */}
      <group position={[-0.1 * layout.k, ON_TOP, 0.05]}>
        <mesh geometry={cutleryTrayGeometry} material={stainless} castShadow receiveShadow />
        <mesh geometry={cutleryGeometry} material={cutleryMat} castShadow />
      </group>

      {/* Napkin stack */}
      <InstancedParts geometry={napkinGeometry} material={porcelain} placements={layout.napkins} />

      {/* Water pitchers */}
      <InstancedParts geometry={pitcherGeometry} material={clearGlass} placements={layout.pitchers} castShadow={false} />
      <InstancedParts geometry={pitcherWaterGeometry} material={waterMat} placements={layout.pitchers} castShadow={false} />

      {/* Upturned-glass rack */}
      <mesh geometry={rackGeometry} material={darkPlastic} position={[layout.rackX, ON_TOP, 0]} castShadow receiveShadow />
      <InstancedParts geometry={upturnedGlassGeometry} material={clearGlass} placements={layout.glasses} castShadow={false} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// BeverageCart (酒水車)
// ---------------------------------------------------------------------------

const CART_TOP_Y = 0.78;
const CART_LOW_Y = 0.22;
const CART_TRAY_TOP = 0.0075;

const cartTray = (y: number) => [
  boxAt(0.88, 0.015, 0.5, 0, y, 0),
  boxAt(0.88, 0.02, 0.012, 0, y + 0.0135, 0.244),
  boxAt(0.88, 0.02, 0.012, 0, y + 0.0135, -0.244),
  boxAt(0.012, 0.02, 0.5, 0.434, y + 0.0135, 0),
  boxAt(0.012, 0.02, 0.5, -0.434, y + 0.0135, 0),
];

const cartChassisGeometry = (() => {
  const parts: THREE.BufferGeometry[] = [...cartTray(CART_TOP_Y), ...cartTray(CART_LOW_Y)];
  const ball = (x: number, y: number, z: number) => new THREE.SphereGeometry(0.014, 8, 6).translate(x, y, z);
  for (const x of [-0.4, 0.4]) {
    for (const z of [-0.2, 0.2]) {
      const top = x < 0 ? 0.86 : CART_TOP_Y;
      parts.push(createTubeGeometry([x, 0.1, z], [x, top, z], 0.012, 10));
      // caster: swivel plate + fork plates (the wheel itself is a separate rubber mesh)
      parts.push(boxAt(0.05, 0.006, 0.04, x, 0.097, z));
      parts.push(boxAt(0.03, 0.06, 0.004, x, 0.065, z + 0.019), boxAt(0.03, 0.06, 0.004, x, 0.065, z - 0.019));
    }
  }
  // push handle at the -X end: arms bend outwards to a cross bar
  for (const z of [-0.2, 0.2]) {
    parts.push(createTubeGeometry([-0.4, 0.86, z], [-0.47, 0.95, z], 0.012, 10), ball(-0.4, 0.86, z), ball(-0.47, 0.95, z));
  }
  parts.push(createTubeGeometry([-0.47, 0.95, -0.2], [-0.47, 0.95, 0.2], 0.013, 10));
  // lower cross braces
  parts.push(createTubeGeometry([-0.4, 0.45, -0.2], [0.4, 0.45, -0.2], 0.007, 6), createTubeGeometry([-0.4, 0.45, 0.2], [0.4, 0.45, 0.2], 0.007, 6));
  return mergeParts(parts);
})();
const cartWheelGeometry = mergeParts(
  [-0.4, 0.4].flatMap(x => [-0.2, 0.2].map(z => new THREE.CylinderGeometry(0.04, 0.04, 0.03, 16).rotateX(Math.PI / 2).translate(x, 0.04, z))),
);
const cartGripGeometry = new THREE.CylinderGeometry(0.019, 0.019, 0.22, 12).rotateX(Math.PI / 2).translate(-0.47, 0.95, 0);

export function BeverageCart({ color, selected, isEditMode }: ObjectModelProps) {
  const frameColor = color || '#a1a1aa';
  const topY = CART_TOP_Y + CART_TRAY_TOP;
  const lowY = CART_LOW_Y + CART_TRAY_TOP;

  const layout = useMemo(() => {
    const wine: Placement[] = [];
    [[-0.34, 0.1], [-0.22, 0.1], [-0.1, 0.1], [-0.28, -0.1], [-0.16, -0.1], [-0.04, -0.1]].forEach(([x, z], i) => {
      wine.push({ p: [x, topY + 0.012, z], s: 0.93 + hash(i + 3) * 0.06 });
    });
    const bucketX = 0.22;
    const champagne: Placement[] = [
      { p: [bucketX - 0.022, topY + 0.02, 0.012], r: [0.05, 0, 0.14], s: 1.05 },
      { p: [bucketX + 0.026, topY + 0.02, -0.014], r: [-0.06, 0, -0.12], s: 1.05 },
    ];
    const ice: Placement[] = Array.from({ length: 12 }, (_, i) => {
      const angle = hash(i + 11) * Math.PI * 2;
      const radius = 0.012 + hash(i + 31) * 0.05;
      return {
        p: [bucketX + Math.cos(angle) * radius, topY + 0.14 + hash(i + 51) * 0.04, Math.sin(angle) * radius],
        r: [hash(i + 5) * 3, hash(i + 6) * 3, hash(i + 7) * 3],
        s: 0.8 + hash(i + 9) * 0.35,
      };
    });
    const drinkColors = ['#3b1d0f', '#f59e0b', '#84cc16', '#bfdbfe', '#fb923c'];
    const soda: Placement[] = [];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 5; col++) {
        soda.push({ p: [-0.3 + col * 0.15, lowY + 0.002, row === 0 ? 0.1 : -0.1], c: drinkColors[(col + row * 2) % drinkColors.length] });
      }
    }
    return { wine, champagne, bucketX, ice, soda };
  }, [topY, lowY]);

  return (
    <group>
      {/* Stainless frame: two lipped trays, posts, casters' forks, push handle */}
      <mesh geometry={cartChassisGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.85} />
        {selected && isEditMode && <Highlight />}
      </mesh>
      <mesh geometry={cartWheelGeometry} material={rubber} castShadow />
      <mesh geometry={cartGripGeometry} material={rubber} castShadow />

      {/* Top tray: ice bucket with champagne + standing wine bottles */}
      <mesh geometry={bucketGeometry} material={stainless} position={[layout.bucketX, topY, 0]} castShadow receiveShadow />
      <InstancedParts geometry={iceGeometry} material={iceMat} placements={layout.ice} castShadow={false} />
      <InstancedParts geometry={wineBottleGeometry} material={greenGlass} placements={layout.champagne} />
      <InstancedParts geometry={wineFoilGeometry} material={foilGold} placements={layout.champagne} />
      <InstancedParts geometry={wineBottleGeometry} material={greenGlass} placements={layout.wine} />
      <InstancedParts geometry={wineFoilGeometry} material={foilGold} placements={layout.wine} />

      {/* Lower shelf: soft drinks */}
      <InstancedParts geometry={sodaBottleGeometry} material={tintedGlass} placements={layout.soda} />
      <InstancedParts geometry={sodaCapGeometry} material={capMat} placements={layout.soda} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// BarCounter (吧台)
// ---------------------------------------------------------------------------

const BAR_TOP_Y = 1.1;
const BAR_TOP_THICKNESS = 0.05;
const BAR_PANEL_FRONT = 0.26;
const BAR_PANEL_Y0 = 0.1;
const BAR_PANEL_Y1 = BAR_TOP_Y - BAR_TOP_THICKNESS;
const BAR_SHELF_Y = 0.85;

let glowTexture: THREE.DataTexture | undefined;
/** Vertical 0→1 ramp used as an alpha map: bright at the top (v = 1), fading to nothing below. */
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 64;
  const pixels = new Uint8Array(size * 4);
  for (let y = 0; y < size; y++) {
    const value = Math.round(255 * Math.pow(y / (size - 1), 2.2));
    pixels.set([value, value, value, 255], y * 4);
  }
  glowTexture = new THREE.DataTexture(pixels, 1, size);
  glowTexture.magFilter = THREE.LinearFilter;
  glowTexture.minFilter = THREE.LinearFilter;
  glowTexture.needsUpdate = true;
  return glowTexture;
}
const glowMaterial = new THREE.MeshBasicMaterial({
  color: '#ffb066', alphaMap: getGlowTexture(), transparent: true, opacity: 0.6, depthWrite: false,
  blending: THREE.AdditiveBlending, toneMapped: false,
});
const ledMaterial = new THREE.MeshStandardMaterial({
  color: '#fff1dc', emissive: '#ffb870', emissiveIntensity: 2.5, toneMapped: false,
});

export function BarCounter({ color, customWidth, selected, isEditMode }: ObjectModelProps) {
  const width = clamp(customWidth ?? 2.4, 1, 8);
  const panelColor = color || '#3f2a1d';
  const coreColor = useMemo(() => new THREE.Color(panelColor).multiplyScalar(0.72).getStyle(), [panelColor]);
  const slatColor = useMemo(() => new THREE.Color(panelColor).offsetHSL(0, 0, 0.06).getStyle(), [panelColor]);

  // Fluted slats across the guest-side panel.
  const slatGeometry = useMemo(() => {
    const count = Math.max(1, Math.floor((width - 0.1) / 0.07));
    const start = -((count - 1) * 0.07) / 2;
    return mergeParts(Array.from({ length: count }, (_, i) => boxAt(0.04, 0.82, 0.01, start + i * 0.07, 0.59, BAR_PANEL_FRONT + 0.005)));
  }, [width]);
  useEffect(() => () => slatGeometry.dispose(), [slatGeometry]);

  const brackets = useMemo(() => {
    const count = Math.max(2, Math.floor(width / 0.9) + 1);
    const span = width - 0.4;
    return Array.from({ length: count }, (_, i) => -span / 2 + (span * i) / (count - 1));
  }, [width]);

  const layout = useMemo(() => {
    const spiritColors = ['#7c4a1a', '#cfe8f1', '#14532d', '#4a2c14', '#7f1d1d', '#d6c27a', '#e2e8f0'];
    const bottleCount = clamp(Math.floor((width * 0.55) / 0.13), 2, 7);
    const spirits: Placement[] = Array.from({ length: bottleCount }, (_, i) => ({
      p: [-width / 2 + 0.2 + i * 0.13, BAR_SHELF_Y, -0.2],
      s: 0.92 + hash(i + 13) * 0.16,
      c: spiritColors[i % spiritColors.length],
    }));
    const glassCount = clamp(Math.floor(width * 0.15 / 0.1) + 2, 2, 5);
    const tumblers: Placement[] = Array.from({ length: glassCount }, (_, i) => ({
      p: [width / 2 - 0.2 - i * 0.1, BAR_SHELF_Y, -0.17 - (i % 2) * 0.04],
    }));
    const highballs: Placement[] = Array.from({ length: Math.min(3, glassCount) }, (_, i) => ({
      p: [width / 2 - 0.2 - i * 0.1, BAR_SHELF_Y, -0.25],
    }));
    return { spirits, tumblers, highballs };
  }, [width]);

  const railLength = width - 0.12;
  const panelHeight = BAR_PANEL_Y1 - BAR_PANEL_Y0;

  return (
    <group>
      {/* Plinth and solid core (open shelf side faces -Z) */}
      <mesh position={[0, 0.05, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[width - 0.04, 0.1, 0.52]} />
        <meshStandardMaterial color="#1c1917" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.46, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[width - 0.02, 0.72, 0.5]} />
        <meshStandardMaterial color={coreColor} roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.935, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[width - 0.02, 0.23, 0.3]} />
        <meshStandardMaterial color={coreColor} roughness={0.6} metalness={0.05} />
      </mesh>

      {/* Guest-side front panel (selection outline) with fluted slats */}
      <mesh position={[0, BAR_PANEL_Y0 + panelHeight / 2, BAR_PANEL_FRONT - 0.03]} castShadow receiveShadow>
        <boxGeometry args={[width, panelHeight, 0.06]} />
        <meshStandardMaterial color={panelColor} roughness={0.55} metalness={0.1} />
        {selected && isEditMode && <Highlight />}
      </mesh>
      <mesh geometry={slatGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={slatColor} roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Light stone top with a guest-side overhang */}
      <SoftBox size={[width + 0.04, BAR_TOP_THICKNESS, 0.48]} position={[0, BAR_TOP_Y - BAR_TOP_THICKNESS / 2, 0.12]} radius={0.012} color="#e7e5e4" roughness={0.22} metalness={0.05} />

      {/* Warm LED strip under the overhang + soft glow on the panel */}
      <mesh position={[0, BAR_PANEL_Y1 - 0.007, 0.31]} material={ledMaterial}>
        <boxGeometry args={[width - 0.1, 0.008, 0.02]} />
      </mesh>
      <mesh position={[0, BAR_PANEL_Y1 - 0.14, BAR_PANEL_FRONT + 0.012]} material={glowMaterial} raycast={() => null}>
        <planeGeometry args={[width - 0.1, 0.26]} />
      </mesh>

      {/* Brass foot rail with brackets */}
      <mesh position={[0, 0.2, 0.34]} rotation={[0, 0, Math.PI / 2]} material={brass} castShadow>
        <cylinderGeometry args={[0.025, 0.025, railLength, 16]} />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * (railLength / 2), 0.2, 0.34]} material={brass}>
          <sphereGeometry args={[0.025, 12, 8]} />
        </mesh>
      ))}
      {brackets.map(x => (
        <mesh key={x} position={[x, 0.2, 0.3]} rotation={[Math.PI / 2, 0, 0]} material={brass} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.08, 10]} />
        </mesh>
      ))}

      {/* Bartender side: stainless work shelf with spirits and glassware */}
      <mesh position={[0, BAR_SHELF_Y - 0.015, -0.2]} castShadow receiveShadow material={stainless}>
        <boxGeometry args={[width - 0.02, 0.03, 0.2]} />
      </mesh>
      <InstancedParts geometry={spiritBottleGeometry} material={tintedGlass} placements={layout.spirits} />
      <InstancedParts geometry={spiritCapGeometry} material={capMat} placements={layout.spirits} />
      <InstancedParts geometry={tumblerGeometry} material={clearGlass} placements={layout.tumblers} castShadow={false} />
      <InstancedParts geometry={highballGeometry} material={clearGlass} placements={layout.highballs} castShadow={false} />
    </group>
  );
}
