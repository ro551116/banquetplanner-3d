import React from 'react';
import { PenTool, Plus, X } from 'lucide-react';
import type { HallConfig, PathPoint } from '../types';
import {
  getHallOutline, getWallSegments, isSimplePolygon, MAX_OUTLINE_POINTS, MIN_OUTLINE_POINTS,
  outlineTemplate, OutlineTemplate, signedArea, withOutline,
} from '../planning';
import { NumberField } from './ui/NumberField';

interface HallShapeEditorProps {
  hall: HallConfig;
  setHall: React.Dispatch<React.SetStateAction<HallConfig>>;
  /** Starts drawing the outline corner by corner on the floor. */
  onDrawOutline: () => void;
}

const TEMPLATES: Array<{ id: OutlineTemplate; label: string }> = [
  { id: 'L', label: 'L 形' },
  { id: 'chamfer', label: '斜角' },
  { id: 'octagon', label: '八角' },
  { id: 'alcove', label: '舞台凸出' },
];

const SIZE_PROPS = { unit: 'm', min: 1, max: 200, step: 0.5, precision: 1 } as const;

/** Hall size and shape: a width × length rectangle, or an outline of wall corners (templates, drawn, or typed). */
export function HallShapeEditor({ hall, setHall, onDrawOutline }: HallShapeEditorProps) {
  const outline = hall.outline;
  // Hall edits are not in the undo history, so replacing a hand-made outline asks first.
  const replaceOutline = (next: PathPoint[] | undefined, question: string) => {
    if (outline && !window.confirm(question)) return;
    setHall(previous => withOutline(previous, next));
  };
  const updateOutline = (next: PathPoint[]) => setHall(previous => withOutline(previous, next));
  const heightField = <NumberField label="高" value={hall.height} onChange={height => setHall(previous => ({ ...previous, height }))} {...SIZE_PROPS} />;

  return <section className="space-y-4">
    <h3 className="ui-section-title">尺寸與形狀</h3>
    <div className="ui-segmented flex w-full" role="group" aria-label="場地形狀">
      <button type="button" className="ui-segment flex-1" aria-pressed={!outline} onClick={() => { if (outline) replaceOutline(undefined, '改回矩形會清除自訂外框（保留外框的寬與長），確定嗎？'); }}>矩形</button>
      <button type="button" className="ui-segment flex-1" aria-pressed={!!outline} onClick={() => { if (!outline) updateOutline(getHallOutline(hall)); }}>不規則</button>
    </div>

    {!outline ? <div className="grid grid-cols-3 gap-3">
      <NumberField label="寬" value={hall.width} onChange={width => setHall(previous => ({ ...previous, width }))} {...SIZE_PROPS} />
      <NumberField label="長" value={hall.length} onChange={length => setHall(previous => ({ ...previous, length }))} {...SIZE_PROPS} />
      {heightField}
    </div> : <div className="space-y-4">
      <p className="text-xs tabular-nums text-slate-600">
        外框 {hall.width.toFixed(1)} × {hall.length.toFixed(1)} m・面積 {Math.round(Math.abs(signedArea(outline)))} m²・{getWallSegments(outline).length} 邊
      </p>
      {!isSimplePolygon(outline) && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">外框的牆線互相交叉，地板會畫錯；請調整頂點順序或座標。</p>}
      <div className="space-y-1.5">
        <p className="ui-label">範本（依目前外框寬 × 長）</p>
        <div className="grid grid-cols-4 gap-1.5">
          {TEMPLATES.map(template => <button type="button" key={template.id} className="ui-btn-secondary h-8 px-1 text-xs" onClick={() => replaceOutline(outlineTemplate(template.id, hall.width, hall.length), `套用「${template.label}」會取代目前外框，確定嗎？`)}>{template.label}</button>)}
        </div>
      </div>
      <button type="button" className="ui-btn-secondary w-full" onClick={onDrawOutline}><PenTool className="h-4 w-4" />在場景中描繪外框</button>
      <div className="space-y-2">
        <p className="ui-label">牆角座標（公尺，依序相連）</p>
        <ol className="space-y-2">
          {outline.map((point, index) => {
            const next = outline[(index + 1) % outline.length];
            const update = (patch: Partial<PathPoint>) => updateOutline(outline.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
            return <li key={index} className="space-y-1">
              <div className="flex items-end gap-1.5">
                <span className="w-5 shrink-0 pb-2 text-xs tabular-nums text-slate-500">{index + 1}</span>
                <NumberField className="min-w-0 flex-1" label="X" value={point.x} min={-100} max={100} step={0.1} unit="m" onChange={x => update({ x })} />
                <NumberField className="min-w-0 flex-1" label="Z" value={point.z} min={-100} max={100} step={0.1} unit="m" onChange={z => update({ z })} />
                <button type="button" className="ui-icon-btn mb-0.5 shrink-0" aria-label={`在牆角 ${index + 1} 後插入`} title="在此後插入牆角" disabled={outline.length >= MAX_OUTLINE_POINTS}
                  onClick={() => updateOutline([...outline.slice(0, index + 1), { x: Math.round((point.x + next.x) * 50) / 100, z: Math.round((point.z + next.z) * 50) / 100 }, ...outline.slice(index + 1)])}><Plus className="h-4 w-4" /></button>
                <button type="button" className="ui-icon-btn mb-0.5 shrink-0 text-red-600" aria-label={`刪除牆角 ${index + 1}`} title="刪除牆角" disabled={outline.length <= MIN_OUTLINE_POINTS}
                  onClick={() => updateOutline(outline.filter((_, itemIndex) => itemIndex !== index))}><X className="h-4 w-4" /></button>
              </div>
              <p className="pl-6 text-[11px] tabular-nums text-slate-500">→ {(index + 1) % outline.length + 1}：{Math.hypot(next.x - point.x, next.z - point.z).toFixed(2)} m</p>
            </li>;
          })}
        </ol>
      </div>
      <div className="grid grid-cols-3 gap-3">{heightField}</div>
    </div>}
  </section>;
}
