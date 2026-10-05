import { INITIAL_HALL } from '../constants';
import { BanquetObject, DrawingPath, HallConfig, ObjectType, Vector3 } from '../types';

// Each consumed field is validated below; optional type-specific fields are preserved.
type SceneFields = { [K in 'hall' | 'objects' | 'drawings' | 'width' | 'length' | 'height' |
  'wallColor' | 'floorColor' | 'baseboard' | 'wallRoughness' | 'wallMetalness' |
  'floorRoughness' | 'floorMetalness' | 'x' | 'y' | 'z' | 'id' | 'type' |
  'position' | 'rotation' | 'scale' | 'points' | 'color']?: unknown };
const plainFields = (value: unknown): value is SceneFields =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const knownTypes = Object.values(ObjectType);

export function normalizeSceneData(raw: unknown): {
  hall: HallConfig; objects: BanquetObject[]; drawings: DrawingPath[]; repaired: number; valid: boolean;
  /** Which sections the input actually contained (absent sections are defaults, not data). */
  present: { hall: boolean; objects: boolean; drawings: boolean };
} {
  let repaired = 0;
  const data = plainFields(raw) ? raw : {};
  const present = { hall: data.hall !== undefined, objects: data.objects !== undefined, drawings: data.drawings !== undefined };
  const valid = present.hall || present.objects || present.drawings;
  const hall = { ...INITIAL_HALL };
  if (data.hall !== undefined) {
    if (!plainFields(data.hall)) repaired++;
    else {
      for (const key of ['width', 'length', 'height'] as const) {
        const value = data.hall[key];
        if (finite(value)) {
          hall[key] = Math.max(1, Math.min(200, value));
          if (hall[key] !== value) repaired++;
        } else repaired++;
      }
      for (const key of ['wallColor', 'floorColor', 'baseboard'] as const) {
        const value = data.hall[key];
        if (typeof value === 'string') hall[key] = value;
        else if (value !== undefined) repaired++;
      }
      for (const key of ['wallRoughness', 'wallMetalness', 'floorRoughness', 'floorMetalness'] as const) {
        const value = data.hall[key];
        if (finite(value)) hall[key] = value;
        else if (value !== undefined) repaired++;
      }
    }
  }
  const vector = (rawVector: unknown, fallback: number): Vector3 => {
    const value = plainFields(rawVector) ? rawVector : {};
    const result = { x: fallback, y: fallback, z: fallback };
    for (const key of ['x', 'y', 'z'] as const) {
      if (finite(value[key])) result[key] = value[key];
      else repaired++;
    }
    return result;
  };
  const ids = new Set<string>();
  const objects: BanquetObject[] = [];
  if (Array.isArray(data.objects)) {
    for (const entry of data.objects) {
      if (!plainFields(entry)) { repaired++; continue; }
      const type = knownTypes.find(type => type === entry.type);
      if (!type) { repaired++; continue; }
      let id = entry.id;
      if (typeof id !== 'string' || !id || ids.has(id)) { id = crypto.randomUUID(); repaired++; }
      if (typeof entry.color !== 'string') repaired++;
      const object = {
        ...entry, id: String(id), type,
        color: typeof entry.color === 'string' ? entry.color : '#94a3b8',
        position: vector(entry.position, 0), rotation: vector(entry.rotation, 0), scale: vector(entry.scale, 1),
      };
      ids.add(object.id);
      objects.push(object);
    }
  } else if (data.objects !== undefined) repaired++;
  const drawings: DrawingPath[] = [];
  const drawingIds = new Set<string>();
  if (Array.isArray(data.drawings)) {
    for (const entry of data.drawings) {
      if (!plainFields(entry) || !Array.isArray(entry.points) || typeof entry.color !== 'string'
        || !entry.points.every(point => plainFields(point) && finite(point.x) && finite(point.y) && finite(point.z))) {
        repaired++; continue;
      }
      let id = entry.id;
      if (typeof id !== 'string' || !id || drawingIds.has(id)) { id = crypto.randomUUID(); repaired++; }
      const points: Vector3[] = entry.points.map(point => ({ x: point.x, y: point.y, z: point.z }));
      drawingIds.add(String(id));
      drawings.push({ id: String(id), color: entry.color, points });
    }
  } else if (data.drawings !== undefined) repaired++;
  return { hall, objects, drawings, repaired, valid, present };
}
