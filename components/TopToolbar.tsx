import React from 'react';
import {
  PenTool, Eraser,
  Undo2, Redo2,
  Upload, Download, PlusSquare,
  SunMedium, Moon, Image as ImageIcon,
  LayoutGrid, ArrowDownToLine, Tv, PanelLeft,
  Plus, Settings, ChevronLeft, FileText,
  Tag,
} from 'lucide-react';
import { PRESET_VIEWS } from '../constants';

interface TopToolbarProps {
  mode: 'EDIT' | 'VIEW';
  setMode: (m: 'EDIT' | 'VIEW') => void;
  isDrawMode: boolean;
  setIsDrawMode: (v: boolean) => void;
  drawingColor: string;
  setDrawingColor: (c: string) => void;
  clearDrawings: () => void;
  setSelectedIds: (ids: Set<string>) => void;
  handleImportClick: () => void;
  exportScene: () => void;
  setShowBatchModal: (v: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  viewIndex: number;
  setViewIndex: (idx: number) => void;
  viewEnvironment: 'day' | 'night';
  setViewEnvironment: React.Dispatch<React.SetStateAction<'day' | 'night'>>;
  takeScreenshot: () => void;
  // Panel toggles
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  addPanelOpen: boolean;
  setAddPanelOpen: (v: boolean) => void;
  onBackToList?: () => void;
  hasTrussStructures: boolean;
  onOpenTrussSheets: () => void;
  showLabels: boolean;
  setShowLabels: (v: boolean) => void;
}

const PRESET_VIEW_ICONS = [
  <LayoutGrid className="w-3.5 h-3.5" />,
  <ArrowDownToLine className="w-3.5 h-3.5" />,
  <Tv className="w-3.5 h-3.5" />,
  <PanelLeft className="w-3.5 h-3.5" />,
];

const DRAW_COLORS = ['#3b82f6', '#ef4444', '#eab308', '#22c55e'];

const IconBtn: React.FC<{
  onClick: () => void;
  title: string;
  'aria-label'?: string;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, title, 'aria-label': ariaLabel, disabled, active, children, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={ariaLabel || title}
    aria-pressed={active !== undefined ? active : undefined}
    disabled={disabled}
    className={`h-7 px-1.5 min-w-[28px] flex items-center justify-center rounded transition-colors flex-shrink-0 select-none
      ${active ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700/20' : 'text-slate-600 hover:bg-slate-200 hover:text-blue-600'}
      ${disabled ? 'opacity-30 pointer-events-none' : ''}
      ${className}`}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-5 bg-slate-300 mx-1 flex-shrink-0" />;

export const TopToolbar: React.FC<TopToolbarProps> = ({
  mode, setMode,
  isDrawMode, setIsDrawMode, drawingColor, setDrawingColor, clearDrawings, setSelectedIds,
  handleImportClick, exportScene, setShowBatchModal,
  undo, redo, canUndo, canRedo,
  viewIndex, setViewIndex, viewEnvironment, setViewEnvironment, takeScreenshot,
  panelOpen, setPanelOpen, addPanelOpen, setAddPanelOpen, onBackToList,
  hasTrussStructures, onOpenTrussSheets,
  showLabels, setShowLabels,
}) => {

  return (
    <div
      className="h-12 bg-[#f5f5f5] border-b border-slate-300 flex items-center px-2 gap-1 flex-shrink-0 select-none overflow-x-auto"
      style={{ minHeight: 48, maxHeight: 48 }}
    >
      {/* Left: Back + Logo + Mode */}
      {onBackToList && (
        <IconBtn onClick={onBackToList} title="返回場景列表" aria-label="返回場景列表">
          <ChevronLeft className="w-3.5 h-3.5" />
        </IconBtn>
      )}
      <span className="text-xs font-bold text-slate-700 whitespace-nowrap px-1 hidden sm:block">Banquet 3D</span>
      <span className="text-xs font-bold text-slate-700 whitespace-nowrap px-1 sm:hidden">B3D</span>
      <Divider />
      <div className="flex items-center bg-slate-200 rounded h-7 p-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => setMode('EDIT')}
          aria-label="編輯模式"
          aria-pressed={mode === 'EDIT'}
          className={`px-3 h-6 text-[10px] font-bold rounded transition-colors ${mode === 'EDIT' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-200' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setMode('VIEW')}
          aria-label="預覽模式"
          aria-pressed={mode === 'VIEW'}
          className={`px-3 h-6 text-[10px] font-bold rounded transition-colors ${mode === 'VIEW' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-200' : 'text-slate-400 hover:text-slate-600'}`}
        >
          View
        </button>
      </div>
      <Divider />

      {/* Center: mode-dependent */}
      <div className="flex items-center gap-0.5 flex-1 justify-center min-w-max">
        {mode === 'EDIT' ? (
          <>
            {/* Add panel toggle — mobile */}
            <button
              type="button"
              onClick={() => setAddPanelOpen(!addPanelOpen)}
              aria-label={addPanelOpen ? '收合新增面板' : '展開新增面板'}
              aria-pressed={addPanelOpen}
              className={`md:hidden flex items-center gap-1 px-2 h-7 text-[10px] font-semibold rounded transition-colors ${addPanelOpen ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </>
        ) : (
          <div className="flex items-center gap-0.5 flex-nowrap min-w-0">
            {/* Day / Night toggle */}
            <IconBtn
              onClick={() => setViewEnvironment(prev => (prev === 'day' ? 'night' : 'day'))}
              title={viewEnvironment === 'day' ? '切換夜間模式' : '切換日間模式'}
              aria-label={viewEnvironment === 'day' ? '切換夜間模式' : '切換日間模式'}
              active={viewEnvironment === 'night'}
            >
              {viewEnvironment === 'day' ? <SunMedium className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline text-[11px] font-medium ml-1 whitespace-nowrap">
                {viewEnvironment === 'day' ? '日間' : '夜間'}
              </span>
            </IconBtn>

            <Divider />

            {/* View presets */}
            {PRESET_VIEWS.map((v, idx) => {
              const shortName = v.name.split(' ')[0] || v.name;
              return (
                <IconBtn
                  key={idx}
                  onClick={() => setViewIndex(idx)}
                  title={v.name}
                  aria-label={`視角：${v.name}`}
                  active={viewIndex === idx}
                >
                  {PRESET_VIEW_ICONS[idx]}
                  <span className="hidden md:inline text-[11px] font-medium ml-1 whitespace-nowrap">
                    {shortName}
                  </span>
                </IconBtn>
              );
            })}

            <Divider />

            {/* Labels toggle */}
            <IconBtn
              onClick={() => setShowLabels(!showLabels)}
              title={showLabels ? '隱藏標籤 (Labels)' : '顯示標籤 (Labels)'}
              aria-label={showLabels ? '隱藏 3D 物件標籤' : '顯示 3D 物件標籤'}
              active={showLabels}
            >
              <Tag className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px] font-medium ml-1 whitespace-nowrap">
                標籤
              </span>
            </IconBtn>

            <Divider />

            {/* Screenshot */}
            <IconBtn
              onClick={takeScreenshot}
              title="截圖 (Screenshot)"
              aria-label="擷取場景畫面"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="hidden lg:inline text-[11px] font-medium ml-1 whitespace-nowrap">
                截圖
              </span>
            </IconBtn>
          </div>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-0 flex-shrink-0">
        {mode === 'EDIT' && (
          <>
            {/* Drawing tools — hidden on small screens */}
            <div className="hidden sm:flex items-center gap-0.5">
              <IconBtn
                onClick={() => { setIsDrawMode(!isDrawMode); setSelectedIds(new Set()); }}
                title={isDrawMode ? '關閉繪圖' : '手繪標註'}
                aria-label={isDrawMode ? '關閉繪圖標註' : '手繪標註'}
                active={isDrawMode}
              >
                <PenTool className="w-3.5 h-3.5" />
              </IconBtn>
              <IconBtn onClick={clearDrawings} title="清除標註" aria-label="清除標註">
                <Eraser className="w-3.5 h-3.5" />
              </IconBtn>
              <div className="hidden lg:flex items-center gap-0.5 mx-0.5">
                {DRAW_COLORS.map(c => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setDrawingColor(c)}
                    title={c}
                    aria-label={`選擇標註顏色 ${c}`}
                    className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${drawingColor === c ? 'border-slate-700 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Divider />
            </div>
          </>
        )}
        <IconBtn onClick={undo} title="復原 (Ctrl+Z)" aria-label="復原 (Ctrl+Z)" disabled={!canUndo}>
          <Undo2 className="w-3.5 h-3.5" />
        </IconBtn>
        <IconBtn onClick={redo} title="重做 (Ctrl+Shift+Z)" aria-label="重做 (Ctrl+Shift+Z)" disabled={!canRedo}>
          <Redo2 className="w-3.5 h-3.5" />
        </IconBtn>
        <Divider />
        <div className="hidden sm:flex items-center gap-0.5">
          <IconBtn onClick={handleImportClick} title="匯入場景" aria-label="匯入場景">
            <Upload className="w-3.5 h-3.5" />
          </IconBtn>
          <IconBtn onClick={exportScene} title="匯出場景" aria-label="匯出場景">
            <Download className="w-3.5 h-3.5" />
          </IconBtn>
          <IconBtn onClick={onOpenTrussSheets} title="結構圖" aria-label="結構圖" disabled={!hasTrussStructures}>
            <FileText className="w-3.5 h-3.5" />
          </IconBtn>
        </div>
        {mode === 'EDIT' && (
          <>
            <IconBtn onClick={() => setShowBatchModal(true)} title="批次新增" aria-label="批次新增" className="hidden sm:flex">
              <PlusSquare className="w-3.5 h-3.5" />
            </IconBtn>
          </>
        )}
        {mode === 'EDIT' && (
          <>
            <Divider />
            {/* Panel toggle */}
            <IconBtn
              onClick={() => setPanelOpen(!panelOpen)}
              title={panelOpen ? '收合面板' : '展開面板'}
              aria-label={panelOpen ? '收合面板' : '展開面板'}
              active={panelOpen}
            >
              <Settings className="w-3.5 h-3.5" />
            </IconBtn>
          </>
        )}
      </div>
    </div>
  );
};
