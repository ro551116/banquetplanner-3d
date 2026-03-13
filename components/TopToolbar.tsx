import React, { useState } from 'react';
import {
  Disc, Maximize, Box, ScrollText,
  Music, MonitorPlay, MoveVertical,
  Lightbulb, Zap, GripHorizontal,
  PenTool, Eraser,
  Undo2, Redo2,
  Upload, Download, PlusSquare,
  SunMedium, Moon, Image as ImageIcon,
  LayoutGrid, ArrowDownToLine, Tv, PanelLeft,
  Plus, Settings,
} from 'lucide-react';
import { ObjectType } from '../types';
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
  addObject: (type: ObjectType, pos?: { x: number; y: number; z: number }) => any;
  setDraggedType: (type: ObjectType | null) => void;
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
  // Mobile panel toggle
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
}

const PRESET_VIEW_ICONS = [
  <LayoutGrid className="w-3.5 h-3.5" />,
  <ArrowDownToLine className="w-3.5 h-3.5" />,
  <Tv className="w-3.5 h-3.5" />,
  <PanelLeft className="w-3.5 h-3.5" />,
];

const DRAW_COLORS = ['#3b82f6', '#ef4444', '#eab308', '#22c55e'];

const ADD_ITEMS: { type: ObjectType; label: string; icon: React.ReactNode }[] = [
  { type: ObjectType.ROUND_TABLE, label: '圓桌', icon: <Disc className="w-3.5 h-3.5" /> },
  { type: ObjectType.RECT_TABLE, label: '長桌', icon: <Maximize className="w-3.5 h-3.5" /> },
  { type: ObjectType.STAGE, label: '舞台', icon: <Box className="w-3.5 h-3.5" /> },
  { type: ObjectType.RED_CARPET, label: '紅地毯', icon: <ScrollText className="w-3.5 h-3.5" /> },
  { type: ObjectType.SPEAKER_15, label: '15吋喇叭', icon: <Music className="w-3.5 h-3.5" /> },
  { type: ObjectType.SPEAKER_SUB, label: '超低音', icon: <Box className="w-3.5 h-3.5" /> },
  { type: ObjectType.SPEAKER_MONITOR, label: '監聽喇叭', icon: <MonitorPlay className="w-3.5 h-3.5" /> },
  { type: ObjectType.SPEAKER_COLUMN, label: '音柱喇叭', icon: <MoveVertical className="w-3.5 h-3.5" /> },
  { type: ObjectType.LIGHT_PAR, label: 'LED帕燈', icon: <Lightbulb className="w-3.5 h-3.5" /> },
  { type: ObjectType.LIGHT_MOVING, label: '電腦燈', icon: <Zap className="w-3.5 h-3.5" /> },
  { type: ObjectType.LIGHT_STAND, label: 'T型燈桿', icon: <GripHorizontal className="w-3.5 h-3.5" /> },
];

const DIVIDER_AFTER = [3, 7]; // indices after which to place a divider (furniture|audio|lighting)

const IconBtn: React.FC<{
  onClick: () => void;
  title: string;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, title, disabled, active, children, className = '' }) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`w-7 h-7 flex items-center justify-center rounded transition-colors flex-shrink-0
      ${active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200 hover:text-blue-600'}
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
  addObject, setDraggedType,
  handleImportClick, exportScene, setShowBatchModal,
  undo, redo, canUndo, canRedo,
  viewIndex, setViewIndex, viewEnvironment, setViewEnvironment, takeScreenshot,
  panelOpen, setPanelOpen,
}) => {
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const handleAdd = (type: ObjectType) => {
    addObject(type);
    setIsDrawMode(false);
    setAddMenuOpen(false);
  };

  return (
    <div className="h-12 bg-[#f5f5f5] border-b border-slate-300 flex items-center px-2 gap-1 flex-shrink-0 select-none" style={{ minHeight: 48, maxHeight: 48 }}>
      {/* Left: Logo + Mode */}
      <span className="text-xs font-bold text-slate-700 whitespace-nowrap px-1 hidden sm:block">Banquet 3D</span>
      <span className="text-xs font-bold text-slate-700 whitespace-nowrap px-1 sm:hidden">B3D</span>
      <Divider />
      <div className="flex items-center bg-slate-200 rounded h-6 p-0.5 flex-shrink-0">
        <button
          onClick={() => setMode('EDIT')}
          className={`px-2 h-5 text-[10px] font-semibold rounded transition-colors ${mode === 'EDIT' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Edit
        </button>
        <button
          onClick={() => setMode('VIEW')}
          className={`px-2 h-5 text-[10px] font-semibold rounded transition-colors ${mode === 'VIEW' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          View
        </button>
      </div>
      <Divider />

      {/* Center: mode-dependent */}
      <div className="flex items-center gap-0.5 flex-1 justify-center min-w-0">
        {mode === 'EDIT' ? (
          <>
            {/* Desktop: icon + label buttons */}
            <div className="hidden md:flex items-center gap-0.5">
              {ADD_ITEMS.map((item, idx) => (
                <React.Fragment key={item.type}>
                  <button
                    draggable
                    onDragStart={(e) => {
                      setDraggedType(item.type);
                      e.dataTransfer.setData('application/banquet-type', item.type);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => handleAdd(item.type)}
                    title={item.label}
                    className="flex flex-col items-center justify-center px-1.5 py-0.5 rounded hover:bg-slate-200 active:bg-slate-300 text-slate-600 hover:text-blue-600 transition-colors cursor-grab active:cursor-grabbing"
                  >
                    {item.icon}
                    <span className="text-[8px] leading-tight mt-0.5 whitespace-nowrap">{item.label}</span>
                  </button>
                  {DIVIDER_AFTER.includes(idx) && <Divider />}
                </React.Fragment>
              ))}
            </div>
            {/* Mobile: dropdown add menu */}
            <div className="md:hidden relative">
              <button
                onClick={() => setAddMenuOpen(!addMenuOpen)}
                className={`flex items-center gap-1 px-2 h-7 text-[10px] font-semibold rounded transition-colors ${addMenuOpen ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
              {addMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
                    {ADD_ITEMS.map((item, idx) => (
                      <React.Fragment key={item.type}>
                        {DIVIDER_AFTER.includes(idx - 1) && <div className="h-px bg-slate-100 my-0.5" />}
                        <button
                          onClick={() => handleAdd(item.type)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <IconBtn
              onClick={() => setViewEnvironment(prev => prev === 'day' ? 'night' : 'day')}
              title={viewEnvironment === 'day' ? '切換夜間' : '切換日間'}
              active={viewEnvironment === 'night'}
            >
              {viewEnvironment === 'day' ? <SunMedium className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </IconBtn>
            <Divider />
            {PRESET_VIEWS.map((v, idx) => (
              <IconBtn key={idx} onClick={() => setViewIndex(idx)} title={v.name} active={viewIndex === idx}>
                {PRESET_VIEW_ICONS[idx]}
              </IconBtn>
            ))}
            <Divider />
            <IconBtn onClick={takeScreenshot} title="截圖">
              <ImageIcon className="w-3.5 h-3.5" />
            </IconBtn>
          </>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {mode === 'EDIT' && (
          <>
            {/* Drawing tools — hidden on small screens */}
            <div className="hidden sm:flex items-center gap-0.5">
              <IconBtn
                onClick={() => { setIsDrawMode(!isDrawMode); setSelectedIds(new Set()); }}
                title={isDrawMode ? '關閉繪圖' : '手繪標註'}
                active={isDrawMode}
              >
                <PenTool className="w-3.5 h-3.5" />
              </IconBtn>
              <IconBtn onClick={clearDrawings} title="清除標註">
                <Eraser className="w-3.5 h-3.5" />
              </IconBtn>
              <div className="hidden lg:flex items-center gap-0.5 mx-0.5">
                {DRAW_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setDrawingColor(c)}
                    title={c}
                    className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${drawingColor === c ? 'border-slate-700 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Divider />
            </div>
          </>
        )}
        <IconBtn onClick={undo} title="復原 (Ctrl+Z)" disabled={!canUndo}>
          <Undo2 className="w-3.5 h-3.5" />
        </IconBtn>
        <IconBtn onClick={redo} title="重做 (Ctrl+Shift+Z)" disabled={!canRedo}>
          <Redo2 className="w-3.5 h-3.5" />
        </IconBtn>
        <Divider />
        <div className="hidden sm:flex items-center gap-0.5">
          <IconBtn onClick={handleImportClick} title="匯入場景">
            <Upload className="w-3.5 h-3.5" />
          </IconBtn>
          <IconBtn onClick={exportScene} title="匯出場景">
            <Download className="w-3.5 h-3.5" />
          </IconBtn>
        </div>
        {mode === 'EDIT' && (
          <>
            <IconBtn onClick={() => setShowBatchModal(true)} title="批次新增" className="hidden sm:flex">
              <PlusSquare className="w-3.5 h-3.5" />
            </IconBtn>
          </>
        )}
        <Divider />
        {/* Panel toggle */}
        <IconBtn
          onClick={() => setPanelOpen(!panelOpen)}
          title={panelOpen ? '收合面板' : '展開面板'}
          active={panelOpen}
        >
          <Settings className="w-3.5 h-3.5" />
        </IconBtn>
      </div>
    </div>
  );
};
