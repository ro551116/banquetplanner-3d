import React, { useEffect, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { PathPoint } from '../../types';
import { Highlight } from './shared';
import type { ObjectModelProps } from './modelProps';

/**
 * Drawing annotations laid on the floor: circulation arrows and dimension lines.
 * Both are flat, procedural geometry built from the object's `points` (local x/z offsets in meters).
 */

type Vec2 = { x: number; z: number };

const MIN_POINT_GAP = 0.01;

/** Finite vertices only, with coincident neighbours collapsed. */
function cleanPoints(points: PathPoint[] | undefined): Vec2[] {
  const out: Vec2[] = [];
  if (!points) return out;
  for (const p of points) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
    const last = out[out.length - 1];
    if (last && Math.hypot(p.x - last.x, p.z - last.z) < MIN_POINT_GAP) continue;
    out.push({ x: p.x, z: p.z });
  }
  return out;
}

/** Collects floor-plane triangles; every triangle is wound so that it faces +Y. */
class FlatMesh {
  private readonly positions: number[] = [];

  tri(a: Vec2, b: Vec2, c: Vec2) {
    const crossY = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    if (Math.abs(crossY) < 1e-12) return;
    const [p, q] = crossY > 0 ? [b, c] : [c, b];
    this.positions.push(a.x, 0, a.z, p.x, 0, p.z, q.x, 0, q.z);
  }

  quad(a: Vec2, b: Vec2, c: Vec2, d: Vec2) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  /** Rectangle centred on `center`, `length` along `dir` (unit) and `width` across it. */
  rect(center: Vec2, dir: Vec2, length: number, width: number) {
    const hl = length / 2;
    const hw = width / 2;
    const nx = -dir.z;
    const nz = dir.x;
    const at = (f: number, l: number): Vec2 => ({ x: center.x + dir.x * f + nx * l, z: center.z + dir.z * f + nz * l });
    this.quad(at(-hl, -hw), at(hl, -hw), at(hl, hw), at(-hl, hw));
  }

  build() {
    const geometry = new THREE.BufferGeometry();
    const count = this.positions.length / 3;
    const normals = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) normals[i * 3 + 1] = 1;
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return geometry;
  }
}

/** Disposes a prop-dependent geometry when it is replaced or the model unmounts. */
function useDisposable<T extends THREE.BufferGeometry | null>(geometry: T): T {
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
}

/** Small floor disc that keeps the object selectable while its points are missing. */
const FALLBACK_GEOMETRY = new THREE.CylinderGeometry(0.16, 0.16, 0.02, 20);
const FallbackMarker = ({ color, selected, isEditMode, opacity }: { color: string; selected: boolean; isEditMode?: boolean; opacity: number }) => (
  <mesh geometry={FALLBACK_GEOMETRY} position={[0, 0.01, 0]} castShadow={false} receiveShadow={false}>
    <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
    {selected && isEditMode && <Highlight />}
  </mesh>
);

// --- Flow arrow ---------------------------------------------------------------------------

const ARROW_Y = 0.012;
const CHEVRON_Y = 0.014;
const RIBBON_WIDTH = 0.22;
const HEAD_WIDTH = 0.55;
const HEAD_LENGTH = 0.5;
const CHEVRON_MIN_SEGMENT = 1.2;
const CHEVRON_SPACING = 1.0;
const MITER_LIMIT_COS = 0.4;

interface ArrowGeometries {
  body: THREE.BufferGeometry;
  chevrons: THREE.BufferGeometry | null;
}

function buildArrow(points: Vec2[]): ArrowGeometries | null {
  const n = points.length;
  if (n < 2) return null;

  // The head sits on the last segment; the ribbon stops at its base.
  const tip = points[n - 1];
  const prev = points[n - 2];
  const lastLen = Math.hypot(tip.x - prev.x, tip.z - prev.z);
  const dir: Vec2 = { x: (tip.x - prev.x) / lastLen, z: (tip.z - prev.z) / lastLen };
  const headLength = Math.min(HEAD_LENGTH, lastLen * 0.8);
  const headHalf = (HEAD_WIDTH / 2) * (headLength / HEAD_LENGTH);
  const base: Vec2 = { x: tip.x - dir.x * headLength, z: tip.z - dir.z * headLength };
  const path = [...points.slice(0, n - 1), base];

  const body = new FlatMesh();
  const half = RIBBON_WIDTH / 2;
  const m = path.length;
  const dirs: Vec2[] = [];
  for (let i = 0; i < m - 1; i++) {
    const len = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
    dirs.push({ x: (path[i + 1].x - path[i].x) / len, z: (path[i + 1].z - path[i].z) / len });
  }
  const normals = dirs.map(d => ({ x: -d.z, z: d.x }));

  // Mitred offset vertices, with the miter length clamped for very sharp turns.
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  for (let i = 0; i < m; i++) {
    let mx: number;
    let mz: number;
    let scale = half;
    if (i === 0) {
      ({ x: mx, z: mz } = normals[0]);
    } else if (i === m - 1) {
      ({ x: mx, z: mz } = normals[m - 2]);
    } else {
      const a = normals[i - 1];
      const b = normals[i];
      const len = Math.hypot(a.x + b.x, a.z + b.z);
      if (len < 1e-4) {
        ({ x: mx, z: mz } = b);
      } else {
        mx = (a.x + b.x) / len;
        mz = (a.z + b.z) / len;
        scale = half / Math.max(mx * b.x + mz * b.z, MITER_LIMIT_COS);
      }
    }
    left.push({ x: path[i].x + mx * scale, z: path[i].z + mz * scale });
    right.push({ x: path[i].x - mx * scale, z: path[i].z - mz * scale });
  }
  for (let i = 0; i < m - 1; i++) body.quad(left[i], left[i + 1], right[i + 1], right[i]);

  // Flat arrowhead.
  const side = { x: -dir.z, z: dir.x };
  body.tri(
    tip,
    { x: base.x + side.x * headHalf, z: base.z + side.z * headHalf },
    { x: base.x - side.x * headHalf, z: base.z - side.z * headHalf },
  );

  // Chevrons (">" marks pointing along the travel direction) on long segments.
  const chev = new FlatMesh();
  let chevrons = 0;
  for (let i = 0; i < m - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const d = dirs[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < CHEVRON_MIN_SEGMENT) continue;
    const count = Math.max(1, Math.floor(len / CHEVRON_SPACING));
    const nrm = { x: -d.z, z: d.x };
    for (let k = 0; k < count; k++) {
      const t = ((k + 0.5) / count) * len;
      const cx = a.x + d.x * t;
      const cz = a.z + d.z * t;
      // Outline of a chevron in (forward, lateral) coordinates.
      const pt = (f: number, l: number): Vec2 => ({ x: cx + d.x * f + nrm.x * l, z: cz + d.z * f + nrm.z * l });
      const tipP = pt(0.06, 0);
      const wl = pt(-0.045, 0.075);
      const wl2 = pt(-0.09, 0.075);
      const notch = pt(0.015, 0);
      const wr2 = pt(-0.09, -0.075);
      const wr = pt(-0.045, -0.075);
      chev.tri(tipP, wl, wl2);
      chev.tri(tipP, wl2, notch);
      chev.tri(tipP, notch, wr2);
      chev.tri(tipP, wr2, wr);
      chevrons++;
    }
  }
  return { body: body.build(), chevrons: chevrons > 0 ? chev.build() : null };
}

export const FlowArrow = ({ points, color = '#2563eb', selected, isEditMode }: ObjectModelProps) => {
  const arrow = useMemo(() => buildArrow(cleanPoints(points)), [points]);
  const body = useDisposable(arrow?.body ?? null);
  useDisposable(arrow?.chevrons ?? null);

  if (!arrow || !body) return <FallbackMarker color={color} selected={selected} isEditMode={isEditMode} opacity={0.8} />;
  return (
    <group>
      <mesh geometry={body} position={[0, ARROW_Y, 0]}>
        <meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} toneMapped={false} />
        {selected && isEditMode && <Highlight scale={1} />}
      </mesh>
      {arrow.chevrons && (
        <mesh geometry={arrow.chevrons} position={[0, CHEVRON_Y, 0]} renderOrder={1} raycast={() => null}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
};

// --- Dimension line -----------------------------------------------------------------------

const DIM_Y = 0.03;
const DIM_LINE_WIDTH = 0.03;
const DIM_TICK_LENGTH = 0.3;
const DIM_HIT_WIDTH = 0.25;
const DIM_TAG_HEIGHT = 0.2;

interface DimensionGeometries {
  line: THREE.BufferGeometry;
  hit: THREE.BufferGeometry;
  length: number;
  mid: Vec2;
}

function buildDimension(points: Vec2[]): DimensionGeometries | null {
  if (points.length < 2) return null;
  const a = points[0];
  const b = points[points.length - 1];
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  if (length < MIN_POINT_GAP) return null;
  const dir: Vec2 = { x: (b.x - a.x) / length, z: (b.z - a.z) / length };
  const nrm: Vec2 = { x: -dir.z, z: dir.x };
  const mid: Vec2 = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };

  const line = new FlatMesh();
  line.rect(mid, dir, length, DIM_LINE_WIDTH);
  const slash = { x: (dir.x + nrm.x) * Math.SQRT1_2, z: (dir.z + nrm.z) * Math.SQRT1_2 };
  for (const end of [a, b]) {
    line.rect(end, nrm, DIM_TICK_LENGTH, DIM_LINE_WIDTH); // perpendicular extension mark
    line.rect(end, slash, DIM_TICK_LENGTH, DIM_LINE_WIDTH * 1.6); // 45° architectural slash
  }

  const hit = new FlatMesh();
  hit.rect(mid, dir, length, DIM_HIT_WIDTH);
  return { line: line.build(), hit: hit.build(), length, mid };
}

export const Dimension = ({ points, color = '#334155', label, selected, isEditMode }: ObjectModelProps) => {
  const dimension = useMemo(() => buildDimension(cleanPoints(points)), [points]);
  const line = useDisposable(dimension?.line ?? null);
  const hit = useDisposable(dimension?.hit ?? null);

  if (!dimension || !line || !hit) return <FallbackMarker color={color} selected={selected} isEditMode={isEditMode} opacity={1} />;

  const text = label?.trim() || `${Math.round(dimension.length * 100)} cm`;
  return (
    <group>
      <mesh geometry={line} position={[0, DIM_Y, 0]} castShadow={false} receiveShadow={false}>
        <meshBasicMaterial color={color} side={THREE.DoubleSide} toneMapped={false} />
        {selected && isEditMode && <Highlight scale={1} />}
      </mesh>
      <mesh geometry={hit} position={[0, DIM_Y, 0]}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <Html position={[dimension.mid.x, DIM_TAG_HEIGHT, dimension.mid.z]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
        <div className="whitespace-nowrap rounded-md bg-white px-2 py-0.5 text-center text-xs font-medium text-slate-800 shadow-sm ring-1 ring-slate-300">
          {text}
        </div>
      </Html>
    </group>
  );
};
