import React from 'react';
import {
  Move, RotateCw, ArrowUpDown, Magnet, Copy, Trash2, X,
} from 'lucide-react';
import { EditTool } from '../interaction';

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

export const EditorControls: React.FC<EditorControlsProps> = ({
  tool,
  setTool,
  snapStep,
  setSnapStep,
  selectedCount,
  isPlacing,
  placementLabel,
  onCancel,
  busy,
  onDuplicate,
  onDelete,
}) => {
  const manipulationHint = isPlacing
    ? '點擊地面放置物件 ｜ 按 Esc 取消'
    : tool === 'move'
    ? '拖曳物件移動位置 (XZ) ｜ 方向鍵微調 (Shift×10)'
    : tool === 'rotate'
    ? '水平拖曳物件旋轉 (Yaw) ｜ ←→ 鍵微調 (Shift×10)'
    : '垂直拖曳物件調整高度 (Y) ｜ ↑↓ 鍵微調 (Shift×10)';

  return (
    <div className="pointer-events-auto w-full max-w-2xl mx-auto bg-white/95 backdrop-blur-xs rounded-xl shadow-lg border border-slate-200/90 p-1.5 sm:p-2 flex flex-col gap-1.5">
      {/* Main controls row */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          {/* Tool selector buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60" role="toolbar" aria-label="3D 編輯工具">
            <button
              type="button"
              onClick={() => setTool('move')}
              disabled={busy}
              aria-label="移動工具 (G)"
              aria-pressed={tool === 'move'}
              title="移動工具 (G) — 水平拖曳物件位置"
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                tool === 'move'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Move className="w-3.5 h-3.5" />
              <span>移動</span>
              <kbd className={`text-[9px] px-1 py-0.2 rounded font-mono ${tool === 'move' ? 'bg-blue-700/60 text-blue-100' : 'bg-slate-200 text-slate-500'}`}>G</kbd>
            </button>

            <button
              type="button"
              onClick={() => setTool('rotate')}
              disabled={busy}
              aria-label="旋轉工具 (R)"
              aria-pressed={tool === 'rotate'}
              title="旋轉工具 (R) — 水平拖曳旋轉物件"
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                tool === 'rotate'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>旋轉</span>
              <kbd className={`text-[9px] px-1 py-0.2 rounded font-mono ${tool === 'rotate' ? 'bg-blue-700/60 text-blue-100' : 'bg-slate-200 text-slate-500'}`}>R</kbd>
            </button>

            <button
              type="button"
              onClick={() => setTool('height')}
              disabled={busy}
              aria-label="高度工具 (H)"
              aria-pressed={tool === 'height'}
              title="高度工具 (H) — 垂直拖曳調整高度"
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                tool === 'height'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>高度</span>
              <kbd className={`text-[9px] px-1 py-0.2 rounded font-mono ${tool === 'height' ? 'bg-blue-700/60 text-blue-100' : 'bg-slate-200 text-slate-500'}`}>H</kbd>
            </button>
          </div>

          {/* Snap selection */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600">
            <Magnet className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={snapStep}
              onChange={(e) => setSnapStep(Number(e.target.value))}
              disabled={busy}
              title={snapStep > 0 ? '網格吸附；旋轉每格 15°' : '自由移動與旋轉；方向鍵旋轉每次 1°'}
              aria-label="網格吸附設定"
              className="bg-transparent border-none text-xs text-slate-700 focus:outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-medium pr-1"
            >
              <option value={0}>吸附: 關閉</option>
              <option value={0.1}>網格 0.1m</option>
              <option value={0.5}>網格 0.5m</option>
              <option value={1}>網格 1.0m</option>
            </select>
            <span
              className={`text-[10px] px-1 py-0.5 rounded font-medium shrink-0 ${
                snapStep > 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-200 text-slate-500'
              }`}
              title={snapStep > 0 ? '旋轉吸附 15° 已啟用' : '自由旋轉；方向鍵每次 1°'}
            >
              {snapStep > 0 ? '旋轉 15°' : '自由旋轉'}
            </span>
          </div>

          {/* Placement or Selection actions */}
          <div className="flex items-center gap-1.5 ml-auto">
            {isPlacing ? (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2 py-0.5">
                <span className="text-xs font-semibold text-blue-700 truncate max-w-[120px] sm:max-w-[180px]">
                  放置：{placementLabel || '物件'}
                </span>
                <button
                  type="button"
                  onClick={onCancel}
                  aria-label="取消放置 (Esc)"
                  title="取消放置 (Esc)"
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-medium transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>取消</span>
                  <kbd className="text-[9px] font-mono text-blue-600">Esc</kbd>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500 px-1 whitespace-nowrap">
                  {selectedCount > 0 ? `已選 ${selectedCount} 個` : '未選取'}
                </span>
                {busy && (
                  <button type="button" onClick={onCancel} aria-label="取消操作 (Esc)" className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">
                    取消 · Esc
                  </button>
                )}
                {selectedCount > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={onDuplicate}
                      disabled={busy}
                      aria-label="再製選取物件 (Ctrl+D)"
                      title="再製選取物件 (Ctrl+D / Cmd+D)"
                      className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">再製</span>
                    </button>
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={busy}
                      aria-label="刪除選取物件 (Delete)"
                      title="刪除選取物件 (Delete / Backspace)"
                      className="flex items-center gap-1 px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">刪除</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* On-screen context hint */}
        <div className="text-[10px] sm:text-[11px] text-slate-500 border-t border-slate-100 pt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2 leading-tight">
          <div className="text-slate-700 font-medium truncate">
            {manipulationHint}
          </div>
          <div className="text-slate-400 text-[9px] sm:text-[10px] flex items-center gap-1.5 flex-wrap shrink-0">
            <span>空白拖曳：旋轉視角</span>
            <span>·</span>
            <span>右鍵/雙指：平移</span>
            <span>·</span>
            <span>滾輪/捏合：縮放</span>
          </div>
        </div>
    </div>
  );
};
