import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { ObjectType } from '../../types';
import { Highlight } from './shared';
import { SoftBox, GrilleMaterial } from './details';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Normalizes geometry to non-indexed representation before merging,
 * ensuring index-attribute compatibility across all Three.js BufferGeometries.
 */
function toNonIndexedAndDispose(geom: THREE.BufferGeometry): THREE.BufferGeometry {
  if (geom.index) {
    const nonIndexed = geom.toNonIndexed();
    geom.dispose();
    return nonIndexed;
  }
  return geom;
}

/**
 * Builds a single merged BufferGeometry for a straight box truss section of given length.
 * Features:
 * - 4 main chords with 14-segment circular smooth tubing (radius 0.025m)
 * - Restrained end connector collars (radius 0.029m) and conical spigot bosses on every chord end
 * - Rigid transverse end square framing
 * - 4-sided diagonal V-truss bracing on Front, Back, Top, and Bottom faces
 * - Intermediate perimeter square frame rings at segment divisions
 * - Bottom tangent sits precisely at floor level (y = 0)
 */
function buildStraightTrussGeometry(length: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const crossSection = 0.3;
  const half = crossSection / 2 - 0.025;
  const tubeRadius = 0.025; // 50mm diameter aluminum pipe
  const braceRadius = 0.011; // 22mm diameter aluminum brace
  const radialSegments = 14;

  // The slightly wider connection collars, not the chords, touch the floor.
  const yBottom = tubeRadius + 0.0035;
  const yTop = yBottom + crossSection - tubeRadius * 2;
  const zBack = -half;
  const zFront = half;

  const corners: [number, number][] = [
    [yBottom, zBack],
    [yBottom, zFront],
    [yTop, zBack],
    [yTop, zFront],
  ];

  // 1. Four main chords along X axis
  corners.forEach(([y, z]) => {
    const chord = new THREE.CylinderGeometry(tubeRadius, tubeRadius, length, radialSegments);
    chord.rotateZ(Math.PI / 2);
    chord.translate(0, y, z);
    parts.push(chord);
  });

  // 2. Machined end spigot collars and conical spigot bosses at both ends
  const collarLength = Math.min(0.035, length * 0.15);
  const collarRadius = tubeRadius + 0.004; // 0.029m
  const spigotLength = Math.min(0.015, length * 0.08);
  const spigotRadius = tubeRadius - 0.003; // 0.022m

  [-length / 2, length / 2].forEach((endX, endIdx) => {
    const dir = endIdx === 0 ? 1 : -1;
    const collarCenterX = endX + dir * (collarLength / 2);
    const spigotCenterX = endX + dir * (spigotLength / 2);

    corners.forEach(([y, z]) => {
      // Machined sleeve collar
      const collar = new THREE.CylinderGeometry(collarRadius, collarRadius, collarLength, radialSegments);
      collar.rotateZ(Math.PI / 2);
      collar.translate(collarCenterX, y, z);
      parts.push(collar);

      // Conical spigot locator boss
      const spigot = new THREE.CylinderGeometry(spigotRadius * 0.88, spigotRadius, spigotLength, radialSegments);
      spigot.rotateZ(Math.PI / 2);
      spigot.translate(spigotCenterX, y, z);
      parts.push(spigot);
    });
  });

  // Helper for adding brace tube between two 3D points
  const addTube = (
    p1: [number, number, number],
    p2: [number, number, number],
    r: number,
    segs = 10
  ) => {
    const a = new THREE.Vector3(...p1);
    const b = new THREE.Vector3(...p2);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 0.001) return;
    const tube = new THREE.CylinderGeometry(r, r, len, segs);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    tube.applyQuaternion(quat);
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    tube.translate(mid.x, mid.y, mid.z);
    parts.push(tube);
  };

  // 3. End transverse square frames (rigid perimeter frame at each end)
  [-length / 2 + collarLength, length / 2 - collarLength].forEach((x) => {
    addTube([x, yBottom, zBack], [x, yBottom, zFront], braceRadius, 10);
    addTube([x, yTop, zBack], [x, yTop, zFront], braceRadius, 10);
    addTube([x, yBottom, zBack], [x, yTop, zBack], braceRadius, 10);
    addTube([x, yBottom, zFront], [x, yTop, zFront], braceRadius, 10);
  });

  // 4. Four-sided diagonal webbing
  const numSegments = Math.max(1, Math.round(length / 0.45));
  const segLen = length / numSegments;

  for (let s = 0; s < numSegments; s++) {
    const x0 = -length / 2 + s * segLen;
    const x1 = x0 + segLen / 2;
    const x2 = x0 + segLen;

    // Front face (+Z)
    addTube([x0, yBottom, zFront], [x1, yTop, zFront], braceRadius, 10);
    addTube([x1, yTop, zFront], [x2, yBottom, zFront], braceRadius, 10);

    // Back face (-Z)
    addTube([x0, yBottom, zBack], [x1, yTop, zBack], braceRadius, 10);
    addTube([x1, yTop, zBack], [x2, yBottom, zBack], braceRadius, 10);

    // Top face (+Y)
    addTube([x0, yTop, zBack], [x1, yTop, zFront], braceRadius, 10);
    addTube([x1, yTop, zFront], [x2, yTop, zBack], braceRadius, 10);

    // Bottom face (yBottom)
    addTube([x0, yBottom, zBack], [x1, yBottom, zFront], braceRadius, 10);
    addTube([x1, yBottom, zFront], [x2, yBottom, zBack], braceRadius, 10);

    // Intermediate transverse ring frame at segment junctions
    if (s > 0) {
      addTube([x0, yBottom, zBack], [x0, yBottom, zFront], braceRadius * 0.95, 10);
      addTube([x0, yTop, zBack], [x0, yTop, zFront], braceRadius * 0.95, 10);
      addTube([x0, yBottom, zBack], [x0, yTop, zBack], braceRadius * 0.95, 10);
      addTube([x0, yBottom, zFront], [x0, yTop, zFront], braceRadius * 0.95, 10);
    }
  }

  const normalizedParts = parts.map(toNonIndexedAndDispose);
  const merged = mergeGeometries(normalizedParts)!;
  normalizedParts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Straight Truss Section Model:
 * Manages owned BufferGeometry memoization and automatic lifecycle disposal for customWidth.
 */
const StraightTruss: React.FC<{
  length: number;
  color: string;
  selected?: boolean;
  isEditMode?: boolean;
}> = ({ length, color, selected, isEditMode }) => {
  const geometry = useMemo(() => buildStraightTrussGeometry(length), [length]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const crossSection = 0.3;
  const collarAllowance = 0.007;

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color={color} metalness={0.84} roughness={0.22} />
      </mesh>
      {selected && isEditMode && (
        <mesh position={[0, (crossSection + collarAllowance) / 2, 0]}>
          <boxGeometry args={[length, crossSection + collarAllowance, crossSection + collarAllowance]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Highlight />
        </mesh>
      )}
    </group>
  );
};

/**
 * Professional Touring FOH Audio Mixing Console & Workstation
 */
const MixerConsole: React.FC<{
  color: string;
  selected?: boolean;
  isEditMode?: boolean;
}> = ({ color, selected, isEditMode }) => {
  const faderValues = useMemo(
    () => [-0.02, 0.015, -0.01, 0.025, -0.03, 0.01, 0.0, 0.02, -0.015, 0.005, 0.03, -0.025, 0.01, -0.005, 0.02, 0.0],
    []
  );

  return (
    <group>
      {/* 1. Heavy-duty Touring Desk / Flight Case Stand with Open Knee Well */}
      {/* Tabletop */}
      <SoftBox size={[1.28, 0.038, 0.74]} position={[0, 0.72, 0]} radius={0.012} color="#1c1c22" roughness={0.5} metalness={0.25}>
        {selected && isEditMode && <Highlight />}
      </SoftBox>

      {/* Left Road-Case Pedestal Support */}
      <SoftBox size={[0.09, 0.70, 0.68]} position={[-0.56, 0.35, 0]} radius={0.01} color="#18181e" roughness={0.65} metalness={0.35} />
      {/* Aluminum Corner Edges */}
      <mesh position={[-0.56, 0.35, 0.33]}>
        <boxGeometry args={[0.095, 0.70, 0.018]} />
        <meshStandardMaterial color="#42424a" metalness={0.82} roughness={0.24} />
      </mesh>
      <mesh position={[-0.56, 0.35, -0.33]}>
        <boxGeometry args={[0.095, 0.70, 0.018]} />
        <meshStandardMaterial color="#42424a" metalness={0.82} roughness={0.24} />
      </mesh>

      {/* Right Road-Case Pedestal Support */}
      <SoftBox size={[0.09, 0.70, 0.68]} position={[0.56, 0.35, 0]} radius={0.01} color="#18181e" roughness={0.65} metalness={0.35} />
      {/* Aluminum Corner Edges */}
      <mesh position={[0.56, 0.35, 0.33]}>
        <boxGeometry args={[0.095, 0.70, 0.018]} />
        <meshStandardMaterial color="#42424a" metalness={0.82} roughness={0.24} />
      </mesh>
      <mesh position={[0.56, 0.35, -0.33]}>
        <boxGeometry args={[0.095, 0.70, 0.018]} />
        <meshStandardMaterial color="#42424a" metalness={0.82} roughness={0.24} />
      </mesh>

      {/* Rear Structural Stretcher Bar */}
      <mesh position={[0, 0.22, -0.26]}>
        <boxGeometry args={[1.04, 0.045, 0.025]} />
        <meshStandardMaterial color="#282830" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* 4 Rubber Leveling Feet */}
      {[
        [-0.56, 0.008, 0.28],
        [-0.56, 0.008, -0.28],
        [0.56, 0.008, 0.28],
        [0.56, 0.008, -0.28],
      ].map(([x, y, z], i) => (
        <mesh key={`foot-${i}`} position={[x, y, z]}>
          <cylinderGeometry args={[0.02, 0.02, 0.016, 10]} />
          <meshStandardMaterial color="#2a2a32" roughness={0.9} />
        </mesh>
      ))}

      {/* 2. Digital Mixing Console Chassis */}
      {/* Sculpted Dark Wooden / Cast-Aluminum Side Cheeks */}
      <mesh position={[-0.53, 0.84, -0.04]} rotation={[-0.26, 0, 0]}>
        <boxGeometry args={[0.026, 0.12, 0.58]} />
        <meshStandardMaterial color="#1a1a20" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0.53, 0.84, -0.04]} rotation={[-0.26, 0, 0]}>
        <boxGeometry args={[0.026, 0.12, 0.58]} />
        <meshStandardMaterial color="#1a1a20" roughness={0.5} metalness={0.4} />
      </mesh>

      {/* Raked Lower Control Bed (Channels & Faders, ~14° slope) */}
      <group position={[0, 0.77, 0.04]} rotation={[-0.24, 0, 0]}>
        {/* Main console body bed */}
        <SoftBox size={[1.04, 0.045, 0.40]} position={[0, 0, 0]} radius={0.01} color={color || '#24242c'} roughness={0.4} metalness={0.32} />

        {/* Ergonomic Padded Leatherette Palm / Wrist Rest */}
        <SoftBox size={[1.02, 0.024, 0.08]} position={[0, 0.025, 0.155]} radius={0.012} color="#141418" roughness={0.88} metalness={0.06} />

        {/* Channel Fader Strips (16 channels across width) */}
        {Array.from({ length: 16 }).map((_, i) => {
          const x = -0.45 + i * 0.06;
          const faderOffset = faderValues[i % faderValues.length];
          return (
            <group key={`fader-strip-${i}`}>
              {/* Recessed black fader travel track */}
              <mesh position={[x, 0.024, 0.04]}>
                <boxGeometry args={[0.012, 0.002, 0.11]} />
                <meshStandardMaterial color="#0e0e12" roughness={0.7} />
              </mesh>
              {/* Anodized Aluminum Fader Knob Cap */}
              <mesh position={[x, 0.034, 0.04 + faderOffset]}>
                <boxGeometry args={[0.018, 0.016, 0.026]} />
                <meshStandardMaterial color="#dedee6" metalness={0.85} roughness={0.2} />
              </mesh>
              {/* Channel Select Button (Cyan LED) */}
              <mesh position={[x, 0.025, -0.035]}>
                <boxGeometry args={[0.012, 0.006, 0.012]} />
                <meshStandardMaterial color="#00bcd4" emissive="#00bcd4" emissiveIntensity={0.8} roughness={0.3} toneMapped={false} />
              </mesh>
              {/* Channel Cue Button (Amber LED) */}
              <mesh position={[x, 0.025, -0.055]}>
                <boxGeometry args={[0.012, 0.006, 0.012]} />
                <meshStandardMaterial color="#ff9800" emissive="#ff9800" emissiveIntensity={0.8} roughness={0.3} toneMapped={false} />
              </mesh>
              {/* Channel Mute Button (Red LED) */}
              <mesh position={[x, 0.025, -0.075]}>
                <boxGeometry args={[0.012, 0.006, 0.012]} />
                <meshStandardMaterial color="#f44336" emissive="#f44336" emissiveIntensity={0.8} roughness={0.3} toneMapped={false} />
              </mesh>
              {/* Channel Rotary Encoders (Knobs) */}
              <mesh position={[x, 0.032, -0.11]}>
                <cylinderGeometry args={[0.01, 0.01, 0.014, 12]} />
                <meshStandardMaterial color="#40404a" metalness={0.6} roughness={0.3} />
              </mesh>
              <mesh position={[x, 0.032, -0.14]}>
                <cylinderGeometry args={[0.01, 0.01, 0.014, 12]} />
                <meshStandardMaterial color="#40404a" metalness={0.6} roughness={0.3} />
              </mesh>
            </group>
          );
        })}

        {/* Digital OLED Channel Scribble Strip Displays */}
        <mesh position={[0, 0.024, -0.015]}>
          <boxGeometry args={[0.98, 0.002, 0.016]} />
          <meshStandardMaterial color="#081820" emissive="#0d3545" emissiveIntensity={0.9} roughness={0.2} toneMapped={false} />
        </mesh>
      </group>

      {/* 3. Angled Upper Meter Bridge & Dual Touchscreens (~38° slope) */}
      <group position={[0, 0.86, -0.15]} rotation={[-0.66, 0, 0]}>
        {/* Meter Bridge Chassis Hood */}
        <SoftBox size={[1.04, 0.04, 0.26]} position={[0, 0, 0]} radius={0.01} color="#181820" roughness={0.4} metalness={0.38} />

        {/* Touchscreen 1 (Left: Channel Strip / Parametric EQ Display) */}
        <mesh position={[-0.24, 0.022, 0]}>
          <boxGeometry args={[0.42, 0.004, 0.20]} />
          <meshStandardMaterial color="#081420" emissive="#0a3248" emissiveIntensity={0.85} roughness={0.12} metalness={0.1} />
        </mesh>
        {/* Parametric EQ curve accent line */}
        <mesh position={[-0.24, 0.026, 0]}>
          <boxGeometry args={[0.36, 0.002, 0.006]} />
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>

        {/* Touchscreen 2 (Right: Master Spectrum / RTA Display) */}
        <mesh position={[0.24, 0.022, 0]}>
          <boxGeometry args={[0.42, 0.004, 0.20]} />
          <meshStandardMaterial color="#0c1816" emissive="#124036" emissiveIntensity={0.85} roughness={0.12} metalness={0.1} />
        </mesh>

        {/* Stereo Master LED VU Meter Towers (Flanking the center) */}
        {[-0.018, 0.018].map((xOffset, side) => (
          <group key={`vu-${side}`} position={[xOffset, 0.024, 0]}>
            {/* Green segments (Normal signal) */}
            <mesh position={[0, 0, 0.04]}>
              <boxGeometry args={[0.008, 0.002, 0.08]} />
              <meshStandardMaterial color="#00e676" emissive="#00e676" emissiveIntensity={1.8} toneMapped={false} />
            </mesh>
            {/* Amber segments (Headroom) */}
            <mesh position={[0, 0, -0.025]}>
              <boxGeometry args={[0.008, 0.002, 0.035]} />
              <meshStandardMaterial color="#ffb300" emissive="#ffb300" emissiveIntensity={1.8} toneMapped={false} />
            </mesh>
            {/* Red segments (Peak / Clip) */}
            <mesh position={[0, 0, -0.06]}>
              <boxGeometry args={[0.008, 0.002, 0.02]} />
              <meshStandardMaterial color="#ff1744" emissive="#ff1744" emissiveIntensity={2.0} toneMapped={false} />
            </mesh>
          </group>
        ))}

        {/* Integrated Top Hood Downlight Bar */}
        <mesh position={[0, 0.026, -0.12]}>
          <boxGeometry args={[1.00, 0.008, 0.012]} />
          <meshStandardMaterial color="#fff3e0" emissive="#ffe0b2" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      </group>

      {/* Gooseneck Talkback Microphone */}
      <group position={[-0.48, 0.82, -0.06]}>
        {/* XLR Socket Mount */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.02, 12]} />
          <meshStandardMaterial color="#2a2a30" metalness={0.8} roughness={0.25} />
        </mesh>
        {/* Curved Gooseneck Stem */}
        <mesh position={[0.02, 0.08, 0.02]} rotation={[0.3, 0, -0.3]}>
          <cylinderGeometry args={[0.004, 0.004, 0.16, 8]} />
          <meshStandardMaterial color="#1a1a20" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Mic Capsule & Grille */}
        <mesh position={[0.04, 0.16, 0.04]} rotation={[0.4, 0, -0.4]}>
          <cylinderGeometry args={[0.008, 0.006, 0.03, 12]} />
          <meshStandardMaterial color="#686872" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>

      {/* 4. Touring FOH Engineer Task Chair / Stool */}
      <group position={[0, 0, 0.68]}>
        {/* Contoured Padded Seat Cushion */}
        <SoftBox size={[0.45, 0.065, 0.44]} position={[0, 0.48, 0]} radius={0.025} color="#2b2b34" roughness={0.78} metalness={0.08} />

        {/* Ergonomic Curved Mesh Backrest */}
        <group position={[0, 0.74, 0.20]} rotation={[-0.1, 0, 0]}>
          <SoftBox size={[0.42, 0.34, 0.035]} position={[0, 0, 0]} radius={0.018} color="#22222a" roughness={0.82} metalness={0.1} />
          {/* Lumbar Spine Support Bracket */}
          <mesh position={[0, -0.14, 0.02]}>
            <boxGeometry args={[0.04, 0.18, 0.015]} />
            <meshStandardMaterial color="#45454e" metalness={0.75} roughness={0.25} />
          </mesh>
        </group>

        {/* Pneumatic Chrome Steel Column */}
        <mesh position={[0, 0.26, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.38, 14]} />
          <meshStandardMaterial color="#d4d4dc" metalness={0.92} roughness={0.15} />
        </mesh>

        {/* Chrome Circular Footrest Ring */}
        <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.01, 8, 24]} />
          <meshStandardMaterial color="#c0c0c8" metalness={0.9} roughness={0.18} />
        </mesh>
        {/* Footrest Ring Spokes */}
        {[0, 120, 240].map((deg) => (
          <mesh key={`spoke-${deg}`} position={[0, 0.18, 0]} rotation={[0, (deg * Math.PI) / 180, 0]}>
            <boxGeometry args={[0.36, 0.01, 0.012]} />
            <meshStandardMaterial color="#c0c0c8" metalness={0.9} roughness={0.18} />
          </mesh>
        ))}

        {/* 5-Star Spider Base with Swivel Caster Wheels */}
        {[0, 72, 144, 216, 288].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const legLen = 0.24;
          const legX = Math.sin(rad) * (legLen / 2);
          const legZ = Math.cos(rad) * (legLen / 2);
          const wheelX = Math.sin(rad) * legLen;
          const wheelZ = Math.cos(rad) * legLen;
          return (
            <React.Fragment key={`chair-leg-${angle}`}>
              {/* Spider Leg */}
              <mesh position={[legX, 0.045, legZ]} rotation={[0, -rad, 0]}>
                <boxGeometry args={[0.028, 0.018, legLen]} />
                <meshStandardMaterial color="#303038" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Caster Wheel */}
              <mesh position={[wheelX, 0.022, wheelZ]} rotation={[0, rad, Math.PI / 2]}>
                <cylinderGeometry args={[0.018, 0.018, 0.014, 10]} />
                <meshStandardMaterial color="#1a1a20" roughness={0.8} />
              </mesh>
            </React.Fragment>
          );
        })}
      </group>
    </group>
  );
};

/**
 * Professional Touring Fog & Haze Generator Model
 */
const FogMachine: React.FC<{
  color: string;
  selected?: boolean;
  isEditMode?: boolean;
}> = ({ color, selected, isEditMode }) => {
  return (
    <group>
      {/* 1. Main Industrial Soft Housing */}
      <SoftBox size={[0.54, 0.22, 0.28]} position={[0, 0.125, 0]} radius={0.022} color={color || '#26262e'} roughness={0.45} metalness={0.35}>
        {selected && isEditMode && <Highlight />}
      </SoftBox>

      {/* Industrial Protective Corner Caps */}
      {[
        [-0.26, 0.025, 0.13],
        [0.26, 0.025, 0.13],
        [-0.26, 0.025, -0.13],
        [0.26, 0.025, -0.13],
        [-0.26, 0.225, 0.13],
        [0.26, 0.225, 0.13],
        [-0.26, 0.225, -0.13],
        [0.26, 0.225, -0.13],
      ].map(([x, y, z], i) => (
        <mesh key={`corner-${i}`} position={[x, y, z]}>
          <boxGeometry args={[0.03, 0.03, 0.03]} />
          <meshStandardMaterial color="#1c1c22" roughness={0.7} metalness={0.5} />
        </mesh>
      ))}

      {/* 4 Heavy-duty Anti-Vibration Rubber Feet (Floor contact y = 0) */}
      {[
        [-0.22, 0.007, 0.10],
        [0.22, 0.007, 0.10],
        [-0.22, 0.007, -0.10],
        [0.22, 0.007, -0.10],
      ].map(([x, y, z], i) => (
        <group key={`rubber-foot-${i}`} position={[x, y, z]}>
          <mesh>
            <cylinderGeometry args={[0.018, 0.018, 0.014, 12]} />
            <meshStandardMaterial color="#222228" roughness={0.92} />
          </mesh>
          {/* Steel Center Washer */}
          <mesh position={[0, 0.008, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.002, 10]} />
            <meshStandardMaterial color="#909098" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* 2. Front Fog Output Nozzle Chamber */}
      <group position={[0, 0.125, -0.14]}>
        {/* Recessed Perforated Heat-Shield Grille */}
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[0.18, 0.12]} />
          <GrilleMaterial color="#36363e" roughness={0.5} metalness={0.7} />
        </mesh>

        {/* Machined Brass/Aluminum Dispersion Nozzle Cone */}
        <mesh position={[0, 0, -0.03]} rotation={[Math.PI / 2 + 0.16, 0, 0]} castShadow>
          <cylinderGeometry args={[0.032, 0.022, 0.07, 16]} />
          <meshStandardMaterial color="#b0b0b8" metalness={0.88} roughness={0.18} />
        </mesh>

        {/* Gold Heat-Warning Collar Ring */}
        <mesh position={[0, 0.005, -0.015]} rotation={[Math.PI / 2 + 0.16, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.012, 16]} />
          <meshStandardMaterial color="#d4a340" metalness={0.75} roughness={0.28} />
        </mesh>

        {/* Directional Dispersion Cowl / Deflector Flap on top */}
        <mesh position={[0, 0.065, -0.04]} rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[0.14, 0.006, 0.06]} />
          <meshStandardMaterial color="#282830" metalness={0.65} roughness={0.35} />
        </mesh>
      </group>

      {/* 3. Fluid Reservoir Compartment */}
      <group position={[0.16, 0.125, 0]}>
        {/* Recessed Vertical Fluid Sight Gauge Window */}
        <mesh position={[0, 0, 0.141]}>
          <boxGeometry args={[0.045, 0.14, 0.004]} />
          <meshStandardMaterial color="#0c2028" roughness={0.2} metalness={0.1} />
        </mesh>
        {/* Fluid Level Meniscus Indicator (Soft Blue Glow) */}
        <mesh position={[0, -0.02, 0.143]}>
          <boxGeometry args={[0.038, 0.08, 0.002]} />
          <meshStandardMaterial color="#00bcd4" emissive="#00bcd4" emissiveIntensity={0.65} roughness={0.3} toneMapped={false} />
        </mesh>

        {/* Knurled Aluminum Fluid Filler Cap on Top */}
        <mesh position={[0, 0.12, 0.06]}>
          <cylinderGeometry args={[0.024, 0.024, 0.02, 16]} />
          <meshStandardMaterial color="#909098" metalness={0.85} roughness={0.22} />
        </mesh>
      </group>

      {/* 4. Top Digital Control Console */}
      <group position={[-0.10, 0.237, 0.03]}>
        {/* Recessed Control Plate */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.16, 0.005, 0.12]} />
          <meshStandardMaterial color="#16161c" roughness={0.6} metalness={0.4} />
        </mesh>

        {/* Backlit Digital Graphic LCD Display */}
        <mesh position={[0, 0.004, -0.02]}>
          <boxGeometry args={[0.11, 0.002, 0.04]} />
          <meshStandardMaterial color="#061e28" emissive="#0a3e52" emissiveIntensity={0.95} roughness={0.15} toneMapped={false} />
        </mesh>

        {/* Membrane Navigation Buttons */}
        {[-0.04, -0.015, 0.015, 0.04].map((btnX, bi) => (
          <mesh key={`btn-${bi}`} position={[btnX, 0.004, 0.025]}>
            <boxGeometry args={[0.016, 0.003, 0.012]} />
            <meshStandardMaterial color="#303038" roughness={0.5} />
          </mesh>
        ))}

        {/* 3 Status Indicator LEDs */}
        {/* Ready LED (Green) */}
        <mesh position={[0.062, 0.004, -0.03]}>
          <sphereGeometry args={[0.004, 8, 8]} />
          <meshStandardMaterial color="#00e676" emissive="#00e676" emissiveIntensity={2.0} toneMapped={false} />
        </mesh>
        {/* Heating LED (Amber) */}
        <mesh position={[0.062, 0.004, -0.018]}>
          <sphereGeometry args={[0.004, 8, 8]} />
          <meshStandardMaterial color="#ffab00" emissive="#ffab00" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
        {/* DMX / Active LED (Blue) */}
        <mesh position={[0.062, 0.004, -0.006]}>
          <sphereGeometry args={[0.004, 8, 8]} />
          <meshStandardMaterial color="#00b0ff" emissive="#00b0ff" emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
      </group>

      {/* 5. Tubular Stainless Steel Carry Handle & Recessed Side Flip Handles */}
      <group position={[0, 0.235, 0]}>
        {/* Left Stanchion Mount */}
        <mesh position={[-0.14, 0.035, 0]}>
          <boxGeometry args={[0.024, 0.07, 0.02]} />
          <meshStandardMaterial color="#3a3a44" metalness={0.75} roughness={0.25} />
        </mesh>
        {/* Right Stanchion Mount */}
        <mesh position={[0.14, 0.035, 0]}>
          <boxGeometry args={[0.024, 0.07, 0.02]} />
          <meshStandardMaterial color="#3a3a44" metalness={0.75} roughness={0.25} />
        </mesh>
        {/* Ergonomic Textured Grip Bar */}
        <mesh position={[0, 0.068, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.013, 0.013, 0.30, 14]} />
          <meshStandardMaterial color="#9c9ca4" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>

      {/* Side Recessed Touring Handles */}
      {[-0.271, 0.271].map((handleX, hi) => (
        <group key={`side-handle-${hi}`} position={[handleX, 0.125, 0]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.12, 0.06, 0.006]} />
            <meshStandardMaterial color="#1a1a20" roughness={0.7} metalness={0.4} />
          </mesh>
          <mesh position={[hi === 0 ? 0.006 : -0.006, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.006, 0.006, 0.08, 10]} />
            <meshStandardMaterial color="#808088" metalness={0.8} roughness={0.25} />
          </mesh>
        </group>
      ))}

      {/* 6. Rear Forced-Air Fan & I/O Connectivity Panel */}
      <group position={[0, 0.125, 0.14]}>
        {/* Rear Dispersion Fan Housing & Grille */}
        <mesh position={[-0.10, 0, 0.001]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[0.055, 16]} />
          <GrilleMaterial color="#36363e" roughness={0.5} metalness={0.7} />
        </mesh>
        {/* Fan Center Motor Hub */}
        <mesh position={[-0.10, 0, 0.006]}>
          <cylinderGeometry args={[0.02, 0.02, 0.012, 14]} />
          <meshStandardMaterial color="#181820" roughness={0.7} />
        </mesh>

        {/* PowerCON TRUE1 AC Inlet (Blue/Grey) */}
        <mesh position={[0.10, -0.03, 0.004]}>
          <cylinderGeometry args={[0.012, 0.012, 0.01, 12]} />
          <meshStandardMaterial color="#1976d2" metalness={0.5} roughness={0.35} />
        </mesh>
        {/* Rubber Power Cable Curving to Floor */}
        <mesh position={[0.10, -0.08, 0.04]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 0.10, 8]} />
          <meshStandardMaterial color="#141416" roughness={0.85} />
        </mesh>

        {/* 5-Pin DMX IN and DMX OUT XLR Connectors */}
        <mesh position={[0.10, 0.02, 0.004]}>
          <cylinderGeometry args={[0.01, 0.01, 0.008, 12]} />
          <meshStandardMaterial color="#505058" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0.14, 0.02, 0.004]}>
          <cylinderGeometry args={[0.01, 0.01, 0.008, 12]} />
          <meshStandardMaterial color="#505058" metalness={0.8} roughness={0.25} />
        </mesh>

        {/* Illuminated Red Rocker Power Switch */}
        <mesh position={[0.18, -0.03, 0.004]}>
          <boxGeometry args={[0.014, 0.018, 0.008]} />
          <meshStandardMaterial color="#e53935" emissive="#e53935" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
};

/**
 * Equipment Dispatcher Component
 */
export const Equipment: React.FC<{
  type: ObjectType;
  color: string;
  customWidth?: number;
  selected?: boolean;
  isEditMode?: boolean;
}> = ({ type, color, customWidth = 3, selected, isEditMode }) => {
  return (
    <group>
      {type === ObjectType.TRUSS_STRAIGHT && (
        <StraightTruss length={customWidth} color={color} selected={selected} isEditMode={isEditMode} />
      )}

      {type === ObjectType.EQUIPMENT_MIXER && (
        <MixerConsole color={color} selected={selected} isEditMode={isEditMode} />
      )}

      {type === ObjectType.EFFECTS_FOG && (
        <FogMachine color={color} selected={selected} isEditMode={isEditMode} />
      )}
    </group>
  );
};
