import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Plus, Trash2, X } from 'lucide-react';
import {
  TrussCustomMember,
  TrussMember,
  TrussMemberOrientation,
  TrussSegmentLength,
  TrussStructureConfig,
  TrussStructureKind,
} from '../types';
import {
  calculateTrussBom,
  cloneTrussConfig,
  convertPresetToMembers,
  createDefaultTrussConfig,
  fitSegments,
  fitSegmentsForBays,
  formatTrussTitle,
  getCustomMemberEndpoint,
  getMemberLength,
  getTrussCouplerAllowances,
  getTrussDimensions,
  splitMemberIntoBays,
  COUPLER_LENGTH_CM,
  TRUSS_SEGMENT_COLORS,
  TRUSS_SEGMENT_LENGTHS,
} from '../trussConfig';
import { TrussDiagram } from './TrussDiagram';

interface TrussBuilderModalProps {
  initialConfig?: TrussStructureConfig;
  onClose: () => void;
  onSubmit: (config: TrussStructureConfig) => void | Promise<void>;
  submitLabel?: string;
  lockQuantity?: boolean;
}

const KIND_OPTIONS: Array<{ kind: TrussStructureKind; title: string; description: string }> = [
  { kind: 'TOWER', title: '立柱', description: '單支直立 truss' },
  { kind: 'GOALPOST', title: 'ㄇ型', description: '雙柱加頂梁' },
  { kind: 'BACKDROP', title: '背景框型', description: 'ㄇ型加深度側撐' },
  { kind: 'BOX', title: '口字框', description: '雙柱加上下梁' },
  { kind: 'LSHAPE', title: 'L 型', description: '單柱加單邊懸挑' },
  { kind: 'TSHAPE', title: 'T 型', description: '單柱加左右懸挑' },
  { kind: 'MULTI_BAY', title: '連排門型', description: '多跨連續頂梁' },
  { kind: 'CUSTOM', title: '自訂', description: '自由軸向桿件組合' },
];

const ORIENTATION_OPTIONS: Array<{ value: TrussMemberOrientation; label: string }> = [
  { value: 'VERTICAL', label: '垂直' },
  { value: 'HORIZONTAL', label: '水平' },
  { value: 'DEPTH', label: '深度' },
];

const supportsRightLeg = (kind: TrussStructureKind) => (
  kind === 'GOALPOST' || kind === 'BACKDROP' || kind === 'BOX'
);

const clampInt = (value: number, fallback: number, min = 1, max = Infinity) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
};

const KindSketch = ({ kind }: { kind: TrussStructureKind }) => (
  <svg viewBox="0 0 96 60" className="w-full h-14" aria-hidden="true">
    <rect width="96" height="60" fill="transparent" />
    {kind === 'TOWER' && (
      <>
        <rect x="42" y="10" width="12" height="42" fill="#d8dde6" stroke="#111" />
        <rect x="30" y="52" width="36" height="5" fill="#111" />
      </>
    )}
    {kind === 'GOALPOST' && (
      <>
        <rect x="18" y="16" width="10" height="36" fill="#d8dde6" stroke="#111" />
        <rect x="68" y="16" width="10" height="36" fill="#d8dde6" stroke="#111" />
        <rect x="18" y="10" width="60" height="10" fill="#d8dde6" stroke="#111" />
        <rect x="10" y="52" width="28" height="5" fill="#111" />
        <rect x="58" y="52" width="28" height="5" fill="#111" />
      </>
    )}
    {kind === 'BACKDROP' && (
      <>
        <rect x="16" y="18" width="10" height="34" fill="#d8dde6" stroke="#111" />
        <rect x="58" y="18" width="10" height="34" fill="#d8dde6" stroke="#111" />
        <rect x="16" y="12" width="52" height="10" fill="#d8dde6" stroke="#111" />
        <path d="M68 12 L86 4 L86 14 L68 22 Z" fill="#d8dde6" stroke="#111" />
        <path d="M68 22 L86 14" stroke="#111" strokeWidth="2" />
        <rect x="8" y="52" width="28" height="5" fill="#111" />
        <rect x="50" y="52" width="28" height="5" fill="#111" />
      </>
    )}
    {kind === 'BOX' && (
      <>
        <rect x="18" y="14" width="10" height="38" fill="#d8dde6" stroke="#111" />
        <rect x="68" y="14" width="10" height="38" fill="#d8dde6" stroke="#111" />
        <rect x="18" y="8" width="60" height="10" fill="#d8dde6" stroke="#111" />
        <rect x="18" y="42" width="60" height="10" fill="#d8dde6" stroke="#111" />
        <rect x="10" y="52" width="28" height="5" fill="#111" />
        <rect x="58" y="52" width="28" height="5" fill="#111" />
      </>
    )}
    {kind === 'LSHAPE' && (
      <>
        <rect x="22" y="12" width="10" height="40" fill="#d8dde6" stroke="#111" />
        <rect x="28" y="12" width="54" height="10" fill="#d8dde6" stroke="#111" />
        <rect x="10" y="52" width="34" height="5" fill="#111" />
      </>
    )}
    {kind === 'TSHAPE' && (
      <>
        <rect x="43" y="12" width="10" height="40" fill="#d8dde6" stroke="#111" />
        <rect x="14" y="12" width="68" height="10" fill="#d8dde6" stroke="#111" />
        <rect x="31" y="52" width="34" height="5" fill="#111" />
      </>
    )}
    {kind === 'MULTI_BAY' && (
      <>
        {[14, 36, 58, 80].map(x => (
          <rect key={x} x={x} y="17" width="8" height="35" fill="#d8dde6" stroke="#111" />
        ))}
        <rect x="14" y="10" width="74" height="10" fill="#d8dde6" stroke="#111" />
        {[10, 32, 54, 76].map(x => (
          <rect key={x} x={x} y="52" width="16" height="5" fill="#111" />
        ))}
      </>
    )}
    {kind === 'CUSTOM' && (
      <>
        <rect x="18" y="18" width="8" height="34" fill="#d8dde6" stroke="#111" />
        <rect x="26" y="18" width="44" height="8" fill="#d8dde6" stroke="#111" />
        <rect x="56" y="28" width="8" height="24" fill="#d8dde6" stroke="#111" />
        <rect x="56" y="28" width="24" height="8" fill="#d8dde6" stroke="#111" />
        <rect x="10" y="52" width="24" height="5" fill="#111" />
        <rect x="48" y="52" width="24" height="5" fill="#111" />
      </>
    )}
  </svg>
);

const SegmentChip = ({
  length,
  onChange,
  onRemove,
}: {
  length: TrussSegmentLength;
  onChange: (next: TrussSegmentLength) => void;
  onRemove: () => void;
}) => (
  <div className="group flex items-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
    <span
      className="h-7 w-9 border-r border-slate-200"
      style={{ backgroundColor: TRUSS_SEGMENT_COLORS[length] }}
    />
    <select
      value={length}
      onChange={(e) => onChange(Number(e.target.value) as TrussSegmentLength)}
      className="h-7 bg-white px-1 text-[11px] font-bold text-slate-700 outline-none"
    >
      {TRUSS_SEGMENT_LENGTHS.map(option => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
    <button
      type="button"
      onClick={onRemove}
      className="h-7 w-6 flex items-center justify-center text-slate-300 hover:bg-red-50 hover:text-red-500"
      title="移除此段"
    >
      <X className="w-3 h-3" />
    </button>
  </div>
);

const MemberEditor = ({
  label,
  member,
  onChange,
}: {
  label: string;
  member?: TrussMember;
  onChange: (member: TrussMember) => void;
}) => {
  const segments = member?.segments ?? [];

  const updateSegment = (index: number, next: TrussSegmentLength) => {
    onChange({ segments: segments.map((segment, i) => (i === index ? next : segment)) });
  };

  const removeSegment = (index: number) => {
    const next = segments.filter((_, i) => i !== index);
    onChange({ segments: next.length ? next : [10] });
  };

  const addSegment = (length: TrussSegmentLength) => {
    onChange({ segments: [...segments, length] });
  };

  const total = segments.reduce((sum, segment) => sum + segment, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700">{label}</span>
        <span className="text-[11px] font-semibold text-slate-500">實際 {total}cm</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {segments.map((segment, index) => (
          <SegmentChip
            key={index}
            length={segment}
            onChange={(next) => updateSegment(index, next)}
            onRemove={() => removeSegment(index)}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {TRUSS_SEGMENT_LENGTHS.map(length => (
          <button
            key={length}
            type="button"
            onClick={() => addSegment(length)}
            className="h-6 px-2 rounded border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:border-blue-300 hover:text-blue-600 flex items-center gap-1"
          >
            <Plus className="w-2.5 h-2.5" />
            {length}
          </button>
        ))}
      </div>
    </div>
  );
};

const NumberField = ({
  label,
  value,
  onChange,
  min = 10,
  step = 10,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  step?: number;
}) => {
  const inputId = React.useId();
  const [draft, setDraft] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(value));
    }
  }, [value, isFocused]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '' || !Number.isFinite(Number(trimmed))) {
      setDraft(String(value));
      return;
    }
    const num = Number(trimmed);
    onChange(num);
  };

  const handleBlur = () => {
    setIsFocused(false);
    commit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
      <input
        id={inputId}
        type="number"
        min={min}
        step={step}
        value={isFocused ? draft : value}
        onFocus={() => {
          setIsFocused(true);
          setDraft(String(value));
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
    </div>
  );
};

const getCustomMemberLabel = (member: TrussCustomMember, index: number) => (
  member.label?.trim() || `桿件 ${index + 1}`
);

const createCustomMember = (
  origin: { xCm: number; yCm: number; zCm?: number },
  orientation: TrussMemberOrientation = 'VERTICAL',
  direction: 1 | -1 = 1,
  label = '新桿件',
): TrussCustomMember => ({
  id: `custom-${crypto.randomUUID()}`,
  label,
  orientation,
  segments: fitSegments(100),
  origin: {
    xCm: origin.xCm,
    yCm: origin.yCm,
    zCm: origin.zCm ?? 0,
  },
  direction: orientation === 'HORIZONTAL' ? direction : undefined,
  basePlate: orientation === 'VERTICAL' && origin.yCm === 0 ? true : undefined,
});

export const TrussBuilderModal: React.FC<TrussBuilderModalProps> = ({
  initialConfig,
  onClose,
  onSubmit,
  submitLabel,
  lockQuantity = false,
}) => {
  const initial = useMemo(() => cloneTrussConfig(initialConfig || createDefaultTrussConfig()), [initialConfig]);
  const initialDims = useMemo(() => getTrussDimensions(initial), [initial]);
  const initialAllowances = getTrussCouplerAllowances(initial);

  const initialBeamLength = getMemberLength(initial.beam) || Math.max(10, (initialDims.widthCm || 550) - initialAllowances.widthCm);
  const initialBeamRightLength = getMemberLength(initial.beamRight) || initialBeamLength;
  const initialLegHeight = getMemberLength(initial.legs) || Math.max(10, (initialDims.heightCm || 375) - initialAllowances.heightCm);

  const [kind, setKind] = useState<TrussStructureKind>(initial.kind);
  const [title, setTitle] = useState(initial.title || 'Truss 結構');
  const [quantity, setQuantity] = useState(lockQuantity ? 1 : (initial.quantity || 1));
  const [targetWidth, setTargetWidth] = useState(initial.kind === 'TOWER' ? 350 : (initialDims.widthCm || 550));
  const [targetHeight, setTargetHeight] = useState(initialDims.heightCm || (initialLegHeight + initialAllowances.heightCm));
  const [targetDepth, setTargetDepth] = useState(initialDims.depthCm || 125);
  const [targetBeamLeft, setTargetBeamLeft] = useState(initialBeamLength);
  const [targetBeamRight, setTargetBeamRight] = useState(initialBeamRightLength);

  // BOX bottom beam: targetBottomWidth is outer target width
  const initialBottomWidth = initial.bottomBeam
    ? getMemberLength(initial.bottomBeam) + 2 * COUPLER_LENGTH_CM
    : (initialDims.widthCm || 550);
  const [targetBottomWidth, setTargetBottomWidth] = useState(initialBottomWidth);

  const [beamAttachCm, setBeamAttachCm] = useState(initial.beamAttachCm ?? initialLegHeight);
  const [bayCount, setBayCount] = useState(clampInt(initial.bayCount || 2, 2, 2, 6));
  const [useRightLeg, setUseRightLeg] = useState(Boolean(initial.legsRight));

  // Conservatively initialize preset members to avoid crash on malformed configs
  const [legs, setLegs] = useState<TrussMember>(() => (
    initial.legs?.segments?.length ? initial.legs : { segments: fitSegments(initialLegHeight) }
  ));
  const [legsRight, setLegsRight] = useState<TrussMember>(() => (
    initial.legsRight?.segments?.length
      ? initial.legsRight
      : (initial.legs?.segments?.length ? initial.legs : { segments: fitSegments(initialLegHeight) })
  ));
  const [beam, setBeam] = useState<TrussMember>(() => {
    if (initial.beam?.segments?.length) return initial.beam;
    const count = clampInt(initial.bayCount || 2, 2, 2, 6);
    return {
      segments: initial.kind === 'MULTI_BAY'
        ? fitSegmentsForBays(initialBeamLength, count)
        : fitSegments(initialBeamLength),
    };
  });
  const [beamRight, setBeamRight] = useState<TrussMember>(() => (
    initial.beamRight?.segments?.length ? initial.beamRight : { segments: fitSegments(initialBeamRightLength) }
  ));
  const [bottomBeam, setBottomBeam] = useState<TrussMember>(() => (
    initial.bottomBeam?.segments?.length
      ? initial.bottomBeam
      : { segments: fitSegments(Math.max(10, initialBottomWidth - 2 * COUPLER_LENGTH_CM)) }
  ));
  const [depthMember, setDepthMember] = useState<TrussMember>(() => (
    initial.depthMember?.segments?.length ? initial.depthMember : { segments: fitSegments(initialDims.depthCm || 125) }
  ));

  const [customMembers, setCustomMembers] = useState<TrussCustomMember[]>(() => (
    initial.kind === 'CUSTOM'
      ? initial.members?.length ? initial.members : (createDefaultTrussConfig('CUSTOM').members || [])
      : []
  ));
  const [customAddMode, setCustomAddMode] = useState('FREE');
  const anchorId = customAddMode === 'FREE' ? null : customAddMode.slice(customAddMode.indexOf(':') + 1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    titleInputRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!isSubmitting) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, isSubmitting]);

  const effectiveQuantity = lockQuantity ? 1 : clampInt(quantity, 1, 1);
  const clampedBayCount = clampInt(bayCount, 2, 2, 6);
  const currentLegLength = getMemberLength(legs);
  const clampedBeamAttachCm = clampInt(beamAttachCm, currentLegLength, 0, currentLegLength);
  const hasRightLeg = supportsRightLeg(kind) && useRightLeg;

  const workingConfig: TrussStructureConfig = kind === 'CUSTOM'
    ? {
      kind,
      title,
      quantity: effectiveQuantity,
      members: customMembers,
      groupId: initial.groupId,
    }
    : {
      kind,
      title,
      quantity: effectiveQuantity,
      legs,
      legsRight: hasRightLeg ? legsRight : undefined,
      beam: kind === 'TOWER' ? undefined : beam,
      beamRight: kind === 'TSHAPE' ? beamRight : undefined,
      bottomBeam: kind === 'BOX' ? bottomBeam : undefined,
      depthMember: kind === 'BACKDROP' ? depthMember : undefined,
      bayCount: kind === 'MULTI_BAY' ? clampedBayCount : undefined,
      beamAttachCm: kind === 'LSHAPE' || kind === 'TSHAPE' ? clampedBeamAttachCm : undefined,
      groupId: initial.groupId,
    };

  const actualDims = getTrussDimensions(workingConfig);
  const isEditing = Boolean(initialConfig);

  // Structural validation rules:
  // 1. Left and right legs must have equal total length for horizontal frame closing
  // 2. BOX top and bottom beams must have equal length for rectangular frame
  // 3. MULTI_BAY must have >= 1 segment per bay
  // 4. CUSTOM must have >= 1 member
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (kind === 'CUSTOM') {
      if (customMembers.length === 0) {
        errors.push('自訂結構至少需有 1 支桿件。');
      }
      if (customMembers.some(member => [member.origin.xCm, member.origin.yCm, member.origin.zCm ?? 0]
        .some(value => !Number.isFinite(value) || value < 0))) {
        errors.push('桿件起點座標必須為非負數；向左接續若超出原點，請先調整桿件起點。');
      }
      return errors;
    }

    if (supportsRightLeg(kind) && useRightLeg) {
      const leftLength = getMemberLength(legs);
      const rightLength = getMemberLength(legsRight);
      if (leftLength !== rightLength) {
        errors.push(`左右柱總長度不一致（左柱 ${leftLength}cm、右柱 ${rightLength}cm），頂梁無法水平閉合。兩柱總長度必須相同。`);
      }
    }

    if (kind === 'BOX') {
      const topLength = getMemberLength(beam);
      const bottomLength = getMemberLength(bottomBeam);
      if (topLength !== bottomLength) {
        errors.push(`口字框上下梁長度不一致（頂梁 ${topLength}cm、底梁 ${bottomLength}cm），無法組成長方形框架。上下梁長度必須相同。`);
      }
    }

    if (kind === 'MULTI_BAY') {
      const bays = splitMemberIntoBays(beam, clampedBayCount);
      const hasEmptyBay = bays.some(b => b.segments.length === 0);
      if (hasEmptyBay) {
        errors.push(`連排門型每跨至少需有 1 段桿件（目前 ${clampedBayCount} 跨中存在缺乏桿件的跨數，頂梁共 ${beam?.segments?.length ?? 0} 段）。請增加頂梁配段。`);
      }
    }

    return errors;
  }, [kind, customMembers, legs, legsRight, useRightLeg, beam, bottomBeam, clampedBayCount]);

  const canSubmit = validationErrors.length === 0;

  const fitLegHeight = (nextKind: TrussStructureKind, outerHeight: number) => {
    const cantilever = nextKind === 'LSHAPE' || nextKind === 'TSHAPE';
    const attachedAtTop = (kind !== 'LSHAPE' && kind !== 'TSHAPE') || clampedBeamAttachCm === currentLegLength;
    const allowance = cantilever && !attachedAtTop
      ? 0
      : getTrussCouplerAllowances({ kind: nextKind, bayCount: clampedBayCount }).heightCm;
    const fittedLegs = { segments: fitSegments(Math.max(10, outerHeight - allowance)) };
    setLegs(fittedLegs);
    if (supportsRightLeg(nextKind) && useRightLeg) {
      setLegsRight({ segments: [...fittedLegs.segments] });
    }
    if (cantilever) {
      const height = getMemberLength(fittedLegs);
      setBeamAttachCm(attachedAtTop ? height : Math.min(clampedBeamAttachCm, Math.max(0, height - COUPLER_LENGTH_CM)));
    }
  };

  const autoFit = (nextKind = kind) => {
    if (nextKind === 'CUSTOM') return;

    const allowances = getTrussCouplerAllowances({ kind: nextKind, bayCount: clampedBayCount });
    fitLegHeight(nextKind, targetHeight);

    if (nextKind === 'TOWER') return;

    if (nextKind === 'LSHAPE') {
      setBeam({ segments: fitSegments(targetBeamLeft) });
      return;
    }

    if (nextKind === 'TSHAPE') {
      setBeam({ segments: fitSegments(targetBeamLeft) });
      setBeamRight({ segments: fitSegments(targetBeamRight) });
      return;
    }

    const targetMainBeam = Math.max(10, targetWidth - allowances.widthCm);
    if (nextKind === 'MULTI_BAY') {
      setBeam({ segments: fitSegmentsForBays(targetMainBeam, clampedBayCount) });
    } else {
      setBeam({ segments: fitSegments(targetMainBeam) });
    }

    if (nextKind === 'BOX') {
      const bottomWidth = nextKind === kind ? targetBottomWidth : targetWidth;
      setTargetBottomWidth(bottomWidth);
      setBottomBeam({ segments: fitSegments(Math.max(10, bottomWidth - allowances.widthCm)) });
    }

    if (nextKind === 'BACKDROP') {
      setDepthMember({ segments: fitSegments(targetDepth) });
    }
  };

  const handleKindChange = (nextKind: TrussStructureKind) => {
    if (nextKind === 'CUSTOM') {
      if (customMembers.length === 0) {
        handleConvertToCustom();
        return;
      }
      setKind(nextKind);
      return;
    }

    setKind(nextKind);
    if (!supportsRightLeg(nextKind)) setUseRightLeg(false);
    autoFit(nextKind);
  };

  const handleConvertToCustom = () => {
    const members = convertPresetToMembers(workingConfig);
    const before = calculateTrussBom(workingConfig, 1).couplers;
    const after = calculateTrussBom({ ...workingConfig, kind: 'CUSTOM', members }, 1).couplers;
    if (before !== after && !confirm(
      `目前預設與自訂的接頭計算規則不同：每座接頭將由 ${before} 個變成 ${after} 個。請先核對用料，確定轉為自訂？`,
    )) return;
    setCustomMembers(members);
    setCustomAddMode('FREE');
    setKind('CUSTOM');
  };

  const updateCustomMember = (
    memberId: string,
    updater: (member: TrussCustomMember) => TrussCustomMember,
  ) => {
    setCustomMembers(prev => prev.map(member => (
      member.id === memberId ? updater(member) : member
    )));
  };

  const duplicateCustomMember = (member: TrussCustomMember) => {
    const copy: TrussCustomMember = {
      ...member,
      id: `custom-${crypto.randomUUID()}`,
      label: `${member.label?.trim() || '桿件'} 複製`,
      origin: { ...member.origin },
      segments: [...member.segments],
    };

    setCustomMembers(prev => {
      const index = prev.findIndex(item => item.id === member.id);
      if (index === -1) return [...prev, copy];
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  };

  const deleteCustomMember = (memberId: string) => {
    setCustomMembers(prev => (
      prev.length <= 1 ? prev : prev.filter(member => member.id !== memberId)
    ));
    if (anchorId === memberId) setCustomAddMode('FREE');
  };

  const addCustomMember = () => {
    if (customAddMode === 'FREE') {
      setCustomMembers(prev => [...prev, createCustomMember({ xCm: 0, yCm: 0, zCm: 0 })]);
      return;
    }

    const anchor = customMembers.find(member => member.id === anchorId);
    if (!anchor) {
      setCustomAddMode('FREE');
      setCustomMembers(prev => [...prev, createCustomMember({ xCm: 0, yCm: 0, zCm: 0 })]);
      return;
    }

    const endpoint = getCustomMemberEndpoint(anchor);

    if (customAddMode.startsWith('UP:')) {
      setCustomMembers(prev => [...prev, createCustomMember(endpoint, 'VERTICAL', 1, '接續立柱')]);
      return;
    }

    if (customAddMode.startsWith('LEFT:')) {
      setCustomMembers(prev => [...prev, createCustomMember(endpoint, 'HORIZONTAL', -1, '左接梁')]);
      return;
    }

    setCustomMembers(prev => [...prev, createCustomMember(endpoint, 'HORIZONTAL', 1, '右接梁')]);
  };

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const configToSubmit: TrussStructureConfig = {
        ...workingConfig,
        title: title.trim() || 'Truss 結構',
        quantity: effectiveQuantity,
      };

      await onSubmit(configToSubmit);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '儲存失敗，請重試';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showWidthField = kind === 'GOALPOST' || kind === 'BACKDROP' || kind === 'BOX' || kind === 'MULTI_BAY';
  const showCantileverFields = kind === 'LSHAPE' || kind === 'TSHAPE';

  const renderCustomMemberEditor = (member: TrussCustomMember, index: number) => {
    const basePlateChecked = member.basePlate ?? member.origin.yCm === 0;
    const currentLength = getMemberLength(member) || 10;

    return (
      <div key={member.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
        <div className="flex items-start gap-2">
          <div className="grid grid-cols-2 gap-2 flex-1">
            <div className="space-y-1 col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Label</label>
              <input
                value={member.label || ''}
                placeholder={getCustomMemberLabel(member, index)}
                onChange={(e) => updateCustomMember(member.id, item => ({ ...item, label: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">方向</label>
              <select
                value={member.orientation}
                onChange={(e) => {
                  const orientation = e.target.value as TrussMemberOrientation;
                  updateCustomMember(member.id, item => ({
                    ...item,
                    orientation,
                    direction: orientation === 'HORIZONTAL' ? (item.direction === -1 ? -1 : 1) : undefined,
                    basePlate: orientation === 'VERTICAL' ? (item.basePlate ?? item.origin.yCm === 0) : undefined,
                    origin: { ...item.origin, zCm: item.origin.zCm ?? 0 },
                  }));
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              >
                {ORIENTATION_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {member.orientation === 'HORIZONTAL' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">水平方向</label>
                <select
                  value={member.direction === -1 ? -1 : 1}
                  onChange={(e) => updateCustomMember(member.id, item => ({
                    ...item,
                    direction: Number(e.target.value) === -1 ? -1 : 1,
                  }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value={1}>向右</option>
                  <option value={-1}>向左</option>
                </select>
              </div>
            )}

            {member.orientation === 'VERTICAL' && (
              <label className="space-y-1">
                <span className="block text-[10px] font-bold text-slate-500 uppercase">鐵板</span>
                <span className="flex h-[38px] items-center justify-between rounded-lg border border-slate-200 px-3">
                  <span className="text-xs font-semibold text-slate-600">底部鐵板</span>
                  <input
                    type="checkbox"
                    checked={basePlateChecked}
                    onChange={(e) => updateCustomMember(member.id, item => ({
                      ...item,
                      basePlate: e.target.checked,
                    }))}
                    className="h-4 w-4 accent-blue-600"
                  />
                </span>
              </label>
            )}

            <NumberField
              label="Origin X (cm)"
              value={member.origin.xCm}
              min={0}
              onChange={(raw) => updateCustomMember(member.id, item => ({
                ...item,
                origin: { ...item.origin, xCm: clampInt(raw, item.origin.xCm, 0) },
              }))}
            />
            <NumberField
              label="Origin Y (cm)"
              value={member.origin.yCm}
              min={0}
              onChange={(raw) => updateCustomMember(member.id, item => ({
                ...item,
                origin: { ...item.origin, yCm: clampInt(raw, item.origin.yCm, 0) },
              }))}
            />
            <NumberField
              label="Origin Z (cm)"
              value={member.origin.zCm ?? 0}
              min={0}
              onChange={(raw) => updateCustomMember(member.id, item => ({
                ...item,
                origin: { ...item.origin, zCm: clampInt(raw, item.origin.zCm ?? 0, 0) },
              }))}
            />
            <NumberField
              label="目標長度自動配段 (cm)"
              value={currentLength}
              min={10}
              onChange={(raw) => updateCustomMember(member.id, item => ({
                ...item,
                segments: fitSegments(clampInt(raw, currentLength, 10)),
              }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => duplicateCustomMember(member)}
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-blue-600 flex items-center justify-center"
              title="複製桿件"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => deleteCustomMember(member.id)}
              disabled={customMembers.length <= 1}
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-500 flex items-center justify-center"
              title="刪除桿件"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <MemberEditor
          label={`${getCustomMemberLabel(member, index)} 配段`}
          member={member}
          onChange={(next) => updateCustomMember(member.id, item => ({
            ...item,
            segments: next.segments,
          }))}
        />
      </div>
    );
  };

  const isDeadAnchor = customAddMode !== 'FREE' && !customMembers.some(member => member.id === anchorId);
  const effectiveCustomAddMode = isDeadAnchor ? 'FREE' : customAddMode;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ) || []).filter(element => element.offsetParent !== null && !element.closest('[inert]'));
        if (controls.length === 0) {
          event.preventDefault();
          dialogRef.current?.focus();
          return;
        }
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="truss-builder-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 id="truss-builder-title" className="text-sm font-bold text-slate-800">Truss 建造器</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            title="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          ref={(element) => { if (element) element.inert = isSubmitting; }}
          aria-busy={isSubmitting}
          className="grid grid-cols-1 lg:grid-cols-[440px_1fr] flex-1 min-h-0 min-w-0 overflow-hidden"
        >
          <div className="overflow-y-auto p-4 space-y-4 border-r border-slate-100">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {KIND_OPTIONS.map(option => (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => handleKindChange(option.kind)}
                  className={`rounded-lg border p-2 text-left transition-colors ${kind === option.kind ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <KindSketch kind={option.kind} />
                  <div className="text-xs font-bold text-slate-800">{option.title}</div>
                  <div className="text-[10px] text-slate-500">{option.description}</div>
                </button>
              ))}
            </div>

            {kind !== 'CUSTOM' && (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={handleConvertToCustom}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold text-blue-700 hover:border-blue-300 hover:bg-blue-50"
                >
                  {customMembers.length > 0
                    ? '⤷ 依目前預設重新產生自訂桿件（將取代自訂草稿）'
                    : '⤷ 轉為自訂繼續編輯'}
                </button>
                <div className="text-[11px] text-slate-500 px-1 leading-relaxed">
                  預設結構外徑包含 25cm 轉角連接件；轉為自訂後將以實際桿件端點座標範圍呈現（不計轉角連接件間距）。
                  {customMembers.length > 0 && ' 點擊上方按鈕將以目前預設桿件覆蓋現有的自訂草稿。'}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">用途名稱</label>
                <input
                  ref={titleInputRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              {showWidthField && (
                <NumberField
                  label={kind === 'MULTI_BAY' ? '目標總寬 W (cm)' : '目標 W (cm)'}
                  value={targetWidth}
                  onChange={(raw) => {
                    const next = clampInt(raw, targetWidth, 10);
                    setTargetWidth(next);
                    const allowances = getTrussCouplerAllowances({ kind, bayCount: clampedBayCount });
                    const targetMainBeam = Math.max(10, next - allowances.widthCm);
                    if (kind === 'MULTI_BAY') {
                      setBeam({ segments: fitSegmentsForBays(targetMainBeam, clampedBayCount) });
                    } else {
                      const fittedBeam = { segments: fitSegments(targetMainBeam) };
                      setBeam(fittedBeam);
                      if (kind === 'BOX') {
                        setBottomBeam(fittedBeam);
                        setTargetBottomWidth(next);
                      }
                    }
                  }}
                />
              )}

              {showCantileverFields && (
                <>
                  <NumberField
                    label={kind === 'TSHAPE' ? '左懸挑長度 (cm)' : '目標懸挑長度 (cm)'}
                    value={targetBeamLeft}
                    onChange={(raw) => {
                      const next = clampInt(raw, targetBeamLeft, 10);
                      setTargetBeamLeft(next);
                      setBeam({ segments: fitSegments(next) });
                    }}
                  />
                  {kind === 'TSHAPE' && (
                    <NumberField
                      label="右懸挑長度 (cm)"
                      value={targetBeamRight}
                      onChange={(raw) => {
                        const next = clampInt(raw, targetBeamRight, 10);
                        setTargetBeamRight(next);
                        setBeamRight({ segments: fitSegments(next) });
                      }}
                    />
                  )}
                </>
              )}

              {kind !== 'CUSTOM' && (
                <NumberField
                  label="目標 H (cm)"
                  value={targetHeight}
                  onChange={(raw) => {
                    const next = clampInt(raw, targetHeight, 10);
                    fitLegHeight(kind, next);
                    setTargetHeight(next);
                  }}
                />
              )}

              {showCantileverFields && (
                <NumberField
                  label="梁附掛高度 (cm)"
                  value={clampedBeamAttachCm}
                  min={0}
                  onChange={(raw) => {
                    const maxAttach = getMemberLength(legs);
                    setBeamAttachCm(clampInt(raw, beamAttachCm, 0, maxAttach));
                  }}
                />
              )}

              {kind === 'BACKDROP' && (
                <NumberField
                  label="目標 D (cm)"
                  value={targetDepth}
                  onChange={(raw) => {
                    const next = clampInt(raw, targetDepth, 10);
                    setTargetDepth(next);
                    setDepthMember({ segments: fitSegments(next) });
                  }}
                />
              )}

              {kind === 'BOX' && (
                <NumberField
                  label="底梁目標 W (cm)"
                  value={targetBottomWidth}
                  onChange={(raw) => {
                    const next = clampInt(raw, targetBottomWidth, 10);
                    setTargetBottomWidth(next);
                    setBottomBeam({ segments: fitSegments(Math.max(10, next - 2 * COUPLER_LENGTH_CM)) });
                  }}
                />
              )}

              {kind === 'MULTI_BAY' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">跨數</label>
                  <select
                    value={clampedBayCount}
                    onChange={(e) => {
                      const nextBayCount = Number(e.target.value);
                      setBayCount(nextBayCount);
                      const allowances = getTrussCouplerAllowances({ kind: 'MULTI_BAY', bayCount: nextBayCount });
                      const targetMainBeam = Math.max(10, targetWidth - allowances.widthCm);
                      setBeam({ segments: fitSegmentsForBays(targetMainBeam, nextBayCount) });
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                  >
                    {[2, 3, 4, 5, 6].map(count => (
                      <option key={count} value={count}>{count} 跨</option>
                    ))}
                  </select>
                </div>
              )}

              {lockQuantity ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">座數</label>
                  <div className="flex h-[38px] items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                    <span>1 座</span>
                    <span className="text-[11px] text-slate-400">（場景編輯固定單座）</span>
                  </div>
                </div>
              ) : (
                <NumberField
                  label="座數"
                  value={quantity}
                  min={1}
                  step={1}
                  onChange={(raw) => setQuantity(clampInt(raw, quantity, 1))}
                />
              )}

              {kind !== 'CUSTOM' && (
                <div className="space-y-1 flex items-end">
                  <button
                    type="button"
                    onClick={() => autoFit()}
                    className="w-full h-[38px] rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100"
                  >
                    重新自動配段
                  </button>
                </div>
              )}
            </div>

            {supportsRightLeg(kind) && (
              <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="text-xs font-bold text-slate-700">右柱獨立配段</span>
                <input
                  type="checkbox"
                  checked={useRightLeg}
                  onChange={(e) => {
                    setUseRightLeg(e.target.checked);
                    if (e.target.checked) {
                      setLegsRight({ segments: [...legs.segments] });
                    }
                  }}
                  className="h-4 w-4 accent-blue-600"
                />
              </label>
            )}

            <div className="rounded-lg bg-slate-900 text-white px-3 py-2">
              <div className="text-[10px] text-slate-300">
                {kind === 'CUSTOM' ? '桿件座標範圍' : '實際外徑'}
              </div>
              <div className="text-sm font-bold">
                {kind === 'TOWER'
                  ? `H${actualDims.heightCm}`
                  : `W${actualDims.widthCm} × H${actualDims.heightCm}${actualDims.depthCm !== undefined ? ` × D${actualDims.depthCm || 0}` : ''}`} cm
              </div>
            </div>

            {validationErrors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1 text-xs text-amber-800">
                <div className="font-bold text-amber-900">
                  結構規格驗證未通過
                </div>
                {validationErrors.map((err, idx) => (
                  <div key={idx} className="text-amber-700 pl-2">
                    • {err}
                  </div>
                ))}
              </div>
            )}

            {kind === 'CUSTOM' ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={effectiveCustomAddMode}
                      onChange={(e) => setCustomAddMode(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    >
                      <option value="FREE">自由位置</option>
                      {customMembers.map((member, index) => {
                        const memberLabel = getCustomMemberLabel(member, index);
                        return (
                          <React.Fragment key={member.id}>
                            <option value={`UP:${member.id}`}>接在 {memberLabel} 頂端往上</option>
                            <option value={`RIGHT:${member.id}`}>接在 {memberLabel} 頂端往右</option>
                            <option value={`LEFT:${member.id}`}>接在 {memberLabel} 頂端往左</option>
                          </React.Fragment>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={addCustomMember}
                      className="h-[38px] px-3 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新增桿件
                    </button>
                  </div>
                </div>
                {customMembers.map(renderCustomMemberEditor)}
              </div>
            ) : (
              <div className="space-y-3">
                <MemberEditor
                  label={supportsRightLeg(kind) ? '左柱配段（由下而上）' : '立柱配段（由下而上）'}
                  member={legs}
                  onChange={setLegs}
                />
                {hasRightLeg && (
                  <MemberEditor label="右柱配段（由下而上）" member={legsRight} onChange={setLegsRight} />
                )}
                {kind === 'GOALPOST' && <MemberEditor label="頂梁配段（由左而右）" member={beam} onChange={setBeam} />}
                {kind === 'BACKDROP' && <MemberEditor label="頂梁配段（由左而右）" member={beam} onChange={setBeam} />}
                {kind === 'BACKDROP' && <MemberEditor label="深度側撐配段" member={depthMember} onChange={setDepthMember} />}
                {kind === 'BOX' && <MemberEditor label="頂梁配段（由左而右）" member={beam} onChange={setBeam} />}
                {kind === 'BOX' && <MemberEditor label="底梁配段（由左而右）" member={bottomBeam} onChange={setBottomBeam} />}
                {kind === 'LSHAPE' && <MemberEditor label="懸挑梁配段（由柱往外）" member={beam} onChange={setBeam} />}
                {kind === 'TSHAPE' && <MemberEditor label="左懸挑梁配段（由柱往左）" member={beam} onChange={setBeam} />}
                {kind === 'TSHAPE' && <MemberEditor label="右懸挑梁配段（由柱往右）" member={beamRight} onChange={setBeamRight} />}
                {kind === 'MULTI_BAY' && <MemberEditor label="連續頂梁配段（由左而右）" member={beam} onChange={setBeam} />}
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto bg-slate-100 p-4">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-xs font-bold text-slate-700">2D 結構圖預覽</div>
                <div className="text-[11px] text-slate-500 truncate">{formatTrussTitle(workingConfig)}</div>
              </div>
              <div className="aspect-[16/9]">
                <TrussDiagram config={workingConfig} />
              </div>
            </div>
          </div>
        </div>

        {submitError && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs font-semibold text-red-600 flex items-center justify-between">
            <span>儲存失敗：{submitError}</span>
            <button
              type="button"
              onClick={() => setSubmitError(null)}
              className="text-red-400 hover:text-red-600 p-0.5 rounded"
              title="關閉提示"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:bg-slate-300 disabled:hover:bg-slate-300 flex items-center justify-center gap-2"
          >
            <Check className="w-3.5 h-3.5" />
            {isSubmitting ? '儲存中...' : (submitLabel ?? (isEditing ? '儲存結構' : '加入場景'))}
          </button>
        </div>
      </div>
    </div>
  );
};
