import React from 'react';
import { MousePointer2, Trash2, X } from 'lucide-react';
import { ObjectType } from '../types';
import type { BanquetObject, StairConfig, StairSide, TableCloth } from '../types';
import { TABLE_PRESETS, TABLE_CLOTH_MATERIALS } from '../constants';
import { formatTrussTitle, getTrussDimensions } from '../trussConfig';
import { OBJECT_TYPE_META, getObjectDisplayName } from './objectTypeMeta';
import { NumberField, TextField } from './ui/NumberField';

interface PropertiesPanelProps {
  selectedIds: Set<string>;
  objects: BanquetObject[];
  updateObject: (id: string, updates: Partial<BanquetObject>, mergeKey?: string) => void;
  deleteSelected: () => void;
  handleBulkPropertyUpdate: (ids: Set<string>, updates: Partial<BanquetObject>, mergeKey?: string) => void;
  handleAddStair: (stageId: string) => void;
  handleRemoveStair: (stageId: string, stairId: string) => void;
  handleUpdateStair: (stageId: string, stairId: string, updates: Partial<StairConfig>) => void;
  onEditTrussStructure: (object: BanquetObject) => void;
}

// Maps to (-180, 180] so dragging the slider to its right end shows 180° instead of jumping to -180°.
const wrapDegrees = (radians: number) => 180 - ((((180 - radians * 180 / Math.PI) % 360) + 360) % 360);

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedIds, objects, updateObject, deleteSelected, handleBulkPropertyUpdate, handleAddStair, handleRemoveStair, handleUpdateStair, onEditTrussStructure }) => {
  const count = selectedIds.size;
  const object = count === 1 ? objects.find(item => selectedIds.has(item.id)) : undefined;
  if (count === 0) return null;
  const meta = object ? OBJECT_TYPE_META[object.type] : undefined;
  const Icon = meta?.Icon ?? MousePointer2;
  const isLight = object?.type.includes('LIGHT');
  const pan = object ? wrapDegrees(object.rotation.y) : 0;
  const tilt = object ? Math.max(-90, Math.min(90, wrapDegrees(object.rotation.x ?? 0))) : 0;
  return <div key={object?.id ?? 'multiple'} className="space-y-6 animate-fade-in">
    <header className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
        <div className="min-w-0">
          <h2 className="break-words text-base font-semibold">{object ? getObjectDisplayName(object) : `已選 ${count} 個物件`}</h2>
          {object?.label?.trim() && <p className="mt-1 text-xs text-slate-500">{meta?.label}</p>}
        </div>
      </div>
      <button type="button" onClick={deleteSelected} aria-label="刪除" className="ui-btn-danger h-8 shrink-0 px-2"><Trash2 className="h-4 w-4" /></button>
    </header>
    {count > 1 && <section className="space-y-3">
      <h3 className="ui-section-title">批量修改顏色</h3>
      <input type="color" aria-label="批量修改顏色" className="h-9 w-9 cursor-pointer rounded-lg ring-1 ring-slate-200 coarse:h-10 coarse:w-10" onChange={event => handleBulkPropertyUpdate(selectedIds, { color: event.target.value }, 'bulk:color')} />
    </section>}
    {object && <>
      <TextField key={`name-${object.id}`} label="名稱" value={object.label ?? ''} placeholder={meta?.label} onChange={label => updateObject(object.id, { label })} />
      <section className="space-y-3">
        <h3 className="ui-section-title">位置</h3>
        <div className="grid grid-cols-3 gap-3">
          <NumberField label="X" value={object.position.x} unit="m" step={0.1} onChange={x => updateObject(object.id, { position: { ...object.position, x } })} />
          <NumberField label="高度 Y" value={object.position.y} unit="m" step={0.1} onChange={y => updateObject(object.id, { position: { ...object.position, y } })} />
          <NumberField label="Z" value={object.position.z} unit="m" step={0.1} onChange={z => updateObject(object.id, { position: { ...object.position, z } })} />
        </div>
      </section>
      <section className="space-y-4">
        <h3 className="ui-section-title">方向</h3>
        <div className="space-y-3">
          <NumberField label="水平角度" value={pan} min={-180} max={180} step={1} precision={0} unit="°" onChange={value => updateObject(object.id, { rotation: { ...object.rotation, y: value * Math.PI / 180 } })} />
          <input aria-label="水平角度" type="range" min={-180} max={180} step={1} value={pan} className="h-6 w-full cursor-pointer accent-blue-600 coarse:h-10" onChange={event => updateObject(object.id, { rotation: { ...object.rotation, y: Number(event.target.value) * Math.PI / 180 } }, `${object.id}:rotation.y`)} />
        </div>
        {isLight && <>
          <div className="space-y-3">
            <NumberField label="仰角" value={tilt} min={-90} max={90} step={1} precision={0} unit="°" onChange={value => updateObject(object.id, { rotation: { ...object.rotation, x: value * Math.PI / 180 } })} />
            <input aria-label="仰角" type="range" min={-90} max={90} step={1} value={tilt} className="h-6 w-full cursor-pointer accent-blue-600 coarse:h-10" onChange={event => updateObject(object.id, { rotation: { ...object.rotation, x: Number(event.target.value) * Math.PI / 180 } }, `${object.id}:rotation.x`)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500"><span>亮度</span><span className="tabular-nums">{Math.round((object.intensity ?? 1) * 100)}%</span></div>
            <input aria-label="亮度" type="range" min={0} max={300} step={1} value={(object.intensity ?? 1) * 100} className="h-6 w-full cursor-pointer accent-blue-600 coarse:h-10" onChange={event => updateObject(object.id, { intensity: Number(event.target.value) / 100 }, `${object.id}:intensity`)} />
          </div>
        </>}
      </section>
      <section className="space-y-3">
        <h3 className="ui-section-title">顏色</h3>
        <div className="flex items-center gap-3">
          <input aria-label="物件顏色" type="color" value={object.color} onChange={event => updateObject(object.id, { color: event.target.value }, `${object.id}:color`)} className="h-9 w-9 cursor-pointer rounded-lg ring-1 ring-slate-200 coarse:h-10 coarse:w-10" />
          <span className="text-xs tabular-nums text-slate-500">{object.color}</span>
        </div>
      </section>
      {(object.type === ObjectType.ROUND_TABLE || object.type === ObjectType.RECT_TABLE) && <section className="space-y-4">
        <h3 className="ui-section-title">桌布</h3>
        <div className="grid grid-cols-4 gap-2">
          {TABLE_PRESETS.map(preset => <button type="button" key={preset.id} aria-pressed={object.color === preset.color && object.tableCloth === preset.cloth} aria-label={preset.name} onClick={() => updateObject(object.id, { color: preset.color, tableCloth: preset.cloth })} className={`flex flex-col items-center gap-2 rounded-lg p-1.5 ${object.color === preset.color && object.tableCloth === preset.cloth ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <span className="h-8 w-8 rounded-lg border border-slate-200 coarse:h-10 coarse:w-10" style={{ backgroundColor: preset.color }} /><span className="text-xs">{preset.name}</span>
          </button>)}
        </div>
        <div className="space-y-1.5">
          <p className="ui-label">材質</p>
          <div className="ui-segmented flex w-full">
            {(Object.entries(TABLE_CLOTH_MATERIALS) as [TableCloth, typeof TABLE_CLOTH_MATERIALS[TableCloth]][]).map(([key, material]) => <button type="button" key={key} className="ui-segment flex-1" aria-pressed={(object.tableCloth ?? 'linen') === key} onClick={() => updateObject(object.id, { tableCloth: key })}>{material.label}</button>)}
          </div>
        </div>
      </section>}
      {object.type === ObjectType.ROUND_TABLE && <section className="space-y-3">
        <h3 className="ui-section-title">圓桌尺寸</h3>
        <select aria-label="圓桌尺寸" value={object.customSize ?? 6} className="ui-input" onChange={event => updateObject(object.id, { customSize: Number(event.target.value) })}>
          <option value={4}>4 尺（5 人）</option><option value={5}>5 尺（8 人）</option><option value={6}>6 尺（10 人）</option><option value={8}>8 尺（12 人）</option>
        </select>
      </section>}
      {object.type === ObjectType.RED_CARPET && <section className="space-y-3">
        <h3 className="ui-section-title">紅地毯</h3>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="寬" value={object.customWidth ?? 1.5} min={0.5} step={0.1} unit="m" onChange={customWidth => updateObject(object.id, { customWidth })} />
          <NumberField label="長" value={object.customDepth ?? 10} min={1} step={0.5} unit="m" onChange={customDepth => updateObject(object.id, { customDepth })} />
        </div>
      </section>}
      {object.type === ObjectType.STAGE && <section className="space-y-4">
        <h3 className="ui-section-title">舞台</h3>
        <div className="grid grid-cols-3 gap-3">
          <NumberField label="寬" value={object.customWidth ?? 6} step={0.5} unit="m" onChange={customWidth => updateObject(object.id, { customWidth })} />
          <NumberField label="深" value={object.customDepth ?? 4} step={0.5} unit="m" onChange={customDepth => updateObject(object.id, { customDepth })} />
          <NumberField label="高" value={object.customHeight ?? 0.5} step={0.1} unit="m" onChange={customHeight => updateObject(object.id, { customHeight })} />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between"><h4 className="ui-section-title">樓梯</h4><button type="button" className="ui-btn-secondary h-8" onClick={() => handleAddStair(object.id)}>新增樓梯</button></div>
          {(object.stairs ?? []).map((stair, index) => <div key={stair.id} className="ui-card space-y-3 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-slate-500">{index + 1}</span>
              <select aria-label={`樓梯 ${index + 1} 方位`} className="ui-input flex-1" value={stair.side} onChange={event => handleUpdateStair(object.id, stair.id, { side: event.target.value as StairSide })}><option value="front">前側</option><option value="back">後側</option><option value="left">左側</option><option value="right">右側</option></select>
              <button type="button" className="ui-icon-btn text-red-600" aria-label="移除樓梯" onClick={() => handleRemoveStair(object.id, stair.id)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="位置" value={stair.offset} min={-5} max={5} step={0.1} unit="m" onChange={offset => handleUpdateStair(object.id, stair.id, { offset })} />
              <NumberField label="寬度" value={stair.width} step={0.1} unit="m" onChange={width => handleUpdateStair(object.id, stair.id, { width })} />
            </div>
          </div>)}
          {!object.stairs?.length && <p className="text-xs text-slate-500">尚未新增樓梯</p>}
        </div>
      </section>}
      {(object.type === ObjectType.SPEAKER_15 || object.type === ObjectType.LIGHT_STAND) && <section className="space-y-3">
        <h3 className="ui-section-title">支架底座</h3>
        <div className="ui-segmented flex w-full">
          <button type="button" className="ui-segment flex-1" aria-pressed={!object.standType || object.standType === 'TRIPOD'} onClick={() => updateObject(object.id, { standType: 'TRIPOD' })}>腳架</button>
          <button type="button" className="ui-segment flex-1" aria-pressed={object.standType === 'PLATE'} onClick={() => updateObject(object.id, { standType: 'PLATE' })}>鐵板</button>
        </div>
      </section>}
      {object.type === ObjectType.TRUSS_STRUCTURE && object.trussStructure && (() => {
        const dimensions = getTrussDimensions(object.trussStructure);
        return <section className="space-y-3">
          <h3 className="ui-section-title">Truss 結構</h3>
          <div className="ui-card space-y-3 p-3">
            <p className="text-sm font-medium">{formatTrussTitle(object.trussStructure)}</p>
            <p className="text-xs text-slate-500">實際外徑：{object.trussStructure.kind === 'TOWER' ? `高 ${dimensions.heightCm}` : `寬 ${dimensions.widthCm} × 高 ${dimensions.heightCm}${object.trussStructure.kind === 'BACKDROP' ? ` × 深 ${dimensions.depthCm ?? 0}` : ''}`} 公分</p>
            <button type="button" className="ui-btn-secondary w-full" onClick={() => onEditTrussStructure(object)}>編輯結構</button>
          </div>
          <button type="button" role="switch" aria-checked={!!object.trussSchematicColors} aria-label="段長配色" className="flex min-h-10 w-full items-center justify-between rounded-lg text-sm text-slate-700" onClick={() => updateObject(object.id, { trussSchematicColors: !object.trussSchematicColors })}>
            段長配色<span className={`flex h-6 w-11 items-center rounded-full p-1 ${object.trussSchematicColors ? 'bg-slate-700' : 'bg-slate-200'}`}><span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${object.trussSchematicColors ? 'translate-x-5' : ''}`} /></span>
          </button>
        </section>;
      })()}
    </>}
  </div>;
};
