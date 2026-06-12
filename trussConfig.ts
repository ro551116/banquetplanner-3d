import { BanquetObject, ObjectType, TrussMember, TrussSegmentLength, TrussStructureConfig } from './types';

export const TRUSS_SEGMENT_LENGTHS: TrussSegmentLength[] = [200, 150, 100, 50, 20, 10];

export const TRUSS_SEGMENT_COLORS: Record<TrussSegmentLength, string> = {
  200: '#4da6e8',
  150: '#7ec850',
  100: '#f0d040',
  50: '#8b3a2a',
  20: '#d03030',
  10: '#999999',
};

export interface TrussDimensions {
  widthCm: number;
  heightCm: number;
  depthCm?: number;
}

export interface TrussBom {
  segments: Record<TrussSegmentLength, number>;
  couplers: number;
  basePlates: number;
}

export interface TrussGroup {
  key: string;
  config: TrussStructureConfig;
  objects: BanquetObject[];
  quantity: number;
}

const EMPTY_SEGMENT_COUNTS: Record<TrussSegmentLength, number> = {
  200: 0,
  150: 0,
  100: 0,
  50: 0,
  20: 0,
  10: 0,
};

const clampQuantity = (quantity?: number) => Math.max(1, Math.round(quantity || 1));

export const sanitizeMember = (member?: TrussMember): TrussMember => ({
  segments: (member?.segments || []).filter((length): length is TrussSegmentLength =>
    TRUSS_SEGMENT_LENGTHS.includes(length as TrussSegmentLength)
  ),
});

export const getMemberLength = (member?: TrussMember): number => {
  return sanitizeMember(member).segments.reduce((sum, segment) => sum + segment, 0);
};

export const fitSegments = (targetCm: number): TrussSegmentLength[] => {
  const target = Math.max(10, Math.floor((Number.isFinite(targetCm) ? targetCm : 10) / 10) * 10);
  const result: TrussSegmentLength[] = [];
  let remaining = target;

  for (const length of TRUSS_SEGMENT_LENGTHS) {
    while (remaining >= length) {
      result.push(length);
      remaining -= length;
    }
  }

  return result.length > 0 ? result : [10];
};

export const createDefaultTrussConfig = (
  kind: TrussStructureConfig['kind'] = 'GOALPOST',
  title = 'Truss 結構',
  widthCm = 550,
  heightCm = 375,
  depthCm = 125,
  quantity = 1,
): TrussStructureConfig => {
  const beam = kind === 'TOWER' ? undefined : { segments: fitSegments(widthCm) };
  const depthMember = kind === 'BACKDROP' ? { segments: fitSegments(depthCm) } : undefined;

  return {
    kind,
    legs: { segments: fitSegments(heightCm) },
    beam,
    depthMember,
    quantity: clampQuantity(quantity),
    title,
  };
};

export const getTrussDimensions = (config: TrussStructureConfig): TrussDimensions => {
  const heightCm = getMemberLength(config.legs);
  const beamLength = getMemberLength(config.beam);
  const depthLength = getMemberLength(config.depthMember);

  return {
    widthCm: config.kind === 'TOWER' ? 30 : beamLength,
    heightCm,
    depthCm: config.kind === 'BACKDROP' ? depthLength : undefined,
  };
};

export const formatTrussTitle = (config: TrussStructureConfig, quantityOverride?: number): string => {
  const dims = getTrussDimensions(config);
  const quantity = clampQuantity(quantityOverride ?? config.quantity);
  const baseTitle = config.title.trim() || 'Truss 結構';
  const dimensionText = config.kind === 'TOWER'
    ? `外徑H${dims.heightCm}`
    : `外徑W${dims.widthCm}×H${dims.heightCm}${config.kind === 'BACKDROP' ? `×D${dims.depthCm || 0}` : ''}`;
  const suffix = config.kind === 'GOALPOST' || config.kind === 'BACKDROP'
    ? `ㄇTRUSS${quantity > 1 ? `×${quantity}座` : ''}`
    : `TRUSS${quantity > 1 ? `×${quantity}座` : ''}`;

  return `${baseTitle} ${dimensionText} ${suffix}`;
};

const addMemberToBom = (
  bom: TrussBom,
  member: TrussMember | undefined,
  physicalCount: number,
) => {
  const sanitized = sanitizeMember(member);
  sanitized.segments.forEach(segment => {
    bom.segments[segment] += physicalCount;
  });
  bom.couplers += Math.max(0, sanitized.segments.length - 1) * physicalCount;
};

export const calculateTrussBom = (config: TrussStructureConfig, quantityOverride?: number): TrussBom => {
  const quantity = clampQuantity(quantityOverride ?? config.quantity);
  const bom: TrussBom = {
    segments: { ...EMPTY_SEGMENT_COUNTS },
    couplers: 0,
    basePlates: 0,
  };

  const legCount = config.kind === 'TOWER' ? 1 : 2;
  addMemberToBom(bom, config.legs, legCount * quantity);

  if (config.kind !== 'TOWER') {
    addMemberToBom(bom, config.beam, quantity);
    bom.couplers += 2 * quantity; // column-to-beam joints
    bom.basePlates += 2 * quantity;
  } else {
    bom.basePlates += quantity;
  }

  if (config.kind === 'BACKDROP') {
    addMemberToBom(bom, config.depthMember, 2 * quantity);
    bom.couplers += 2 * quantity; // depth side brace joints
  }

  return bom;
};

export const mergeTrussBoms = (boms: TrussBom[]): TrussBom => {
  const total: TrussBom = {
    segments: { ...EMPTY_SEGMENT_COUNTS },
    couplers: 0,
    basePlates: 0,
  };

  boms.forEach(bom => {
    TRUSS_SEGMENT_LENGTHS.forEach(length => {
      total.segments[length] += bom.segments[length] || 0;
    });
    total.couplers += bom.couplers;
    total.basePlates += bom.basePlates;
  });

  return total;
};

export const getTrussGroups = (objects: BanquetObject[]): TrussGroup[] => {
  const groups = new Map<string, TrussGroup>();

  objects
    .filter(obj => obj.type === ObjectType.TRUSS_STRUCTURE && obj.trussStructure)
    .forEach(obj => {
      const config = obj.trussStructure as TrussStructureConfig;
      const key = config.groupId || obj.id;
      const existing = groups.get(key);
      if (existing) {
        existing.objects.push(obj);
        existing.quantity = existing.objects.length;
      } else {
        groups.set(key, {
          key,
          config,
          objects: [obj],
          quantity: config.groupId ? 1 : clampQuantity(config.quantity),
        });
      }
    });

  return Array.from(groups.values()).map(group => ({
    ...group,
    quantity: group.config.groupId ? group.objects.length : clampQuantity(group.config.quantity),
  }));
};

export const summarizeTrussBom = (objects: BanquetObject[]): TrussBom => {
  return mergeTrussBoms(
    getTrussGroups(objects).map(group => calculateTrussBom(group.config, group.quantity))
  );
};

export const cloneTrussConfig = (config: TrussStructureConfig): TrussStructureConfig => ({
  ...config,
  legs: { segments: [...config.legs.segments] },
  beam: config.beam ? { segments: [...config.beam.segments] } : undefined,
  depthMember: config.depthMember ? { segments: [...config.depthMember.segments] } : undefined,
});
