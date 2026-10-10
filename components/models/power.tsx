import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Highlight, mergeParts, useTextTexture } from './shared';
import { GrilleMaterial, SoftBox } from './details';
import type { ObjectModelProps } from './modelProps';
import type { PathPoint } from '../../types';

// ---------------------------------------------------------------------------
// Shared helpers & materials (module-level, never disposed)
// ---------------------------------------------------------------------------

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Box geometry positioned in the part's local space; caller owns the result. */
const boxAt = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) => {
  const geometry = new THREE.BoxGeometry(w, h, d);
  if (rx) geometry.rotateX(rx);
  return geometry.translate(x, y, z);
};

const blackPlastic = new THREE.MeshStandardMaterial({ color: '#16181d', roughness: 0.65, metalness: 0.15 });
const darkSteel = new THREE.MeshStandardMaterial({ color: '#2f3640', roughness: 0.5, metalness: 0.65 });
const chromeMat = new THREE.MeshStandardMaterial({ color: '#d1d5db', roughness: 0.22, metalness: 0.9 });
const rubberMat = new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.85, metalness: 0.02 });
const smokedGlass = new THREE.MeshPhysicalMaterial({
  color: '#0b1220', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false,
});
const socketGrey = new THREE.MeshStandardMaterial({ color: '#e5e7eb', roughness: 0.45, metalness: 0.05 });
const warnYellow = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.5, metalness: 0.05 });

/** Colour-coded single-pole connector colours: L1, L2, L3, N, PE. */
const CAMLOCK_COLORS = ['#dc2626', '#eab308', '#2563eb', '#18181b', '#16a34a'] as const;
const camlockMaterials = CAMLOCK_COLORS.map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 }));
const camlockBody = new THREE.CylinderGeometry(0.016, 0.016, 0.05, 14);
const camlockCollar = new THREE.CylinderGeometry(0.021, 0.021, 0.012, 14);

const textMaterialProps = { roughness: 0.4, metalness: 0.15 } as const;

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

const SKID_HEIGHT = 0.12;

function buildGeneratorParts(width: number, depth: number, height: number) {
  const y0 = SKID_HEIGHT + 0.08;
  const y1 = height - 0.08;
  const dark: THREE.BufferGeometry[] = [];
  const chrome: THREE.BufferGeometry[] = [];
  const slats: THREE.BufferGeometry[] = [];

  const outline = (x0: number, x1: number, dir: 1 | -1) => {
    const line = 0.006;
    const layer = 0.004;
    const z = dir * (depth / 2 + 0.001);
    const w = x1 - x0;
    const h = y1 - y0;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    dark.push(boxAt(w, line, layer, cx, y0, z), boxAt(w, line, layer, cx, y1, z), boxAt(line, h, layer, x0, cy, z), boxAt(line, h, layer, x1, cy, z));
  };
  const handle = (x: number, dir: 1 | -1) => {
    chrome.push(boxAt(0.022, 0.13, 0.018, x, (y0 + y1) / 2 - 0.05, dir * (depth / 2 + 0.012)));
  };
  const louvre = (x0: number, x1: number, dir: 1 | -1) => {
    const w = (x1 - x0) * 0.78;
    const cx = (x0 + x1) / 2;
    dark.push(boxAt(w + 0.03, 0.2, 0.006, cx, y1 - 0.12, dir * (depth / 2 + 0.002)));
    for (let i = 0; i < 6; i++) slats.push(boxAt(w, 0.01, 0.034, cx, y1 - 0.05 - i * 0.03, dir * (depth / 2 + 0.012), 0.6 * dir));
  };

  // Front (+Z): two service doors flanking the control window.
  outline(-0.47 * width, -0.17 * width, 1);
  outline(0.17 * width, 0.47 * width, 1);
  handle(-0.19 * width, 1);
  handle(0.19 * width, 1);
  louvre(-0.47 * width, -0.17 * width, 1);
  // Rear (-Z): two doors meeting in the middle, louvred at the top.
  outline(-0.47 * width, -0.005 * width, -1);
  outline(0.005 * width, 0.47 * width, -1);
  handle(-0.03 * width, -1);
  handle(0.03 * width, -1);
  louvre(-0.47 * width, -0.03 * width, -1);
  louvre(0.03 * width, 0.47 * width, -1);

  // Forklift pockets in the skid on both long sides.
  for (const dir of [1, -1] as const) {
    for (const sx of [-1, 1]) {
      dark.push(boxAt(0.26, 0.07, 0.01, sx * 0.3 * width, SKID_HEIGHT / 2, dir * (depth / 2 + 0.03)));
    }
  }

  return { dark: mergeParts(dark), chrome: mergeParts(chrome), slats: mergeParts(slats) };
}

export function Generator({ color, customWidth, customDepth, customHeight, powerKva, selected, isEditMode }: ObjectModelProps) {
  const width = clamp(customWidth ?? 2.2, 1.2, 6);
  const depth = clamp(customDepth ?? 0.95, 0.6, 2);
  const height = clamp(customHeight ?? 1.2, 0.8, 2.4);
  const kva = powerKva ?? 25;
  const bodyColor = color || '#4b5563';
  const bodyHeight = height - SKID_HEIGHT;
  const bodyCenterY = SKID_HEIGHT + bodyHeight / 2;

  const parts = useMemo(() => buildGeneratorParts(width, depth, height), [width, depth, height]);
  useEffect(() => () => {
    parts.dark.dispose();
    parts.chrome.dispose();
    parts.slats.dispose();
  }, [parts]);

  const slatColor = useMemo(() => new THREE.Color(bodyColor).multiplyScalar(0.8).getStyle(), [bodyColor]);
  const plateTexture = useTextTexture(`${kva} kVA`, { width: 256, height: 128, background: '#d1d5db', color: '#111827', fontSize: 72, fontWeight: 700 });
  const displayTexture = useTextTexture('READY\n60 Hz', { width: 256, height: 128, background: '#06281e', color: '#4ade80', fontSize: 64, fontWeight: 600 });

  const plateWidth = Math.min(0.4, 0.17 * width);
  const panelWidth = 0.22 * width;
  const panelHeight = 0.3;
  const panelY = SKID_HEIGHT + bodyHeight * 0.58;
  const outputY = SKID_HEIGHT + bodyHeight * 0.2;
  const frontZ = depth / 2;

  return (
    <group>
      {/* Steel skid base (forklift pockets are the dark openings on the long sides) */}
      <mesh position={[0, SKID_HEIGHT / 2, 0]} castShadow receiveShadow material={darkSteel}>
        <boxGeometry args={[width + 0.06, SKID_HEIGHT, depth + 0.06]} />
      </mesh>

      {/* Sound-attenuated enclosure */}
      <SoftBox size={[width, bodyHeight, depth]} position={[0, bodyCenterY, 0]} radius={0.025} color={bodyColor} roughness={0.55} metalness={0.25}>
        {selected && isEditMode && <Highlight />}
      </SoftBox>

      {/* Door seams, pockets, louvre backings / handles / louvre slats (merged) */}
      <mesh geometry={parts.dark} material={blackPlastic} />
      <mesh geometry={parts.chrome} material={chromeMat} castShadow />
      <mesh geometry={parts.slats} castShadow>
        <meshStandardMaterial color={slatColor} roughness={0.5} metalness={0.3} />
      </mesh>

      {/* Intake (-X) and outlet (+X) grilles with bezels */}
      {[-1, 1].map(side => (
        <group key={side} position={[side * (width / 2), bodyCenterY, 0]} rotation={[0, side * Math.PI / 2, 0]}>
          <mesh position={[0, 0, 0.004]} receiveShadow material={blackPlastic}>
            <boxGeometry args={[depth * 0.86, bodyHeight * 0.74, 0.008]} />
          </mesh>
          <mesh position={[0, 0, 0.0085]}>
            <planeGeometry args={[depth * 0.8, bodyHeight * 0.68]} />
            <GrilleMaterial />
          </mesh>
        </group>
      ))}

      {/* Control panel window (front) */}
      <group position={[0, panelY, frontZ]}>
        <mesh position={[0, 0, 0.005]} castShadow material={darkSteel}>
          <boxGeometry args={[panelWidth + 0.04, panelHeight + 0.04, 0.02]} />
        </mesh>
        <mesh position={[0, 0, 0.0085]} material={blackPlastic}>
          <boxGeometry args={[panelWidth, panelHeight, 0.004]} />
        </mesh>
        {/* display */}
        <mesh position={[-panelWidth * 0.2, panelHeight * 0.18, 0.0112]}>
          <planeGeometry args={[panelWidth * 0.42, panelHeight * 0.34]} />
          <meshBasicMaterial map={displayTexture} toneMapped={false} />
        </mesh>
        {/* gauges */}
        {[0.14, 0.36].map(fx => (
          <mesh key={fx} position={[panelWidth * (fx), panelHeight * 0.2, 0.011]} rotation={[Math.PI / 2, 0, 0]} material={socketGrey}>
            <cylinderGeometry args={[0.034, 0.034, 0.004, 20]} />
          </mesh>
        ))}
        {/* start / stop buttons */}
        {([['#16a34a', -0.3], ['#f59e0b', -0.15], ['#dc2626', 0.0]] as const).map(([buttonColor, fx]) => (
          <mesh key={buttonColor} position={[panelWidth * fx, -panelHeight * 0.28, 0.0125]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.008, 12]} />
            <meshStandardMaterial color={buttonColor} roughness={0.35} metalness={0.1} />
          </mesh>
        ))}
        {/* emergency stop mushroom */}
        <mesh position={[panelWidth * 0.36, -panelHeight * 0.26, 0.016]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.026, 0.02, 0.016, 16]} />
          <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.1} />
        </mesh>
        {/* glass */}
        <mesh position={[0, 0, 0.0165]} material={smokedGlass}>
          <planeGeometry args={[panelWidth, panelHeight]} />
        </mesh>
      </group>

      {/* Output camlock panel under the window */}
      <group position={[0, outputY, frontZ]}>
        <mesh position={[0, 0, 0.003]} material={blackPlastic}>
          <boxGeometry args={[0.46, 0.1, 0.008]} />
        </mesh>
        {camlockMaterials.map((material, index) => (
          <group key={index} position={[(index - 2) * 0.085, 0, 0.032]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh geometry={camlockBody} material={material} castShadow />
            <mesh geometry={camlockCollar} material={chromeMat} position={[0, 0.02, 0]} />
          </group>
        ))}
      </group>

      {/* Rating plate (front, right door) */}
      <group position={[0.32 * width, height - 0.28, frontZ]}>
        <mesh position={[0, 0, 0.002]} material={chromeMat}>
          <boxGeometry args={[plateWidth + 0.02, plateWidth * 0.5 + 0.02, 0.004]} />
        </mesh>
        <mesh position={[0, 0, 0.0045]}>
          <planeGeometry args={[plateWidth, plateWidth * 0.5]} />
          <meshStandardMaterial map={plateTexture} {...textMaterialProps} />
        </mesh>
      </group>

      {/* Exhaust stack with rain cap */}
      <group position={[0.32 * width, height, -0.2 * depth]}>
        <mesh position={[0, 0.006, 0]} castShadow material={darkSteel}>
          <cylinderGeometry args={[0.07, 0.07, 0.012, 20]} />
        </mesh>
        <mesh position={[0, 0.25, 0]} castShadow material={darkSteel}>
          <cylinderGeometry args={[0.045, 0.045, 0.5, 18]} />
        </mesh>
        <mesh position={[0, 0.5, -0.01]} rotation={[0.38, 0, 0]} castShadow material={darkSteel}>
          <cylinderGeometry args={[0.062, 0.062, 0.01, 18]} />
        </mesh>
        <mesh position={[0, 0.49, -0.055]} rotation={[0.38, 0, 0]} material={chromeMat}>
          <boxGeometry args={[0.016, 0.02, 0.016]} />
        </mesh>
      </group>

      {/* Lifting eye */}
      <group position={[-0.12 * width, height, 0]}>
        <mesh position={[0, 0.006, 0]} castShadow material={darkSteel}>
          <boxGeometry args={[0.11, 0.012, 0.11]} />
        </mesh>
        <mesh position={[0, 0.06, 0]} castShadow material={chromeMat}>
          <torusGeometry args={[0.045, 0.011, 8, 18]} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Power distribution box
// ---------------------------------------------------------------------------

const DISTRO_LEG_HEIGHT = 0.25;
const DISTRO_W = 0.6;
const DISTRO_D = 0.3;
const DISTRO_H = 0.8;

const distroLegs = mergeParts([
  ...[-1, 1].flatMap(sx => [-1, 1].map(sz => boxAt(0.03, DISTRO_LEG_HEIGHT, 0.03, sx * 0.26, DISTRO_LEG_HEIGHT / 2, sz * 0.11))),
  boxAt(0.52, 0.02, 0.02, 0, 0.1, 0.11),
  boxAt(0.52, 0.02, 0.02, 0, 0.1, -0.11),
  boxAt(0.02, 0.02, 0.22, 0.26, 0.1, 0),
  boxAt(0.02, 0.02, 0.22, -0.26, 0.1, 0),
]);

// Breaker row visible behind the window: 8 black modules with orange toggles.
const BREAKER_COUNT = 8;
const breakerBodies = mergeParts(Array.from({ length: BREAKER_COUNT }, (_, i) => boxAt(0.034, 0.075, 0.03, (i - (BREAKER_COUNT - 1) / 2) * 0.046, 0, 0)));
const breakerToggles = mergeParts(Array.from({ length: BREAKER_COUNT }, (_, i) => boxAt(0.014, 0.022, 0.014, (i - (BREAKER_COUNT - 1) / 2) * 0.046, 0.012, 0.011)));
const breakerToggleMat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.4, metalness: 0.1 });

const socketPlateGeometry = new THREE.BoxGeometry(0.09, 0.09, 0.024);
const socketFaceGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.006, 20);
const socketSlots = mergeParts([
  boxAt(0.004, 0.016, 0.004, -0.009, 0.005, 0),
  boxAt(0.004, 0.016, 0.004, 0.009, 0.005, 0),
  new THREE.CylinderGeometry(0.004, 0.004, 0.004, 8).rotateX(Math.PI / 2).translate(0, -0.014, 0),
]);
/** Same slots lying on an upward-facing face (outlet box top). */
const socketSlotsFlat = socketSlots.clone().rotateX(-Math.PI / 2);

// Triangles point up with their thickness along +Z (door normal).
const warningTriangleOuter = new THREE.CylinderGeometry(0.056, 0.056, 0.004, 3).rotateY(Math.PI).rotateX(Math.PI / 2);
const warningTriangleInner = new THREE.CylinderGeometry(0.044, 0.044, 0.005, 3).rotateY(Math.PI).rotateX(Math.PI / 2);
const warningMark = mergeParts([boxAt(0.007, 0.026, 0.0015, 0, 0.008, 0), boxAt(0.008, 0.008, 0.0015, 0, -0.014, 0)]);

function Socket({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={socketPlateGeometry} material={darkSteel} castShadow />
      <mesh geometry={socketFaceGeometry} material={socketGrey} position={[0, 0, 0.013]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={socketSlots} material={blackPlastic} position={[0, 0, 0.0165]} />
    </group>
  );
}

export function PowerDistro({ color, powerKva, selected, isEditMode }: ObjectModelProps) {
  const bodyColor = color || '#9ca3af';
  const doorColor = useMemo(() => new THREE.Color(bodyColor).offsetHSL(0, 0, 0.05).getStyle(), [bodyColor]);
  const hasRating = powerKva != null;
  const plateTexture = useTextTexture(`${powerKva ?? 0} kVA`, { width: 256, height: 96, background: '#e5e7eb', color: '#111827', fontSize: 64, fontWeight: 700 });

  const baseY = DISTRO_LEG_HEIGHT;
  const frontZ = DISTRO_D / 2;
  const cabinetCenterY = baseY + DISTRO_H / 2;

  return (
    <group>
      <mesh geometry={distroLegs} material={darkSteel} castShadow receiveShadow />

      {/* Cabinet body */}
      <SoftBox size={[DISTRO_W, DISTRO_H, DISTRO_D]} position={[0, cabinetCenterY, 0]} radius={0.015} color={bodyColor} roughness={0.5} metalness={0.45}>
        {selected && isEditMode && <Highlight />}
      </SoftBox>
      {/* Rain hood */}
      <SoftBox size={[DISTRO_W + 0.04, 0.02, DISTRO_D + 0.04]} position={[0, baseY + DISTRO_H + 0.01, 0.01]} radius={0.008} color={bodyColor} roughness={0.5} metalness={0.45} />

      {/* Front door */}
      <group position={[0, baseY, frontZ]}>
        <mesh position={[0, 0.46, 0.004]} castShadow receiveShadow>
          <boxGeometry args={[0.54, 0.64, 0.008]} />
          <meshStandardMaterial color={doorColor} roughness={0.45} metalness={0.45} />
        </mesh>
        {/* door handle + hinge knuckles */}
        <mesh position={[0.235, 0.44, 0.017]} material={chromeMat} castShadow>
          <boxGeometry args={[0.02, 0.1, 0.018]} />
        </mesh>
        {[0.2, 0.46, 0.72].map(y => (
          <mesh key={y} position={[-0.275, y, 0.006]} material={darkSteel}>
            <cylinderGeometry args={[0.007, 0.007, 0.05, 8]} />
          </mesh>
        ))}

        {/* Breaker window: backing, breaker row, frame and glass */}
        <mesh position={[0, 0.58, 0.0085]} material={blackPlastic}>
          <boxGeometry args={[0.44, 0.18, 0.003]} />
        </mesh>
        <group position={[0, 0.58, 0.0235]}>
          <mesh geometry={breakerBodies} material={blackPlastic} castShadow />
          <mesh geometry={breakerToggles} material={breakerToggleMat} />
        </group>
        {[[0, 0.1, 0.46, 0.014], [0, -0.1, 0.46, 0.014], [0.23, 0, 0.014, 0.21], [-0.23, 0, 0.014, 0.21]].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, 0.58 + y, 0.026]} material={darkSteel}>
            <boxGeometry args={[w, h, 0.04]} />
          </mesh>
        ))}
        <mesh position={[0, 0.58, 0.0455]} material={smokedGlass}>
          <planeGeometry args={[0.44, 0.19]} />
        </mesh>

        {/* Warning triangle */}
        <group position={[-0.17, 0.3, 0.01]}>
          <mesh geometry={warningTriangleOuter} material={blackPlastic} />
          <mesh geometry={warningTriangleInner} material={warnYellow} position={[0, 0, 0.0025]} />
          <mesh geometry={warningMark} material={blackPlastic} position={[0, 0, 0.0057]} />
        </group>

        {/* Rating plate */}
        {hasRating && (
          <mesh position={[0.15, 0.3, 0.0085]}>
            <planeGeometry args={[0.2, 0.075]} />
            <meshStandardMaterial map={plateTexture} {...textMaterialProps} />
          </mesh>
        )}

        {/* Input connector bay: colour-coded single-pole connectors (L1 L2 L3 N PE) */}
        <mesh position={[0, 0.065, 0.003]} material={blackPlastic}>
          <boxGeometry args={[0.52, 0.11, 0.006]} />
        </mesh>
        {camlockMaterials.map((material, index) => (
          <group key={index} position={[(index - 2) * 0.1, 0.065, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh geometry={camlockBody} material={material} castShadow />
            <mesh geometry={camlockCollar} material={chromeMat} position={[0, 0.02, 0]} />
          </group>
        ))}
      </group>

      {/* Outlet sockets on both sides */}
      {[-1, 1].flatMap(side => [0.07, -0.07].map((z, index) => (
        <Socket key={`${side}-${index}`} position={[side * (DISTRO_W / 2 + 0.012), baseY + 0.5, z]} rotationY={side * Math.PI / 2} />
      )))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Power outlet drop point
// ---------------------------------------------------------------------------

const OUTLET_W = 0.28;
const OUTLET_D = 0.12;
const OUTLET_H = 0.1;

const outletCoil = (() => {
  const points: THREE.Vector3[] = [new THREE.Vector3(OUTLET_W / 2 - 0.01, 0.04, 0), new THREE.Vector3(OUTLET_W / 2 + 0.01, 0.052, 0)];
  const turns = 6;
  const steps = turns * 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * Math.PI * 2 * turns;
    points.push(new THREE.Vector3(OUTLET_W / 2 + 0.02 + t * 0.2, 0.03 + 0.022 * Math.cos(a), 0.022 * Math.sin(a)));
  }
  points.push(new THREE.Vector3(OUTLET_W / 2 + 0.28, 0.02, 0.012), new THREE.Vector3(OUTLET_W / 2 + 0.34, 0.008, 0.05));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), 200, 0.0045, 6, false);
})();
const outletCoilMat = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.55, metalness: 0.1 });
const outletPlugGeometry = new THREE.BoxGeometry(0.035, 0.018, 0.03);
const outletBodyColor = '#f59e0b';

const outletFace = new THREE.CylinderGeometry(0.026, 0.026, 0.004, 18);

export function PowerOutlet({ color, voltage, selected, isEditMode }: ObjectModelProps) {
  const label = voltage ?? '110V';
  const plateColor = color || '#dc2626';
  const plateTexture = useTextTexture(label, { width: 256, height: 128, background: plateColor, color: '#ffffff', fontSize: 80, fontWeight: 800 });
  const POST_HEIGHT = 0.6;
  const PLATE_W = 0.22;
  const PLATE_H = 0.11;

  return (
    <group>
      {/* Outlet box with three sockets on the sloped top row */}
      <SoftBox size={[OUTLET_W, OUTLET_H, OUTLET_D]} position={[0, OUTLET_H / 2, 0]} radius={0.015} color={outletBodyColor} roughness={0.5} metalness={0.1}>
        {selected && isEditMode && <Highlight />}
      </SoftBox>
      {[-1, 0, 1].map(i => (
        <group key={i} position={[i * 0.085, OUTLET_H + 0.001, 0]}>
          <mesh geometry={outletFace} material={socketGrey} castShadow />
          <mesh geometry={socketSlotsFlat} material={blackPlastic} position={[0, 0.0035, 0]} />
        </group>
      ))}
      {/* Cord strain relief + coiled lead + plug lying on the floor */}
      <mesh position={[OUTLET_W / 2 + 0.004, 0.04, 0]} rotation={[0, 0, Math.PI / 2]} material={blackPlastic}>
        <cylinderGeometry args={[0.016, 0.02, 0.016, 12]} />
      </mesh>
      <mesh geometry={outletCoil} material={outletCoilMat} castShadow />
      <mesh geometry={outletPlugGeometry} material={blackPlastic} position={[OUTLET_W / 2 + 0.36, 0.009, 0.055]} rotation={[0, 0.3, 0]} castShadow />

      {/* Marker post with voltage plate */}
      <mesh position={[0, POST_HEIGHT / 2, -0.045]} material={darkSteel} castShadow>
        <cylinderGeometry args={[0.009, 0.009, POST_HEIGHT, 8]} />
      </mesh>
      <mesh position={[0, 0.006, -0.045]} material={darkSteel} castShadow>
        <cylinderGeometry args={[0.03, 0.035, 0.012, 14]} />
      </mesh>
      <group position={[0, POST_HEIGHT - PLATE_H / 2 - 0.01, -0.045]}>
        <mesh castShadow>
          <boxGeometry args={[PLATE_W, PLATE_H, 0.006]} />
          <meshStandardMaterial color={plateColor} roughness={0.5} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0, 0.0035]}>
          <planeGeometry args={[PLATE_W * 0.96, PLATE_H * 0.96]} />
          <meshStandardMaterial map={plateTexture} {...textMaterialProps} />
        </mesh>
        <mesh position={[0, 0, -0.0035]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[PLATE_W * 0.96, PLATE_H * 0.96]} />
          <meshStandardMaterial map={plateTexture} {...textMaterialProps} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Cable ramp (cable protector)
// ---------------------------------------------------------------------------

const RAMP_PITCH = 0.9;
const RAMP_SECTION = 0.896;
const RAMP_HEIGHT = 0.075;
const RAMP_WIDTH = 0.5;
const RAMP_LID_HALF = 0.12;

function buildRampParts(sections: number) {
  const lid: THREE.BufferGeometry[] = [];
  const ramps: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];

  // Ramp wedge profile in (z, y); the extrusion shape uses x = -z so that the rotation below maps it back to +z.
  const wedge = (sign: 1 | -1) => {
    const shape = new THREE.Shape();
    const inner = RAMP_LID_HALF;
    const outer = RAMP_WIDTH / 2;
    shape.moveTo(-sign * inner, 0);
    shape.lineTo(-sign * outer, 0);
    shape.lineTo(-sign * outer, 0.012);
    shape.lineTo(-sign * inner, RAMP_HEIGHT);
    shape.closePath();
    return shape;
  };
  const wedges = [wedge(1), wedge(-1)];

  const butterfly = new THREE.Shape();
  butterfly.moveTo(-0.026, -0.1);
  butterfly.lineTo(0.026, -0.1);
  butterfly.lineTo(0.012, 0);
  butterfly.lineTo(0.026, 0.1);
  butterfly.lineTo(-0.026, 0.1);
  butterfly.lineTo(-0.012, 0);
  butterfly.closePath();

  for (let i = 0; i < sections; i++) {
    const cx = (i - (sections - 1) / 2) * RAMP_PITCH;
    lid.push(boxAt(RAMP_SECTION, RAMP_HEIGHT, RAMP_LID_HALF * 2, cx, RAMP_HEIGHT / 2, 0));
    for (let r = -2; r <= 2; r++) lid.push(boxAt(0.012, 0.004, 0.2, cx + r * 0.16, RAMP_HEIGHT + 0.001, 0));
    for (const shape of wedges) {
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: RAMP_SECTION, bevelEnabled: false });
      geometry.rotateY(Math.PI / 2);
      geometry.translate(cx - RAMP_SECTION / 2, 0, 0);
      ramps.push(geometry);
    }
    // Cable channel mouths at both ends of the section.
    dark.push(boxAt(0.02, 0.032, 0.1, cx - RAMP_SECTION / 2 + 0.009, 0.017, 0));
    dark.push(boxAt(0.02, 0.032, 0.1, cx + RAMP_SECTION / 2 - 0.009, 0.017, 0));
    // Dovetail / butterfly key on the joint to the previous section.
    if (i > 0) {
      const key = new THREE.ExtrudeGeometry(butterfly, { depth: 0.004, bevelEnabled: false });
      key.rotateX(-Math.PI / 2);
      key.translate(cx - RAMP_PITCH / 2, RAMP_HEIGHT - 0.0005, 0);
      dark.push(key);
    }
  }
  return { lid: mergeParts(lid), ramps: mergeParts(ramps), dark: mergeParts(dark) };
}

export function CableRamp({ color, customWidth, selected, isEditMode }: ObjectModelProps) {
  const length = customWidth ?? RAMP_PITCH;
  const sections = clamp(Math.ceil(length / RAMP_PITCH - 1e-6), 1, 60);
  const parts = useMemo(() => buildRampParts(sections), [sections]);
  useEffect(() => () => {
    parts.lid.dispose();
    parts.ramps.dispose();
    parts.dark.dispose();
  }, [parts]);

  return (
    <group>
      <mesh geometry={parts.lid} castShadow receiveShadow>
        <meshStandardMaterial color={color || '#facc15'} roughness={0.5} metalness={0.05} />
        {selected && isEditMode && <Highlight />}
      </mesh>
      <mesh geometry={parts.ramps} material={rubberMat} castShadow receiveShadow />
      <mesh geometry={parts.dark} material={blackPlastic} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Cable run
// ---------------------------------------------------------------------------

const CABLE_RADIUS = 0.012;
const CABLE_Y = 0.015;
const HIT_RIBBON_WIDTH = 0.3;

/** Floor path with quadratic-bezier fillets at the corners. Null when the polyline degenerates. */
function buildCablePath(points: PathPoint[]): THREE.CurvePath<THREE.Vector3> | null {
  const pts: THREE.Vector3[] = [];
  for (const point of points) {
    const v = new THREE.Vector3(point.x, CABLE_Y, point.z);
    if (!pts.length || pts[pts.length - 1].distanceTo(v) > 1e-3) pts.push(v);
  }
  if (pts.length < 2) return null;

  const path = new THREE.CurvePath<THREE.Vector3>();
  let cursor = pts[0].clone();
  const addLine = (to: THREE.Vector3) => {
    if (cursor.distanceTo(to) > 1e-4) path.add(new THREE.LineCurve3(cursor.clone(), to.clone()));
    cursor = to.clone();
  };
  for (let i = 1; i < pts.length - 1; i++) {
    const corner = pts[i];
    const toPrev = pts[i - 1].clone().sub(corner);
    const toNext = pts[i + 1].clone().sub(corner);
    const radius = Math.min(0.4, toPrev.length() / 2, toNext.length() / 2);
    const entry = corner.clone().add(toPrev.normalize().multiplyScalar(radius));
    const exit = corner.clone().add(toNext.normalize().multiplyScalar(radius));
    addLine(entry);
    if (entry.distanceTo(exit) > 1e-4) path.add(new THREE.QuadraticBezierCurve3(entry.clone(), corner.clone(), exit.clone()));
    cursor = exit;
  }
  addLine(pts[pts.length - 1]);
  if (path.curves.length === 0 || path.getLength() < 1e-3) return null;
  return path;
}

function buildHitRibbon(path: THREE.CurvePath<THREE.Vector3>, length: number) {
  const divisions = clamp(Math.ceil(length / 0.1), 4, 1200);
  const samples = path.getSpacedPoints(divisions);
  const positions = new Float32Array(samples.length * 2 * 3);
  const indices: number[] = [];
  const half = HIT_RIBBON_WIDTH / 2;
  samples.forEach((point, i) => {
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const norm = Math.hypot(tx, tz) || 1;
    tx /= norm;
    tz /= norm;
    const nx = -tz;
    const nz = tx;
    positions.set([point.x + nx * half, 0.02, point.z + nz * half, point.x - nx * half, 0.02, point.z - nz * half], i * 6);
    if (i < samples.length - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

const plugBodyGeometry = new THREE.BoxGeometry(0.05, 0.034, 0.06);
const plugCollarGeometry = new THREE.BoxGeometry(0.054, 0.038, 0.01);
const plugPinGeometry = new THREE.BoxGeometry(0.004, 0.018, 0.024);
const plugReliefIn = new THREE.CylinderGeometry(0.011, 0.017, 0.05, 12).rotateX(Math.PI / 2);
const plugReliefOut = new THREE.CylinderGeometry(0.017, 0.011, 0.05, 12).rotateX(Math.PI / 2);
const plugPlasticMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.55, metalness: 0.1 });
const socketBodyMat = new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.5, metalness: 0.15 });
const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide });
const haloMaterial = new THREE.MeshBasicMaterial({ color: '#3b82f6', transparent: true, opacity: 0.55, depthWrite: false });

export function CableRun({ color, points, selected, isEditMode }: ObjectModelProps) {
  const key = points ? points.map(p => `${p.x.toFixed(4)},${p.z.toFixed(4)}`).join('|') : '';
  const built = useMemo(() => {
    if (!points || points.length < 2) return null;
    const path = buildCablePath(points);
    if (!path) return null;
    const length = path.getLength();
    path.arcLengthDivisions = clamp(Math.ceil(length / 0.02), 200, 4000);
    path.updateArcLengths();
    return { path, length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const showHalo = !!selected && !!isEditMode;
  const geometries = useMemo(() => {
    if (!built) return null;
    const segments = clamp(Math.ceil(built.length / 0.04), 8, 1500);
    return {
      tube: new THREE.TubeGeometry(built.path, segments, CABLE_RADIUS, 8, false),
      ribbon: buildHitRibbon(built.path, built.length),
    };
  }, [built]);
  const halo = useMemo(() => {
    if (!built || !showHalo) return null;
    const segments = clamp(Math.ceil(built.length / 0.08), 8, 800);
    return new THREE.TubeGeometry(built.path, segments, CABLE_RADIUS * 2.2, 6, false);
  }, [built, showHalo]);
  useEffect(() => () => {
    geometries?.tube.dispose();
    geometries?.ribbon.dispose();
  }, [geometries]);
  useEffect(() => () => halo?.dispose(), [halo]);

  const cableColor = color || '#b91c1c';

  if (!built || !geometries) {
    return (
      <group>
        <mesh position={[0, 0.015, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.03, 16]} />
          <meshStandardMaterial color={cableColor} roughness={0.55} metalness={0.05} />
          {selected && isEditMode && <Highlight />}
        </mesh>
      </group>
    );
  }

  const startTangent = built.path.getTangentAt(0);
  const endTangent = built.path.getTangentAt(1);
  const start = built.path.getPointAt(0);
  const end = built.path.getPointAt(1);
  const startYaw = Math.atan2(startTangent.x, startTangent.z);
  const endYaw = Math.atan2(endTangent.x, endTangent.z);

  return (
    <group>
      <mesh geometry={geometries.tube} castShadow receiveShadow>
        <meshStandardMaterial color={cableColor} roughness={0.55} metalness={0.05} />
      </mesh>
      {halo && <mesh geometry={halo} material={haloMaterial} raycast={() => null} />}
      <mesh geometry={geometries.ribbon} material={hitMaterial} />

      {/* Plug at the first point: pins point backwards, strain relief faces the cable */}
      <group position={[start.x, 0, start.z]} rotation={[0, startYaw, 0]}>
        <mesh geometry={plugBodyGeometry} material={plugPlasticMat} position={[0, 0.017, -0.03]} castShadow />
        <mesh geometry={plugCollarGeometry} material={plugPlasticMat} position={[0, 0.017, -0.055]} />
        <mesh geometry={plugReliefIn} material={plugPlasticMat} position={[0, CABLE_Y, 0.025]} />
        <mesh geometry={plugPinGeometry} material={chromeMat} position={[-0.011, 0.017, -0.072]} />
        <mesh geometry={plugPinGeometry} material={chromeMat} position={[0.011, 0.017, -0.072]} />
      </group>

      {/* Socket / connector at the last point */}
      <group position={[end.x, 0, end.z]} rotation={[0, endYaw, 0]}>
        <mesh geometry={plugBodyGeometry} material={socketBodyMat} position={[0, 0.017, 0.03]} castShadow />
        <mesh geometry={plugCollarGeometry} material={socketBodyMat} position={[0, 0.017, 0.055]} />
        <mesh geometry={plugReliefOut} material={plugPlasticMat} position={[0, CABLE_Y, -0.025]} />
        <mesh geometry={plugPinGeometry} material={blackPlastic} position={[-0.011, 0.017, 0.0605]} scale={[1, 1, 0.2]} />
        <mesh geometry={plugPinGeometry} material={blackPlastic} position={[0.011, 0.017, 0.0605]} scale={[1, 1, 0.2]} />
      </group>
    </group>
  );
}
