import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { SoftBox, createTubeGeometry } from './details';
import { Highlight, mergeParts } from './shared';
import type { ObjectModelProps } from './modelProps';

type V2 = [number, number];

/**
 * Flat ribbons (triangle strips lying in the XZ plane, facing +Y) along polylines of [x, z] points.
 * Corners are mitred. Returned geometry is caller-owned.
 */
function buildRibbons(paths: V2[][], width: number, y: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const half = width / 2;
  for (const path of paths) {
    if (path.length < 2) continue;
    const segmentNormals = path.slice(1).map(([x1, z1], i): V2 => {
      const [x0, z0] = path[i];
      const length = Math.hypot(x1 - x0, z1 - z0) || 1;
      return [-(z1 - z0) / length, (x1 - x0) / length];
    });
    const base = positions.length / 3;
    path.forEach(([x, z], i) => {
      const a = segmentNormals[Math.max(0, i - 1)];
      const b = segmentNormals[Math.min(segmentNormals.length - 1, i)];
      let nx = a[0] + b[0];
      let nz = a[1] + b[1];
      const length = Math.hypot(nx, nz) || 1;
      nx /= length;
      nz /= length;
      const reach = half / Math.max(0.3, nx * a[0] + nz * a[1]);
      positions.push(x + nx * reach, y, z + nz * reach, x - nx * reach, y, z - nz * reach);
      normals.push(0, 1, 0, 0, 1, 0);
    });
    for (let i = 0; i < path.length - 1; i++) {
      const l = base + i * 2;
      indices.push(l, l + 2, l + 1, l + 1, l + 2, l + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

// ---------------------------------------------------------------------------
// Door
// ---------------------------------------------------------------------------

const WALL_THICKNESS = 0.12;
const FRAME_DEPTH = 0.2;
const JAMB = 0.08;
const THRESHOLD = 0.02;
const LEAF_THICKNESS = 0.04;
/** Hall walls are solid boxes (no openings), so closed leaves sit just proud of the wall's room face. */
const LEAF_Z = WALL_THICKNESS / 2 + LEAF_THICKNESS / 2 + 0.004;

const brassMaterial = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.85, roughness: 0.3 });
const swingMaterial = new THREE.MeshBasicMaterial({
  color: '#c4c8cf', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});

const box = (w: number, h: number, d: number, x: number, y: number, z: number) =>
  new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/**
 * One door leaf centred on x=0, bottom at y=0. `handleSide` (+1/-1) is the x side of the pull handle.
 * Wood (slab + raised panels) and brass (handles, plates, hinges) are separate merged geometries.
 */
function buildLeafGeometry(width: number, height: number, handleSide: 1 | -1) {
  const wood: THREE.BufferGeometry[] = [box(width, height, LEAF_THICKNESS, 0, height / 2, 0)];
  const brass: THREE.BufferGeometry[] = [];
  const margin = Math.min(0.1, width * 0.15);
  const panelW = width - margin * 2;
  const lowerTop = height * 0.38;
  const upperBottom = height * 0.46;
  const half = LEAF_THICKNESS / 2;
  const handleX = handleSide * (width / 2 - 0.05);
  const handleY = Math.min(1.1, height * 0.5);
  for (const f of [-1, 1]) {
    // Raised panels (lower, upper), 8 mm proud of the slab.
    wood.push(box(panelW, lowerTop - margin, 0.012, 0, (lowerTop + margin) / 2, f * (half + 0.002)));
    wood.push(box(panelW, height - margin - upperBottom, 0.012, 0, (height - margin + upperBottom) / 2, f * (half + 0.002)));
    // Pull handle on standoffs, push plate above it, kick plate at the bottom.
    for (const dy of [-0.14, 0.14]) {
      brass.push(createTubeGeometry([handleX, handleY + dy, f * half], [handleX, handleY + dy, f * 0.05], 0.006, 8));
    }
    brass.push(createTubeGeometry([handleX, handleY - 0.2, f * 0.05], [handleX, handleY + 0.2, f * 0.05], 0.011, 10));
    brass.push(box(0.07, 0.22, 0.006, handleX, handleY + 0.34, f * (half + 0.003)));
    brass.push(box(width - 0.12, 0.16, 0.006, 0, 0.1, f * (half + 0.0115)));
  }
  // Hinge knuckles on the hinge edge.
  for (const y of [0.22, height / 2, height - 0.22]) {
    brass.push(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8).translate(-handleSide * (width / 2), y, 0));
  }
  return { wood: mergeParts(wood), brass: mergeParts(brass) };
}

function DoorLeaf({ x, width, height, handleSide, material }: { x: number; width: number; height: number; handleSide: 1 | -1; material: THREE.Material }) {
  const geometry = useMemo(() => buildLeafGeometry(width, height, handleSide), [width, height, handleSide]);
  useEffect(() => () => {
    geometry.wood.dispose();
    geometry.brass.dispose();
  }, [geometry]);
  return (
    <group position={[x, THRESHOLD + 0.002, LEAF_Z]}>
      <mesh geometry={geometry.wood} material={material} castShadow receiveShadow />
      <mesh geometry={geometry.brass} material={brassMaterial} castShadow receiveShadow />
    </group>
  );
}

export const Door = ({ color, customWidth = 1.8, customHeight = 2.4, doorLeaves = 2, selected, isEditMode }: ObjectModelProps) => {
  const width = Math.max(0.6, customWidth);
  const height = Math.max(1.6, customHeight);
  const leaves = doorLeaves === 1 ? 1 : 2;
  const clearW = width - JAMB * 2;
  const gap = 0.004;
  const leafW = leaves === 2 ? (clearW - gap) / 2 : clearW - gap;
  const leafH = height - JAMB - THRESHOLD - 0.004;

  const leafMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 }), [color]);
  const frameMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.08), roughness: 0.6, metalness: 0 }),
    [color],
  );
  useEffect(() => () => leafMaterial.dispose(), [leafMaterial]);
  useEffect(() => () => frameMaterial.dispose(), [frameMaterial]);

  // Jambs and head sit inside the opening (deeper than the wall); casing boards sit on both wall faces.
  const frameGeometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const casingZ = WALL_THICKNESS / 2 + 0.01;
    for (const s of [-1, 1]) {
      parts.push(box(JAMB, height, FRAME_DEPTH, s * (width / 2 - JAMB / 2), height / 2, 0));
      for (const f of [-1, 1]) parts.push(box(0.07, height + 0.07, 0.02, s * (width / 2 + 0.035), (height + 0.07) / 2, f * casingZ));
    }
    parts.push(box(width, JAMB, FRAME_DEPTH, 0, height - JAMB / 2, 0));
    for (const f of [-1, 1]) parts.push(box(width + 0.14, 0.07, 0.02, 0, height + 0.035, f * casingZ));
    return mergeParts(parts);
  }, [width, height]);
  useEffect(() => () => frameGeometry.dispose(), [frameGeometry]);

  // Plan-style swing: leaf at 90 degrees plus a quarter-circle arc per leaf, into the room (+Z).
  const swingGeometry = useMemo(() => {
    const paths: V2[][] = [];
    const swing = (hingeX: number, length: number, closedAngle: number) => {
      paths.push([[hingeX, 0], [hingeX, length]]);
      const arc: V2[] = [];
      for (let i = 0; i <= 24; i++) {
        const angle = closedAngle + ((Math.PI / 2 - closedAngle) * i) / 24;
        arc.push([hingeX + length * Math.cos(angle), length * Math.sin(angle)]);
      }
      paths.push(arc);
    };
    swing(-clearW / 2, leafW, 0);
    if (leaves === 2) swing(clearW / 2, leafW, Math.PI);
    return buildRibbons(paths, 0.014, 0.006);
  }, [clearW, leafW, leaves]);
  useEffect(() => () => swingGeometry.dispose(), [swingGeometry]);

  return (
    <group>
      <mesh geometry={frameGeometry} material={frameMaterial} castShadow receiveShadow>
        {selected && isEditMode && <Highlight />}
      </mesh>
      <mesh position={[0, 0.006, 0]} material={brassMaterial} receiveShadow>
        <boxGeometry args={[clearW, 0.012, FRAME_DEPTH - 0.04]} />
      </mesh>
      {leaves === 2 ? (
        <>
          <DoorLeaf x={-clearW / 2 + leafW / 2} width={leafW} height={leafH} handleSide={1} material={leafMaterial} />
          <DoorLeaf x={clearW / 2 - leafW / 2} width={leafW} height={leafH} handleSide={-1} material={leafMaterial} />
        </>
      ) : (
        <DoorLeaf x={0} width={leafW} height={leafH} handleSide={1} material={leafMaterial} />
      )}
      <mesh geometry={swingGeometry} material={swingMaterial} raycast={() => null} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

// [height, outset] of each plinth / crown layer (bottom-up for the plinth, top-down for the crown).
const PLINTH_LAYERS: [number, number][] = [[0.12, 0.1], [0.06, 0.05]];
const CROWN_LAYERS: [number, number][] = [[0.06, 0.05], [0.1, 0.1]];

export const Column = ({ color, shape = 'rect', customWidth = 0.6, customDepth = 0.6, customHeight = 5, selected, isEditMode }: ObjectModelProps) => {
  const round = shape === 'round';
  const w = Math.max(0.2, customWidth);
  const d = round ? w : Math.max(0.2, customDepth);
  const h = Math.max(0.6, customHeight);
  const baseH = PLINTH_LAYERS.reduce((sum, [height]) => sum + height, 0);
  const crownH = CROWN_LAYERS.reduce((sum, [height]) => sum + height, 0);
  const shaftH = h - baseH - crownH;

  const layers: { y: number; height: number; outset: number }[] = [];
  let y = 0;
  for (const [height, outset] of PLINTH_LAYERS) {
    layers.push({ y: y + height / 2, height, outset });
    y += height;
  }
  const shaftBottom = y;
  y = h - crownH;
  for (const [height, outset] of CROWN_LAYERS) {
    layers.push({ y: y + height / 2, height, outset });
    y += height;
  }

  return (
    <group>
      {round ? (
        <>
          <mesh position={[0, shaftBottom + shaftH / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[w / 2, w / 2, shaftH, 48]} />
            <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
            {selected && isEditMode && <Highlight />}
          </mesh>
          {layers.map(layer => (
            <mesh key={layer.y} position={[0, layer.y, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[w / 2 + layer.outset / 2, w / 2 + layer.outset / 2, layer.height, 48]} />
              <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
            </mesh>
          ))}
        </>
      ) : (
        <>
          <SoftBox size={[w, shaftH, d]} position={[0, shaftBottom + shaftH / 2, 0]} radius={0.015} color={color} roughness={0.9} metalness={0}>
            {selected && isEditMode && <Highlight />}
          </SoftBox>
          {layers.map(layer => (
            <SoftBox key={layer.y} size={[w + layer.outset, layer.height, d + layer.outset]} position={[0, layer.y, 0]} radius={0.01} color={color} roughness={0.9} metalness={0} />
          ))}
        </>
      )}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Zone (floor area marker)
// ---------------------------------------------------------------------------

const ZONE_FILL_Y = 0.004;
const ZONE_OUTLINE_Y = 0.008;
const ZONE_OUTLINE_WIDTH = 0.04;

/** Splits a closed polyline (first point repeated at the end) into evenly spaced dashes. */
function dashPath(path: V2[], target = 0.35, dashRatio = 0.62): V2[][] {
  const cumulative = [0];
  for (let i = 1; i < path.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  }
  const perimeter = cumulative[cumulative.length - 1];
  const count = Math.max(4, Math.round(perimeter / target));
  const period = perimeter / count;
  const dash = period * dashRatio;
  const at = (s: number): V2 => {
    let i = 0;
    while (i < path.length - 2 && cumulative[i + 1] < s) i++;
    const span = cumulative[i + 1] - cumulative[i] || 1;
    const t = (s - cumulative[i]) / span;
    return [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t];
  };
  const dashes: V2[][] = [];
  for (let n = 0; n < count; n++) {
    const start = n * period + (period - dash) / 2;
    const end = start + dash;
    const points: V2[] = [at(start)];
    for (let i = 0; i < path.length; i++) if (cumulative[i] > start && cumulative[i] < end) points.push(path[i]);
    points.push(at(end));
    dashes.push(points);
  }
  return dashes;
}

export const Zone = ({ color, shape = 'rect', customWidth = 3, customDepth = 2 }: ObjectModelProps) => {
  const w = Math.max(0.2, customWidth);
  const d = Math.max(0.2, customDepth);
  const round = shape === 'round';

  const outlineGeometry = useMemo(() => {
    const a = w / 2;
    const b = d / 2;
    let path: V2[];
    if (round) {
      path = [];
      for (let i = 0; i <= 96; i++) path.push([a * Math.cos((i / 96) * Math.PI * 2), b * Math.sin((i / 96) * Math.PI * 2)]);
    } else {
      path = [[-a, -b], [a, -b], [a, b], [-a, b], [-a, -b]];
    }
    return buildRibbons(dashPath(path), ZONE_OUTLINE_WIDTH, ZONE_OUTLINE_Y);
  }, [w, d, round]);
  useEffect(() => () => outlineGeometry.dispose(), [outlineGeometry]);

  return (
    <group>
      <mesh position={[0, ZONE_FILL_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={round ? [w, d, 1] : [1, 1, 1]} renderOrder={1}>
        {round ? <circleGeometry args={[0.5, 64]} /> : <planeGeometry args={[w, d]} />}
        <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      <mesh geometry={outlineGeometry} renderOrder={2}>
        <meshBasicMaterial color={color} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
    </group>
  );
};
