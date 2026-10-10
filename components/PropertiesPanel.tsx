import React from 'react';
import { MousePointer2, Trash2, X } from 'lucide-react';
import { ObjectType } from '../types';
import type { BanquetObject, DeviceSystem, LightMount, StairConfig, StairSide, TableCloth } from '../types';
import { TABLE_PRESETS, TABLE_CLOTH_MATERIALS } from '../constants';
import { formatTrussTitle, getTrussDimensions } from '../trussConfig';
import { DEVICE_SYSTEM_ORDER, DEVICE_SYSTEMS, getRoundTableSpec, getSeating, getTableTop, isMountedOn, isOnTable, isPathType, LIGHT_MOUNT_LABELS, MAX_ROUND_TABLE_SEATS, nextDeviceCode, pathLength, TRUSS_MOUNT_TYPES } from '../planning';
import { OBJECT_TYPE_META, getObjectDisplayName } from './objectTypeMeta';
import { NumberField, TextField } from './ui/NumberField';

type SizeKey = 'customWidth' | 'customDepth' | 'customHeight';
interface SizeField { key: SizeKey; label: string; fallback: number; min?: number; max?: number; step?: number }

/** Dimension fields per type; defaults mirror createObjectConfig and the models. */
const SIZE_FIELDS: Partial<Record<ObjectType, SizeField[]>> = {
  [ObjectType.DOOR]: [{ key: 'customWidth', label: '寬', fallback: 1.8, min: 0.6, max: 8 }, { key: 'customHeight', label: '高', fallback: 2.4, min: 1.8, max: 6 }],
  [ObjectType.COLUMN]: [{ key: 'customWidth', label: '寬', fallback: 0.6, max: 5 }, { key: 'customDepth', label: '深', fallback: 0.6, max: 5 }, { key: 'customHeight', label: '高', fallback: 5, min: 1, max: 50 }],
  [ObjectType.EASEL]: [{ key: 'customWidth', label: '畫板寬', fallback: 0.6, min: 0.3, max: 1.5 }, { key: 'customHeight', label: '畫板高', fallback: 0.9, min: 0.3, max: 1.8 }],
  [ObjectType.KIOSK]: [{ key: 'customWidth', label: '寬', fallback: 0.6, min: 0.3, max: 4 }, { key: 'customDepth', label: '深', fallback: 0.6, min: 0.3, max: 4 }, { key: 'customHeight', label: '高', fallback: 1.7, min: 0.5, max: 3 }],
  [ObjectType.GENERATOR]: [{ key: 'customWidth', label: '長', fallback: 2.2, min: 0.5, max: 12 }, { key: 'customDepth', label: '深', fallback: 0.95, min: 0.4, max: 4 }, { key: 'customHeight', label: '高', fallback: 1.2, min: 0.4, max: 4 }],
  [ObjectType.CABLE_RAMP]: [{ key: 'customWidth', label: '總長', fallback: 0.9, min: 0.9, max: 30, step: 0.9 }],
  [ObjectType.SERVICE_STATION]: [{ key: 'customWidth', label: '長', fallback: 1.8, min: 0.9, max: 8 }],
  [ObjectType.BAR_COUNTER]: [{ key: 'customWidth', label: '長', fallback: 2.4, min: 1, max: 12 }],
  [ObjectType.ZONE]: [{ key: 'customWidth', label: '寬', fallback: 3, max: 100 }, { key: 'customDepth', label: '深', fallback: 2, max: 100 }],
  [ObjectType.WALL]: [{ key: 'customWidth', label: '厚度', fallback: 0.12, min: 0.03, max: 1, step: 0.01 }, { key: 'customHeight', label: '高', fallback: 3, min: 0.3, max: 20 }],
};

const FLOW_PRESETS = [
  { label: '新人進場', color: '#db2777' },
  { label: '出菜動線', color: '#ea580c' },
  { label: '賓客動線', color: '#2563eb' },
  { label: '撤場動線', color: '#64748b' },
];

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (value: T) => void }) {
  return <div className="space-y-1.5">
    <p className="ui-label">{label}</p>
    <div className="ui-segmented flex w-full" role="group" aria-label={label}>
      {options.map(([option, text]) => <button type="button" key={String(option)} className="ui-segment flex-1" aria-pressed={value === option} onClick={() => onChange(option)}>{text}</button>)}
    </div>
  </div>;
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="flex min-h-10 w-full items-center justify-between rounded-lg text-sm text-slate-700" onClick={() => onChange(!checked)}>
    {label}<span className={`flex h-6 w-11 items-center rounded-full p-1 ${checked ? 'bg-slate-700' : 'bg-slate-200'}`}><span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`} /></span>
  </button>;
}

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
  /** Path objects: draw the polyline again, keeping every other property. */
  onRedrawPath: (object: BanquetObject) => void;
  /** Adds a tabletop number plate (with the table's label) to each given table that has none. */
  onAddTableNumbers: (tableIds: Set<string>) => void;
  /** Puts a light back on the floor or clamps it to the nearest truss beam, upright or inverted. */
  onRemountLight: (id: string, mount: LightMount) => void;
}

// Maps to (-180, 180] so dragging the slider to its right end shows 180° instead of jumping to -180°.
const wrapDegrees = (radians: number) => 180 - ((((180 - radians * 180 / Math.PI) % 360) + 360) % 360);

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedIds, objects, updateObject, deleteSelected, handleBulkPropertyUpdate, handleAddStair, handleRemoveStair, handleUpdateStair, onEditTrussStructure, onRedrawPath, onAddTableNumbers, onRemountLight }) => {
  const count = selectedIds.size;
  const object = count === 1 ? objects.find(item => selectedIds.has(item.id)) : undefined;
  if (count === 0) return null;
  const meta = object ? OBJECT_TYPE_META[object.type] : undefined;
  const Icon = meta?.Icon ?? MousePointer2;
  const isLight = object?.type.includes('LIGHT');
  const pan = object ? wrapDegrees(object.rotation.y) : 0;
  // A fixture hung upside down tilts the other way; flipping the shown value keeps the slider moving the beam the same way.
  const tiltSign = object?.mount === 'inverted' && TRUSS_MOUNT_TYPES[object.type] ? -1 : 1;
  const tilt = object ? Math.max(-90, Math.min(90, tiltSign * wrapDegrees(object.rotation.x ?? 0))) : 0;
  const seating = object ? getSeating(object) : null;
  const sizeFields = object ? (SIZE_FIELDS[object.type] ?? []).filter(field => !(object.type === ObjectType.COLUMN && object.shape === 'round' && field.key === 'customDepth'))
    .map(field => object.type === ObjectType.COLUMN && object.shape === 'round' && field.key === 'customWidth' ? { ...field, label: '直徑' } : field) : [];
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
    {count > 1 && (() => {
      const tables = objects.filter(item => selectedIds.has(item.id) && getTableTop(item));
      return tables.length > 0 && <button type="button" className="ui-btn-secondary w-full" onClick={() => onAddTableNumbers(new Set(tables.map(table => table.id)))}>為 {tables.length} 張桌子加上桌號牌</button>;
    })()}
    {object && <>
      <TextField key={`name-${object.id}`} label="名稱" value={object.label ?? ''} placeholder={meta?.label} onChange={label => updateObject(object.id, { label })} />
      <TextField key={`note-${object.id}`} label="備註" value={object.note ?? ''} placeholder="例如：13:30 需撤離" onChange={note => updateObject(object.id, { note })} />
      {(object.type === ObjectType.EASEL || object.type === ObjectType.KIOSK || object.type === ObjectType.TABLE_NUMBER) && <p className="-mt-3 text-xs text-slate-500">{object.type === ObjectType.EASEL ? '畫板' : object.type === ObjectType.KIOSK ? '機台招牌' : '牌面'}文字使用「名稱」</p>}
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
        {object && TRUSS_MOUNT_TYPES[object.type] && (() => {
          const mount = object.mount ?? 'floor';
          const truss = mount === 'floor' ? undefined : objects.find(item => isMountedOn(object, item));
          return <div className="space-y-1.5">
            <Segmented label="安裝方式" value={mount} options={Object.entries(LIGHT_MOUNT_LABELS) as Array<[LightMount, string]>} onChange={next => onRemountLight(object.id, next)} />
            {mount !== 'floor' && <p className="text-xs text-slate-600">{truss
              ? `夾在「${getObjectDisplayName(truss)}」橫梁上，移動或旋轉 truss 時會一起移動。`
              : '沒有對準 truss 橫梁；再點一次安裝方式可吸附到 2 公尺內最近的橫梁。'}</p>}
          </div>;
        })()}
        {isLight && <>
          <div className="space-y-3">
            <NumberField label="仰角" value={tilt} min={-90} max={90} step={1} precision={0} unit="°" onChange={value => updateObject(object.id, { rotation: { ...object.rotation, x: tiltSign * value * Math.PI / 180 } })} />
            <input aria-label="仰角" type="range" min={-90} max={90} step={1} value={tilt} className="h-6 w-full cursor-pointer accent-blue-600 coarse:h-10" onChange={event => updateObject(object.id, { rotation: { ...object.rotation, x: tiltSign * Number(event.target.value) * Math.PI / 180 } }, `${object.id}:rotation.x`)} />
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
      {(object.type === ObjectType.ROUND_TABLE || object.type === ObjectType.RECT_TABLE || object.type === ObjectType.CHAMPAGNE_TOWER || object.type === ObjectType.SERVICE_STATION) && <section className="space-y-4">
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
      {object.type === ObjectType.RECT_TABLE && <section className="space-y-3">
        <h3 className="ui-section-title">長桌尺寸</h3>
        <select aria-label="長桌尺寸" value={object.customSize ?? 6} className="ui-input" onChange={event => updateObject(object.id, { customSize: Number(event.target.value) })}>
          <option value={6}>6 尺（180 cm）</option><option value={8}>8 尺（240 cm）</option>
        </select>
      </section>}
      {seating && <section className="space-y-4">
        <h3 className="ui-section-title">座位</h3>
        {object.type === ObjectType.ROUND_TABLE ? <div className="space-y-2">
          <NumberField label="座位數" value={seating.seats} min={0} max={MAX_ROUND_TABLE_SEATS} step={1} precision={0} unit="位" onChange={seatCount => updateObject(object.id, { seatCount })} />
          {object.seatCount !== undefined && object.seatCount !== getRoundTableSpec(object.customSize).chairs && <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => updateObject(object.id, { seatCount: undefined })}>恢復預設 {getRoundTableSpec(object.customSize).chairs} 位</button>}
        </div> : <Segmented label="座椅" value={object.chairLayout ?? 'both'} options={[['both', '兩側'], ['front', '單側'], ['none', '無椅']]} onChange={chairLayout => updateObject(object.id, { chairLayout })} />}
        {seating.seats > 0 && <div className="grid grid-cols-2 gap-3">
          <NumberField label="兒童椅" value={seating.childSeats} min={0} max={seating.seats} step={1} precision={0} unit="位" onChange={childSeats => updateObject(object.id, { childSeats })} />
          <NumberField label="素食" value={seating.vegetarianSeats} min={0} max={seating.seats} step={1} precision={0} unit="位" onChange={vegetarianSeats => updateObject(object.id, { vegetarianSeats })} />
        </div>}
        <Switch label="備桌（不計入桌數）" checked={!!object.standby} onChange={standby => updateObject(object.id, { standby })} />
      </section>}
      {getTableTop(object) && (() => {
        const plate = objects.find(item => isOnTable(item, object));
        return <section className="space-y-2">
          <h3 className="ui-section-title">桌號牌</h3>
          {plate ? <p className="text-xs text-slate-600">桌上已有桌號牌「{plate.label?.trim() || '桌號'}」，移動或旋轉桌子時會一起移動。</p>
            : <button type="button" className="ui-btn-secondary w-full" onClick={() => onAddTableNumbers(new Set([object.id]))}>加上桌號牌</button>}
        </section>;
      })()}
      {object.type === ObjectType.TABLE_NUMBER && <Segmented label="款式" value={object.plateStyle ?? 'table'} options={[['table', '桌上立牌'], ['floor', '落地立牌']]} onChange={plateStyle => updateObject(object.id, { plateStyle })} />}
      {object.type === ObjectType.CHAIR && <section className="space-y-3">
        <h3 className="ui-section-title">椅子</h3>
        <Segmented label="款式" value={object.chairStyle ?? 'banquet'} options={[['banquet', '宴會椅'], ['child', '兒童椅']]} onChange={chairStyle => updateObject(object.id, { chairStyle })} />
      </section>}
      {object.type === ObjectType.DOOR && <Segmented label="門扇" value={object.doorLeaves ?? 2} options={[[1, '單開'], [2, '雙開']]} onChange={doorLeaves => updateObject(object.id, { doorLeaves })} />}
      {(object.type === ObjectType.COLUMN || object.type === ObjectType.ZONE) && <Segmented label="形狀" value={object.shape ?? 'rect'} options={object.type === ObjectType.COLUMN ? [['rect', '方柱'], ['round', '圓柱']] : [['rect', '矩形'], ['round', '橢圓']]} onChange={shape => updateObject(object.id, { shape })} />}
      {sizeFields.length > 0 && <section className="space-y-3">
        <h3 className="ui-section-title">尺寸</h3>
        <div className={`grid gap-3 ${sizeFields.length === 3 ? 'grid-cols-3' : sizeFields.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {sizeFields.map(({ key, label, fallback, min = 0.1, max, step = 0.1 }) => <NumberField key={key} label={label} value={object[key] ?? fallback} min={min} max={max} step={step} unit="m" onChange={value => updateObject(object.id, { [key]: value })} />)}
        </div>
      </section>}
      {object.type === ObjectType.CHAMPAGNE_TOWER && <section className="space-y-3">
        <h3 className="ui-section-title">香檳塔</h3>
        <NumberField label="層數" value={object.tiers ?? 5} min={3} max={7} step={1} precision={0} unit="層" onChange={tiers => updateObject(object.id, { tiers })} />
        <p className="text-xs text-slate-500">共 {Array.from({ length: Math.max(3, Math.min(7, Math.round(object.tiers ?? 5))) }, (_, index) => (index + 1) ** 2).reduce((sum, glasses) => sum + glasses, 0)} 杯</p>
      </section>}
      {(object.type === ObjectType.GENERATOR || object.type === ObjectType.POWER_DISTRO) && <section className="space-y-3">
        <h3 className="ui-section-title">電力</h3>
        <NumberField label="容量" value={object.powerKva ?? 0} min={0} max={2000} step={5} precision={0} unit="kVA" onChange={powerKva => updateObject(object.id, { powerKva: powerKva > 0 ? powerKva : undefined })} />
      </section>}
      {object.type === ObjectType.POWER_OUTLET && <Segmented label="電壓" value={object.voltage ?? '110V'} options={[['110V', '110V'], ['220V', '220V']]} onChange={voltage => updateObject(object.id, { voltage })} />}
      {object.type === ObjectType.DEVICE_POINT && <section className="space-y-3">
        <h3 className="ui-section-title">點位</h3>
        <div className="space-y-1.5">
          <label className="ui-label" htmlFor={`system-${object.id}`}>系統</label>
          <select id={`system-${object.id}`} className="ui-input" value={object.system ?? 'other'} onChange={event => {
            const system = event.target.value as DeviceSystem;
            // A generated code (PREFIX-NN) follows the new system; a hand-written code is kept.
            const generated = /^[A-Za-z]+-\d+$/.test(object.label?.trim() ?? '');
            updateObject(object.id, { system, color: DEVICE_SYSTEMS[system].color, ...(generated ? { label: nextDeviceCode(objects.filter(item => item.id !== object.id), system) } : {}) });
          }}>
            {DEVICE_SYSTEM_ORDER.map(system => <option key={system} value={system}>{DEVICE_SYSTEMS[system].label}</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-500">編號即「名稱」；高度 Y 可設成安裝高度（例如天花 AP 2.8 m）。</p>
      </section>}
      {isPathType(object.type) && <section className="space-y-3">
        <h3 className="ui-section-title">{object.type === ObjectType.DIMENSION ? '標註' : '路徑'}</h3>
        <p className="text-sm tabular-nums text-slate-700">總長 {pathLength(object.points).toFixed(2)} m・{object.points?.length ?? 0} 個節點</p>
        {object.type === ObjectType.FLOW_ARROW && <div className="grid grid-cols-2 gap-2">
          {FLOW_PRESETS.map(preset => <button type="button" key={preset.label} className="ui-btn-secondary justify-start gap-2" aria-pressed={object.color === preset.color && object.label === preset.label} onClick={() => updateObject(object.id, { color: preset.color, label: preset.label })}>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: preset.color }} />{preset.label}
          </button>)}
        </div>}
        {object.type === ObjectType.DIMENSION && <p className="text-xs text-slate-500">名稱留空時顯示實際長度</p>}
        <button type="button" className="ui-btn-secondary w-full" onClick={() => onRedrawPath(object)}>重新繪製</button>
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
          <Switch label="段長配色" checked={!!object.trussSchematicColors} onChange={trussSchematicColors => updateObject(object.id, { trussSchematicColors })} />
        </section>;
      })()}
    </>}
  </div>;
};
