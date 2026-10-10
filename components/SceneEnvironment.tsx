import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HallConfig, PathPoint } from '../types';
import { getHallOutline, getOutlineBounds, getWallSegments, signedArea, WallSegment } from '../planning';
import { cleanPolyline, offsetPolyline, prismGeometry, wallBands } from './models/wallGeometry';

// Generated locally: the viewport and exported images do not depend on an HDR CDN.
function StudioReflections({ night }: { night: boolean }) {
  const { gl, scene, invalidate } = useThree();
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
    invalidate();
    room.dispose();
    generator.dispose();
    return () => {
      scene.environment = previous;
      map.dispose();
      invalidate();
    };
  }, [gl, scene, night, invalidate]);
  useEffect(() => {
    gl.toneMappingExposure = 0.95;
    invalidate();
  }, [gl, night, invalidate]);
  return null;
}

// Relief UVs are in meters (floor ShapeGeometry), so one 1.5 m stone tile per texture repeat for any hall shape.
function stoneRelief() {
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
  texture.repeat.set(1 / 1.5, 1 / 1.5);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const WALL_HALF_THICKNESS = 0.06;
const TRIM_HALF_DEPTH = 0.085;
const BASEBOARD_HEIGHT = 0.16;
const CROWN_HEIGHT = 0.12;

interface WallPiece {
  wall: WallSegment;
  midpoint: PathPoint;
  body: THREE.BufferGeometry;
  baseboard: THREE.BufferGeometry;
  crown: THREE.BufferGeometry;
  seams: Array<{ position: [number, number, number]; rotationY: number }>;
}

function buildWalls(outline: PathPoint[], height: number): WallPiece[] {
  const corners = cleanPolyline(outline, true);
  const walls = getWallSegments(corners);
  const bodies = wallBands(corners, WALL_HALF_THICKNESS, true);
  const trims = wallBands(corners, TRIM_HALF_DEPTH, true);
  return walls.map((wall, k) => {
    const panels = Math.max(1, Math.ceil(wall.length / 3));
    return {
      wall,
      midpoint: { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 },
      body: prismGeometry(bodies[k], 0, height),
      baseboard: prismGeometry(trims[k], 0, BASEBOARD_HEIGHT),
      crown: prismGeometry(trims[k], height - CROWN_HEIGHT, CROWN_HEIGHT),
      seams: Array.from({ length: panels - 1 }, (_, index) => {
        const along = (index + 1) * wall.length / panels;
        return {
          position: [wall.start.x + wall.direction.x * along, height / 2, wall.start.z + wall.direction.z * along],
          rotationY: Math.atan2(-wall.direction.z, wall.direction.x),
        };
      }),
    };
  });
}

function CutawayWall({ piece, hall }: { piece: WallPiece; hall: HallConfig }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera, invalidate }) => {
    if (!group.current) return;
    // Cut away walls whose outer side faces the camera (exterior viewpoints), including picking.
    const outside = (camera.position.x - piece.midpoint.x) * -piece.wall.inward.x + (camera.position.z - piece.midpoint.z) * -piece.wall.inward.z;
    const visible = outside < 0.15;
    if (group.current.visible !== visible) {
      group.current.visible = visible;
      group.current.traverse(object => object.layers.set(visible ? 0 : 31));
      invalidate();
    }
  });
  return (
    <group ref={group}>
      <mesh geometry={piece.body} receiveShadow>
        <meshStandardMaterial color={hall.wallColor} roughness={hall.wallRoughness ?? 0.85} metalness={hall.wallMetalness ?? 0} envMapIntensity={0.35} />
      </mesh>
      {piece.seams.map((seam, index) => (
        <mesh key={index} position={seam.position} rotation={[0, seam.rotationY, 0]}>
          <boxGeometry args={[0.018, hall.height - 0.16, 0.125]} />
          <meshStandardMaterial color={hall.wallColor} roughness={1} envMapIntensity={0.08} />
        </mesh>
      ))}
      {hall.baseboard && (
        <mesh geometry={piece.baseboard} receiveShadow>
          <meshStandardMaterial color={hall.baseboard} roughness={0.5} metalness={0.1} />
        </mesh>
      )}
      <mesh geometry={piece.crown}>
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
  const relief = useMemo(() => stoneRelief(), []);
  useEffect(() => () => relief.dispose(), [relief]);
  // getHallOutline builds a fresh rectangle for plain halls; key the geometry on the inputs, not the array.
  const outline = useMemo(() => getHallOutline(hall), [hall.outline, hall.width, hall.length]);
  const bounds = useMemo(() => getOutlineBounds(outline), [outline]);
  const ground = useMemo(() => {
    const floor = new THREE.ShapeGeometry(new THREE.Shape(outline.map(point => new THREE.Vector2(point.x, -point.z)))).rotateX(-Math.PI / 2);
    const corners = cleanPolyline(outline, true);
    // Outward = against the inward normal, whose side of the left normal depends on the winding.
    const slab = prismGeometry(offsetPolyline(corners, signedArea(corners) >= 0 ? -0.08 : 0.08, true), -0.163, 0.16);
    return { floor, slab };
  }, [outline]);
  useEffect(() => () => { ground.floor.dispose(); ground.slab.dispose(); }, [ground]);
  const walls = useMemo(() => buildWalls(outline, hall.height), [outline, hall.height]);
  useEffect(() => () => walls.forEach(piece => { piece.body.dispose(); piece.baseboard.dispose(); piece.crown.dispose(); }), [walls]);
  // Lights aim at the origin, so an off-centre hall widens the shadow frustum by its offset.
  const extent = Math.max(bounds.width, bounds.length, hall.height * 2) + 2 * Math.hypot(bounds.centerX, bounds.centerZ);
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[bounds.centerX, -0.18, bounds.centerZ]} receiveShadow onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <planeGeometry args={[Math.max(200, extent * 10), Math.max(200, extent * 10)]} />
        <meshStandardMaterial color={backdrop} roughness={1} envMapIntensity={0.2} />
      </mesh>
      <mesh geometry={ground.slab} receiveShadow>
        <meshStandardMaterial color={hall.floorColor} roughness={0.85} />
      </mesh>
      <mesh geometry={ground.floor} receiveShadow onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <meshStandardMaterial color={hall.floorColor} roughness={hall.floorRoughness ?? 0.6} metalness={hall.floorMetalness ?? 0.05} bumpMap={relief} bumpScale={0.018} roughnessMap={relief} envMapIntensity={0.65} />
      </mesh>
      {walls.map((piece, index) => <CutawayWall key={index} piece={piece} hall={hall} />)}
    </>
  );
}
