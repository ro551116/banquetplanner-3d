import * as THREE from 'three';
import type { PathPoint } from '../../types';

/** Caps the miter at very sharp corners so offset corners cannot spike across the room. */
const MITER_LIMIT = 4;

/** Drops repeated vertices (and, for a closed loop, a last vertex equal to the first). */
export function cleanPolyline(points: PathPoint[], closed: boolean): PathPoint[] {
  const same = (a: PathPoint, b: PathPoint) => Math.hypot(a.x - b.x, a.z - b.z) < 1e-6;
  const result = points.filter((point, index) => index === 0 || !same(point, points[index - 1]));
  if (closed && result.length > 1 && same(result[0], result[result.length - 1])) result.pop();
  return result;
}

/**
 * The polyline moved `distance` along its left normal (-dz, dx) with mitred joins; open ends move
 * perpendicular to their segment. Expects a cleaned polyline.
 */
export function offsetPolyline(points: PathPoint[], distance: number, closed: boolean): PathPoint[] {
  const count = points.length;
  const segmentNormal = (from: PathPoint, to: PathPoint) => {
    const length = Math.hypot(to.x - from.x, to.z - from.z) || 1;
    return { x: -(to.z - from.z) / length, z: (to.x - from.x) / length };
  };
  return points.map((point, index) => {
    const hasPrevious = closed || index > 0, hasNext = closed || index < count - 1;
    const before = hasPrevious ? segmentNormal(points[(index - 1 + count) % count], point) : null;
    const after = hasNext ? segmentNormal(point, points[(index + 1) % count]) : null;
    let miter = before ?? after!;
    if (before && after) {
      const dot = before.x * after.x + before.z * after.z;
      if (1 + dot < 1e-3) miter = after;
      else {
        const scale = Math.min(MITER_LIMIT, 1 / (1 + dot));
        miter = { x: (before.x + after.x) * scale, z: (before.z + after.z) * scale };
      }
    }
    return { x: point.x + miter.x * distance, z: point.z + miter.z * distance };
  });
}

/** One mitred quad per segment of a wall centred on the polyline: [left start, left end, right end, right start]. */
export function wallBands(points: PathPoint[], halfThickness: number, closed: boolean): PathPoint[][] {
  const left = offsetPolyline(points, halfThickness, closed);
  const right = offsetPolyline(points, -halfThickness, closed);
  const segments = closed ? points.length : points.length - 1;
  return Array.from({ length: Math.max(0, segments) }, (_, i) => {
    const j = (i + 1) % points.length;
    return [left[i], left[j], right[j], right[i]];
  });
}

/** Vertical prism over an XZ polygon; shape Y is -Z so ExtrudeGeometry rotated -90° about X lands on world XZ. */
export function prismGeometry(points: PathPoint[], bottom: number, height: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(point => new THREE.Vector2(point.x, -point.z)));
  return new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, bottom, 0);
}
