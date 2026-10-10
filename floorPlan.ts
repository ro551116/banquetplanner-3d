/**
 * 2D floor-plan export: object footprints (meters) and a standalone, print-ready SVG document.
 * Pure data → string; no DOM, no three. World X runs right, world Z runs down (stage normally at the top).
 */
import { BanquetObject, DeviceSystem, DrawingPath, HallConfig, ObjectType, PathPoint } from './types';
import {
  getHallOutline,
  getOutlineBounds,
  getRectTableSpec,
  getRoundTableSpec,
  getSeating,
  getWallSegments,
  isOnTable,
  isPathType,
  pathLength,
  RECT_TABLE_DEPTH,
  signedArea,
  summarizeSeating,
  SeatingSummary,
  DEVICE_SYSTEMS,
  DEVICE_SYSTEM_ORDER,
  DeviceSymbol,
  objectPointToWorld,
  PARTITION_THICKNESS,
} from './planning';
import { getTrussDimensions } from './trussConfig';
import { getObjectLabel } from './components/objectTypeMeta';

export interface FloorPlanOptions {
  /** Legend of the symbols present on the plan (default true). */
  showLegend?: boolean;
  /** 1 m grid under the plan (default false). */
  showGrid?: boolean;
  /** Title used when `hall.planInfo.title` is empty. */
  title?: string;
  /** Only device points of these systems are drawn (legend and summary follow); undefined = all. */
  deviceSystems?: DeviceSystem[];
}

export type Footprint =
  | { kind: 'circle'; r: number }
  | { kind: 'rect'; w: number; d: number }
  | { kind: 'ellipse'; rx: number; rz: number }
  | { kind: 'path'; points: PathPoint[] };

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface FloorPlanInput {
  hall: HallConfig;
  objects: BanquetObject[];
  drawings?: DrawingPath[];
}

/** Space the seated chairs add around a table body, meters. */
const CHAIR_RING = 0.65;
/** Chair centre offset from a rectangular table's centre line (matches the 3D model). */
const RECT_CHAIR_OFFSET = 0.58;
const ROUND_CHAIR_OFFSET = 0.44;

const positive = (value: number | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

const rect = (w: number, d: number): Footprint => ({ kind: 'rect', w, d });
const circle = (r: number): Footprint => ({ kind: 'circle', r });

/**
 * Footprint in the object's local XZ plane (meters, centred on the object origin, +Z = front).
 * Tables include their chairs (that is the floor space they occupy); a front-only rectangular table
 * is reported symmetric. Path objects return their vertices.
 */
export function getObjectFootprint(object: BanquetObject): Footprint {
  switch (object.type) {
    case ObjectType.ROUND_TABLE: {
      const r = getRoundTableSpec(object.customSize).r;
      return circle((getSeating(object)?.seats ?? 0) > 0 ? r + CHAIR_RING : r);
    }
    case ObjectType.RECT_TABLE: {
      const w = getRectTableSpec(object.customSize).w;
      const seated = (getSeating(object)?.seats ?? 0) > 0;
      return rect(w, seated ? RECT_TABLE_DEPTH + 2 * (RECT_CHAIR_OFFSET + 0.22 - RECT_TABLE_DEPTH / 2) : RECT_TABLE_DEPTH);
    }
    case ObjectType.STAGE: return rect(positive(object.customWidth, 6), positive(object.customDepth, 4));
    case ObjectType.RED_CARPET: return rect(positive(object.customWidth, 1.5), positive(object.customDepth, 10));
    case ObjectType.DANCE_FLOOR: return rect(positive(object.customWidth, 4), positive(object.customDepth, 4));
    case ObjectType.COCKTAIL_TABLE: return circle(0.32);
    case ObjectType.PODIUM: return rect(0.66, 0.52);
    case ObjectType.RECEPTION_DESK: return rect(positive(object.customWidth, 1.8), 0.68);
    case ObjectType.PROJECTION_SCREEN: return rect(positive(object.customWidth, 3), 0.6);
    case ObjectType.LED_WALL: return rect(positive(object.customWidth, 4), 0.6);
    case ObjectType.DECOR: return circle(0.25);
    case ObjectType.SPEAKER_15:
    case ObjectType.SPEAKER: return circle(0.6);
    case ObjectType.SPEAKER_SUB: return rect(0.72, 0.76);
    case ObjectType.SPEAKER_MONITOR: return rect(0.5, 0.42);
    case ObjectType.SPEAKER_COLUMN: return rect(0.38, 0.46);
    case ObjectType.SPEAKER_LINE_ARRAY: return rect(0.64, 0.42);
    case ObjectType.LIGHT_PAR:
    case ObjectType.LIGHT: return rect(0.35, 0.3);
    case ObjectType.LIGHT_MOVING: return rect(0.32, 0.25);
    case ObjectType.LIGHT_STAND: return rect(1.5, 0.6);
    case ObjectType.LIGHT_FOLLOWSPOT: return circle(0.65);
    case ObjectType.LIGHT_WASH: return rect(0.36, 0.3);
    case ObjectType.LIGHT_STROBE: return rect(0.48, 0.25);
    case ObjectType.TRUSS_STRAIGHT: return rect(positive(object.customWidth, 3), 0.3);
    case ObjectType.TRUSS_STRUCTURE: {
      if (!object.trussStructure) return rect(3, 0.3);
      const dims = getTrussDimensions(object.trussStructure);
      return rect(positive(dims.widthCm / 100, 3), Math.max(0.3, (dims.depthCm ?? 0) / 100));
    }
    case ObjectType.EQUIPMENT_MIXER: return rect(1.28, 1.42);
    case ObjectType.EFFECTS_FOG: return rect(0.54, 0.28);
    case ObjectType.CHAIR: return rect(0.45, 0.45);
    case ObjectType.DOOR: return rect(positive(object.customWidth, 1.8), 0.2);
    case ObjectType.COLUMN: {
      const w = positive(object.customWidth, 0.6);
      return object.shape === 'round' ? circle(w / 2) : rect(w, positive(object.customDepth, 0.6));
    }
    case ObjectType.CHAMPAGNE_TOWER: return circle(0.45);
    case ObjectType.EASEL: return rect(0.7, 0.6);
    case ObjectType.KIOSK: return rect(positive(object.customWidth, 0.6), positive(object.customDepth, 0.6));
    case ObjectType.GENERATOR: return rect(positive(object.customWidth, 2.2), positive(object.customDepth, 0.95));
    case ObjectType.POWER_DISTRO: return rect(0.6, 0.3);
    case ObjectType.POWER_OUTLET: return rect(0.3, 0.15);
    case ObjectType.CABLE_RAMP: return rect(Math.ceil(positive(object.customWidth, 0.9) / 0.9) * 0.9, 0.5);
    case ObjectType.SERVICE_STATION: return rect(positive(object.customWidth, 1.8), 0.6);
    case ObjectType.BEVERAGE_CART: return rect(0.9, 0.5);
    case ObjectType.BAR_COUNTER: return rect(positive(object.customWidth, 2.4), 0.6);
    case ObjectType.ZONE: {
      const w = positive(object.customWidth, 3);
      const d = positive(object.customDepth, 2);
      return object.shape === 'round' ? { kind: 'ellipse', rx: w / 2, rz: d / 2 } : rect(w, d);
    }
    case ObjectType.DEVICE_POINT: return circle(0.2);
    case ObjectType.TABLE_NUMBER: return object.plateStyle === 'floor' ? circle(0.18) : rect(0.12, 0.08);
    case ObjectType.CABLE_RUN:
    case ObjectType.FLOW_ARROW:
    case ObjectType.DIMENSION:
    case ObjectType.WALL:
      return { kind: 'path', points: object.points ?? [] };
    default:
      return rect(0.5, 0.5);
  }
}

/**
 * Local point → world point, the three.js way for a rotation about Y:
 * (x, z) ↦ (x·cosθ + z·sinθ, −x·sinθ + z·cosθ) + position.
 */
export function localToWorld(object: BanquetObject, local: { x: number; z: number }): { x: number; z: number } {
  const theta = object.rotation?.y ?? 0;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    x: object.position.x + local.x * cos + local.z * sin,
    z: object.position.z - local.x * sin + local.z * cos,
  };
}

const emptyBounds = (): WorldBounds => ({ minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
const extend = (box: WorldBounds, x: number, z: number) => {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return;
  box.minX = Math.min(box.minX, x);
  box.maxX = Math.max(box.maxX, x);
  box.minZ = Math.min(box.minZ, z);
  box.maxZ = Math.max(box.maxZ, z);
};

/** Axis-aligned world bounds of the rotated footprint (meters). */
export function getObjectBounds(object: BanquetObject): WorldBounds {
  const box = emptyBounds();
  const fp = getObjectFootprint(object);
  const theta = object.rotation?.y ?? 0;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  switch (fp.kind) {
    case 'circle':
      extend(box, object.position.x - fp.r, object.position.z - fp.r);
      extend(box, object.position.x + fp.r, object.position.z + fp.r);
      break;
    case 'ellipse': {
      const hx = Math.hypot(fp.rx * cos, fp.rz * sin);
      const hz = Math.hypot(fp.rx * sin, fp.rz * cos);
      extend(box, object.position.x - hx, object.position.z - hz);
      extend(box, object.position.x + hx, object.position.z + hz);
      break;
    }
    case 'rect':
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const p = localToWorld(object, { x: (sx * fp.w) / 2, z: (sz * fp.d) / 2 });
        extend(box, p.x, p.z);
      }
      break;
    case 'path':
      extend(box, object.position.x, object.position.z);
      for (const point of fp.points) {
        const p = localToWorld(object, point);
        extend(box, p.x, p.z);
      }
      break;
  }
  return box;
}

/* ------------------------------------------------------------------ text & colour helpers */

const S = 40; // px per meter
const FONT_FAMILY = "system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif";
const INK = '#0f172a';
const MUTED = '#475569';
const WALL = '#1e293b';
const CABLE_RED = '#dc2626';
const CHILD_RED = '#dc2626';
const VEG_GREEN = '#16a34a';

const n = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return String(Object.is(rounded, -0) ? 0 : rounded);
};

/** A spec line such as "25 kVA" or "110V" is skipped when the user's label already states it ("發電機 25kVA"). */
const mentions = (label: string, spec: string) => label.replace(/\s+/g, '').toLowerCase().includes(spec.replace(/\s+/g, '').toLowerCase());

/** Escapes text and attribute values; drops characters XML 1.0 cannot carry. */
const esc = (value: string) =>
  value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

type Rgb = [number, number, number];

const parseColor = (color: string | undefined): Rgb | null => {
  if (!color) return null;
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].replace(/./g, c => c + c) : match[1];
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
};
const toHex = (rgb: Rgb) => `#${rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const luminance = (rgb: Rgb) => (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
const NEUTRAL: Rgb = [148, 163, 184];

/** Light fill derived from the object colour. */
const fillOf = (color: string | undefined, t = 0.62) => {
  const rgb = parseColor(color) ?? NEUTRAL;
  return luminance(rgb) > 0.9 ? '#f8fafc' : toHex(mix(rgb, [255, 255, 255], t));
};
/** Outline colour with enough contrast on white. */
const strokeOf = (color: string | undefined) => {
  const rgb = parseColor(color) ?? NEUTRAL;
  return luminance(rgb) > 0.7 ? '#64748b' : toHex(mix(rgb, [0, 0, 0], 0.45));
};
/** Solid colour for lines/solid fills: keeps saturated colours, darkens pale ones. */
const lineOf = (color: string | undefined, fallback = '#2563eb') => {
  const rgb = parseColor(color) ?? parseColor(fallback)!;
  return luminance(rgb) > 0.7 ? toHex(mix(rgb, [0, 0, 0], 0.5)) : toHex(rgb);
};

const charWidth = (char: string, size: number) => {
  const code = char.codePointAt(0) ?? 0;
  if (code >= 0x2e80) return size;
  if (char >= 'A' && char <= 'Z') return size * 0.64;
  if (char === ' ' || char === 'i' || char === 'l' || char === '.' || char === ',' || char === '1') return size * 0.3;
  return size * 0.56;
};
const textWidth = (text: string, size: number) => {
  let width = 0;
  for (const char of text) width += charWidth(char, size);
  return width;
};
const wrapText = (text: string, maxWidth: number, size: number): string[] => {
  const lines: string[] = [];
  let line = '';
  let width = 0;
  for (const char of text) {
    const w = charWidth(char, size);
    if (line && width + w > maxWidth) {
      lines.push(line);
      line = '';
      width = 0;
    }
    line += char;
    width += w;
  }
  if (line) lines.push(line);
  return lines;
};

interface TextOptions {
  size?: number;
  weight?: number | string;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
  halo?: boolean;
  extra?: string;
}

/** `y` is the vertical centre of the line. */
const text = (x: number, y: number, value: string, options: TextOptions = {}) => {
  const size = options.size ?? 11;
  const attrs = [
    `x="${n(x)}"`,
    `y="${n(y + size * 0.35)}"`,
    `font-size="${n(size)}"`,
    options.weight ? `font-weight="${options.weight}"` : '',
    `fill="${options.fill ?? INK}"`,
    options.anchor && options.anchor !== 'start' ? `text-anchor="${options.anchor}"` : '',
    options.halo ? 'stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke"' : '',
    options.extra ?? '',
  ].filter(Boolean).join(' ');
  return `<text ${attrs}>${esc(value)}</text>`;
};

/* ------------------------------------------------------------------ summaries */

export function formatSeatingSummary(summary: SeatingSummary): string {
  const tables = summary.tables > 0
    ? `共 ${summary.tables} 桌${summary.standbyTables > 0 ? `＋備 ${summary.standbyTables} 桌` : ''}`
    : summary.standbyTables > 0 ? `備 ${summary.standbyTables} 桌` : '';
  const seats = summary.seats > 0
    ? `座位 ${summary.seats}${summary.childSeats > 0 ? `（兒童椅 ${summary.childSeats}）` : ''}`
    : '';
  const vegetarian = summary.vegetarianSeats > 0 ? `素食 ${summary.vegetarianSeats}` : '';
  return [tables, seats, vegetarian].filter(Boolean).join('・');
}

export function formatPowerSummary(objects: BanquetObject[]): string {
  const parts: string[] = [];
  const generators = new Map<string, number>();
  for (const o of objects) {
    if (o.type !== ObjectType.GENERATOR) continue;
    const key = o.powerKva && o.powerKva > 0 ? `發電機 ${n(o.powerKva)} kVA` : '發電機';
    generators.set(key, (generators.get(key) ?? 0) + 1);
  }
  generators.forEach((count, key) => parts.push(`${key} × ${count}`));
  const distros = objects.filter(o => o.type === ObjectType.POWER_DISTRO).length;
  if (distros > 0) parts.push(`配電箱 × ${distros}`);
  for (const voltage of ['110V', '220V'] as const) {
    const count = objects.filter(o => o.type === ObjectType.POWER_OUTLET && (o.voltage ?? '110V') === voltage).length;
    if (count > 0) parts.push(`${voltage} 電源點 × ${count}`);
  }
  const cable = objects.filter(o => o.type === ObjectType.CABLE_RUN).reduce((sum, o) => sum + pathLength(o.points), 0);
  if (cable > 0) parts.push(`電纜 ${cable.toFixed(1)} m`);
  return parts.join('・');
}

const typeName = (object: BanquetObject) => getObjectLabel(object.type);
const displayName = (object: BanquetObject) => object.label?.trim() || typeName(object);

/* ------------------------------------------------------------------ plan symbols */

const HEART = 'M0 3.2C-4.8 -0.4 -4.2 -4.2 -2.1 -4.2C-0.9 -4.2 0 -3.3 0 -2.4C0 -3.3 0.9 -4.2 2.1 -4.2C4.2 -4.2 4.8 -0.4 0 3.2Z';
const TRIANGLE = 'M0 -3.6L3.4 2.6L-3.4 2.6Z';
const BOLT = 'M1.5 -6L-4 1.2H-0.4L-1.5 6L4 -1.4H0.4Z';

const heartAt = (x: number, y: number, scale = 1) =>
  `<path d="${HEART}" transform="translate(${n(x)} ${n(y)}) scale(${n(scale)})" fill="${CHILD_RED}" stroke="#ffffff" stroke-width="0.8"/>`;
const triangleAt = (x: number, y: number, scale = 1) =>
  `<path d="${TRIANGLE}" transform="translate(${n(x)} ${n(y)}) scale(${n(scale)})" fill="${VEG_GREEN}" stroke="#ffffff" stroke-width="0.8"/>`;
const boltAt = (x: number, y: number, fill: string, scale = 1) =>
  `<path d="${BOLT}" transform="translate(${n(x)} ${n(y)}) scale(${n(scale)})" fill="${fill}"/>`;

interface Seat {
  x: number;
  z: number;
  /** Angle fed to the chair group: the chair's local +Z (its back) points away from the table. */
  rotation: number;
  /** Where the vegetarian marker goes on the cloth. */
  marker: { x: number; z: number };
}

const seatsOf = (object: BanquetObject, seatCount: number): Seat[] => {
  const seats: Seat[] = [];
  if (seatCount <= 0) return seats;
  if (object.type === ObjectType.ROUND_TABLE) {
    const r = getRoundTableSpec(object.customSize).r;
    const distance = r + ROUND_CHAIR_OFFSET;
    const inward = (r - 0.14) / distance;
    for (let i = 0; i < seatCount; i++) {
      const angle = (i / seatCount) * Math.PI * 2;
      const x = Math.sin(angle) * distance;
      const z = Math.cos(angle) * distance;
      seats.push({ x, z, rotation: angle, marker: { x: x * inward, z: z * inward } });
    }
    return seats;
  }
  const spec = getRectTableSpec(object.customSize);
  const layout = object.chairLayout ?? 'both';
  const spacing = spec.w / (spec.chairsPerSide + 1);
  for (const side of layout === 'both' ? [1, -1] : [1]) {
    for (let i = 1; i <= spec.chairsPerSide; i++) {
      const x = -spec.w / 2 + spacing * i;
      seats.push({ x, z: side * RECT_CHAIR_OFFSET, rotation: side > 0 ? 0 : Math.PI, marker: { x, z: side * (RECT_TABLE_DEPTH / 2 - 0.1) } });
    }
  }
  return seats;
};

const deg = (rad: number) => (rad * 180) / Math.PI;

const rectEl = (w: number, d: number, attrs: string, rx = 2.5) =>
  `<rect x="${n((-w / 2) * S)}" y="${n((-d / 2) * S)}" width="${n(w * S)}" height="${n(d * S)}" rx="${n(Math.min(rx, (w * S) / 2, (d * S) / 2))}" ${attrs}/>`;

const footprintEl = (fp: Footprint, attrs: string) => {
  switch (fp.kind) {
    case 'circle': return `<circle r="${n(fp.r * S)}" ${attrs}/>`;
    case 'ellipse': return `<ellipse rx="${n(fp.rx * S)}" ry="${n(fp.rz * S)}" ${attrs}/>`;
    case 'rect': return rectEl(fp.w, fp.d, attrs);
    case 'path': return '';
  }
};

interface LabelSpec {
  /** World centre of the object, meters. */
  cx: number;
  cz: number;
  lines: string[];
  size: number;
  weight?: number;
  fill?: string;
  /** Always draw at the centre (tables, zones) instead of falling back to below the object. */
  forceCenter?: boolean;
  bounds: WorldBounds;
}

interface Rendered {
  layer: number;
  shape: string;
  /** Walls are cut where a door sits. */
  gap?: string;
  /** Partition wall band; drawn with the hall walls, before furniture and door cuts. */
  partition?: string;
  label?: LabelSpec;
  /** Upright overlay (hearts, triangles, path text) drawn after every symbol. */
  overlay?: string;
}

const LAYER_ZONE = 0;
const LAYER_FLOOR = 1;
const LAYER_STAGE = 2;
const LAYER_BODY = 3;
const LAYER_PATH = 5;
const LAYER_POINT = 6;

const layerOf = (type: ObjectType) => {
  switch (type) {
    case ObjectType.ZONE: return LAYER_ZONE;
    case ObjectType.RED_CARPET:
    case ObjectType.DANCE_FLOOR: return LAYER_FLOOR;
    case ObjectType.STAGE:
    case ObjectType.CABLE_RAMP: return LAYER_STAGE;
    case ObjectType.CABLE_RUN:
    case ObjectType.FLOW_ARROW:
    case ObjectType.DIMENSION: return LAYER_PATH;
    case ObjectType.DEVICE_POINT: return LAYER_POINT;
    default: return LAYER_BODY;
  }
};

const VOLTAGE_COLOR = { '110V': '#d97706', '220V': '#dc2626' } as const;

/** Types that only carry a text when the user typed one. */
const SILENT_TYPES: Partial<Record<ObjectType, true>> = { [ObjectType.CHAIR]: true, [ObjectType.DOOR]: true, [ObjectType.COLUMN]: true, [ObjectType.DECOR]: true };

interface UsedSymbols {
  chair: boolean;
  childChair: boolean;
}

const deviceSystemOf = (object: BanquetObject): DeviceSystem => (object.system && DEVICE_SYSTEMS[object.system] ? object.system : 'other');

export function countDevicePoints(objects: BanquetObject[]): Partial<Record<DeviceSystem, number>> {
  const counts: Partial<Record<DeviceSystem, number>> = {};
  for (const object of objects) {
    if (object.type !== ObjectType.DEVICE_POINT) continue;
    const system = deviceSystemOf(object);
    counts[system] = (counts[system] ?? 0) + 1;
  }
  return counts;
}

/** Drops device points of systems that are not selected; every other object is kept. */
const filterDeviceSystems = (objects: BanquetObject[], systems?: DeviceSystem[]) => {
  if (!systems) return objects;
  const selected = new Set(systems);
  return objects.filter(object => object.type !== ObjectType.DEVICE_POINT || selected.has(deviceSystemOf(object)));
};

const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
  const radius = i % 2 === 0 ? 6.2 : 2.7;
  const angle = -Math.PI / 2 + (i * Math.PI) / 5;
  return `${n(Math.cos(angle) * radius)},${n(Math.sin(angle) * radius)}`;
}).join(' ');
const HEXAGON_POINTS = Array.from({ length: 6 }, (_, i) => `${n(Math.cos((i * Math.PI) / 3) * 5.4)},${n(Math.sin((i * Math.PI) / 3) * 5.4)}`).join(' ');

/** Plan symbol of a device system, about 9 px, centred on (cx, cy). */
function deviceSymbol(symbol: DeviceSymbol, color: string, cx: number, cy: number): string {
  const paint = `fill="${color}" stroke="#ffffff" stroke-width="1"`;
  let inner: string;
  switch (symbol) {
    case 'square': inner = `<rect x="-4.5" y="-4.5" width="9" height="9" ${paint}/>`; break;
    case 'diamond': inner = `<polygon points="0,-6 6,0 0,6 -6,0" ${paint}/>`; break;
    case 'circle': inner = `<circle r="4.5" ${paint}/>`; break;
    case 'triangle': inner = `<polygon points="0,-5.5 5.2,4 -5.2,4" ${paint}/>`; break;
    case 'ring': inner = `<circle r="4.3" fill="none" stroke="#ffffff" stroke-width="4"/><circle r="4.3" fill="none" stroke="${color}" stroke-width="2"/>`; break;
    case 'bar': inner = `<rect x="-6.5" y="-2.8" width="13" height="5.6" ${paint}/>`; break;
    case 'star': inner = `<polygon points="${STAR_POINTS}" ${paint}/>`; break;
    case 'hexagon': inner = `<polygon points="${HEXAGON_POINTS}" ${paint}/>`; break;
    default: inner = `<circle r="2.6" ${paint}/>`;
  }
  return `<g transform="translate(${n(cx)} ${n(cy)})">${inner}</g>`;
}

const wrapLocal = (object: BanquetObject, inner: string, tagged = true) =>
  `<g${tagged ? ` data-id="${esc(object.id)}" data-type="${esc(object.type)}"` : ''} transform="translate(${n(object.position.x * S)} ${n(object.position.z * S)}) rotate(${n(-deg(object.rotation?.y ?? 0))})">${inner}</g>`;

const worldPoints = (object: BanquetObject) => (object.points ?? []).map(point => localToWorld(object, point));

/** Point at half the polyline length. */
function polylineMid(points: Array<{ x: number; z: number }>) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  let remaining = total / 2;
  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    if (length >= remaining && length > 0) {
      const t = remaining / length;
      return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, z: points[i - 1].z + (points[i].z - points[i - 1].z) * t };
    }
    remaining -= length;
  }
  return points[0];
}

function renderPath(object: BanquetObject): Rendered | null {
  const pts = worldPoints(object);
  if (pts.length < 2) return null;
  const mid = polylineMid(pts);
  const midX = mid.x * S;
  const midY = mid.z * S;

  if (object.type === ObjectType.WALL) {
    const thickness = Math.max(2, positive(object.customWidth, PARTITION_THICKNESS) * S);
    const closed = pts.length > 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].z - pts[pts.length - 1].z) < 1e-6;
    const loop = closed ? pts.slice(0, -1) : pts;
    const paint = `fill="none" stroke="${WALL}" stroke-width="${n(thickness)}" stroke-linejoin="miter" stroke-linecap="butt"`;
    const body = closed
      ? `<path d="M${loop.map(p => `${n(p.x * S)} ${n(p.z * S)}`).join('L')}Z" ${paint}/>`
      : `<polyline points="${loop.map(p => `${n(p.x * S)},${n(p.z * S)}`).join(' ')}" ${paint}/>`;
    return { layer: LAYER_BODY, shape: '', partition: `<g data-id="${esc(object.id)}" data-type="${esc(object.type)}">${body}</g>` };
  }

  if (object.type === ObjectType.CABLE_RUN) {
    const length = pathLength(object.points);
    const caption = `${object.label?.trim() || '電纜'} ${length.toFixed(1)} m`;
    const joints = pts.map(p => `<circle cx="${n(p.x * S)}" cy="${n(p.z * S)}" r="2.6" fill="${CABLE_RED}"/>`).join('');
    return {
      layer: LAYER_PATH,
      shape: `<g data-id="${esc(object.id)}" data-type="${esc(object.type)}"><polyline points="${pts.map(p => `${n(p.x * S)},${n(p.z * S)}`).join(' ')}" fill="none" stroke="${CABLE_RED}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>${joints}</g>`,
      overlay: text(midX, midY - 9, caption, { size: 10.5, weight: 700, fill: '#b91c1c', anchor: 'middle', halo: true }),
    };
  }

  if (object.type === ObjectType.FLOW_ARROW) {
    const color = lineOf(object.color, '#2563eb');
    let tail = pts[pts.length - 2];
    const tip = pts[pts.length - 1];
    for (let i = pts.length - 2; i >= 0; i--) {
      tail = pts[i];
      if (Math.hypot(tip.x - tail.x, tip.z - tail.z) > 1e-6) break;
    }
    const angle = Math.atan2(tip.z - tail.z, tip.x - tail.x);
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const tipX = tip.x * S;
    const tipY = tip.z * S;
    const head = 11;
    const half = 5.5;
    const base = { x: tipX - ux * head, y: tipY - uy * head };
    const arrow = `${n(tipX)},${n(tipY)} ${n(base.x - uy * half)},${n(base.y + ux * half)} ${n(base.x + uy * half)},${n(base.y - ux * half)}`;
    // The line stops at the arrowhead base so a wide stroke does not poke through the tip.
    const linePts = [...pts.slice(0, -1).map(p => ({ x: p.x * S, y: p.z * S })), { x: base.x, y: base.y }];
    return {
      layer: LAYER_PATH,
      shape: `<g data-id="${esc(object.id)}" data-type="${esc(object.type)}"><polyline points="${linePts.map(p => `${n(p.x)},${n(p.y)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><polygon points="${arrow}" fill="${color}"/></g>`,
      overlay: object.label?.trim() ? text(midX, midY - 9, object.label.trim(), { size: 10.5, weight: 600, fill: color, anchor: 'middle', halo: true }) : undefined,
    };
  }

  // DIMENSION: end ticks + text
  const a = pts[0];
  const b = pts[pts.length - 1];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return null;
  const ux = dx / length;
  const uy = dz / length;
  let nx = -uy;
  let ny = ux;
  if (ny > 0) { nx = -nx; ny = -ny; } // text side: up on the sheet
  const tick = 6;
  const ax = a.x * S, ay = a.z * S, bx = b.x * S, by = b.z * S;
  const caption = object.label?.trim() || `${Math.round(length * 100)}cm`;
  const color = '#334155';
  return {
    layer: LAYER_PATH,
    shape: `<g data-id="${esc(object.id)}" data-type="${esc(object.type)}" stroke="${color}" stroke-width="1.2" stroke-linecap="round"><line x1="${n(ax)}" y1="${n(ay)}" x2="${n(bx)}" y2="${n(by)}"/><line x1="${n(ax - nx * tick)}" y1="${n(ay - ny * tick)}" x2="${n(ax + nx * tick)}" y2="${n(ay + ny * tick)}"/><line x1="${n(bx - nx * tick)}" y1="${n(by - ny * tick)}" x2="${n(bx + nx * tick)}" y2="${n(by + ny * tick)}"/></g>`,
    overlay: text(midX + nx * 9, midY + ny * 9, caption, { size: 10.5, weight: 600, fill: color, anchor: 'middle', halo: true }),
  };
}

function renderObject(object: BanquetObject, used: UsedSymbols): Rendered | null {
  if (isPathType(object.type)) return renderPath(object);

  if (object.type === ObjectType.DEVICE_POINT) {
    const def = DEVICE_SYSTEMS[deviceSystemOf(object)];
    const px = object.position.x * S;
    const pz = object.position.z * S;
    const code = object.label?.trim();
    return {
      layer: LAYER_POINT,
      shape: `<g data-id="${esc(object.id)}" data-type="${esc(object.type)}">${deviceSymbol(def.symbol, def.color, px, pz)}</g>`,
      // Codes never rotate and sit beside the symbol, not on it.
      overlay: code ? text(px + 7, pz - 5, code, { size: 8.5, weight: 600, fill: def.color, halo: true }) : undefined,
    };
  }

  const fp = getObjectFootprint(object);
  const bounds = getObjectBounds(object);
  const center = { cx: object.position.x, cz: object.position.z };
  const color = object.color;
  const fill = fillOf(color);
  const stroke = strokeOf(color);
  const style = `fill="${fill}" stroke="${stroke}" stroke-width="1.2"`;
  const layer = layerOf(object.type);
  const userLabel = object.label?.trim();
  const baseName = userLabel || typeName(object);

  // ---- seated tables
  if (object.type === ObjectType.ROUND_TABLE || object.type === ObjectType.RECT_TABLE) {
    const seating = getSeating(object)!;
    const standby = object.standby === true;
    const seats = seatsOf(object, seating.seats);
    const body = object.type === ObjectType.ROUND_TABLE
      ? { kind: 'circle', r: getRoundTableSpec(object.customSize).r } as Footprint
      : rect(getRectTableSpec(object.customSize).w, RECT_TABLE_DEPTH);
    const bodyStyle = standby
      ? `fill="#ffffff" stroke="${stroke}" stroke-width="1.4" stroke-dasharray="5 3"`
      : style;
    let chairs = '';
    let markers = '';
    seats.forEach((seat, i) => {
      const child = i < seating.childSeats;
      if (child) used.childChair = true; else used.chair = true;
      chairs += `<use href="#${child ? 'chair-child' : 'chair'}" transform="translate(${n(seat.x * S)} ${n(seat.z * S)}) rotate(${n(-deg(seat.rotation))})"/>`;
      const world = localToWorld(object, seat);
      if (child) markers += heartAt(world.x * S, world.z * S);
      if (i >= seats.length - seating.vegetarianSeats) {
        const spot = localToWorld(object, seat.marker);
        markers += triangleAt(spot.x * S, spot.z * S);
      }
    });
    const caption = userLabel || (standby ? '備' : '');
    const size = caption && [...caption].length <= 2 ? 16 : 11;
    return {
      layer,
      shape: wrapLocal(object, `${seats.length ? `<g${standby ? ' opacity="0.6"' : ''}>${chairs}</g>` : ''}${footprintEl(body, bodyStyle)}`),
      overlay: markers || undefined,
      label: caption ? { ...center, lines: [caption], size, weight: 700, forceCenter: true, bounds } : undefined,
    };
  }

  const lines: string[] = [];
  let inner = '';
  let gap: string | undefined;
  let size = 9.5;
  let weight: number | undefined;
  let forceCenter = false;

  switch (object.type) {
    case ObjectType.STAGE: {
      const rectFp = fp as Extract<Footprint, { kind: 'rect' }>;
      inner = footprintEl(fp, `fill="${fillOf(color, 0.55)}" stroke="${stroke}" stroke-width="1.8"`);
      lines.push(baseName, `${Math.round(rectFp.w * 100)}×${Math.round(rectFp.d * 100)}cm`);
      size = 12;
      weight = 700;
      forceCenter = true;
      break;
    }
    case ObjectType.RED_CARPET:
      inner = footprintEl(fp, `fill="${fillOf(color, 0.45)}" fill-opacity="0.7" stroke="${stroke}" stroke-width="1"`);
      lines.push(baseName);
      break;
    case ObjectType.DANCE_FLOOR: {
      const rectFp = fp as Extract<Footprint, { kind: 'rect' }>;
      inner = footprintEl(fp, `fill="${fillOf(color, 0.78)}" fill-opacity="0.8" stroke="${stroke}" stroke-width="1"`)
        + rectEl(rectFp.w - 0.3, rectFp.d - 0.3, `fill="none" stroke="${stroke}" stroke-width="0.8" stroke-dasharray="3 3"`, 1);
      lines.push(baseName);
      break;
    }
    case ObjectType.PROJECTION_SCREEN:
    case ObjectType.LED_WALL: {
      const rectFp = fp as Extract<Footprint, { kind: 'rect' }>;
      inner = footprintEl(fp, `fill="none" stroke="${stroke}" stroke-width="0.8" stroke-dasharray="3 3"`)
        + rectEl(rectFp.w, 0.12, `fill="${object.type === ObjectType.LED_WALL ? '#1e293b' : '#94a3b8'}" stroke="${WALL}" stroke-width="1"`, 1);
      lines.push(baseName);
      break;
    }
    case ObjectType.TRUSS_STRAIGHT:
    case ObjectType.TRUSS_STRUCTURE: {
      const rectFp = fp as Extract<Footprint, { kind: 'rect' }>;
      const zig: string[] = [];
      const step = 0.3;
      const count = Math.max(2, Math.floor(rectFp.w / step));
      for (let i = 0; i <= count; i++) zig.push(`${n((-rectFp.w / 2 + (rectFp.w * i) / count) * S)},${n((i % 2 === 0 ? -1 : 1) * (rectFp.d / 2) * S)}`);
      inner = footprintEl(fp, style) + `<polyline points="${zig.join(' ')}" fill="none" stroke="${stroke}" stroke-width="0.8"/>`;
      lines.push(userLabel || (object.trussStructure?.title?.trim() || baseName));
      break;
    }
    case ObjectType.SPEAKER_15:
    case ObjectType.SPEAKER:
    case ObjectType.LIGHT_FOLLOWSPOT:
      inner = footprintEl(fp, `fill="none" stroke="${stroke}" stroke-width="0.8" stroke-dasharray="3 3"`)
        + rectEl(0.4, 0.4, style, 2);
      lines.push(baseName);
      break;
    case ObjectType.CHAIR: {
      const child = object.chairStyle === 'child';
      if (child) used.childChair = true; else used.chair = true;
      inner = `<use href="#${child ? 'chair-child' : 'chair'}"/>`;
      if (child) inner += heartAt(0, 0, 0.9);
      if (userLabel) lines.push(userLabel);
      break;
    }
    case ObjectType.DOOR: {
      const w = (fp as Extract<Footprint, { kind: 'rect' }>).w * S;
      const leaves = object.doorLeaves === 2 ? 2 : 1;
      const parts: string[] = [];
      if (leaves === 1) {
        parts.push(`<line x1="${n(-w / 2)}" y1="0" x2="${n(-w / 2)}" y2="${n(w)}" stroke="${WALL}" stroke-width="2.2" stroke-linecap="round"/>`);
        parts.push(`<path d="M${n(w / 2)} 0A${n(w)} ${n(w)} 0 0 1 ${n(-w / 2)} ${n(w)}" fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="3 2"/>`);
      } else {
        const leaf = w / 2;
        parts.push(`<line x1="${n(-w / 2)}" y1="0" x2="${n(-w / 2)}" y2="${n(leaf)}" stroke="${WALL}" stroke-width="2.2" stroke-linecap="round"/>`);
        parts.push(`<line x1="${n(w / 2)}" y1="0" x2="${n(w / 2)}" y2="${n(leaf)}" stroke="${WALL}" stroke-width="2.2" stroke-linecap="round"/>`);
        parts.push(`<path d="M0 0A${n(leaf)} ${n(leaf)} 0 0 1 ${n(-w / 2)} ${n(leaf)}" fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="3 2"/>`);
        parts.push(`<path d="M0 0A${n(leaf)} ${n(leaf)} 0 0 0 ${n(w / 2)} ${n(leaf)}" fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="3 2"/>`);
      }
      inner = parts.join('');
      // White cut that opens the wall line (drawn right after the walls).
      gap = wrapLocal(object, `<rect x="${n(-w / 2)}" y="-8" width="${n(w)}" height="16" fill="#ffffff"/><line x1="${n(-w / 2)}" y1="-5" x2="${n(-w / 2)}" y2="5" stroke="${WALL}" stroke-width="1.5"/><line x1="${n(w / 2)}" y1="-5" x2="${n(w / 2)}" y2="5" stroke="${WALL}" stroke-width="1.5"/>`, false);
      if (userLabel) lines.push(userLabel);
      break;
    }
    case ObjectType.COLUMN: {
      const solid = luminance(parseColor(color) ?? NEUTRAL) > 0.7 ? '#94a3b8' : toHex(mix(parseColor(color) ?? NEUTRAL, [0, 0, 0], 0.3));
      inner = footprintEl(fp, `fill="${solid}" stroke="${WALL}" stroke-width="1.2"`);
      if (userLabel) lines.push(userLabel);
      break;
    }
    case ObjectType.CHAMPAGNE_TOWER: {
      const rings = Math.max(2, Math.min(4, Math.round(object.tiers ?? 4) - 1));
      let rs = '';
      for (let i = 0; i < rings; i++) {
        const r = 0.45 * (1 - i / (rings + 0.6));
        rs += `<circle r="${n(r * S)}" fill="${i === 0 ? fill : 'none'}" stroke="${stroke}" stroke-width="1"/>`;
      }
      inner = rs;
      lines.push(baseName);
      break;
    }
    case ObjectType.EASEL:
      inner = footprintEl(fp, `fill="none" stroke="${stroke}" stroke-width="0.8" stroke-dasharray="3 3"`)
        + `<line x1="-14" y1="-10" x2="14" y2="-10" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>`
        + `<path d="M-10 -10L-14 10M10 -10L14 10M0 -10V8" fill="none" stroke="${stroke}" stroke-width="1"/>`;
      lines.push(baseName);
      break;
    case ObjectType.GENERATOR:
      inner = footprintEl(fp, `fill="${fill}" stroke="${stroke}" stroke-width="1.6"`) + boltAt(0, -4, stroke, 1.3);
      lines.push(baseName);
      if (object.powerKva && object.powerKva > 0 && !mentions(baseName, `${n(object.powerKva)} kVA`)) lines.push(`${n(object.powerKva)} kVA`);
      forceCenter = true;
      size = 10;
      weight = 600;
      break;
    case ObjectType.POWER_DISTRO:
      inner = footprintEl(fp, `fill="${fill}" stroke="${stroke}" stroke-width="1.4"`) + boltAt(0, 0, stroke, 0.9);
      lines.push(baseName);
      if (object.powerKva && object.powerKva > 0 && !mentions(baseName, `${n(object.powerKva)} kVA`)) lines.push(`${n(object.powerKva)} kVA`);
      break;
    case ObjectType.POWER_OUTLET: {
      const tone = VOLTAGE_COLOR[object.voltage === '220V' ? '220V' : '110V'];
      inner = `<circle r="8" fill="#ffffff" stroke="${tone}" stroke-width="1.4"/>` + boltAt(0, 0, tone, 1);
      if (userLabel) lines.push(userLabel);
      if (!mentions(userLabel ?? '', object.voltage === '220V' ? '220V' : '110V')) lines.push(object.voltage === '220V' ? '220V' : '110V');
      size = 9;
      weight = 700;
      break;
    }
    case ObjectType.CABLE_RAMP: {
      const rectFp = fp as Extract<Footprint, { kind: 'rect' }>;
      const stripes: string[] = [];
      const pitch = 8;
      for (let x = -rectFp.w * S / 2 + 4; x < (rectFp.w * S) / 2 - 5; x += pitch) {
        stripes.push(`M${n(x)} ${n((-rectFp.d * S) / 2)}l5 ${n(rectFp.d * S)}`);
      }
      inner = footprintEl(fp, 'fill="#fde047" stroke="#1f2937" stroke-width="1.2"')
        + `<path d="${stripes.join('')}" stroke="#1f2937" stroke-width="2" fill="none"/>`;
      lines.push(baseName);
      break;
    }
    case ObjectType.SERVICE_STATION: {
      const rectFp = fp as Extract<Footprint, { kind: 'rect' }>;
      inner = footprintEl(fp, style)
        + `<path d="M${n((-rectFp.w * S) / 2 + 4)} 0H${n((rectFp.w * S) / 2 - 4)}" stroke="${stroke}" stroke-width="0.8" stroke-dasharray="2 2"/>`;
      lines.push(baseName);
      break;
    }
    case ObjectType.BEVERAGE_CART: {
      const rectFp = fp as Extract<Footprint, { kind: 'rect' }>;
      const wx = (rectFp.w * S) / 2 - 5;
      const wz = (rectFp.d * S) / 2;
      inner = footprintEl(fp, style)
        + [[-wx, -wz], [wx, -wz], [-wx, wz], [wx, wz]].map(([x, z]) => `<circle cx="${n(x)}" cy="${n(z)}" r="2.2" fill="${WALL}"/>`).join('');
      lines.push(baseName);
      break;
    }
    case ObjectType.BAR_COUNTER: {
      const rectFp = fp as Extract<Footprint, { kind: 'rect' }>;
      inner = footprintEl(fp, style) + rectEl(rectFp.w - 0.16, rectFp.d - 0.22, `fill="none" stroke="${stroke}" stroke-width="0.8"`, 1.5);
      lines.push(baseName);
      break;
    }
    case ObjectType.ZONE: {
      const line = lineOf(color, '#7c3aed');
      inner = footprintEl(fp, `fill="${line}" fill-opacity="0.12" stroke="${line}" stroke-width="1.6" stroke-dasharray="7 4"`);
      lines.push(baseName);
      const note = object.note?.trim();
      if (note) lines.push(note);
      size = 12.5;
      weight = 700;
      forceCenter = true;
      return {
        layer,
        shape: wrapLocal(object, inner),
        label: { ...center, lines, size, weight, fill: strokeOf(line), forceCenter, bounds },
      };
    }
    default:
      inner = footprintEl(fp, style);
      if (!SILENT_TYPES[object.type] || userLabel) lines.push(baseName);
      break;
  }

  return {
    layer,
    shape: wrapLocal(object, inner),
    gap,
    label: lines.length ? { ...center, lines, size, weight, forceCenter, bounds } : undefined,
  };
}

/* ------------------------------------------------------------------ labels */

function renderLabel(spec: LabelSpec): string {
  const lineHeight = spec.size + 2.5;
  const widest = Math.max(...spec.lines.map(line => textWidth(line, spec.size)));
  const boxW = (spec.bounds.maxX - spec.bounds.minX) * S;
  const boxH = (spec.bounds.maxZ - spec.bounds.minZ) * S;
  const inside = spec.forceCenter || (boxW >= widest + 4 && boxH >= lineHeight * spec.lines.length + 2);
  const x = spec.cx * S;
  const top = inside
    ? spec.cz * S - (lineHeight * spec.lines.length) / 2
    : spec.bounds.maxZ * S + 3;
  return spec.lines
    .map((line, i) => text(x, top + lineHeight * (i + 0.5), line, {
      size: i > 0 && spec.size > 11 ? spec.size - 2 : spec.size,
      weight: spec.weight ?? 500,
      fill: spec.fill ?? INK,
      anchor: 'middle',
      halo: true,
    }))
    .join('');
}

/* ------------------------------------------------------------------ legend */

interface LegendEntry {
  key: string;
  label: string;
  icon: (cx: number, cy: number) => string;
}

const LEGEND_ICON_W = 30;

const iconTable = (cx: number, cy: number, dashed = false) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="5.5" fill="${dashed ? '#ffffff' : '#f1f5f9'}" stroke="#64748b" stroke-width="1.2"${dashed ? ' stroke-dasharray="3 2"' : ''}/>`
  + [[-9, 0], [9, 0], [0, -9], [0, 9]].map(([dx, dy]) => `<rect x="${n(cx + dx - 2.5)}" y="${n(cy + dy - 2.5)}" width="5" height="5" rx="1.5" fill="#f8fafc" stroke="#64748b" stroke-width="0.9"/>`).join('');

const buildLegend = (objects: BanquetObject[]): LegendEntry[] => {
  const types = new Set(objects.map(o => o.type));
  const seatings = objects.map(o => ({ o, seating: getSeating(o) })).filter(entry => entry.seating !== null);
  const dining = seatings.filter(entry => (entry.seating!.seats > 0));
  const entries: LegendEntry[] = [];
  if (dining.some(entry => !entry.o.standby)) entries.push({ key: 'table', label: '桌（標示桌號）', icon: (cx, cy) => iconTable(cx, cy) });
  if (dining.some(entry => entry.o.standby)) entries.push({ key: 'standby', label: '備桌', icon: (cx, cy) => iconTable(cx, cy, true) });
  if (dining.length > 0 || types.has(ObjectType.CHAIR)) {
    entries.push({ key: 'chair', label: '座位', icon: (cx, cy) => `<use href="#chair" transform="translate(${n(cx)} ${n(cy)}) scale(0.85)"/>` });
  }
  if (seatings.some(entry => entry.seating!.childSeats > 0) || objects.some(o => o.type === ObjectType.CHAIR && o.chairStyle === 'child')) {
    entries.push({ key: 'child', label: '兒童椅', icon: (cx, cy) => heartAt(cx, cy, 1.3) });
  }
  if (seatings.some(entry => entry.seating!.vegetarianSeats > 0)) {
    entries.push({ key: 'vegetarian', label: '素食', icon: (cx, cy) => triangleAt(cx, cy, 1.3) });
  }
  if (types.has(ObjectType.STAGE)) {
    entries.push({ key: 'stage', label: '舞台', icon: (cx, cy) => `<rect x="${n(cx - 11)}" y="${n(cy - 6)}" width="22" height="12" rx="1.5" fill="#cbd5e1" stroke="#475569" stroke-width="1.4"/>` });
  }
  if (types.has(ObjectType.DOOR)) {
    entries.push({
      key: 'door',
      label: '門（含開門方向）',
      icon: (cx, cy) => `<path d="M${n(cx - 12)} ${n(cy - 5)}H${n(cx - 8)}M${n(cx + 8)} ${n(cy - 5)}H${n(cx + 12)}" stroke="${WALL}" stroke-width="2.4"/><path d="M${n(cx - 8)} ${n(cy - 5)}V${n(cy + 5)}" stroke="${WALL}" stroke-width="1.6"/><path d="M${n(cx + 8)} ${n(cy - 5)}A16 16 0 0 1 ${n(cx - 8)} ${n(cy + 5)}" fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="2 2"/>`,
    });
  }
  if (types.has(ObjectType.COLUMN)) {
    entries.push({ key: 'column', label: '柱', icon: (cx, cy) => `<rect x="${n(cx - 4.5)}" y="${n(cy - 4.5)}" width="9" height="9" fill="#64748b" stroke="${WALL}" stroke-width="1.2"/>` });
  }
  if (types.has(ObjectType.GENERATOR)) {
    entries.push({ key: 'generator', label: '發電機', icon: (cx, cy) => `<rect x="${n(cx - 11)}" y="${n(cy - 6)}" width="22" height="12" rx="1.5" fill="#e2e8f0" stroke="#475569" stroke-width="1.4"/>${boltAt(cx, cy, '#475569', 0.9)}` });
  }
  if (types.has(ObjectType.POWER_DISTRO)) {
    entries.push({ key: 'distro', label: '配電箱', icon: (cx, cy) => `<rect x="${n(cx - 8)}" y="${n(cy - 4.5)}" width="16" height="9" rx="1.5" fill="#e2e8f0" stroke="#475569" stroke-width="1.2"/>${boltAt(cx, cy, '#475569', 0.6)}` });
  }
  for (const voltage of ['110V', '220V'] as const) {
    if (objects.some(o => o.type === ObjectType.POWER_OUTLET && (o.voltage ?? '110V') === voltage)) {
      entries.push({
        key: `outlet-${voltage}`,
        label: `${voltage} 電源點`,
        icon: (cx, cy) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="7" fill="#ffffff" stroke="${VOLTAGE_COLOR[voltage]}" stroke-width="1.4"/>${boltAt(cx, cy, VOLTAGE_COLOR[voltage], 0.9)}`,
      });
    }
  }
  if (types.has(ObjectType.CABLE_RUN)) {
    entries.push({ key: 'cable-run', label: '電纜路線', icon: (cx, cy) => `<path d="M${n(cx - 12)} ${n(cy)}H${n(cx + 12)}" stroke="${CABLE_RED}" stroke-width="3.2" stroke-linecap="round"/>` });
  }
  if (types.has(ObjectType.CABLE_RAMP)) {
    entries.push({ key: 'cable-ramp', label: '過線槽', icon: (cx, cy) => `<rect x="${n(cx - 11)}" y="${n(cy - 5)}" width="22" height="10" fill="#fde047" stroke="#1f2937" stroke-width="1.2"/><path d="M${n(cx - 6)} ${n(cy - 5)}l3 10M${n(cx)} ${n(cy - 5)}l3 10M${n(cx + 6)} ${n(cy - 5)}l3 10" stroke="#1f2937" stroke-width="1.6"/>` });
  }
  if (types.has(ObjectType.FLOW_ARROW)) {
    entries.push({ key: 'flow-arrow', label: '動線', icon: (cx, cy) => `<path d="M${n(cx - 12)} ${n(cy)}H${n(cx + 5)}" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/><polygon points="${n(cx + 13)},${n(cy)} ${n(cx + 4)},${n(cy - 5)} ${n(cx + 4)},${n(cy + 5)}" fill="#2563eb"/>` });
  }
  if (types.has(ObjectType.DIMENSION)) {
    entries.push({ key: 'dimension', label: '尺寸標註', icon: (cx, cy) => `<path d="M${n(cx - 12)} ${n(cy)}H${n(cx + 12)}M${n(cx - 12)} ${n(cy - 5)}V${n(cy + 5)}M${n(cx + 12)} ${n(cy - 5)}V${n(cy + 5)}" stroke="#334155" stroke-width="1.2"/>` });
  }
  if (types.has(ObjectType.ZONE)) {
    entries.push({ key: 'zone', label: '區域', icon: (cx, cy) => `<rect x="${n(cx - 11)}" y="${n(cy - 6)}" width="22" height="12" fill="#7c3aed" fill-opacity="0.12" stroke="#7c3aed" stroke-width="1.4" stroke-dasharray="4 3"/>` });
  }
  if (types.has(ObjectType.WALL)) {
    entries.push({ key: 'partition', label: '隔間牆', icon: (cx, cy) => `<path d="M${n(cx - 12)} ${n(cy)}H${n(cx + 12)}" stroke="${WALL}" stroke-width="4"/>` });
  }
  const deviceCounts = countDevicePoints(objects);
  for (const system of DEVICE_SYSTEM_ORDER) {
    const count = deviceCounts[system];
    if (!count) continue;
    const def = DEVICE_SYSTEMS[system];
    entries.push({ key: `device-${system}`, label: `${def.label}（${count}）`, icon: (cx, cy) => deviceSymbol(def.symbol, def.color, cx, cy) });
  }
  return entries;
};

/* ------------------------------------------------------------------ document */

/** Length of every wall, set outside the room along the wall and kept upright (never upside down). */
function wallLengthLabels(outline: PathPoint[]): string {
  return getWallSegments(outline).map(wall => {
    const x = ((wall.start.x + wall.end.x) / 2 - wall.inward.x * (14 / S)) * S;
    const y = ((wall.start.z + wall.end.z) / 2 - wall.inward.z * (14 / S)) * S;
    let angle = deg(Math.atan2(wall.direction.z, wall.direction.x));
    if (angle > 90) angle -= 180;
    else if (angle <= -90) angle += 180;
    return text(x, y, `${n(wall.length)} m`, { size: 11, fill: MUTED, anchor: 'middle', extra: `transform="rotate(${n(angle)} ${n(x)} ${n(y)})"` });
  }).join('');
}

const MARGIN_M = 1.5;
const PAD = 24;
const MIN_WIDTH = 960;
const TITLE_COL = 300;

export function buildFloorPlanSvg(input: FloorPlanInput, options: FloorPlanOptions = {}): string {
  const { hall } = input;
  // A plate standing on a table repeats the table's number, which the table symbol already prints.
  const objects = filterDeviceSystems(input.objects, options.deviceSystems)
    .filter((object, _, all) => object.type !== ObjectType.TABLE_NUMBER || !all.some(table => isOnTable(object, table)));
  const drawings = input.drawings ?? [];
  const showLegend = options.showLegend !== false;
  const showGrid = options.showGrid === true;
  const info = hall.planInfo ?? {};

  /* ---- bounds */
  const hallW = positive(hall.width, 20);
  const hallL = positive(hall.length, 30);
  const customOutline = (hall.outline ?? []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.z));
  const outline = getHallOutline({ width: hallW, length: hallL, outline: customOutline });
  const hallBounds = getOutlineBounds(outline);
  const hallIsRect = outline.length === 4 && Math.abs(Math.abs(signedArea(outline)) - hallBounds.width * hallBounds.length) < 1e-6;
  const box: WorldBounds = { minX: hallBounds.minX, maxX: hallBounds.maxX, minZ: hallBounds.minZ, maxZ: hallBounds.maxZ };
  const merge = (other: WorldBounds) => {
    if (!Number.isFinite(other.minX)) return;
    extend(box, other.minX, other.minZ);
    extend(box, other.maxX, other.maxZ);
  };
  for (const object of objects) merge(getObjectBounds(object));
  const validDrawings = drawings.filter(path => path.points && path.points.length >= 2);
  for (const path of validDrawings) for (const p of path.points) extend(box, p.x, p.z);
  const minX = box.minX - MARGIN_M;
  const minZ = box.minZ - MARGIN_M;
  const planW = (box.maxX - box.minX + 2 * MARGIN_M) * S;
  const planH = (box.maxZ - box.minZ + 2 * MARGIN_M) * S;
  const width = Math.max(MIN_WIDTH, Math.ceil(planW + 2 * PAD));
  const planX = (width - planW) / 2 - minX * S;
  const planY = -minZ * S;

  /* ---- plan contents */
  const used: UsedSymbols = { chair: false, childChair: false };
  const rendered = objects
    .map((object, index) => ({ index, item: renderObject(object, used) }))
    .filter((entry): entry is { index: number; item: Rendered } => entry.item !== null)
    .sort((a, b) => a.item.layer - b.item.layer || a.index - b.index)
    .map(entry => entry.item);
  const underlay = rendered.filter(r => r.layer <= LAYER_STAGE).map(r => r.shape).join('');
  const bodies = rendered.filter(r => r.layer > LAYER_STAGE).map(r => r.shape).join('');
  const partitions = rendered.map(r => r.partition ?? '').join('');
  const gaps = rendered.map(r => r.gap ?? '').join('');
  const overlays = rendered.map(r => r.overlay ?? '').join('');
  const labels = rendered.map(r => (r.label ? renderLabel(r.label) : '')).join('');

  const legend = showLegend ? buildLegend(objects) : [];


  let grid = '';
  if (showGrid) {
    const x0 = Math.floor(box.minX - MARGIN_M);
    const x1 = Math.ceil(box.maxX + MARGIN_M);
    const z0 = Math.floor(box.minZ - MARGIN_M);
    const z1 = Math.ceil(box.maxZ + MARGIN_M);
    const parts: string[] = [];
    for (let x = x0; x <= x1; x++) parts.push(`<line x1="${n(x * S)}" y1="${n(z0 * S)}" x2="${n(x * S)}" y2="${n(z1 * S)}" stroke="${x % 5 === 0 ? '#cbd5e1' : '#e8edf3'}" stroke-width="${x % 5 === 0 ? 0.8 : 0.5}"/>`);
    for (let z = z0; z <= z1; z++) parts.push(`<line x1="${n(x0 * S)}" y1="${n(z * S)}" x2="${n(x1 * S)}" y2="${n(z * S)}" stroke="${z % 5 === 0 ? '#cbd5e1' : '#e8edf3'}" stroke-width="${z % 5 === 0 ? 0.8 : 0.5}"/>`);
    grid = `<g id="grid">${parts.join('')}</g>`;
  }

  const drawingSvg = validDrawings
    .map(path => `<polyline points="${path.points.map(p => `${n(p.x * S)},${n(p.z * S)}`).join(' ')}" fill="none" stroke="${lineOf(path.color, '#ef4444')}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`)
    .join('');

  const wallPath = `M${outline.map(p => `${n(p.x * S)} ${n(p.z * S)}`).join('L')}Z`;
  const walls = `<path id="hall-walls" d="${wallPath}" fill="none" stroke="${WALL}" stroke-width="6" stroke-linejoin="miter"/>`;
  const hallLabels = hallIsRect
    ? text(hallBounds.centerX * S, hallBounds.minZ * S - 14, `${n(hallBounds.width)} m`, { size: 11, fill: MUTED, anchor: 'middle' })
      + text(0, 0, `${n(hallBounds.length)} m`, { size: 11, fill: MUTED, anchor: 'middle', extra: `transform="translate(${n(hallBounds.minX * S - 14)} ${n(hallBounds.centerZ * S)}) rotate(-90)"` })
    : wallLengthLabels(outline);

  const planSvg = `<g id="plan" transform="translate(${n(planX)} ${n(planY)})">`
    + grid
    + `<path id="hall-floor" d="${wallPath}" fill="#f8fafc"/>`
    + underlay
    + walls
    + partitions
    + gaps
    + bodies
    + drawingSvg
    + overlays
    + labels
    + hallLabels
    + '</g>';

  /* ---- footer: title block | notes | legend */
  const title = info.title?.trim() || options.title?.trim() || '宴會平面圖';
  const notes: string[] = [];
  for (const line of (info.notes ?? '').split(/\r?\n/)) if (line.trim()) notes.push(line.trim());
  for (const object of objects) {
    // Hundreds of device points can exist; their remarks go to the CSV list instead.
    if (object.type === ObjectType.DEVICE_POINT) continue;
    const note = object.note?.trim();
    if (note) notes.push(`${displayName(object)}：${note}`);
  }

  const footerTop = planH + 8;
  const legendCols = legend.length > 7 ? 2 : 1;
  const legendW = legend.length > 0 ? legendCols * 170 : 0;
  const gapW = 24;
  const columnsUsed = 1 + (notes.length > 0 ? 1 : 0) + (legend.length > 0 ? 1 : 0);
  const notesW = Math.max(220, width - 2 * PAD - TITLE_COL - legendW - gapW * (columnsUsed - 1));
  const finalWidth = notes.length > 0 ? Math.max(width, 2 * PAD + TITLE_COL + legendW + notesW + gapW * (columnsUsed - 1)) : width;
  const bottomEdge = finalWidth - PAD;

  // title column
  const colX = PAD;
  let y = footerTop + 22;
  const titleParts: string[] = [];
  for (const line of wrapText(title, TITLE_COL, 20)) {
    titleParts.push(text(colX, y, line, { size: 20, weight: 700 }));
    y += 26;
  }
  y += 2;
  const meta: string[] = [];
  if (info.venue?.trim()) meta.push(`場地：${info.venue.trim()}`);
  if (info.date?.trim()) meta.push(`日期：${info.date.trim()}`);
  if (info.version?.trim()) meta.push(`版本：${info.version.trim()}`);
  const outlineArea = Math.round(Math.abs(signedArea(outline)));
  meta.push(hallIsRect
    ? `廳房尺寸：${n(hallBounds.width)} × ${n(hallBounds.length)} m・面積 ${outlineArea} m²`
    : `廳房外框：${n(hallBounds.width)} × ${n(hallBounds.length)} m（${getWallSegments(outline).length} 邊）・面積 ${outlineArea} m²`);
  for (const entry of meta) for (const line of wrapText(entry, TITLE_COL, 12.5)) {
    titleParts.push(text(colX, y, line, { size: 12.5, fill: MUTED }));
    y += 18;
  }
  y += 4;
  const summaries = [formatSeatingSummary(summarizeSeating(objects)), formatPowerSummary(objects), formatDeviceSummary(objects)].filter(Boolean);
  for (const entry of summaries) for (const line of wrapText(entry, TITLE_COL, 12.5)) {
    titleParts.push(text(colX, y, line, { size: 12.5, weight: 600 }));
    y += 18;
  }
  y += 10;
  // scale bar: 5 × 1 m, alternating
  const barY = y + 6;
  let bar = '';
  for (let i = 0; i < 5; i++) {
    bar += `<rect x="${n(colX + i * S)}" y="${n(barY)}" width="${S}" height="6" fill="${i % 2 === 0 ? '#1e293b' : '#ffffff'}" stroke="#1e293b" stroke-width="1"/>`;
  }
  bar += text(colX, barY + 17, '0', { size: 10, fill: MUTED, anchor: 'middle' })
    + text(colX + S, barY + 17, '1 m', { size: 10, fill: MUTED, anchor: 'middle' })
    + text(colX + 5 * S, barY + 17, '5 m', { size: 10, fill: MUTED, anchor: 'middle' });
  titleParts.push(`<g id="scale-bar">${bar}</g>`);
  const titleBottom = barY + 26;

  // notes column
  let notesSvg = '';
  let notesBottom = footerTop;
  let nextX = PAD + TITLE_COL + gapW;
  if (notes.length > 0) {
    let ny = footerTop + 22;
    const parts = [text(nextX, ny, '備註', { size: 13, weight: 700 })];
    ny += 22;
    for (const note of notes) {
      const lines = wrapText(note, notesW - 12, 12);
      lines.forEach((line, i) => {
        parts.push(text(nextX + (i === 0 ? 0 : 12), ny, i === 0 ? `・${line}` : line, { size: 12 }));
        ny += 17;
      });
      ny += 3;
    }
    notesSvg = `<g id="notes">${parts.join('')}</g>`;
    notesBottom = ny;
    nextX += notesW + gapW;
  }

  // legend column
  let legendSvg = '';
  let legendBottom = footerTop;
  if (legend.length > 0) {
    const rowsPerCol = Math.ceil(legend.length / legendCols);
    const parts = [text(nextX, footerTop + 22, '圖例', { size: 13, weight: 700 })];
    legend.forEach((entry, i) => {
      const col = Math.floor(i / rowsPerCol);
      const row = i % rowsPerCol;
      const ey = footerTop + 48 + row * 26;
      const ex = nextX + col * 170;
      parts.push(`<g class="legend-item" data-legend="${esc(entry.key)}">${entry.icon(ex + LEGEND_ICON_W / 2, ey)}${text(ex + LEGEND_ICON_W + 8, ey, entry.label, { size: 12 })}</g>`);
    });
    legendSvg = `<g id="legend">${parts.join('')}</g>`;
    legendBottom = footerTop + 48 + rowsPerCol * 26;
  }

  const height = Math.ceil(Math.max(titleBottom, notesBottom, legendBottom) + PAD);

  const defs: string[] = [];
  if (used.chair || legend.some(e => e.key === 'chair')) {
    defs.push(`<g id="chair"><rect x="-8" y="-7.5" width="16" height="14" rx="3" fill="#f8fafc" stroke="#64748b" stroke-width="1"/><line x1="-8" y1="9" x2="8" y2="9" stroke="#475569" stroke-width="2.2" stroke-linecap="round"/></g>`);
  }
  if (used.childChair || legend.some(e => e.key === 'child')) {
    defs.push(`<g id="chair-child"><rect x="-6" y="-5.5" width="12" height="11" rx="2.5" fill="#fee2e2" stroke="${CHILD_RED}" stroke-width="1"/><line x1="-6" y1="7.5" x2="6" y2="7.5" stroke="${CHILD_RED}" stroke-width="2" stroke-linecap="round"/></g>`);
  }

  const separator = `<line x1="${PAD}" y1="${n(footerTop - 6)}" x2="${n(bottomEdge)}" y2="${n(footerTop - 6)}" stroke="#cbd5e1" stroke-width="1"/>`;
  const frame = `<rect x="6" y="6" width="${finalWidth - 12}" height="${height - 12}" fill="none" stroke="#cbd5e1" stroke-width="1"/>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${finalWidth}" height="${height}" viewBox="0 0 ${finalWidth} ${height}" font-family="${FONT_FAMILY}">`,
    `<title>${esc(title)}</title>`,
    defs.length ? `<defs>${defs.join('')}</defs>` : '',
    `<rect width="${finalWidth}" height="${height}" fill="#ffffff"/>`,
    frame,
    planSvg,
    separator,
    `<g id="title-block">${titleParts.join('')}</g>`,
    notesSvg,
    legendSvg,
    '</svg>',
  ].filter(Boolean).join('\n');
}

/** `點位 152：網路點 31・電子門牌 5・…` in system order; '' without device points. */
export function formatDeviceSummary(objects: BanquetObject[]): string {
  const counts = countDevicePoints(objects);
  const parts = DEVICE_SYSTEM_ORDER.filter(system => counts[system]).map(system => `${DEVICE_SYSTEMS[system].label} ${counts[system]}`);
  if (parts.length === 0) return '';
  const total = DEVICE_SYSTEM_ORDER.reduce((sum, system) => sum + (counts[system] ?? 0), 0);
  return `點位 ${total}：${parts.join('・')}`;
}

const csvField = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const round2 = (value: number) => (Math.round(value * 100) / 100) + 0;
const codeCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/**
 * Device point list as UTF-8 CSV (no BOM): 編號,系統,X (m),Z (m),高度 (m),備註.
 * Sorted by system order, then natural code order (MN-2 before MN-10); coordinates are world meters.
 */
export function buildDevicePointCsv(objects: BanquetObject[]): string {
  const rows = objects
    .filter(object => object.type === ObjectType.DEVICE_POINT)
    .map(object => ({ object, system: deviceSystemOf(object), code: object.label?.trim() ?? '' }))
    .sort((a, b) => DEVICE_SYSTEM_ORDER.indexOf(a.system) - DEVICE_SYSTEM_ORDER.indexOf(b.system) || codeCollator.compare(a.code, b.code));
  const lines = [['編號', '系統', 'X (m)', 'Z (m)', '高度 (m)', '備註']];
  for (const { object, system, code } of rows) {
    const world = objectPointToWorld(object, { x: 0, z: 0 });
    lines.push([code, DEVICE_SYSTEMS[system].label, String(round2(world.x)), String(round2(world.z)), String(round2(object.position.y)), object.note?.trim() ?? '']);
  }
  return lines.map(line => line.map(csvField).join(',')).join('\r\n');
}
