import React from 'react';
import {
  Ruler, PaintBucket, X,
} from 'lucide-react';
import { BanquetObject, ObjectType, HallConfig } from '../types';
import { THEMES, Theme } from '../constants';
import { ObjectListPanel } from './ObjectListPanel';

interface SidebarProps {
  mode: 'EDIT' | 'VIEW';
  hall: HallConfig;
  setHall: React.Dispatch<React.SetStateAction<HallConfig>>;
  objects: BanquetObject[];
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  deleteObject: (id: string) => void;
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  children: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mode, hall, setHall,
  objects, selectedIds, setSelectedIds, deleteObject,
  panelOpen, setPanelOpen,
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

  if (mode !== 'EDIT' || !panelOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-30 md:hidden"
        onClick={() => setPanelOpen(false)}
      />

      <div className={`
        flex flex-col bg-white border-l border-slate-300 flex-shrink-0 z-40
        fixed inset-y-0 right-0 w-72 md:relative md:w-72
        shadow-xl md:shadow-none
      `}>
        {/* Mobile close button */}
        <div className="flex items-center justify-between p-3 border-b border-slate-100 md:hidden">
          <span className="text-xs font-bold text-slate-500 uppercase">Settings</span>
          <button onClick={() => setPanelOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Dimensions */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Ruler className="w-3 h-3" /> Dimensions
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-slate-500 uppercase">W (m)</label>
                <input type="number" value={hall.width} onChange={(e) => setHall({ ...hall, width: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-slate-500 uppercase">L (m)</label>
                <input type="number" value={hall.length} onChange={(e) => setHall({ ...hall, length: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-slate-500 uppercase">H (m)</label>
                <input type="number" value={hall.height} onChange={(e) => setHall({ ...hall, height: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs" />
              </div>
            </div>
          </div>

          {/* Themes */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <PaintBucket className="w-3 h-3" /> Theme
            </h3>
            <div className="grid grid-cols-4 gap-1.5">
              {THEMES.map(t => (
                <button key={t.id} onClick={() => applyTheme(t)} className="group flex flex-col items-center gap-1" title={t.name}>
                  <div className="w-full aspect-square rounded-full border-2 border-slate-100 shadow-sm overflow-hidden relative group-hover:border-blue-400 transition-colors">
                    <div className="absolute inset-0 h-1/2" style={{ backgroundColor: t.wall }} />
                    <div className="absolute inset-0 top-1/2 h-1/2" style={{ backgroundColor: t.floor }} />
                  </div>
                  <span className="text-[9px] font-medium text-slate-500 group-hover:text-blue-600 transition-colors leading-tight">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Properties Panel */}
          <div className="border-t border-slate-100 pt-4">
            {children}
          </div>
        </div>

        {/* Object List */}
        <ObjectListPanel
          objects={objects}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          deleteObject={deleteObject}
        />
      </div>
    </>
  );
};
