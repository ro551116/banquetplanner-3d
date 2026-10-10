import { INITIAL_HALL } from '../constants';
import { DEVICE_SYSTEMS, MAX_OUTLINE_POINTS, MIN_OUTLINE_POINTS, withOutline } from '../planning';
import { BanquetObject, DrawingPath, HallConfig, ObjectType, PathPoint, PlanInfo, Vector3 } from '../types';

// Each consumed field is validated below; optional type-specific fields are preserved.
type SceneFields = { [K in 'hall' | 'objects' | 'drawings' | 'width' | 'length' | 'height' |
  'wallColor' | 'floorColor' | 'baseboard' | 'wallRoughness' | 'wallMetalness' |
  'floorRoughness' | 'floorMetalness' | 'planInfo' | 'outline' | 'x' | 'y' | 'z' | 'id' | 'type' |
  'position' | 'rotation' | 'scale' | 'points' | 'color']?: unknown };
const plainFields = (value: unknown): value is SceneFields =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const knownTypes = Object.values(ObjectType);

/** Optional planning fields: a value that fails its check is dropped (counted as a repair) instead of reaching a model. */
const OPTIONAL_FIELD_CHECKS: Record<string, (value: unknown) => boolean> = {
  note: value => typeof value === 'string',
  seatCount: finite,
  childSeats: finite,
  vegetarianSeats: finite,
  tiers: finite,
  powerKva: finite,
  standby: value => typeof value === 'boolean',
  chairLayout: value => value === 'both' || value === 'front' || value === 'none',
  chairStyle: value => value === 'banquet' || value === 'child',
  doorLeaves: value => value === 1 || value === 2,
  shape: value => value === 'rect' || value === 'round',
  voltage: value => value === '110V' || value === '220V',
  system: value => typeof value === 'string' && Object.hasOwn(DEVICE_SYSTEMS, value),
  plateStyle: value => value === 'table' || value === 'floor',
};
const PLAN_INFO_KEYS = ['title', 'venue', 'date', 'version', 'notes'] as const;

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
      const planInfo = data.hall.planInfo;
      if (planInfo !== undefined) {
        if (!plainFields(planInfo)) repaired++;
        else {
          const fields = planInfo as Record<string, unknown>;
          const kept: PlanInfo = {};
          for (const key of PLAN_INFO_KEYS) {
            if (typeof fields[key] === 'string') kept[key] = fields[key] as string;
            else if (fields[key] !== undefined) repaired++;
          }
          hall.planInfo = kept;
        }
      }
      // A valid outline also defines width/length (its bounding box); an unusable one falls back to the rectangle.
      const outline = data.hall.outline;
      if (outline !== undefined) {
        const points: PathPoint[] = Array.isArray(outline)
          ? outline.filter(point => plainFields(point) && finite(point.x) && finite(point.z)).map(point => ({ x: point.x as number, z: point.z as number }))
          : [];
        if (!Array.isArray(outline) || points.length !== outline.length) repaired++;
        if (points.length >= MIN_OUTLINE_POINTS && points.length <= MAX_OUTLINE_POINTS) Object.assign(hall, withOutline(hall, points));
        else repaired++;
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
      const { points: rawPoints, ...fields } = entry;
      const object: BanquetObject = {
        ...fields, id: String(id), type,
        color: typeof entry.color === 'string' ? entry.color : '#94a3b8',
        position: vector(entry.position, 0), rotation: vector(entry.rotation, 0), scale: vector(entry.scale, 1),
      };
      const record = object as unknown as Record<string, unknown>;
      for (const [key, check] of Object.entries(OPTIONAL_FIELD_CHECKS)) {
        if (record[key] !== undefined && !check(record[key])) { delete record[key]; repaired++; }
      }
      if (rawPoints !== undefined) {
        const points: PathPoint[] = Array.isArray(rawPoints)
          ? rawPoints.filter(point => plainFields(point) && finite(point.x) && finite(point.z)).map(point => ({ x: point.x as number, z: point.z as number }))
          : [];
        if (!Array.isArray(rawPoints) || points.length !== rawPoints.length) repaired++;
        object.points = points;
      }
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
