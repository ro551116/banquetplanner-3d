import { BanquetObject, ObjectType, TrussMember, TrussSegmentLength, TrussStructureConfig, TrussStructureKind } from './types';

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
const clampBayCount = (bayCount?: number) => Math.min(6, Math.max(2, Math.round(bayCount || 2)));

const cloneMember = (member?: TrussMember): TrussMember | undefined => (
  member ? { segments: [...member.segments] } : undefined
);

export const getEffectiveRightLeg = (config: TrussStructureConfig): TrussMember => (
  config.legsRight || config.legs
);

export const getEffectiveBayCount = (config: TrussStructureConfig): number => (
  clampBayCount(config.bayCount)
);

export const getEffectiveBeamAttachCm = (config: TrussStructureConfig): number => {
  const legHeight = getMemberLength(config.legs);
  const attach = config.beamAttachCm ?? legHeight;
  if (!Number.isFinite(attach)) return legHeight;
  return Math.max(0, Math.round(attach));
};

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
  const halfWidth = Math.max(10, Math.round(widthCm / 2));
  const legs = { segments: fitSegments(heightCm) };
  const fittedHeightCm = getMemberLength(legs);
  const beam = kind === 'TOWER' ? undefined : { segments: fitSegments(kind === 'TSHAPE' ? halfWidth : widthCm) };
  const beamRight = kind === 'TSHAPE' ? { segments: fitSegments(halfWidth) } : undefined;
  const bottomBeam = kind === 'BOX' ? { segments: fitSegments(widthCm) } : undefined;
  const depthMember = kind === 'BACKDROP' ? { segments: fitSegments(depthCm) } : undefined;

  return {
    kind,
    legs,
    beam,
    beamRight,
    bottomBeam,
    depthMember,
    bayCount: kind === 'MULTI_BAY' ? 2 : undefined,
    beamAttachCm: kind === 'LSHAPE' || kind === 'TSHAPE' ? fittedHeightCm : undefined,
    quantity: clampQuantity(quantity),
    title,
  };
};

export const getTrussDimensions = (config: TrussStructureConfig): TrussDimensions => {
  const leftHeight = getMemberLength(config.legs);
  const rightHeight = (
    config.kind === 'GOALPOST' ||
    config.kind === 'BACKDROP' ||
    config.kind === 'BOX'
  ) ? getMemberLength(getEffectiveRightLeg(config)) : 0;
  const attachHeight = (
    config.kind === 'LSHAPE' ||
    config.kind === 'TSHAPE'
  ) ? getEffectiveBeamAttachCm(config) : 0;
  const heightCm = Math.max(leftHeight, rightHeight, attachHeight);
  const beamLength = getMemberLength(config.beam);
  const beamRightLength = getMemberLength(config.beamRight);
  const depthLength = getMemberLength(config.depthMember);
  const widthCm = (() => {
    switch (config.kind) {
      case 'TOWER':
        return 30;
      case 'TSHAPE':
        return beamLength + beamRightLength;
      case 'LSHAPE':
      case 'MULTI_BAY':
      case 'GOALPOST':
      case 'BACKDROP':
      case 'BOX':
      default:
        return beamLength;
    }
  })();

  return {
    widthCm,
    heightCm,
    depthCm: config.kind === 'BACKDROP' ? depthLength : undefined,
  };
};

const getKindSuffix = (kind: TrussStructureKind, quantity: number, bayCount?: number): string => {
  const quantityText = quantity > 1 ? `×${quantity}座` : '';

  switch (kind) {
    case 'GOALPOST':
    case 'BACKDROP':
      return `ㄇTRUSS${quantityText}`;
    case 'BOX':
      return `口字TRUSS${quantityText}`;
    case 'LSHAPE':
      return `L型TRUSS${quantityText}`;
    case 'TSHAPE':
      return `T型TRUSS${quantityText}`;
    case 'MULTI_BAY':
      return `連排ㄇTRUSS×${clampBayCount(bayCount)}跨${quantityText}`;
    case 'TOWER':
    default:
      return `TRUSS${quantityText}`;
  }
};

export const formatTrussTitle = (config: TrussStructureConfig, quantityOverride?: number): string => {
  const dims = getTrussDimensions(config);
  const quantity = clampQuantity(quantityOverride ?? config.quantity);
  const baseTitle = config.title.trim() || 'Truss 結構';
  const dimensionText = config.kind === 'TOWER'
    ? `外徑H${dims.heightCm}`
    : `外徑W${dims.widthCm}×H${dims.heightCm}${config.kind === 'BACKDROP' ? `×D${dims.depthCm || 0}` : ''}`;
  const suffix = getKindSuffix(config.kind, quantity, config.bayCount);

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
  const bayCount = getEffectiveBayCount(config);

  switch (config.kind) {
    case 'TOWER':
      addMemberToBom(bom, config.legs, quantity);
      bom.basePlates += quantity;
      break;

    case 'LSHAPE':
      addMemberToBom(bom, config.legs, quantity);
      addMemberToBom(bom, config.beam, quantity);
      bom.couplers += quantity;
      bom.basePlates += quantity;
      break;

    case 'TSHAPE':
      addMemberToBom(bom, config.legs, quantity);
      addMemberToBom(bom, config.beam, quantity);
      addMemberToBom(bom, config.beamRight, quantity);
      bom.couplers += 2 * quantity;
      bom.basePlates += quantity;
      break;

    case 'MULTI_BAY':
      addMemberToBom(bom, config.legs, (bayCount + 1) * quantity);
      addMemberToBom(bom, config.beam, quantity);
      bom.couplers += (bayCount + 1) * quantity;
      bom.basePlates += (bayCount + 1) * quantity;
      break;

    case 'BOX':
      addMemberToBom(bom, config.legs, quantity);
      addMemberToBom(bom, getEffectiveRightLeg(config), quantity);
      addMemberToBom(bom, config.beam, quantity);
      addMemberToBom(bom, config.bottomBeam, quantity);
      bom.couplers += 4 * quantity;
      bom.basePlates += 2 * quantity;
      break;

    case 'BACKDROP':
      addMemberToBom(bom, config.legs, quantity);
      addMemberToBom(bom, getEffectiveRightLeg(config), quantity);
      addMemberToBom(bom, config.beam, quantity);
      addMemberToBom(bom, config.depthMember, 2 * quantity);
      bom.couplers += 2 * quantity; // column-to-beam joints
      bom.couplers += 2 * quantity; // depth side brace joints retained for old backdrop configs
      bom.basePlates += 2 * quantity;
      break;

    case 'GOALPOST':
    default:
      addMemberToBom(bom, config.legs, quantity);
      addMemberToBom(bom, getEffectiveRightLeg(config), quantity);
      addMemberToBom(bom, config.beam, quantity);
      bom.couplers += 2 * quantity;
      bom.basePlates += 2 * quantity;
      break;
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
  legsRight: cloneMember(config.legsRight),
  beam: cloneMember(config.beam),
  beamRight: cloneMember(config.beamRight),
  bottomBeam: cloneMember(config.bottomBeam),
  depthMember: cloneMember(config.depthMember),
});
