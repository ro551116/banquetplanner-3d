import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type Point = [number, number, number];

interface SoftBoxProps {
  size: Point;
  position?: Point;
  rotation?: Point;
  radius?: number;
  color?: string;
  roughness?: number;
  metalness?: number;
  children?: React.ReactNode;
}

export function SoftBox({ size, position, rotation, radius = 0.02, color = '#25252b', roughness = 0.5, metalness = 0.15, children }: SoftBoxProps) {
  const [width, height, depth] = size;
  const geometry = useMemo(() => new RoundedBoxGeometry(width, height, depth, 2, Math.min(radius, width / 2, height / 2, depth / 2)), [width, height, depth, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
      {children}
    </mesh>
  );
}

// Returned geometry is caller-owned; merge static parts once, then dispose the inputs.
export function createTubeGeometry(start: Point, end: Point, radius: number, segments = 12): THREE.BufferGeometry {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), segments);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  return geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

// A single opaque perforation texture replaces hundreds of grille-hole meshes.
const grilleTexture = (() => {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cx = (x + (Math.floor(y / 8) % 2) * 4) % 8 - 3.5;
    const cy = y % 8 - 3.5;
    const distance = Math.sqrt(cx * cx + cy * cy);
    const value = distance < 2.1 ? 32 : distance < 2.8 ? 120 : 238;
    const offset = (y * size + x) * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
})();

export function GrilleMaterial({ color = '#55555d', roughness = 0.58, metalness = 0.65 }: { color?: string; roughness?: number; metalness?: number }) {
  return <meshStandardMaterial color={color} map={grilleTexture} bumpMap={grilleTexture} bumpScale={0.0015} roughness={roughness} metalness={metalness} />;
}
