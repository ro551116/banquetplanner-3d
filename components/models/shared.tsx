import React, { useMemo, useContext, useLayoutEffect, useRef } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { TABLE_CLOTH_MATERIALS } from '../../constants';
import { RenderSettingsContext } from '../RenderSettings';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createTubeGeometry } from './details';

export const Highlight = ({ color = "#3b82f6" }: { color?: string }) => {
  const ref = useRef<THREE.LineSegments>(null);
  const resource = useRef<{ source: THREE.BufferGeometry; edges: THREE.EdgesGeometry } | null>(null);
  useLayoutEffect(() => {
    const line = ref.current;
    const source = (line?.parent as THREE.Mesh | undefined)?.geometry;
    if (!line || !source || resource.current?.source === source) return;
    const edges = new THREE.EdgesGeometry(source, 15);
    line.geometry.dispose();
    line.geometry = edges;
    resource.current = { source, edges };
  });
  useLayoutEffect(() => () => {
    resource.current?.edges.dispose();
    resource.current = null;
  }, []);
  return (
    <lineSegments ref={ref} scale={1.02} raycast={() => null}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  );
};

export const Label = ({ text }: { text: string }) => {
  const { showLabels } = useContext(RenderSettingsContext);
  if (!showLabels) return null;

  return (
    <Html position={[0, 2, 0]} center distanceFactor={15} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
      <div className="bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded shadow-sm whitespace-nowrap backdrop-blur-sm border border-white/10">
        {text}
      </div>
    </Html>
  );
};

export const LightSource = ({ color, intensity }: { color: string, intensity: number }) => {
  const { night } = useContext(RenderSettingsContext);
  const target = useMemo(() => {
    const t = new THREE.Object3D();
    t.position.set(0, 0, 6); // Target in front (local Z)
    return t;
  }, []);

  // Don't render light if intensity is 0 to save performance
  if (intensity <= 0) return null;

  const multiplier = night ? 32 : 24;

  return (
    <>
      <primitive object={target} />
      <spotLight 
        position={[0, 0, 0]}
        color={color} 
        intensity={intensity * multiplier}
        distance={25}
        angle={0.65}
        penumbra={0.7}
        decay={2}
        target={target}
      />
    </>
  );
};

function mergeParts(parts: THREE.BufferGeometry[]) {
  const mixedIndices = parts.some(part => !!part.index !== !!parts[0].index);
  const normalized = mixedIndices ? parts.map(part => part.index ? part.toNonIndexed() : part) : parts;
  const geometry = mergeGeometries(normalized)!;
  normalized.forEach((part, index) => { if (part !== parts[index]) part.dispose(); });
  parts.forEach(part => part.dispose());
  return geometry;
}

const standMetal = new THREE.MeshStandardMaterial({ color: '#535b61', metalness: 0.8, roughness: 0.28 });
const standRubber = new THREE.MeshStandardMaterial({ color: '#181c20', metalness: 0.05, roughness: 0.8 });
const tripodParts = (() => {
  const tubes = [
    createTubeGeometry([0, 0.035, 0], [0, 0.79, 0], 0.026, 20),
    createTubeGeometry([0, 0.77, 0], [0, 1.2, 0], 0.019, 20),
  ];
  const fittings: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(0.047, 0.043, 0.095, 20).translate(0, 0.78, 0),
    new THREE.CylinderGeometry(0.039, 0.039, 0.065, 20).translate(0, 0.32, 0),
    new THREE.CylinderGeometry(0.031, 0.031, 0.025, 20).translate(0, 1.14, 0),
  ];
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3, x = Math.sin(angle), z = Math.cos(angle);
    tubes.push(createTubeGeometry([x * 0.02, 0.77, z * 0.02], [x * 0.59, 0.045, z * 0.59], 0.018));
    tubes.push(createTubeGeometry([0, 0.32, 0], [x * 0.3, 0.42, z * 0.3], 0.009, 8));
    fittings.push(new RoundedBoxGeometry(0.065, 0.035, 0.095, 2, 0.012).rotateY(angle).translate(x * 0.59, 0.0175, z * 0.59));
  }
  fittings.push(new RoundedBoxGeometry(0.065, 0.022, 0.024, 2, 0.006).translate(0.04, 0.8, 0));
  fittings.push(new RoundedBoxGeometry(0.058, 0.02, 0.022, 2, 0.006).translate(0.035, 1.14, 0));
  return { tubes: mergeParts(tubes), fittings: mergeParts(fittings) };
})();

export const TripodBase = () => (
  <group>
    <mesh geometry={tripodParts.tubes} material={standMetal} castShadow receiveShadow />
    <mesh geometry={tripodParts.fittings} material={standRubber} castShadow receiveShadow />
  </group>
);

const plateParts = (() => {
  const metal = [
    new RoundedBoxGeometry(0.6, 0.035, 0.6, 2, 0.012).translate(0, 0.0315, 0),
    new THREE.CylinderGeometry(0.04, 0.045, 0.07, 20).translate(0, 0.08, 0),
    createTubeGeometry([0, 0.08, 0], [0, 1.2, 0], 0.022, 20),
  ];
  const feet: THREE.BufferGeometry[] = [];
  for (const x of [-0.25, 0.25]) for (const z of [-0.25, 0.25]) {
    feet.push(new THREE.CylinderGeometry(0.027, 0.03, 0.014, 12).translate(x, 0.007, z));
  }
  feet.push(new THREE.CylinderGeometry(0.028, 0.028, 0.035, 16).translate(0, 1.12, 0));
  return { metal: mergeParts(metal), feet: mergeParts(feet) };
})();

export const PlateBase = () => (
  <group>
    <mesh geometry={plateParts.metal} material={standMetal} castShadow receiveShadow />
    <mesh geometry={plateParts.feet} material={standRubber} castShadow receiveShadow />
  </group>
);

// One upholstered banquet-chair model, instanced by each table in three draw calls.
const chairParts = (() => {
  const frame: THREE.BufferGeometry[] = [];
  const feet: THREE.BufferGeometry[] = [];
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    frame.push(createTubeGeometry([x * 0.195, 0.025, z * 0.195], [x * 0.175, 0.425, z * 0.175], 0.013, 12));
    feet.push(new RoundedBoxGeometry(0.035, 0.028, 0.035, 2, 0.009).translate(x * 0.195, 0.014, z * 0.195));
  }
  for (const x of [-0.175, 0.175]) {
    frame.push(createTubeGeometry([x, 0.425, -0.175], [x, 0.425, 0.175], 0.013));
    frame.push(createTubeGeometry([x, 0.19, -0.18], [x, 0.19, 0.18], 0.01));
  }
  frame.push(createTubeGeometry([-0.175, 0.425, -0.175], [0.175, 0.425, -0.175], 0.013));
  frame.push(createTubeGeometry([-0.175, 0.425, 0.175], [0.175, 0.425, 0.175], 0.013));
  const arch = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.225, 0.425, 0.18), new THREE.Vector3(-0.225, 0.87, 0.22),
    new THREE.Vector3(-0.16, 1.01, 0.24), new THREE.Vector3(0, 1.045, 0.24),
    new THREE.Vector3(0.16, 1.01, 0.24), new THREE.Vector3(0.225, 0.87, 0.22),
    new THREE.Vector3(0.225, 0.425, 0.18),
  ]);
  frame.push(new THREE.TubeGeometry(arch, 28, 0.012, 8, false));
  const profile = new THREE.Shape();
  profile.moveTo(-0.18, 0);
  profile.quadraticCurveTo(-0.205, 0, -0.205, 0.03);
  profile.lineTo(-0.205, 0.28);
  profile.quadraticCurveTo(-0.205, 0.42, 0, 0.43);
  profile.quadraticCurveTo(0.205, 0.42, 0.205, 0.28);
  profile.lineTo(0.205, 0.03);
  profile.quadraticCurveTo(0.205, 0, 0.18, 0);
  profile.closePath();
  const back = new THREE.ExtrudeGeometry(profile, { depth: 0.025, steps: 1, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 12 });
  const positions = back.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i);
    positions.setZ(i, positions.getZ(i) + y * 0.08 - 0.025 * (1 - (x / 0.22) ** 2));
  }
  back.computeVertexNormals();
  back.translate(0, 0.565, 0.195);
  const seat = new RoundedBoxGeometry(0.43, 0.07, 0.43, 2, 0.03).translate(0, 0.46, 0);
  return { frame: mergeParts(frame), upholstery: mergeParts([seat, back]), feet: mergeParts(feet) };
})();
const chairMetal = new THREE.MeshStandardMaterial({ color: '#bba16b', metalness: 0.78, roughness: 0.3 });
const chairFabric = new THREE.MeshPhysicalMaterial({ color: '#eee8dc', roughness: 0.85, metalness: 0, sheen: 0.4, sheenRoughness: 0.65, sheenColor: '#ffffff' });

export interface ChairPlacement {
  position: [number, number, number];
  rotation: number;
}

export function BanquetChairs({ placements }: { placements: ChairPlacement[] }) {
  const frame = useRef<THREE.InstancedMesh>(null);
  const upholstery = useRef<THREE.InstancedMesh>(null);
  const feet = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const transform = new THREE.Object3D();
    const meshes = [frame.current, upholstery.current, feet.current];
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
  }, [placements]);
  return (
    <group>
      <instancedMesh ref={frame} args={[chairParts.frame, chairMetal, placements.length]} castShadow receiveShadow />
      <instancedMesh ref={upholstery} args={[chairParts.upholstery, chairFabric, placements.length]} castShadow receiveShadow />
      <instancedMesh ref={feet} args={[chairParts.feet, standRubber, placements.length]} castShadow receiveShadow />
    </group>
  );
}

// --- Specific Object Implementations ---

// One small texture shared by every fabric surface for the lifetime of the app.
let fabricRelief: THREE.DataTexture | undefined;
function getFabricRelief() {
  if (fabricRelief) return fabricRelief;
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  const threadHeights = [150, 195, 220, 180];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = (y * size + x) * 4;
    const thread = ((x >> 2) + (y >> 2)) % 2 === 0 ? x % 4 : y % 4;
    const value = threadHeights[thread];
    pixels[index] = pixels[index + 1] = pixels[index + 2] = value;
    pixels[index + 3] = 255;
  }
  fabricRelief = new THREE.DataTexture(pixels, size, size);
  fabricRelief.wrapS = fabricRelief.wrapT = THREE.RepeatWrapping;
  fabricRelief.repeat.set(16, 16);
  fabricRelief.magFilter = THREE.LinearFilter;
  fabricRelief.minFilter = THREE.LinearMipmapLinearFilter;
  fabricRelief.generateMipmaps = true;
  fabricRelief.needsUpdate = true;
  return fabricRelief;
}

export const TableClothMaterial = ({ color, tableCloth }: { color: string; tableCloth: string }) => {
  const mat = TABLE_CLOTH_MATERIALS[tableCloth as keyof typeof TABLE_CLOTH_MATERIALS] || TABLE_CLOTH_MATERIALS.linen;
  const sheenColor = useMemo(() => {
    const factor = mat.sheenColorFactor ?? 0.3;
    return new THREE.Color(color).lerp(new THREE.Color('#ffffff'), factor);
  }, [color, mat.sheenColorFactor]);

  return (
    <meshPhysicalMaterial
      color={color}
      bumpMap={getFabricRelief()}
      bumpScale={tableCloth === 'satin' ? 0.002 : 0.006}
      roughness={mat.roughness}
      metalness={mat.metalness}
      clearcoat={mat.clearcoat ?? 0}
      clearcoatRoughness={mat.clearcoatRoughness ?? 0}
      sheen={mat.sheen ?? (tableCloth === 'linen' ? 0.2 : 0)}
      sheenRoughness={mat.sheenRoughness ?? 0.3}
      sheenColor={sheenColor}
    />
  );
};
