import React from 'react';
import { Move, RotateCw, ArrowUpDown, Copy, Trash2 } from 'lucide-react';
import { EditTool } from '../interaction';
import type { DeviceSystem } from '../types';
import { DEVICE_SYSTEM_ORDER, DEVICE_SYSTEMS } from '../planning';

export const EDIT_TOOLS = [
  { id: 'move', label: '移動', key: 'G', Icon: Move },
  { id: 'rotate', label: '旋轉', key: 'R', Icon: RotateCw },
  { id: 'height', label: '高度', key: 'H', Icon: ArrowUpDown },
] as const;

export function ToolControls({ tool, setTool, snapStep, setSnapStep }: Pick<EditorControlsProps, 'tool' | 'setTool' | 'snapStep' | 'setSnapStep'>) {
  return <>
    <div className="ui-segmented" aria-label="編輯工具">
      {EDIT_TOOLS.map(({ id, label, key, Icon }) => <button key={id} type="button" className="ui-segment coarse:h-10" aria-pressed={tool === id} title={`${label}（${key}）`} onClick={() => setTool(id)}>
        <Icon size={16} /><span>{label}</span><kbd className="ui-kbd">{key}</kbd>
      </button>)}
    </div>
    <select aria-label="吸附間距" className="ui-input h-8 coarse:h-10 w-auto" value={snapStep} onChange={event => setSnapStep(Number(event.target.value))}>
      <option value={0}>吸附：關</option><option value={0.1}>吸附：0.1 m</option><option value={0.5}>吸附：0.5 m</option><option value={1}>吸附：1 m</option>
    </select>
    {snapStep > 0 && <span className="text-xs text-slate-500 whitespace-nowrap">旋轉 15°</span>}
  </>;
}

export interface EditorControlsProps {
  tool: EditTool;
  setTool: (tool: EditTool) => void;
  snapStep: number;
  setSnapStep: (step: number) => void;
  selectedCount: number;
  isPlacing: boolean;
  placementLabel: string;
  onCancel: () => void;
  busy: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Present while drawing a path object or the hall outline (`closed`): vertex count and the finish/undo actions. */
  path?: { vertices: number; min: number; closed?: boolean; loop?: boolean; onFinish: () => void; onUndo: () => void };
  /** Present while placing device points: the system of the next point. */
  deviceSystem?: { value: DeviceSystem; onChange: (system: DeviceSystem) => void };
  /** Replaces 「點擊地面放置」 while placing, e.g. for tabletop plates. */
  placementHint?: string;
}

export const EditorControls: React.FC<EditorControlsProps> = props => {
  const { selectedCount, isPlacing, placementLabel, onCancel, busy, onDuplicate, onDelete, path, deviceSystem, placementHint } = props;
  const cancel = <button className="ui-btn-secondary h-8 coarse:h-10" onClick={onCancel}>取消<kbd className="ui-kbd">Esc</kbd></button>;
  return <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-max max-w-[calc(100%_-_1.5rem)] rounded-xl bg-white shadow-lg ring-1 ring-slate-200 px-2 py-1.5 ${!isPlacing && !selectedCount ? 'lg:hidden' : ''}`}>
    {(isPlacing || selectedCount > 0) && <div className="flex flex-wrap items-center justify-center gap-2">
      {isPlacing && path ? <>
        <span className="text-sm font-medium">繪製中：{placementLabel}</span>
        <span className="text-xs text-slate-500">{path.closed ? `點擊牆角加點（${path.vertices} 點）・Shift 鎖 45°・點第一點或 Enter 封閉` : `點擊地面加節點（${path.vertices} 點）・Shift 鎖 45°・Enter 或再點最後一點完成${path.loop ? '・點第一點圍成封閉' : ''}`}</span>
        <button className="ui-btn-secondary h-8 coarse:h-10" disabled={path.vertices === 0} onClick={path.onUndo}>復原節點<kbd className="ui-kbd">⌫</kbd></button>
        <button className="ui-btn-primary h-8 coarse:h-10" disabled={path.vertices < path.min} onClick={path.onFinish}>完成<kbd className="ui-kbd">Enter</kbd></button>
        {cancel}
      </> : isPlacing && deviceSystem ? <>
        <span className="text-sm font-medium">放置點位：{placementLabel}</span>
        <select aria-label="點位系統" className="ui-input h-8 w-auto coarse:h-10" value={deviceSystem.value} onChange={event => deviceSystem.onChange(event.target.value as DeviceSystem)}>
          {DEVICE_SYSTEM_ORDER.map(system => <option key={system} value={system}>{DEVICE_SYSTEMS[system].label}</option>)}
        </select>
        <span className="text-xs text-slate-500">連續點擊地面放置，編號自動遞增</span>
        <button className="ui-btn-secondary h-8 coarse:h-10" onClick={onCancel}>完成<kbd className="ui-kbd">Esc</kbd></button>
      </> : isPlacing ? <><span className="text-sm font-medium">放置中：{placementLabel}</span><span className="text-xs text-slate-500">{placementHint ?? '點擊地面放置'}</span>{cancel}</> : <><span className="text-sm font-medium whitespace-nowrap">已選 {selectedCount} 個</span><button className="ui-btn-secondary h-8 coarse:h-10" disabled={busy} onClick={onDuplicate}><Copy size={16} />再製</button><button className="ui-btn-danger h-8 coarse:h-10" disabled={busy} onClick={onDelete}><Trash2 size={16} />刪除</button></>}
    </div>}
    <div className={`flex flex-wrap items-center justify-center gap-2 lg:hidden ${isPlacing || selectedCount > 0 ? 'mt-2' : ''}`}><ToolControls {...props} /></div>
  </div>;
};
