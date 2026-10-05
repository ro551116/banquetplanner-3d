import React from 'react';
import { Move, RotateCw, ArrowUpDown, Copy, Trash2 } from 'lucide-react';
import { EditTool } from '../interaction';

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
}

export const EditorControls: React.FC<EditorControlsProps> = props => {
  const { selectedCount, isPlacing, placementLabel, onCancel, busy, onDuplicate, onDelete } = props;
  return <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-max max-w-[calc(100%_-_1.5rem)] rounded-xl bg-white shadow-lg ring-1 ring-slate-200 px-2 py-1.5 ${!isPlacing && !selectedCount ? 'lg:hidden' : ''}`}>
    {(isPlacing || selectedCount > 0) && <div className="flex flex-wrap items-center justify-center gap-2">
      {isPlacing ? <><span className="text-sm font-medium">放置中：{placementLabel}</span><span className="text-xs text-slate-500">點擊地面放置</span><button className="ui-btn-secondary h-8 coarse:h-10" onClick={onCancel}>取消<kbd className="ui-kbd">Esc</kbd></button></> : <><span className="text-sm font-medium whitespace-nowrap">已選 {selectedCount} 個</span><button className="ui-btn-secondary h-8 coarse:h-10" disabled={busy} onClick={onDuplicate}><Copy size={16} />再製</button><button className="ui-btn-danger h-8 coarse:h-10" disabled={busy} onClick={onDelete}><Trash2 size={16} />刪除</button></>}
    </div>}
    <div className={`flex flex-wrap items-center justify-center gap-2 lg:hidden ${isPlacing || selectedCount > 0 ? 'mt-2' : ''}`}><ToolControls {...props} /></div>
  </div>;
};
