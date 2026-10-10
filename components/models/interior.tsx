import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { DEVICE_SYSTEMS, DeviceSymbol, PARTITION_THICKNESS } from '../../planning';
import { Highlight, mergeParts } from './shared';
import { cleanPolyline, prismGeometry, wallBands } from './wallGeometry';
import type { ObjectModelProps } from './modelProps';

const fallbackMarker = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 20).translate(0, 0.02, 0);

/** Partition wall along `points`; a loop (last point = first) gets mitred corners all round. */
export const PartitionWall = ({ points, customWidth = PARTITION_THICKNESS, customHeight = 3, color, selected, isEditMode }: ObjectModelProps) => {
  const geometry = useMemo(() => {
    const raw = points ?? [];
    const last = raw[raw.length - 1];
    const loop = raw.length > 3 && Math.hypot(raw[0].x - last.x, raw[0].z - last.z) < 1e-3;
    const line = cleanPolyline(raw, loop);
    if (line.length < 2) return null;
    const bands = wallBands(line, Math.max(0.02, customWidth) / 2, loop);
    return mergeParts(bands.map(band => prismGeometry(band, 0, Math.max(0.3, customHeight))));
  }, [points, customWidth, customHeight]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return (
    <mesh geometry={geometry ?? fallbackMarker} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.85} metalness={0} envMapIntensity={0.35} />
      {/* The wall's origin is its first vertex, not its centre: an enlarged outline would drift. */}
      {selected && isEditMode && <Highlight scale={geometry ? 1 : 1.02} />}
    </mesh>
  );
};

function starGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? 0.15 : 0.065;
    const angle = Math.PI / 2 + i * Math.PI / 5;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false }).translate(0, 0, -0.025);
}

/** One shared marker geometry per plan symbol, centred on the origin. */
const SYMBOL_GEOMETRY: Record<DeviceSymbol, THREE.BufferGeometry> = {
  square: new THREE.BoxGeometry(0.22, 0.22, 0.22),
  diamond: new THREE.OctahedronGeometry(0.16),
  circle: new THREE.SphereGeometry(0.13, 24, 16),
  triangle: new THREE.ConeGeometry(0.15, 0.25, 3),
  ring: new THREE.TorusGeometry(0.11, 0.04, 12, 28),
  bar: new THREE.BoxGeometry(0.36, 0.13, 0.06),
  star: starGeometry(),
  hexagon: new THREE.CylinderGeometry(0.13, 0.13, 0.1, 6).rotateX(Math.PI / 2),
  dot: new THREE.SphereGeometry(0.09, 20, 12),
};
const stemGeometry = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8).translate(0, 0.25, 0);
const baseGeometry = new THREE.CylinderGeometry(0.11, 0.11, 0.012, 24).translate(0, 0.006, 0);
const stemMaterial = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.4, roughness: 0.5 });
const MARKER_HEIGHT = 0.64;

/** Device point: the system's symbol on a short stem above a floor disc, readable from any view. */
export const DevicePoint = ({ system = 'other', color, selected, isEditMode }: ObjectModelProps) => {
  const symbol = DEVICE_SYSTEMS[system]?.symbol ?? 'dot';
  const emissive = useMemo(() => new THREE.Color(color).multiplyScalar(0.35), [color]);
  return (
    <group>
      <mesh geometry={baseGeometry} receiveShadow>
        <meshStandardMaterial color={color} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <mesh geometry={stemGeometry} material={stemMaterial} castShadow />
      <mesh geometry={SYMBOL_GEOMETRY[symbol]} position={[0, MARKER_HEIGHT, 0]} castShadow>
        <meshStandardMaterial color={color} emissive={emissive} roughness={0.4} metalness={0.1} />
        {selected && isEditMode && <Highlight />}
      </mesh>
    </group>
  );
};
