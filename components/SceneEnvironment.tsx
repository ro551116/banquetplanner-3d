import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HallConfig } from '../types';

// Generated locally: the viewport and exported images do not depend on an HDR CDN.
function StudioReflections({ night }: { night: boolean }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const room = new RoomEnvironment();
    // Lower the radiance itself on Three r160 (no scene.environmentIntensity).
    room.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshBasicMaterial) {
        object.material.color.multiplyScalar(night ? 0.22 : 0.65);
      }
      if (object instanceof THREE.Light) object.intensity = night ? 198 : 585;
    });
    const generator = new THREE.PMREMGenerator(gl);
    const map = generator.fromScene(room, 0.04);
    const previous = scene.environment;
    scene.environment = map.texture;
    room.dispose();
    generator.dispose();
    return () => {
      scene.environment = previous;
      map.dispose();
    };
  }, [gl, scene, night]);
  useEffect(() => {
    gl.toneMappingExposure = 0.95;
  }, [gl, night]);
  return null;
}

function stoneRelief(width: number, length: number) {
  const size = 256;
  const pixels = new Uint8Array(size * size * 4);
  let seed = 1709;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = (seed >>> 24) / 255;
      const seam = x < 1 || y < 1;
      const value = seam ? 105 : 190 + Math.round(grain * 22);
      const index = (y * size + x) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width / 1.5, length / 1.5);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

interface WallProps {
  hall: HallConfig;
  axis: 'x' | 'z';
  sign: number;
}

function CutawayWall({ hall, axis, sign }: WallProps) {
  const group = useRef<THREE.Group>(null);
  const span = axis === 'x' ? hall.length : hall.width;
  const boundary = (axis === 'x' ? hall.width : hall.length) / 2;
  const panelCount = Math.max(1, Math.ceil(span / 3));
  useFrame(({ camera }) => {
    if (!group.current) return;
    // Cut away near walls only for exterior viewpoints, including picking.
    const visible = camera.position[axis] * sign < boundary + 0.15;
    if (group.current.visible !== visible) {
      group.current.visible = visible;
      group.current.traverse(object => object.layers.set(visible ? 0 : 31));
    }
  });
  return (
    <group ref={group} position={axis === 'x' ? [sign * boundary, 0, 0] : [0, 0, sign * boundary]} rotation={[0, axis === 'x' ? Math.PI / 2 : 0, 0]}>
      <mesh position={[0, hall.height / 2, 0]} receiveShadow>
        <boxGeometry args={[span, hall.height, 0.12]} />
        <meshStandardMaterial color={hall.wallColor} roughness={hall.wallRoughness ?? 0.85} metalness={hall.wallMetalness ?? 0} envMapIntensity={0.35} />
      </mesh>
      {Array.from({ length: panelCount - 1 }, (_, index) => (
        <mesh key={index} position={[-span / 2 + (index + 1) * span / panelCount, hall.height / 2, 0]}>
          <boxGeometry args={[0.018, hall.height - 0.16, 0.125]} />
          <meshStandardMaterial color={hall.wallColor} roughness={1} envMapIntensity={0.08} />
        </mesh>
      ))}
      {hall.baseboard && (
        <mesh position={[0, 0.08, 0]} receiveShadow>
          <boxGeometry args={[span, 0.16, 0.17]} />
          <meshStandardMaterial color={hall.baseboard} roughness={0.5} metalness={0.1} />
        </mesh>
      )}
      <mesh position={[0, hall.height - 0.06, 0]}>
        <boxGeometry args={[span, 0.12, 0.17]} />
        <meshStandardMaterial color={hall.wallColor} roughness={0.55} />
      </mesh>
    </group>
  );
}

interface SceneEnvironmentProps {
  hall: HallConfig;
  night: boolean;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (event: ThreeEvent<PointerEvent>) => void;
}

export function SceneEnvironment({ hall, night, onPointerDown, onPointerMove, onPointerUp }: SceneEnvironmentProps) {
  const relief = useMemo(() => stoneRelief(hall.width, hall.length), [hall.width, hall.length]);
  useEffect(() => () => relief.dispose(), [relief]);
  const extent = Math.max(hall.width, hall.length, hall.height * 2);
  const backdrop = night ? '#161d2a' : '#e5e3df';
  return (
    <>
      <color attach="background" args={[backdrop]} />
      <fog attach="fog" args={[backdrop, extent * 2.5, extent * 7]} />
      <StudioReflections night={night} />
      <hemisphereLight args={[night ? '#aebddc' : '#edf3ff', night ? '#393044' : '#b3a28d', night ? 0.35 : 0.45]} />
      <directionalLight
        position={[-extent * 0.35, extent * 0.85, extent * 0.3]}
        color={night ? '#b7c9ed' : '#fff1da'} intensity={night ? 0.7 : 1.5}
        castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-extent * 0.8} shadow-camera-right={extent * 0.8}
        shadow-camera-top={extent * 0.8} shadow-camera-bottom={-extent * 0.8}
        shadow-camera-near={0.1} shadow-camera-far={extent * 3}
        shadow-bias={-0.00008} shadow-normalBias={0.025}
      />
      <directionalLight position={[extent * 0.5, extent * 0.35, -extent * 0.5]} color={night ? '#e8c9a1' : '#d5e3ff'} intensity={night ? 0.28 : 0.45} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]} receiveShadow onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <planeGeometry args={[Math.max(200, extent * 10), Math.max(200, extent * 10)]} />
        <meshStandardMaterial color={backdrop} roughness={1} envMapIntensity={0.2} />
      </mesh>
      <mesh position={[0, -0.083, 0]} receiveShadow>
        <boxGeometry args={[hall.width + 0.16, 0.16, hall.length + 0.16]} />
        <meshStandardMaterial color={hall.floorColor} roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <planeGeometry args={[hall.width, hall.length]} />
        <meshStandardMaterial color={hall.floorColor} roughness={hall.floorRoughness ?? 0.6} metalness={hall.floorMetalness ?? 0.05} bumpMap={relief} bumpScale={0.018} roughnessMap={relief} envMapIntensity={0.65} />
      </mesh>
      <CutawayWall hall={hall} axis="x" sign={-1} />
      <CutawayWall hall={hall} axis="x" sign={1} />
      <CutawayWall hall={hall} axis="z" sign={-1} />
      <CutawayWall hall={hall} axis="z" sign={1} />
    </>
  );
}
