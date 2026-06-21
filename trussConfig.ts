import {
  BanquetObject,
  ObjectType,
  TrussCustomMember,
  TrussMember,
  TrussMemberOrientation,
  TrussSegmentLength,
  TrussStructureConfig,
  TrussStructureKind,
} from './types';

export const TRUSS_SEGMENT_LENGTHS: TrussSegmentLength[] = [200, 150, 100, 50, 20, 10];
export const COUPLER_LENGTH_CM = 25;

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

export interface TrussCustomPoint {
  xCm: number;
  yCm: number;
  zCm: number;
}

export interface TrussCustomBounds extends TrussDimensions {
  minXCm: number;
  maxXCm: number;
  minYCm: number;
  maxYCm: number;
  minZCm: number;
  maxZCm: number;
  depthCm: number;
  hasDepth: boolean;
}

export interface TrussCustomJoint extends TrussCustomPoint {
  id: string;
  type: 'INTERNAL' | 'INTER_MEMBER';
  memberIds: string[];
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
const CUSTOM_JOINT_TOLERANCE_CM = 2;

const cloneMember = (member?: TrussMember): TrussMember | undefined => (
  member ? { segments: [...member.segments] } : undefined
);

export const getEffectiveRightLeg = (config: TrussStructureConfig): TrussMember => (
  config.legsRight || config.legs || { segments: [] }
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
  const segments = sanitizeMember(member).segments;
  const segmentSum = segments.reduce((sum, segment) => sum + segment, 0);
  const couplerCount = Math.max(0, segments.length - 1);
  return segmentSum + couplerCount * COUPLER_LENGTH_CM;
};

export const fitSegments = (totalCm: number): TrussSegmentLength[] => {
  const target = Math.max(10, Math.floor((Number.isFinite(totalCm) ? totalCm : 10) / 10) * 10);

  const fillExact = (remaining: number, count: number): TrussSegmentLength[] | null => {
    if (count === 1) {
      return TRUSS_SEGMENT_LENGTHS.includes(remaining as TrussSegmentLength)
        ? [remaining as TrussSegmentLength]
        : null;
    }
    for (const len of TRUSS_SEGMENT_LENGTHS) {
      if (remaining >= len) {
        const rest = fillExact(remaining - len, count - 1);
        if (rest) return [len, ...rest];
      }
    }
    return null;
  };

  for (let n = 1; n <= 20; n++) {
    const segTarget = target - (n - 1) * COUPLER_LENGTH_CM;
    if (segTarget <= 0) break;
    const segs = fillExact(segTarget, n);
    if (segs) return segs;
  }

  return [10];
};

const getMemberSegmentsOrFallback = (
  member: TrussMember | undefined,
  fallback: TrussSegmentLength[] = [10],
): TrussSegmentLength[] => {
  const segments = sanitizeMember(member).segments;
  return segments.length > 0 ? segments : [...fallback];
};

const addPoints = (a: TrussCustomPoint, b: TrussCustomPoint): TrussCustomPoint => ({
  xCm: a.xCm + b.xCm,
  yCm: a.yCm + b.yCm,
  zCm: a.zCm + b.zCm,
});

const scalePoint = (point: TrussCustomPoint, scale: number): TrussCustomPoint => ({
  xCm: point.xCm * scale,
  yCm: point.yCm * scale,
  zCm: point.zCm * scale,
});

const pointDistance = (a: TrussCustomPoint, b: TrussCustomPoint): number => (
  Math.hypot(a.xCm - b.xCm, a.yCm - b.yCm, a.zCm - b.zCm)
);

const pointDot = (a: TrussCustomPoint, b: TrussCustomPoint): number => (
  a.xCm * b.xCm + a.yCm * b.yCm + a.zCm * b.zCm
);

const closestPointOnSegment = (
  point: TrussCustomPoint,
  start: TrussCustomPoint,
  end: TrussCustomPoint,
): TrussCustomPoint => {
  const segment = {
    xCm: end.xCm - start.xCm,
    yCm: end.yCm - start.yCm,
    zCm: end.zCm - start.zCm,
  };
  const lengthSquared = pointDot(segment, segment);
  if (lengthSquared <= 0) return start;

  const pointOffset = {
    xCm: point.xCm - start.xCm,
    yCm: point.yCm - start.yCm,
    zCm: point.zCm - start.zCm,
  };
  const t = Math.min(1, Math.max(0, pointDot(pointOffset, segment) / lengthSquared));

  return addPoints(start, scalePoint(segment, t));
};

export const getCustomMemberLength = (member?: TrussCustomMember): number => (
  getMemberLength(member)
);

export const getCustomMemberStart = (member: TrussCustomMember): TrussCustomPoint => ({
  xCm: Number.isFinite(member.origin?.xCm) ? member.origin.xCm : 0,
  yCm: Number.isFinite(member.origin?.yCm) ? member.origin.yCm : 0,
  zCm: Number.isFinite(member.origin?.zCm) ? member.origin.zCm || 0 : 0,
});

export const getCustomMemberAxis = (member: Pick<TrussCustomMember, 'orientation' | 'direction'>): TrussCustomPoint => {
  switch (member.orientation) {
    case 'HORIZONTAL':
      return { xCm: member.direction === -1 ? -1 : 1, yCm: 0, zCm: 0 };
    case 'DEPTH':
      return { xCm: 0, yCm: 0, zCm: 1 };
    case 'VERTICAL':
    default:
      return { xCm: 0, yCm: 1, zCm: 0 };
  }
};

export const getCustomMemberEndpoint = (member: TrussCustomMember): TrussCustomPoint => (
  addPoints(getCustomMemberStart(member), scalePoint(getCustomMemberAxis(member), getCustomMemberLength(member)))
);

export const customMemberHasBasePlate = (member: TrussCustomMember): boolean => (
  member.orientation === 'VERTICAL' && (member.basePlate ?? member.origin?.yCm === 0)
);

export const getCustomBounds = (members: TrussCustomMember[] = []): TrussCustomBounds => {
  const points = members.flatMap(member => [getCustomMemberStart(member), getCustomMemberEndpoint(member)]);

  if (points.length === 0) {
    return {
      minXCm: 0,
      maxXCm: 0,
      minYCm: 0,
      maxYCm: 0,
      minZCm: 0,
      maxZCm: 0,
      widthCm: 0,
      heightCm: 0,
      depthCm: 0,
      hasDepth: false,
    };
  }

  const minXCm = Math.min(...points.map(point => point.xCm));
  const maxXCm = Math.max(...points.map(point => point.xCm));
  const minYCm = Math.min(...points.map(point => point.yCm));
  const maxYCm = Math.max(...points.map(point => point.yCm));
  const minZCm = Math.min(...points.map(point => point.zCm));
  const maxZCm = Math.max(...points.map(point => point.zCm));
  const hasDepth = members.some(member => member.orientation === 'DEPTH');

  return {
    minXCm,
    maxXCm,
    minYCm,
    maxYCm,
    minZCm,
    maxZCm,
    widthCm: Math.round(maxXCm - minXCm),
    heightCm: Math.round(maxYCm - minYCm),
    depthCm: Math.round(maxZCm - minZCm),
    hasDepth,
  };
};

export const detectCustomJoints = (members: TrussCustomMember[] = []): TrussCustomJoint[] => {
  const normalizedMembers = members
    .map(member => ({
      ...member,
      segments: sanitizeMember(member).segments,
    }))
    .filter(member => member.segments.length > 0);
  const internalJoints: TrussCustomJoint[] = [];
  const interMemberJoints: TrussCustomJoint[] = [];

  normalizedMembers.forEach(member => {
    const start = getCustomMemberStart(member);
    const axis = getCustomMemberAxis(member);
    let offset = 0;

    member.segments.forEach((segment, index) => {
      offset += segment;
      if (index >= member.segments.length - 1) return;

      const point = addPoints(start, scalePoint(axis, offset));
      internalJoints.push({
        id: `internal-${member.id}-${index}`,
        type: 'INTERNAL',
        memberIds: [member.id],
        ...point,
      });
    });
  });

  const addInterMemberJoint = (point: TrussCustomPoint, memberIds: string[]) => {
    const existing = interMemberJoints.find(joint => pointDistance(joint, point) <= CUSTOM_JOINT_TOLERANCE_CM);
    if (existing) {
      existing.memberIds = Array.from(new Set([...existing.memberIds, ...memberIds]));
      return;
    }

    interMemberJoints.push({
      id: `inter-${interMemberJoints.length}`,
      type: 'INTER_MEMBER',
      memberIds: Array.from(new Set(memberIds)),
      ...point,
    });
  };

  normalizedMembers.forEach((member, memberIndex) => {
    const endpoints = [getCustomMemberStart(member), getCustomMemberEndpoint(member)];

    endpoints.forEach(endpoint => {
      normalizedMembers.forEach((otherMember, otherIndex) => {
        if (memberIndex === otherIndex) return;

        const otherStart = getCustomMemberStart(otherMember);
        const otherEnd = getCustomMemberEndpoint(otherMember);
        const closest = closestPointOnSegment(endpoint, otherStart, otherEnd);

        if (pointDistance(endpoint, closest) <= CUSTOM_JOINT_TOLERANCE_CM) {
          addInterMemberJoint(endpoint, [member.id, otherMember.id]);
        }
      });
    });
  });

  return [...internalJoints, ...interMemberJoints];
};

export const createDefaultTrussConfig = (
  kind: TrussStructureConfig['kind'] = 'GOALPOST',
  title = 'Truss 結構',
  widthCm = 550,
  heightCm = 375,
  depthCm = 125,
  quantity = 1,
): TrussStructureConfig => {
  if (kind === 'CUSTOM') {
    return {
      kind,
      members: [{
        id: 'custom-1',
        label: '立柱',
        orientation: 'VERTICAL',
        segments: fitSegments(heightCm),
        origin: { xCm: 0, yCm: 0 },
        basePlate: true,
      }],
      quantity: clampQuantity(quantity),
      title,
    };
  }

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
  if (config.kind === 'CUSTOM') {
    const bounds = getCustomBounds(config.members || []);
    return {
      widthCm: bounds.widthCm,
      heightCm: bounds.heightCm,
      depthCm: bounds.hasDepth ? bounds.depthCm : undefined,
    };
  }

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
    case 'CUSTOM':
      return `自訂TRUSS${quantityText}`;
    case 'TOWER':
    default:
      return `TRUSS${quantityText}`;
  }
};

export const formatTrussTitle = (config: TrussStructureConfig, quantityOverride?: number): string => {
  const dims = getTrussDimensions(config);
  const quantity = clampQuantity(quantityOverride ?? config.quantity);
  const baseTitle = config.title.trim() || 'Truss 結構';
  const hasDepth = config.kind === 'CUSTOM'
    ? dims.depthCm !== undefined
    : config.kind === 'BACKDROP';
  const dimensionText = config.kind === 'TOWER'
    ? `外徑H${dims.heightCm}`
    : `外徑W${dims.widthCm}×H${dims.heightCm}${hasDepth ? `×D${dims.depthCm || 0}` : ''}`;
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
    case 'CUSTOM': {
      const members = config.members || [];
      members.forEach(member => {
        sanitizeMember(member).segments.forEach(segment => {
          bom.segments[segment] += quantity;
        });
        if (customMemberHasBasePlate(member)) {
          bom.basePlates += quantity;
        }
      });
      bom.couplers += detectCustomJoints(members).length * quantity;
      break;
    }

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

export const convertPresetToMembers = (config: TrussStructureConfig): TrussCustomMember[] => {
  if (config.kind === 'CUSTOM') {
    return (config.members || []).map(member => ({
      ...member,
      origin: { ...member.origin },
      segments: [...member.segments],
    }));
  }

  const dims = getTrussDimensions(config);
  const beamLength = getMemberLength(config.beam);
  const rightLeg = getEffectiveRightLeg(config);
  const baseLegSegments = getMemberSegmentsOrFallback(config.legs, fitSegments(dims.heightCm || 10));
  const rightLegSegments = getMemberSegmentsOrFallback(rightLeg, baseLegSegments);
  const beamSegments = getMemberSegmentsOrFallback(config.beam, fitSegments(Math.max(10, dims.widthCm || 10)));
  const members: TrussCustomMember[] = [];
  const addMember = (
    id: string,
    label: string,
    orientation: TrussMemberOrientation,
    segments: TrussSegmentLength[],
    origin: { xCm: number; yCm: number; zCm?: number },
    direction?: 1 | -1,
    basePlate?: boolean,
  ) => {
    members.push({
      id,
      label,
      orientation,
      segments: [...segments],
      origin: { ...origin },
      direction,
      basePlate,
    });
  };

  switch (config.kind) {
    case 'TOWER':
      addMember('preset-tower-leg', '立柱', 'VERTICAL', baseLegSegments, { xCm: 0, yCm: 0 }, undefined, true);
      break;

    case 'LSHAPE': {
      const attachY = getEffectiveBeamAttachCm(config);
      addMember('preset-l-leg', '立柱', 'VERTICAL', baseLegSegments, { xCm: 0, yCm: 0 }, undefined, true);
      addMember('preset-l-beam', '懸挑梁', 'HORIZONTAL', beamSegments, { xCm: 0, yCm: attachY }, 1);
      break;
    }

    case 'TSHAPE': {
      const leftLength = getMemberLength(config.beam);
      const attachY = getEffectiveBeamAttachCm(config);
      addMember('preset-t-leg', '立柱', 'VERTICAL', baseLegSegments, { xCm: leftLength, yCm: 0 }, undefined, true);
      addMember('preset-t-left-beam', '左懸挑梁', 'HORIZONTAL', beamSegments, { xCm: leftLength, yCm: attachY }, -1);
      addMember(
        'preset-t-right-beam',
        '右懸挑梁',
        'HORIZONTAL',
        getMemberSegmentsOrFallback(config.beamRight, beamSegments),
        { xCm: leftLength, yCm: attachY },
        1,
      );
      break;
    }

    case 'MULTI_BAY': {
      const bayCount = getEffectiveBayCount(config);
      addMember('preset-multi-beam', '連續頂梁', 'HORIZONTAL', beamSegments, { xCm: 0, yCm: dims.heightCm }, 1);
      Array.from({ length: bayCount + 1 }).forEach((_, index) => {
        addMember(
          `preset-multi-leg-${index}`,
          `第${index + 1}柱`,
          'VERTICAL',
          baseLegSegments,
          { xCm: bayCount === 0 ? 0 : (beamLength * index) / bayCount, yCm: 0 },
          undefined,
          true,
        );
      });
      break;
    }

    case 'BOX':
      addMember('preset-box-left-leg', '左柱', 'VERTICAL', baseLegSegments, { xCm: 0, yCm: 0 }, undefined, true);
      addMember('preset-box-right-leg', '右柱', 'VERTICAL', rightLegSegments, { xCm: beamLength, yCm: 0 }, undefined, true);
      addMember('preset-box-top-beam', '頂梁', 'HORIZONTAL', beamSegments, { xCm: 0, yCm: dims.heightCm }, 1);
      addMember(
        'preset-box-bottom-beam',
        '底梁',
        'HORIZONTAL',
        getMemberSegmentsOrFallback(config.bottomBeam, beamSegments),
        { xCm: 0, yCm: 0 },
        1,
      );
      break;

    case 'BACKDROP':
      addMember('preset-backdrop-left-leg', '左柱', 'VERTICAL', baseLegSegments, { xCm: 0, yCm: 0 }, undefined, true);
      addMember('preset-backdrop-right-leg', '右柱', 'VERTICAL', rightLegSegments, { xCm: beamLength, yCm: 0 }, undefined, true);
      addMember('preset-backdrop-top-beam', '頂梁', 'HORIZONTAL', beamSegments, { xCm: 0, yCm: dims.heightCm }, 1);
      addMember(
        'preset-backdrop-left-depth',
        '左深度撐',
        'DEPTH',
        getMemberSegmentsOrFallback(config.depthMember, fitSegments(dims.depthCm || 10)),
        { xCm: 0, yCm: dims.heightCm, zCm: 0 },
      );
      addMember(
        'preset-backdrop-right-depth',
        '右深度撐',
        'DEPTH',
        getMemberSegmentsOrFallback(config.depthMember, fitSegments(dims.depthCm || 10)),
        { xCm: beamLength, yCm: dims.heightCm, zCm: 0 },
      );
      break;

    case 'GOALPOST':
    default:
      addMember('preset-goalpost-left-leg', '左柱', 'VERTICAL', baseLegSegments, { xCm: 0, yCm: 0 }, undefined, true);
      addMember('preset-goalpost-right-leg', '右柱', 'VERTICAL', rightLegSegments, { xCm: beamLength, yCm: 0 }, undefined, true);
      addMember('preset-goalpost-top-beam', '頂梁', 'HORIZONTAL', beamSegments, { xCm: 0, yCm: dims.heightCm }, 1);
      break;
  }

  return members;
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
  legs: cloneMember(config.legs),
  legsRight: cloneMember(config.legsRight),
  beam: cloneMember(config.beam),
  beamRight: cloneMember(config.beamRight),
  bottomBeam: cloneMember(config.bottomBeam),
  depthMember: cloneMember(config.depthMember),
  members: config.members?.map(member => ({
    ...member,
    origin: { ...member.origin },
    segments: [...member.segments],
  })),
});
