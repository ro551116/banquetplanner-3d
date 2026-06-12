import React, { useMemo, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import {
  TrussMember,
  TrussSegmentLength,
  TrussStructureConfig,
  TrussStructureKind,
} from '../types';
import {
  cloneTrussConfig,
  createDefaultTrussConfig,
  fitSegments,
  formatTrussTitle,
  getTrussDimensions,
  TRUSS_SEGMENT_COLORS,
  TRUSS_SEGMENT_LENGTHS,
} from '../trussConfig';
import { TrussDiagram } from './TrussDiagram';

interface TrussBuilderModalProps {
  initialConfig?: TrussStructureConfig;
  onClose: () => void;
  onSubmit: (config: TrussStructureConfig) => void;
  submitLabel?: string;
}

const KIND_OPTIONS: Array<{ kind: TrussStructureKind; title: string; description: string }> = [
  { kind: 'TOWER', title: '立柱', description: '單支直立 truss' },
  { kind: 'GOALPOST', title: 'ㄇ型', description: '雙柱加頂梁' },
  { kind: 'BACKDROP', title: '背景框型', description: 'ㄇ型加深度側撐' },
];

const clampInt = (value: number, fallback: number, min = 1) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.round(value));
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
  member: TrussMember;
  onChange: (member: TrussMember) => void;
}) => {
  const updateSegment = (index: number, next: TrussSegmentLength) => {
    onChange({ segments: member.segments.map((segment, i) => i === index ? next : segment) });
  };

  const removeSegment = (index: number) => {
    const next = member.segments.filter((_, i) => i !== index);
    onChange({ segments: next.length ? next : [10] });
  };

  const addSegment = (length: TrussSegmentLength) => {
    onChange({ segments: [...member.segments, length] });
  };

  const total = member.segments.reduce((sum, segment) => sum + segment, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700">{label}</span>
        <span className="text-[11px] font-semibold text-slate-500">實際 {total}cm</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {member.segments.map((segment, index) => (
          <SegmentChip
            key={`${segment}-${index}`}
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

export const TrussBuilderModal: React.FC<TrussBuilderModalProps> = ({
  initialConfig,
  onClose,
  onSubmit,
  submitLabel,
}) => {
  const initial = useMemo(() => cloneTrussConfig(initialConfig || createDefaultTrussConfig()), [initialConfig]);
  const initialDims = useMemo(() => getTrussDimensions(initial), [initial]);
  const [kind, setKind] = useState<TrussStructureKind>(initial.kind);
  const [title, setTitle] = useState(initial.title || 'Truss 結構');
  const [quantity, setQuantity] = useState(initial.quantity || 1);
  const [targetWidth, setTargetWidth] = useState(initial.kind === 'TOWER' ? 350 : initialDims.widthCm);
  const [targetHeight, setTargetHeight] = useState(initialDims.heightCm);
  const [targetDepth, setTargetDepth] = useState(initialDims.depthCm || 125);
  const [legs, setLegs] = useState<TrussMember>(initial.legs);
  const [beam, setBeam] = useState<TrussMember>(initial.beam || { segments: fitSegments(initialDims.widthCm || 550) });
  const [depthMember, setDepthMember] = useState<TrussMember>(initial.depthMember || { segments: fitSegments(initialDims.depthCm || 125) });

  const workingConfig: TrussStructureConfig = {
    kind,
    title,
    quantity: clampInt(quantity, 1),
    legs,
    beam: kind === 'TOWER' ? undefined : beam,
    depthMember: kind === 'BACKDROP' ? depthMember : undefined,
    groupId: initial.groupId,
  };

  const actualDims = getTrussDimensions(workingConfig);
  const isEditing = Boolean(initialConfig);

  const autoFit = (
    nextKind = kind,
    nextWidth = targetWidth,
    nextHeight = targetHeight,
    nextDepth = targetDepth,
  ) => {
    setLegs({ segments: fitSegments(nextHeight) });
    if (nextKind !== 'TOWER') setBeam({ segments: fitSegments(nextWidth) });
    if (nextKind === 'BACKDROP') setDepthMember({ segments: fitSegments(nextDepth) });
  };

  const handleKindChange = (nextKind: TrussStructureKind) => {
    setKind(nextKind);
    autoFit(nextKind);
  };

  const handleSubmit = () => {
    onSubmit({
      ...workingConfig,
      title: title.trim() || 'Truss 結構',
      quantity: clampInt(quantity, 1),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Truss 建造器</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] flex-1 min-h-0 overflow-hidden">
          <div className="overflow-y-auto p-4 space-y-4 border-r border-slate-100">
            <div className="grid grid-cols-3 gap-2">
              {KIND_OPTIONS.map(option => (
                <button
                  key={option.kind}
                  onClick={() => handleKindChange(option.kind)}
                  className={`rounded-lg border p-2 text-left transition-colors ${kind === option.kind ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <KindSketch kind={option.kind} />
                  <div className="text-xs font-bold text-slate-800">{option.title}</div>
                  <div className="text-[10px] text-slate-500">{option.description}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">用途名稱</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              {kind !== 'TOWER' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">目標 W (cm)</label>
                  <input
                    type="number"
                    min={10}
                    step={10}
                    value={targetWidth}
                    onChange={(e) => {
                      const next = clampInt(parseFloat(e.target.value), targetWidth, 10);
                      setTargetWidth(next);
                      setBeam({ segments: fitSegments(next) });
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">目標 H (cm)</label>
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={targetHeight}
                  onChange={(e) => {
                    const next = clampInt(parseFloat(e.target.value), targetHeight, 10);
                    setTargetHeight(next);
                    setLegs({ segments: fitSegments(next) });
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              {kind === 'BACKDROP' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">目標 D (cm)</label>
                  <input
                    type="number"
                    min={10}
                    step={10}
                    value={targetDepth}
                    onChange={(e) => {
                      const next = clampInt(parseFloat(e.target.value), targetDepth, 10);
                      setTargetDepth(next);
                      setDepthMember({ segments: fitSegments(next) });
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">座數</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(clampInt(parseFloat(e.target.value), quantity))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1 flex items-end">
                <button
                  onClick={() => autoFit()}
                  className="w-full h-[38px] rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100"
                >
                  重新自動配段
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-slate-900 text-white px-3 py-2">
              <div className="text-[10px] text-slate-300">實際外徑</div>
              <div className="text-sm font-bold">
                {kind === 'TOWER'
                  ? `H${actualDims.heightCm}`
                  : `W${actualDims.widthCm} × H${actualDims.heightCm}${kind === 'BACKDROP' ? ` × D${actualDims.depthCm || 0}` : ''}`} cm
              </div>
            </div>

            <div className="space-y-3">
              <MemberEditor label="立柱配段（由下而上）" member={legs} onChange={setLegs} />
              {kind !== 'TOWER' && <MemberEditor label="頂梁配段（由左而右）" member={beam} onChange={setBeam} />}
              {kind === 'BACKDROP' && <MemberEditor label="深度側撐配段" member={depthMember} onChange={setDepthMember} />}
            </div>
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

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            取消
          </button>
          <button onClick={handleSubmit} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
            <Check className="w-3.5 h-3.5" />
            {submitLabel ?? (isEditing ? '儲存結構' : '加入場景')}
          </button>
        </div>
      </div>
    </div>
  );
};
