import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SoftBox, createTubeGeometry } from './details';
import { Highlight, TableClothMaterial, chairMetal, chairParts, mergeParts, standRubber, useTextTexture } from './shared';
import type { ChairPlacement } from './shared';
import { getRoundTableClothGeometry } from './cloth';
import type { ObjectModelProps } from './modelProps';

type V3 = [number, number, number];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// ---------------------------------------------------------------------------
// Child high chair (restaurant style, natural beech). Seat faces -Z, back at +Z.
// Shared module-level geometry, never disposed.
// ---------------------------------------------------------------------------

const childChairParts = (() => {
  const wood: THREE.BufferGeometry[] = [];
  const feet: THREE.BufferGeometry[] = [];
  const tube = (a: V3, b: V3, radius: number) => wood.push(createTubeGeometry(a, b, radius, 10));
  const ball = (radius: number, x: number, y: number, z: number) => wood.push(new THREE.SphereGeometry(radius, 10, 8).translate(x, y, z));
  const slab = (w: number, h: number, d: number, x: number, y: number, z: number, radius = 0.006) =>
    wood.push(new RoundedBoxGeometry(w, h, d, 2, radius).translate(x, y, z));

  for (const s of [-1, 1]) {
    // Front leg: splays forward/outward and continues up as the armrest post.
    tube([s * 0.19, 0.012, -0.19], [s * 0.16, 0.72, -0.14], 0.016);
    ball(0.019, s * 0.16, 0.72, -0.14);
    // Rear leg splays backward, then continues as the (slightly reclined) back post.
    tube([s * 0.19, 0.012, 0.24], [s * 0.155, 0.5, 0.15], 0.016);
    tube([s * 0.155, 0.5, 0.15], [s * 0.15, 0.85, 0.2], 0.015);
    ball(0.016, s * 0.155, 0.5, 0.15);
    ball(0.016, s * 0.15, 0.85, 0.2);
    // Armrest and side stretcher.
    tube([s * 0.16, 0.72, -0.14], [s * 0.152, 0.72, 0.181], 0.013);
    tube([s * 0.181, 0.22, -0.175], [s * 0.175, 0.22, 0.2], 0.011);
    // Rubber feet.
    feet.push(new THREE.CylinderGeometry(0.02, 0.021, 0.014, 12).translate(s * 0.19, 0.007, -0.19));
    feet.push(new THREE.CylinderGeometry(0.02, 0.021, 0.014, 12).translate(s * 0.19, 0.007, 0.24));
  }
  // Front safety bar at armrest height and rear stretcher.
  tube([-0.16, 0.72, -0.14], [0.16, 0.72, -0.14], 0.013);
  tube([-0.175, 0.22, 0.2], [0.175, 0.22, 0.2], 0.011);
  // Footrest board.
  slab(0.33, 0.02, 0.06, 0, 0.2, -0.18);
  // Seat plank, back rails and spindles.
  slab(0.3, 0.03, 0.3, 0, 0.505, 0, 0.01);
  slab(0.31, 0.05, 0.022, 0, 0.825, 0.2, 0.008);
  slab(0.3, 0.03, 0.018, 0, 0.66, 0.173, 0.006);
  for (const x of [-0.06, 0, 0.06]) tube([x, 0.52, 0.158], [x, 0.8, 0.197], 0.007);

  const pad = new RoundedBoxGeometry(0.285, 0.036, 0.28, 2, 0.014).translate(0, 0.538, -0.005);
  return { wood: mergeParts(wood), pad, feet: mergeParts(feet) };
})();

const childWoodMaterial = new THREE.MeshStandardMaterial({ color: '#c8a27a', roughness: 0.62, metalness: 0 });
const childPadMaterial = new THREE.MeshStandardMaterial({ color: '#e9e2d3', roughness: 0.9, metalness: 0 });

/** Instanced child high chairs; same placement convention as BanquetChairs. */
export function ChildChairs({ placements }: { placements: ChairPlacement[] }) {
  const invalidate = useThree(state => state.invalidate);
  const wood = useRef<THREE.InstancedMesh>(null);
  const pad = useRef<THREE.InstancedMesh>(null);
  const feet = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const transform = new THREE.Object3D();
    const meshes = [wood.current, pad.current, feet.current];
    placements.forEach((placement, index) => {
      transform.position.set(...placement.position);
      transform.rotation.set(0, placement.rotation, 0);
      transform.updateMatrix();
      meshes.forEach(mesh => mesh?.setMatrixAt(index, transform.matrix));
    });
    meshes.forEach(mesh => {
      if (!mesh) return;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
    invalidate();
  }, [placements, invalidate]);
  return (
    <group>
      <instancedMesh ref={wood} args={[childChairParts.wood, childWoodMaterial, placements.length]} castShadow receiveShadow />
      <instancedMesh ref={pad} args={[childChairParts.pad, childPadMaterial, placements.length]} castShadow receiveShadow />
      <instancedMesh ref={feet} args={[childChairParts.feet, standRubber, placements.length]} castShadow receiveShadow />
    </group>
  );
}

function ChildHighChair({ padColor, highlighted }: { padColor: string; highlighted: boolean }) {
  return (
    <group>
      <mesh geometry={childChairParts.wood} material={childWoodMaterial} castShadow receiveShadow>
        {highlighted && <Highlight />}
      </mesh>
      <mesh geometry={childChairParts.pad} castShadow receiveShadow>
        <meshStandardMaterial color={padColor} roughness={0.9} metalness={0} />
      </mesh>
      <mesh geometry={childChairParts.feet} material={standRubber} castShadow receiveShadow />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Single loose chair
// ---------------------------------------------------------------------------

export const ChairModel = ({ chairStyle = 'banquet', color, selected, isEditMode }: ObjectModelProps) => {
  const highlighted = !!selected && !!isEditMode;
  if (chairStyle === 'child') return <ChildHighChair padColor={color} highlighted={highlighted} />;
  return (
    <group>
      <mesh geometry={chairParts.frame} material={chairMetal} castShadow receiveShadow />
      <mesh geometry={chairParts.upholstery} castShadow receiveShadow>
        <meshPhysicalMaterial color={color} roughness={0.85} metalness={0} sheen={0.4} sheenRoughness={0.65} sheenColor="#ffffff" />
        {highlighted && <Highlight />}
      </mesh>
      <mesh geometry={chairParts.feet} material={standRubber} castShadow receiveShadow />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Champagne tower
// ---------------------------------------------------------------------------

const COUPE_HEIGHT = 0.16;
const COUPE_RIM_RADIUS = 0.055;
const COUPE_SPACING = 0.115;
const TABLE_RADIUS = 0.45;
const TABLE_HEIGHT = 0.75;
const TRAY_RADIUS = 0.435;
const TRAY_THICKNESS = 0.012;

const lathe = (profile: [number, number][], segments: number) =>
  new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);

// Double-walled coupe: foot, stem, shallow wide bowl, inner wall back down to the axis.
const coupeGlassGeometry = lathe([
  [0.001, 0], [0.036, 0], [0.037, 0.003], [0.033, 0.006], [0.018, 0.01], [0.007, 0.018],
  [0.0042, 0.03], [0.0042, 0.085], [0.0075, 0.093], [0.0085, 0.099],
  [0.02, 0.104], [0.036, 0.115], [0.047, 0.13], [0.0535, 0.146], [0.055, COUPE_HEIGHT],
  [0.0525, 0.158], [0.0505, 0.146], [0.0445, 0.131], [0.034, 0.118], [0.018, 0.11], [0.001, 0.107],
], 16);
const coupeFillGeometry = lathe([
  [0.001, 0.109], [0.0165, 0.1115], [0.0325, 0.12], [0.0425, 0.132], [0.0485, 0.147], [0.001, 0.147],
], 16);

const coupeGlassMaterial = new THREE.MeshPhysicalMaterial({
  color: '#f4f8ff', transparent: true, opacity: 0.3, roughness: 0.04, metalness: 0,
  clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4,
});
const champagneMaterial = new THREE.MeshStandardMaterial({
  color: '#f0c75e', roughness: 0.15, metalness: 0, emissive: '#8a6200', emissiveIntensity: 0.25, side: THREE.DoubleSide,
});
const trayMaterial = new THREE.MeshStandardMaterial({ color: '#e5e7eb', metalness: 1, roughness: 0.08 });

export const ChampagneTower = ({ color, tableCloth = 'linen', tiers, selected, isEditMode }: ObjectModelProps) => {
  const invalidate = useThree(state => state.invalidate);
  const glasses = useRef<THREE.InstancedMesh>(null);
  const fill = useRef<THREE.InstancedMesh>(null);
  const tierCount = Math.round(clamp(tiers ?? 5, 3, 7));

  const layout = useMemo(() => {
    // Shrink the glasses when the bottom tier would overhang the tray.
    const extent = ((tierCount - 1) / 2) * COUPE_SPACING * Math.SQRT2 + COUPE_RIM_RADIUS;
    const scale = Math.min(1, (TRAY_RADIUS - 0.01) / extent);
    const spacing = COUPE_SPACING * scale;
    const step = COUPE_HEIGHT * scale; // each tier's feet rest on the rims below
    const baseY = TABLE_HEIGHT + TRAY_THICKNESS;
    const items: V3[] = [];
    for (let k = 1; k <= tierCount; k++) {
      const y = baseY + (tierCount - k) * step;
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
        items.push([(i - (k - 1) / 2) * spacing, y, (j - (k - 1) / 2) * spacing]);
      }
    }
    return { items, scale };
  }, [tierCount]);

  const clothGeometry = useMemo(() => getRoundTableClothGeometry(TABLE_RADIUS, TABLE_HEIGHT), []);

  useLayoutEffect(() => {
    const transform = new THREE.Object3D();
    transform.scale.setScalar(layout.scale);
    layout.items.forEach((position, index) => {
      transform.position.set(...position);
      transform.updateMatrix();
      glasses.current?.setMatrixAt(index, transform.matrix);
      fill.current?.setMatrixAt(index, transform.matrix);
    });
    [glasses.current, fill.current].forEach(mesh => {
      if (!mesh) return;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
    invalidate();
  }, [layout, invalidate]);

  return (
    <group>
      <mesh geometry={clothGeometry} castShadow receiveShadow>
        <TableClothMaterial color={color} tableCloth={tableCloth} />
        {selected && isEditMode && <Highlight />}
      </mesh>
      {/* Mirrored tray */}
      <mesh position={[0, TABLE_HEIGHT + TRAY_THICKNESS / 2, 0]} material={trayMaterial} castShadow receiveShadow>
        <cylinderGeometry args={[TRAY_RADIUS, TRAY_RADIUS + 0.005, TRAY_THICKNESS, 56]} />
      </mesh>
      <mesh position={[0, TABLE_HEIGHT + TRAY_THICKNESS, 0]} rotation={[Math.PI / 2, 0, 0]} material={trayMaterial} castShadow>
        <torusGeometry args={[TRAY_RADIUS, 0.005, 8, 56]} />
      </mesh>
      {/* Coupe tower: instanced glass + champagne */}
      <instancedMesh key={`fill-${layout.items.length}`} ref={fill} args={[coupeFillGeometry, champagneMaterial, layout.items.length]} castShadow />
      <instancedMesh key={`glass-${layout.items.length}`} ref={glasses} args={[coupeGlassGeometry, coupeGlassMaterial, layout.items.length]} renderOrder={2} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Easel
// ---------------------------------------------------------------------------

const UP = new THREE.Vector3(0, 1, 0);

function Beam({ from, to, width, depth, material }: { from: V3; to: V3; width: number; depth: number; material: THREE.Material }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    const length = direction.length();
    return {
      length,
      quaternion: new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()),
      position: a.add(b).multiplyScalar(0.5).toArray() as V3,
    };
  }, [from[0], from[1], from[2], to[0], to[1], to[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh position={position} quaternion={quaternion} material={material} castShadow receiveShadow>
      <boxGeometry args={[width, length, depth]} />
    </mesh>
  );
}

const goldFrameMaterial = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.85, roughness: 0.28 });
const foamBoardMaterial = new THREE.MeshStandardMaterial({ color: '#fbfbf9', roughness: 0.8, metalness: 0 });

export const Easel = ({ color, label, customWidth = 0.6, customHeight = 0.9, selected, isEditMode }: ObjectModelProps) => {
  const boardW = Math.max(0.2, customWidth);
  const boardH = Math.max(0.2, customHeight);
  const lean = (10 * Math.PI) / 180;
  const tan = Math.tan(lean);
  const ledgeY = 0.9;
  const frontZ = 0.4;
  const topY = ledgeY + boardH * Math.cos(lean) + 0.14;
  const footX = Math.max(0.3, boardW * 0.55);
  const topX = 0.07;
  const legZ = (y: number) => frontZ - y * tan;
  const legX = (y: number) => footX - (footX - topX) * (y / topY);

  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0 }), [color]);
  useEffect(() => () => wood.dispose(), [wood]);

  const faceW = boardW - 0.044;
  const faceH = boardH - 0.044;
  const text = label?.trim() || 'WELCOME';
  const texture = useTextTexture(text, {
    width: clamp(Math.round(512 * (faceW / faceH)), 128, 1024), height: 512,
    background: '#fcfcfa', color: '#6b4f1d', fontSize: 120, fontWeight: 700,
  });

  const braceY = 0.45;
  const ledgeWidth = Math.max(boardW + 0.04, legX(ledgeY) * 2 + 0.08);
  const pivotZ = legZ(ledgeY) + 0.0155;

  return (
    <group>
      {/* Front A-frame legs (one each side), header and cross brace */}
      {[-1, 1].map(s => (
        <Beam key={s} from={[s * footX, 0, frontZ]} to={[s * topX, topY, legZ(topY)]} width={0.045} depth={0.03} material={wood} />
      ))}
      <mesh position={[0, topY - 0.03, legZ(topY - 0.03)]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[topX * 2 + 0.07, 0.055, 0.045]} />
      </mesh>
      <Beam from={[-legX(braceY), braceY, legZ(braceY)]} to={[legX(braceY), braceY, legZ(braceY)]} width={0.022} depth={0.03} material={wood} />
      {/* Rear leg */}
      <Beam from={[0, topY - 0.1, legZ(topY) - 0.03]} to={[0, 0, -frontZ]} width={0.04} depth={0.03} material={wood} />
      {/* Ledge */}
      <mesh position={[0, ledgeY - 0.015, legZ(ledgeY) + 0.035]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[ledgeWidth, 0.03, 0.07]} />
      </mesh>
      {/* Board leaning back on the legs */}
      <group position={[0, ledgeY, pivotZ]} rotation={[-lean, 0, 0]}>
        <mesh position={[0, boardH / 2, 0.01]} material={foamBoardMaterial} castShadow receiveShadow>
          <boxGeometry args={[boardW - 0.02, boardH - 0.02, 0.016]} />
          {selected && isEditMode && <Highlight />}
        </mesh>
        <mesh position={[0, 0.011, 0.013]} material={goldFrameMaterial} castShadow receiveShadow>
          <boxGeometry args={[boardW, 0.022, 0.026]} />
        </mesh>
        <mesh position={[0, boardH - 0.011, 0.013]} material={goldFrameMaterial} castShadow receiveShadow>
          <boxGeometry args={[boardW, 0.022, 0.026]} />
        </mesh>
        {[-1, 1].map(s => (
          <mesh key={s} position={[s * (boardW / 2 - 0.011), boardH / 2, 0.013]} material={goldFrameMaterial} castShadow receiveShadow>
            <boxGeometry args={[0.022, boardH - 0.044, 0.026]} />
          </mesh>
        ))}
        <mesh position={[0, boardH / 2, 0.0185]} receiveShadow>
          <planeGeometry args={[faceW, faceH]} />
          <meshStandardMaterial map={texture} roughness={0.7} metalness={0} />
        </mesh>
      </group>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Kiosk (instant photo-print station / cocktail machine)
// ---------------------------------------------------------------------------

export const Kiosk = ({ color, label, customWidth = 0.6, customDepth = 0.6, customHeight = 1.7, selected, isEditMode }: ObjectModelProps) => {
  const w = Math.max(0.35, customWidth);
  const d = Math.max(0.3, customDepth);
  const h = Math.max(0.6, customHeight);
  const plinthH = 0.08;
  const headerH = Math.min(0.2, h * 0.14);
  const bodyH = h - plinthH - headerH;

  const signW = w - 0.04;
  const signH = headerH - 0.04;
  const sign = useTextTexture(label?.trim() || '機台', {
    width: 512, height: clamp(Math.round(512 * (signH / signW)), 48, 512),
    background: '#14181f', color: '#f8fafc', fontSize: 400, fontWeight: 700,
  });

  const screenW = w * 0.72;
  const screenH = Math.min(screenW * 0.8, bodyH * 0.34);
  const screenY = plinthH + bodyH * 0.66;
  const slotY = plinthH + bodyH * 0.3;

  return (
    <group>
      <SoftBox size={[w - 0.05, plinthH, d - 0.05]} position={[0, plinthH / 2, 0]} radius={0.01} color="#15171b" roughness={0.7} metalness={0.2} />
      <SoftBox size={[w, bodyH, d]} position={[0, plinthH + bodyH / 2, 0]} radius={0.03} color={color} roughness={0.35} metalness={0.1}>
        {selected && isEditMode && <Highlight />}
      </SoftBox>
      {/* Header sign */}
      <SoftBox size={[w + 0.02, headerH, d + 0.02]} position={[0, h - headerH / 2, 0.01]} radius={0.02} color="#14181f" roughness={0.4} metalness={0.2} />
      <mesh position={[0, h - headerH / 2, d / 2 + 0.0215]}>
        <planeGeometry args={[signW, signH]} />
        <meshStandardMaterial map={sign} emissiveMap={sign} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.4} metalness={0} />
      </mesh>
      {/* Touchscreen */}
      <SoftBox size={[screenW + 0.03, screenH + 0.03, 0.02]} position={[0, screenY, d / 2 + 0.002]} radius={0.01} color="#0f1115" roughness={0.4} metalness={0.3} />
      <mesh position={[0, screenY, d / 2 + 0.0125]}>
        <planeGeometry args={[screenW, screenH]} />
        <meshPhysicalMaterial color="#0b1220" roughness={0.08} metalness={0.3} clearcoat={1} clearcoatRoughness={0.05} emissive="#1d4ed8" emissiveIntensity={0.35} />
      </mesh>
      {/* Print / dispense slot and tray */}
      <SoftBox size={[w * 0.44, 0.035, 0.015]} position={[0, slotY, d / 2 + 0.001]} radius={0.008} color="#0b0c0e" roughness={0.6} metalness={0.2} />
      <SoftBox size={[w * 0.5, 0.015, 0.11]} position={[0, slotY - 0.035, d / 2 + 0.05]} radius={0.006} color="#2b2f36" roughness={0.45} metalness={0.4} />
      {/* Payment terminal and status lamp */}
      <SoftBox size={[0.08, 0.13, 0.03]} position={[w / 2 - 0.09, slotY, d / 2 + 0.01]} radius={0.008} color="#1b1e24" roughness={0.5} metalness={0.3} />
      <mesh position={[-(w / 2 - 0.06), slotY, d / 2 + 0.002]}>
        <circleGeometry args={[0.012, 16]} />
        <meshStandardMaterial color="#052e16" emissive="#22c55e" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
};

/* ---- Table number plate ------------------------------------------------------------------------------ */

const plateBrass = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.85, roughness: 0.3 });
const plateIron = new THREE.MeshStandardMaterial({ color: '#2b2b30', metalness: 0.6, roughness: 0.45 });
const PLATE_PARTS = {
  // Tabletop stand: brass disc foot clearing the charger plate, stem tall enough to clear a centrepiece; card 0.15 × 0.2 m.
  table: {
    base: new THREE.CylinderGeometry(0.04, 0.045, 0.008, 24).translate(0, 0.012, 0),
    stem: new THREE.CylinderGeometry(0.004, 0.004, 0.28, 8).translate(0, 0.156, 0),
    clip: new THREE.BoxGeometry(0.034, 0.012, 0.012).translate(0, 0.296, 0),
    card: new THREE.BoxGeometry(0.15, 0.2, 0.004).translate(0, 0.4, 0),
  },
  // Floor sign: weighted disc, pole, 0.32 × 0.4 m board at eye level.
  floor: {
    base: new THREE.CylinderGeometry(0.17, 0.18, 0.02, 32).translate(0, 0.01, 0),
    stem: new THREE.CylinderGeometry(0.012, 0.012, 0.95, 12).translate(0, 0.49, 0),
    clip: new THREE.BoxGeometry(0.34, 0.02, 0.03).translate(0, 0.965, 0),
    card: new THREE.BoxGeometry(0.32, 0.4, 0.012).translate(0, 1.175, 0),
  },
};

/** Number plate showing the object's label on both faces; tabletop stand by default, or a floor sign. */
export const TableNumber = ({ label, plateStyle = 'table', color, selected, isEditMode }: ObjectModelProps) => {
  const parts = PLATE_PARTS[plateStyle === 'floor' ? 'floor' : 'table'];
  const ink = useMemo(() => new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }).l < 0.5 ? '#ffffff' : '#1f2937', [color]);
  const texture = useTextTexture(label?.trim() || '桌號', { width: 240, height: 320, background: color, color: ink, fontSize: 170, fontWeight: 700 });
  return (
    <group>
      <mesh geometry={parts.base} material={plateStyle === 'floor' ? plateIron : plateBrass} castShadow receiveShadow />
      <mesh geometry={parts.stem} material={plateBrass} castShadow />
      <mesh geometry={parts.clip} material={plateBrass} castShadow />
      <mesh geometry={parts.card} castShadow>
        <meshStandardMaterial map={texture} roughness={0.55} />
        {selected && isEditMode && <Highlight />}
      </mesh>
    </group>
  );
};
