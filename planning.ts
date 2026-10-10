import { BanquetObject, DeviceSystem, HallConfig, ObjectType, PathPoint } from './types';

/** Round table geometry and default chair count per size in feet. */
export const ROUND_TABLE_SPECS: Record<number, { r: number; chairs: number }> = {
  4: { r: 0.6, chairs: 5 },
  5: { r: 0.75, chairs: 8 },
  6: { r: 0.9, chairs: 10 },
  7: { r: 1.05, chairs: 10 },
  8: { r: 1.2, chairs: 12 },
};

/** Rectangular table length and chairs per long side per size in feet (depth is 0.75 m). */
export const RECT_TABLE_SPECS: Record<number, { w: number; chairsPerSide: number }> = {
  6: { w: 1.8, chairsPerSide: 3 },
  8: { w: 2.4, chairsPerSide: 4 },
};

export const RECT_TABLE_DEPTH = 0.75;
export const MAX_ROUND_TABLE_SEATS = 16;

export const getRoundTableSpec = (size?: number) => ROUND_TABLE_SPECS[size ?? 6] ?? ROUND_TABLE_SPECS[6];
export const getRectTableSpec = (size?: number) => RECT_TABLE_SPECS[size ?? 6] ?? RECT_TABLE_SPECS[6];

const count = (value: number | undefined, max: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value as number))) : 0;

export interface Seating {
  /** Chairs at the table, child chairs included. */
  seats: number;
  childSeats: number;
  vegetarianSeats: number;
}

/** Seats of a dining table; null for every other object type. */
export function getSeating(object: Pick<BanquetObject, 'type' | 'customSize' | 'seatCount' | 'chairLayout' | 'childSeats' | 'vegetarianSeats'>): Seating | null {
  let seats: number;
  if (object.type === ObjectType.ROUND_TABLE) {
    const base = getRoundTableSpec(object.customSize).chairs;
    seats = object.seatCount === undefined ? base : count(object.seatCount, MAX_ROUND_TABLE_SEATS);
  } else if (object.type === ObjectType.RECT_TABLE) {
    const perSide = getRectTableSpec(object.customSize).chairsPerSide;
    const layout = object.chairLayout ?? 'both';
    seats = layout === 'none' ? 0 : layout === 'front' ? perSide : perSide * 2;
  } else {
    return null;
  }
  return { seats, childSeats: count(object.childSeats, seats), vegetarianSeats: count(object.vegetarianSeats, seats) };
}

export interface SeatingSummary {
  /** Dining tables with at least one seat, standby excluded. */
  tables: number;
  standbyTables: number;
  seats: number;
  childSeats: number;
  vegetarianSeats: number;
}

/** Totals the way banquet plans quote them: "15 桌＋備 1". Chairless utility tables are not dining tables. */
export function summarizeSeating(objects: BanquetObject[]): SeatingSummary {
  const summary: SeatingSummary = { tables: 0, standbyTables: 0, seats: 0, childSeats: 0, vegetarianSeats: 0 };
  for (const object of objects) {
    const seating = getSeating(object);
    if (!seating || seating.seats === 0) continue;
    if (object.standby) { summary.standbyTables++; continue; }
    summary.tables++;
    summary.seats += seating.seats;
    summary.childSeats += seating.childSeats;
    summary.vegetarianSeats += seating.vegetarianSeats;
  }
  return summary;
}

/* ---- Table number plates stand on table tops and travel with their table. */

export interface TableTop {
  /** Top surface height above the table's own position.y. */
  height: number;
  /** Whether a world XZ point lies on the top. */
  contains: (point: { x: number; z: number }) => boolean;
}

/** Top surface of the tables a number plate can stand on; null for every other type. */
export function getTableTop(object: BanquetObject): TableTop | null {
  let height: number;
  let inside: (x: number, z: number) => boolean;
  if (object.type === ObjectType.ROUND_TABLE) {
    const r = getRoundTableSpec(object.customSize).r;
    height = 0.75;
    inside = (x, z) => x * x + z * z <= r * r;
  } else if (object.type === ObjectType.RECT_TABLE) {
    const w = getRectTableSpec(object.customSize).w;
    height = 0.75;
    inside = (x, z) => Math.abs(x) <= w / 2 && Math.abs(z) <= RECT_TABLE_DEPTH / 2;
  } else if (object.type === ObjectType.COCKTAIL_TABLE) {
    height = 1.1;
    inside = (x, z) => x * x + z * z <= 0.32 * 0.32;
  } else {
    return null;
  }
  const cos = Math.cos(object.rotation.y), sin = Math.sin(object.rotation.y);
  return {
    height,
    contains: point => {
      const dx = point.x - object.position.x, dz = point.z - object.position.z;
      return inside(dx * cos - dz * sin, dx * sin + dz * cos);
    },
  };
}

/** The table whose top holds the point (nearest centre wins), or null. */
export function findTableUnder(objects: BanquetObject[], point: { x: number; z: number }): BanquetObject | null {
  let best: BanquetObject | null = null;
  for (const object of objects) {
    if (!getTableTop(object)?.contains(point)) continue;
    if (!best || Math.hypot(object.position.x - point.x, object.position.z - point.z) < Math.hypot(best.position.x - point.x, best.position.z - point.z)) best = object;
  }
  return best;
}

/** A plate is attached when it stands on the table's top (height within 5 cm, inside the footprint). */
export function isOnTable(plate: BanquetObject, table: BanquetObject): boolean {
  if (plate.type !== ObjectType.TABLE_NUMBER) return false;
  const top = getTableTop(table);
  return !!top && Math.abs(plate.position.y - (table.position.y + top.height)) < 0.05 && top.contains(plate.position);
}

/** Plates standing on any of the given tables (not themselves in the set). */
export function attachedTableNumbers(objects: BanquetObject[], tableIds: Set<string>): Set<string> {
  const tables = objects.filter(object => tableIds.has(object.id) && getTableTop(object));
  const attached = new Set<string>();
  if (!tables.length) return attached;
  for (const object of objects) {
    if (!tableIds.has(object.id) && tables.some(table => isOnTable(object, table))) attached.add(object.id);
  }
  return attached;
}

const samePosition = (a: BanquetObject, b: BanquetObject) => a.position.x === b.position.x && a.position.y === b.position.y && a.position.z === b.position.z;

/**
 * Moves plates with their table: every table whose position or heading changed from `previous` to `next`
 * carries the plates that stood on it, unless a plate was moved in the same update. Returns `next` itself
 * when nothing needs carrying.
 */
export function carryTableNumbers(previous: BanquetObject[], next: BanquetObject[]): BanquetObject[] {
  if (previous === next) return next;
  const before = new Map(previous.map(object => [object.id, object]));
  const moves: Array<{ from: BanquetObject; to: BanquetObject }> = [];
  for (const table of next) {
    const old = before.get(table.id);
    if (old && old !== table && getTableTop(table) && (!samePosition(old, table) || old.rotation.y !== table.rotation.y)) moves.push({ from: old, to: table });
  }
  if (!moves.length) return next;
  let changed = false;
  const result = next.map(plate => {
    if (plate.type !== ObjectType.TABLE_NUMBER) return plate;
    const old = before.get(plate.id);
    if (!old || !samePosition(old, plate)) return plate;
    const move = moves.find(candidate => isOnTable(old, candidate.from));
    if (!move) return plate;
    const { from, to } = move;
    // Plate offset in the old table's frame, re-applied in the new one.
    const dx = old.position.x - from.position.x, dz = old.position.z - from.position.z;
    const back = -from.rotation.y, turn = to.rotation.y;
    const lx = dx * Math.cos(back) + dz * Math.sin(back), lz = -dx * Math.sin(back) + dz * Math.cos(back);
    changed = true;
    return {
      ...plate,
      position: {
        x: to.position.x + lx * Math.cos(turn) + lz * Math.sin(turn),
        y: plate.position.y + to.position.y - from.position.y,
        z: to.position.z - lx * Math.sin(turn) + lz * Math.cos(turn),
      },
      rotation: { ...plate.rotation, y: plate.rotation.y + turn - from.rotation.y },
    };
  });
  return changed ? result : next;
}

/** Objects defined by a polyline (`points`) and created by clicking vertices instead of a single placement. */
export const PATH_OBJECT_TYPES: Partial<Record<ObjectType, true>> = { [ObjectType.CABLE_RUN]: true, [ObjectType.FLOW_ARROW]: true, [ObjectType.DIMENSION]: true, [ObjectType.WALL]: true };
export const isPathType = (type: ObjectType) => PATH_OBJECT_TYPES[type] === true;

/** Minimum and maximum vertex counts while drawing a path object. */
export const pathVertexLimits = (type: ObjectType) => type === ObjectType.DIMENSION ? { min: 2, max: 2 } : { min: 2, max: 64 };
/** Path types that may be closed into a loop by clicking their first vertex (a room enclosed by partitions). */
export const CLOSABLE_PATH_TYPES: Partial<Record<ObjectType, true>> = { [ObjectType.WALL]: true };

export function pathLength(points: PathPoint[] | undefined): number {
  if (!points) return 0;
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  return length;
}

/**
 * Placement wall snap distance per type: doors always land in the nearest wall,
 * columns become pilasters only when placed close to a wall.
 */
export const WALL_SNAP_DISTANCE: Partial<Record<ObjectType, number>> = { [ObjectType.DOOR]: Infinity, [ObjectType.COLUMN]: 0.8 };

/** A wall line objects can snap to; partitions are two-sided (the object faces the side it was placed on). */
export interface SnapSegment extends WallSegment {
  twoSided?: boolean;
  /** Half the wall thickness: flush objects (columns) keep clear of the wall face. */
  halfThickness?: number;
}

export const PARTITION_THICKNESS = 0.12;

/** Local point of an object to world XZ (three.js rotation about Y). */
export function objectPointToWorld(object: Pick<BanquetObject, 'position' | 'rotation'>, point: PathPoint): PathPoint {
  const angle = object.rotation.y, cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: object.position.x + point.x * cos + point.z * sin, z: object.position.z - point.x * sin + point.z * cos };
}

/** World-space segments of every partition wall, for snapping doors and pilasters onto them. */
export function getPartitionSegments(objects: BanquetObject[]): SnapSegment[] {
  const segments: SnapSegment[] = [];
  for (const object of objects) {
    if (object.type !== ObjectType.WALL || !object.points || object.points.length < 2) continue;
    const world = object.points.map(point => objectPointToWorld(object, point));
    for (let i = 1; i < world.length; i++) {
      const start = world[i - 1], end = world[i];
      const length = Math.hypot(end.x - start.x, end.z - start.z);
      if (length < 1e-6) continue;
      const direction = { x: (end.x - start.x) / length, z: (end.z - start.z) / length };
      segments.push({ start, end, length, direction, inward: { x: -direction.z + 0, z: direction.x + 0 }, twoSided: true, halfThickness: (object.customWidth ?? PARTITION_THICKNESS) / 2 });
    }
  }
  return segments;
}

/**
 * Wall snap for placement onto the nearest wall segment (hall outline and partitions).
 * Local +Z of the returned rotation faces into the room (for a partition: the side of `point`);
 * `depth` keeps an object flush with the wall face. Returns null when the type does not snap or no wall is in reach.
 */
export function snapToWall(type: ObjectType, point: { x: number; z: number }, walls: SnapSegment[], depth = 0): { x: number; z: number; rotationY: number } | null {
  const reach = WALL_SNAP_DISTANCE[type];
  if (reach === undefined) return null;
  let best: { distance: number; x: number; z: number; rotationY: number } | null = null;
  for (const wall of walls) {
    const along = Math.max(0, Math.min(wall.length, (point.x - wall.start.x) * wall.direction.x + (point.z - wall.start.z) * wall.direction.z));
    const x = wall.start.x + wall.direction.x * along;
    const z = wall.start.z + wall.direction.z * along;
    const distance = Math.hypot(point.x - x, point.z - z);
    if (best && distance >= best.distance) continue;
    const side = wall.twoSided && (point.x - x) * wall.inward.x + (point.z - z) * wall.inward.z < 0 ? -1 : 1;
    const normal = { x: wall.inward.x * side + 0, z: wall.inward.z * side + 0 };
    const offset = depth > 0 ? depth / 2 + (wall.halfThickness ?? 0) : 0;
    // `+ 0` turns -0 into 0 so axis-aligned walls give clean angles.
    best = { distance, x: x + normal.x * offset, z: z + normal.z * offset, rotationY: Math.atan2(normal.x, normal.z) + 0 };
  }
  if (!best || best.distance > reach) return null;
  return { x: best.x, z: best.z, rotationY: best.rotationY };
}

export type DeviceSymbol = 'square' | 'diamond' | 'circle' | 'triangle' | 'ring' | 'bar' | 'star' | 'hexagon' | 'dot';

/** Device point systems: default code prefix, colour and plan/3D symbol. */
export const DEVICE_SYSTEMS: Record<DeviceSystem, { label: string; prefix: string; color: string; symbol: DeviceSymbol }> = {
  network: { label: '網路點', prefix: 'NET', color: '#1d4ed8', symbol: 'square' },
  doorplate: { label: '電子門牌', prefix: 'DP', color: '#7c3aed', symbol: 'diamond' },
  wifi: { label: '無線 AP', prefix: 'AP', color: '#15803d', symbol: 'circle' },
  camera: { label: '監控攝影機', prefix: 'CAM', color: '#dc2626', symbol: 'triangle' },
  pos: { label: '公區／POS', prefix: 'POS', color: '#ea580c', symbol: 'ring' },
  display: { label: '螢幕／端景電視', prefix: 'TV', color: '#0d9488', symbol: 'bar' },
  access: { label: '門禁', prefix: 'AC', color: '#111827', symbol: 'star' },
  audio: { label: '音訊點', prefix: 'AUD', color: '#db2777', symbol: 'hexagon' },
  other: { label: '其他點位', prefix: 'PT', color: '#64748b', symbol: 'dot' },
};
export const DEVICE_SYSTEM_ORDER = Object.keys(DEVICE_SYSTEMS) as DeviceSystem[];

/**
 * Next code for a new point of `system`: the prefix its existing points use most (e.g. MN for an imported
 * plan), else the default, numbered after the highest existing number of that prefix.
 */
export function nextDeviceCode(objects: BanquetObject[], system: DeviceSystem): string {
  const prefixes = new Map<string, number>();
  const numbers = new Map<string, number>();
  for (const object of objects) {
    if (object.type !== ObjectType.DEVICE_POINT) continue;
    const match = object.label?.trim().match(/^([A-Za-z]+)-(\d+)$/);
    if (!match) continue;
    numbers.set(match[1], Math.max(numbers.get(match[1]) ?? 0, Number(match[2])));
    if ((object.system ?? 'other') === system) prefixes.set(match[1], (prefixes.get(match[1]) ?? 0) + 1);
  }
  const prefix = [...prefixes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? DEVICE_SYSTEMS[system].prefix;
  return `${prefix}-${String((numbers.get(prefix) ?? 0) + 1).padStart(2, '0')}`;
}

/* ---- Hall outline: rectangular halls are the 4-corner case of the polygon outline. */

export const MIN_OUTLINE_POINTS = 3;
export const MAX_OUTLINE_POINTS = 64;
/** Hall extents are clamped to this range (meters), matching the size fields. */
export const HALL_SIZE_LIMITS = { min: 1, max: 200 };

/** Wall corners of the hall: its outline, or the width × length rectangle centred on the origin. */
export function getHallOutline(hall: Pick<HallConfig, 'width' | 'length' | 'outline'>): PathPoint[] {
  if (hall.outline && hall.outline.length >= MIN_OUTLINE_POINTS) return hall.outline;
  const x = hall.width / 2, z = hall.length / 2;
  return [{ x: -x, z: -z }, { x, z: -z }, { x, z }, { x: -x, z }];
}

/** Shoelace area in m²; the sign is the winding (positive for the default rectangle's order). */
export function signedArea(points: PathPoint[]): number {
  let area = 0;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    area += point.x * next.z - next.x * point.z;
  });
  return area / 2;
}

export interface HallBounds { minX: number; maxX: number; minZ: number; maxZ: number; width: number; length: number; centerX: number; centerZ: number }

export function getOutlineBounds(points: PathPoint[]): HallBounds {
  const xs = points.map(point => point.x), zs = points.map(point => point.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  return { minX, maxX, minZ, maxZ, width: maxX - minX, length: maxZ - minZ, centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2 };
}

/** Bounding box of the hall floor; the centre is not the origin for an off-centre outline. */
export const getHallBounds = (hall: Pick<HallConfig, 'width' | 'length' | 'outline'>) => getOutlineBounds(getHallOutline(hall));

export interface WallSegment {
  start: PathPoint;
  end: PathPoint;
  length: number;
  /** Unit vector from start to end. */
  direction: PathPoint;
  /** Unit normal pointing into the room, whatever the outline's winding. */
  inward: PathPoint;
}

/** One wall per outline edge (zero-length edges skipped). */
export function getWallSegments(outline: PathPoint[]): WallSegment[] {
  const sign = signedArea(outline) >= 0 ? 1 : -1;
  const walls: WallSegment[] = [];
  outline.forEach((start, index) => {
    const end = outline[(index + 1) % outline.length];
    const length = Math.hypot(end.x - start.x, end.z - start.z);
    if (length < 1e-6) return;
    const direction = { x: (end.x - start.x) / length, z: (end.z - start.z) / length };
    walls.push({ start, end, length, direction, inward: { x: sign * -direction.z + 0, z: sign * direction.x + 0 } });
  });
  return walls;
}

/** True when no two non-adjacent edges cross (a self-intersecting outline cannot be floored). */
export function isSimplePolygon(points: PathPoint[]): boolean {
  const cross = (a: PathPoint, b: PathPoint, c: PathPoint) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const count = points.length;
  for (let i = 0; i < count; i++) {
    const a = points[i], b = points[(i + 1) % count];
    for (let j = i + 1; j < count; j++) {
      if (j === i || (j + 1) % count === i || (i + 1) % count === j) continue;
      const c = points[j], d = points[(j + 1) % count];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return false;
    }
  }
  return true;
}

export type OutlineTemplate = 'L' | 'chamfer' | 'octagon' | 'alcove';

/** Common non-rectangular ballroom shapes filling a width × length box centred on the origin (stage side = -Z). */
export function outlineTemplate(kind: OutlineTemplate, width: number, length: number): PathPoint[] {
  const w = width / 2, l = length / 2;
  const round = (point: PathPoint) => ({ x: Math.round(point.x * 100) / 100 + 0, z: Math.round(point.z * 100) / 100 + 0 });
  let points: PathPoint[];
  if (kind === 'L') {
    const cutW = width / 3, cutL = length / 3;
    points = [{ x: -w, z: -l }, { x: w - cutW, z: -l }, { x: w - cutW, z: -l + cutL }, { x: w, z: -l + cutL }, { x: w, z: l }, { x: -w, z: l }];
  } else if (kind === 'chamfer') {
    const c = Math.min(width, length) / 4;
    points = [{ x: -w, z: -l }, { x: w - c, z: -l }, { x: w, z: -l + c }, { x: w, z: l }, { x: -w, z: l }];
  } else if (kind === 'octagon') {
    const c = Math.min(width, length) * 0.22;
    points = [{ x: -w + c, z: -l }, { x: w - c, z: -l }, { x: w, z: -l + c }, { x: w, z: l - c }, { x: w - c, z: l }, { x: -w + c, z: l }, { x: -w, z: l - c }, { x: -w, z: -l + c }];
  } else {
    const depth = Math.min(length / 5, 4), half = width / 6;
    points = [{ x: -w, z: -l + depth }, { x: -half, z: -l + depth }, { x: -half, z: -l }, { x: half, z: -l }, { x: half, z: -l + depth }, { x: w, z: -l + depth }, { x: w, z: l }, { x: -w, z: l }];
  }
  return points.map(round);
}

/** Sets (or clears) the outline and keeps width/length equal to its bounding box. */
export function withOutline(hall: HallConfig, outline: PathPoint[] | undefined): HallConfig {
  const { outline: _previous, ...rest } = hall;
  if (!outline) return rest;
  const bounds = getOutlineBounds(outline);
  const clamp = (value: number) => Math.max(HALL_SIZE_LIMITS.min, Math.min(HALL_SIZE_LIMITS.max, value));
  return { ...rest, outline, width: clamp(bounds.width), length: clamp(bounds.length) };
}
