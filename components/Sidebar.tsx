import React, { useState } from 'react';
import {
  Layers, X, Upload, Download, Ruler, PlusSquare, PaintBucket,
  PenTool, Eraser, Palette, Box, Speaker, Lightbulb,
  Disc, Maximize, ScrollText, Music, MonitorPlay, MoveVertical,
  Zap, GripHorizontal, Undo2, Redo2
} from 'lucide-react';
import { BanquetObject, ObjectType, HallConfig } from '../types';
import { THEMES, Theme } from '../constants';
import { ObjectListPanel } from './ObjectListPanel';

interface SidebarProps {
  mode: 'EDIT' | 'VIEW';
  hall: HallConfig;
  setHall: React.Dispatch<React.SetStateAction<HallConfig>>;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (v: boolean) => void;
  isDrawMode: boolean;
  setIsDrawMode: (v: boolean) => void;
  drawingColor: string;
  setDrawingColor: (c: string) => void;
  clearDrawings: () => void;
  setSelectedIds: (ids: Set<string>) => void;
  setShowBatchModal: (v: boolean) => void;
  addObject: (type: ObjectType, pos?: { x: number; y: number; z: number }) => any;
  setDraggedType: (type: ObjectType | null) => void;
  handleImportClick: () => void;
  exportScene: () => void;
  // Object list
  objects: BanquetObject[];
  selectedIds: Set<string>;
  deleteObject: (id: string) => void;
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // Properties panel (rendered as children)
  children: React.ReactNode;
}

const DraggableAddButton = ({
  type, label, icon, onAdd, onDragStart
}: {
  type: ObjectType; label: string; icon: React.ReactNode;
  onAdd: (type: ObjectType) => void;
  onDragStart: (type: ObjectType) => void;
}) => (
  <div
    draggable
    onDragStart={(e) => {
      onDragStart(type);
      e.dataTransfer.setData('application/banquet-type', type);
      e.dataTransfer.effectAllowed = 'copy';
    }}
    onClick={() => onAdd(type)}
    className="flex flex-col items-center justify-center p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-sm transition-all group hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-grab active:cursor-grabbing"
  >
    <div className="text-slate-600 group-hover:text-blue-600 mb-2 transition-colors pointer-events-none">{icon}</div>
    <span className="text-[10px] font-medium text-center leading-tight text-slate-600 group-hover:text-slate-800 pointer-events-none">{label}</span>
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({
  mode, hall, setHall, mobileSidebarOpen, setMobileSidebarOpen,
  isDrawMode, setIsDrawMode, drawingColor, setDrawingColor, clearDrawings,
  setSelectedIds, setShowBatchModal, addObject, setDraggedType,
  handleImportClick, exportScene,
  objects, selectedIds, deleteObject,
  undo, redo, canUndo, canRedo,
  children
}) => {
  const applyTheme = (theme: Theme) => {
    setHall(prev => ({
      ...prev,
      wallColor: theme.wall,
      floorColor: theme.floor,
      wallRoughness: theme.wallRoughness,
      wallMetalness: theme.wallMetalness,
      floorRoughness: theme.floorRoughness,
      floorMetalness: theme.floorMetalness,
      baseboard: theme.baseboard,
    }));
  };

  const handleAddObject = (type: ObjectType) => {
    addObject(type);
    setIsDrawMode(false);
    if (window.innerWidth < 768) setMobileSidebarOpen(false);
  };

  return (
    <div className={`
      flex flex-col bg-white border-r border-slate-200 shadow-xl z-30 transition-all duration-300
      fixed inset-y-0 left-0 h-full w-80 transform
      md:relative md:translate-x-0
      ${mode === 'EDIT' && mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      ${mode === 'EDIT' ? 'md:w-80' : 'md:w-0 md:overflow-hidden'}
    `}>
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center space-x-2">
          <Layers className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Banquet 3D</h1>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="復原 (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="重做 (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleImportClick}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="匯入場景 (Import JSON)"
          >
            <Upload className="w-5 h-5" />
          </button>
          <button
            onClick={exportScene}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="匯出場景 (Export JSON)"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-8">
        {/* Dimensions */}
        <div className="space-y-4 border-b border-slate-100 pb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Ruler className="w-3 h-3" /> 場地尺寸 (Dimensions)
            </h3>
            <button onClick={() => { setShowBatchModal(true); if (window.innerWidth < 768) setMobileSidebarOpen(false); }} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-md hover:bg-blue-100 font-semibold flex items-center gap-1 transition-colors">
              <PlusSquare className="w-3 h-3" /> 批次新增
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase">寬度 (m)</label>
              <input type="number" value={hall.width} onChange={(e) => setHall({ ...hall, width: parseFloat(e.target.value) || 0 })} className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase">長度 (m)</label>
              <input type="number" value={hall.length} onChange={(e) => setHall({ ...hall, length: parseFloat(e.target.value) || 0 })} className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase">高度 (m)</label>
              <input type="number" value={hall.height} onChange={(e) => setHall({ ...hall, height: parseFloat(e.target.value) || 0 })} className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-sm" />
            </div>
          </div>
        </div>

        {/* Themes */}
        <div className="space-y-3 border-b border-slate-100 pb-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <PaintBucket className="w-3 h-3" /> 空間風格 (Themes)
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map(t => (
              <button key={t.id} onClick={() => applyTheme(t)} className="group flex flex-col items-center gap-2">
                <div className="w-full aspect-square rounded-full border-2 border-slate-100 shadow-sm overflow-hidden relative group-hover:border-blue-400 transition-colors">
                  <div className="absolute inset-0 h-1/2" style={{ backgroundColor: t.wall }} />
                  <div className="absolute inset-0 top-1/2 h-1/2" style={{ backgroundColor: t.floor }} />
                </div>
                <span className="text-[10px] font-medium text-slate-600 group-hover:text-blue-600 transition-colors">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div className="space-y-3 border-b border-slate-100 pb-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <PenTool className="w-3 h-3" /> 工具 (Tools)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setIsDrawMode(!isDrawMode); setSelectedIds(new Set()); if (window.innerWidth < 768) setMobileSidebarOpen(false); }}
              className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all
                ${isDrawMode ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <PenTool className="w-3 h-3" /> {isDrawMode ? '繪圖中' : '手繪標註'}
            </button>
            <button onClick={clearDrawings} className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 transition-all">
              <Eraser className="w-3 h-3" /> 清除標註
            </button>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Palette className="w-3 h-3 text-slate-400" />
            <div className="flex gap-1.5">
              {['#3b82f6', '#ef4444', '#eab308', '#22c55e'].map(c => (
                <button key={c} onClick={() => setDrawingColor(c)} className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${drawingColor === c ? 'border-slate-600 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={drawingColor} onChange={(e) => setDrawingColor(e.target.value)} className="w-5 h-5 rounded-full overflow-hidden cursor-pointer border-none p-0" />
            </div>
          </div>
        </div>

        {/* Objects */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Box className="w-3 h-3" /> 家具 (Furniture)</h3>
          <div className="grid grid-cols-3 gap-2">
            <DraggableAddButton type={ObjectType.ROUND_TABLE} label="圓桌" icon={<Disc className="w-5 h-5" />} onAdd={handleAddObject} onDragStart={setDraggedType} />
            <DraggableAddButton type={ObjectType.RECT_TABLE} label="長桌" icon={<Maximize className="w-5 h-5" />} onAdd={handleAddObject} onDragStart={setDraggedType} />
            <DraggableAddButton type={ObjectType.STAGE} label="舞台" icon={<Box className="w-5 h-5" />} onAdd={handleAddObject} onDragStart={setDraggedType} />
            <DraggableAddButton type={ObjectType.RED_CARPET} label="紅地毯" icon={<ScrollText className="w-5 h-5" />} onAdd={handleAddObject} onDragStart={setDraggedType} />
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Speaker className="w-3 h-3" /> 音響 (Audio)</h3>
          <div className="grid grid-cols-2 gap-2">
            <DraggableAddButton type={ObjectType.SPEAKER_15} label="15吋喇叭" icon={<Music className="w-5 h-5" />} onAdd={handleAddObject} onDragStart={setDraggedType} />
            <DraggableAddButton type={ObjectType.SPEAKER_SUB} label="超低音" icon={<Box className="w-5 h-5" />} onAdd={handleAddObject} onDragStart={setDraggedType} />
            <DraggableAddButton type={ObjectType.SPEAKER_MONITOR} label="監聽喇叭" icon={<MonitorPlay className="w-5 h-5" />} onAdd={handleAddObject} onDragStart={setDraggedType} />
            <DraggableAddButton type={ObjectType.SPEAKER_COLUMN} label="音柱喇叭" icon={<MoveVertical className="w-5 h-5" />} onAdd={handleAddObject} onDragStart={setDraggedType} />
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Lightbulb className="w-3 h-3" /> 燈光 (Lighting)</h3>
          <div className="grid grid-cols-3 gap-2">
            <DraggableAddButton type={ObjectType.LIGHT_PAR} label="LED 帕燈" icon={<Lightbulb className="w-5 h-5" />} onAdd={handleAddObject} onDragStart={setDraggedType} />
            <DraggableAddButton type={ObjectType.LIGHT_MOVING} label="電腦燈" icon={<Zap className="w-5 h-5" />} onAdd={handleAddObject} onDragStart={setDraggedType} />
            <DraggableAddButton type={ObjectType.LIGHT_STAND} label="T型燈桿" icon={<GripHorizontal className="w-5 h-5" />} onAdd={handleAddObject} onDragStart={setDraggedType} />
          </div>
        </div>
      </div>

      {/* Properties Panel (passed as children) */}
      {children}

      {/* Object List (floating popover) */}
      <ObjectListPanel
        objects={objects}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        deleteObject={deleteObject}
      />

    </div>
  );
};
