import { TrussCustomMember, TrussStructureConfig, TrussStructureKind } from './types';
import {
  createDefaultTrussConfig,
  fitSegments,
  fitSegmentsForBays,
  getMemberLength,
  getTrussCouplerAllowances,
  getTrussDimensions,
} from './trussConfig';

/** A ready-made structure for the builder's 常用樣式 row. `sketch` picks the thumbnail; FRAME is the four-post frame. */
export interface TrussTemplate {
  id: string;
  title: string;
  sketch: TrussStructureKind | 'FRAME';
  build: () => TrussStructureConfig;
}

/**
 * Four legs carrying a rectangular top frame (ground support over a stage, a booth frame). Built as CUSTOM members:
 * spans are member centrelines and each top corner is one coupler joining a leg, a beam and a side beam.
 */
export function createFourPostFrame(title: string, widthCm: number, depthCm: number, heightCm: number): TrussStructureConfig {
  const legs = fitSegments(heightCm);
  const beam = fitSegments(widthCm);
  const side = fitSegments(depthCm);
  const height = getMemberLength({ segments: legs });
  const width = getMemberLength({ segments: beam });
  const depth = getMemberLength({ segments: side });
  const leg = (id: string, label: string, xCm: number, zCm: number): TrussCustomMember => ({
    id, label, orientation: 'VERTICAL', segments: [...legs], origin: { xCm, yCm: 0, zCm }, basePlate: true,
  });
  return {
    kind: 'CUSTOM',
    title,
    quantity: 1,
    members: [
      leg('frame-leg-front-left', '左前柱', 0, 0),
      leg('frame-leg-front-right', '右前柱', width, 0),
      leg('frame-leg-back-left', '左後柱', 0, depth),
      leg('frame-leg-back-right', '右後柱', width, depth),
      { id: 'frame-beam-front', label: '前梁', orientation: 'HORIZONTAL', direction: 1, segments: [...beam], origin: { xCm: 0, yCm: height, zCm: 0 } },
      { id: 'frame-beam-back', label: '後梁', orientation: 'HORIZONTAL', direction: 1, segments: [...beam], origin: { xCm: 0, yCm: height, zCm: depth } },
      { id: 'frame-side-left', label: '左側梁', orientation: 'DEPTH', segments: [...side], origin: { xCm: 0, yCm: height, zCm: 0 } },
      { id: 'frame-side-right', label: '右側梁', orientation: 'DEPTH', segments: [...side], origin: { xCm: width, yCm: height, zCm: 0 } },
    ],
  };
}

function createMultiBay(title: string, widthCm: number, heightCm: number, bayCount: number): TrussStructureConfig {
  const allowances = getTrussCouplerAllowances({ kind: 'MULTI_BAY', bayCount });
  return {
    ...createDefaultTrussConfig('MULTI_BAY', title, widthCm, heightCm),
    bayCount,
    beam: { segments: fitSegmentsForBays(Math.max(10, widthCm - allowances.widthCm), bayCount) },
  };
}

/**
 * Common event structures. Outer sizes include the 25 cm corner couplers and are chosen so legs and beams come out in
 * whole 200/150/100/50 sections (no 10/20 fillers); CUSTOM frames are measured on member centrelines.
 */
export const TRUSS_TEMPLATES: TrussTemplate[] = [
  { id: 'screen-frame', title: '投影幕架', sketch: 'GOALPOST', build: () => createDefaultTrussConfig('GOALPOST', '投影幕架', 450, 325) },
  { id: 'led-frame', title: 'LED 牆架', sketch: 'GOALPOST', build: () => createDefaultTrussConfig('GOALPOST', 'LED 牆架', 650, 425) },
  { id: 'stage-backdrop', title: '舞台背板架', sketch: 'BACKDROP', build: () => createDefaultTrussConfig('BACKDROP', '舞台背板架', 850, 425, 150) },
  { id: 'welcome-arch', title: '迎賓門架', sketch: 'GOALPOST', build: () => createDefaultTrussConfig('GOALPOST', '迎賓門架', 350, 275) },
  { id: 'tower', title: '燈光／喇叭立柱', sketch: 'TOWER', build: () => createDefaultTrussConfig('TOWER', '燈光／喇叭立柱', 0, 300) },
  { id: 'lighting-rig', title: '連排燈架', sketch: 'MULTI_BAY', build: () => createMultiBay('連排燈架', 1300, 425, 3) },
  { id: 'four-post-rig', title: '四柱燈架', sketch: 'FRAME', build: () => createFourPostFrame('四柱燈架', 600, 400, 400) },
  { id: 'booth-frame', title: '攤位框', sketch: 'FRAME', build: () => createFourPostFrame('攤位框', 300, 300, 250) },
];

/** "H300", "W450 × H350" or "W600 × H450 × D400" (cm); depth only when the structure has one. */
export function formatTrussSize(config: TrussStructureConfig, separator = ' × '): string {
  const dims = getTrussDimensions(config);
  if (config.kind === 'TOWER') return `H${dims.heightCm}`;
  return `W${dims.widthCm}${separator}H${dims.heightCm}${dims.depthCm !== undefined ? `${separator}D${dims.depthCm}` : ''}`;
}
