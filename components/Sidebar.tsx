import React, { useEffect, useState } from 'react';
import { ChevronDown, MousePointer2 } from 'lucide-react';
import type { BanquetObject, HallConfig } from '../types';
import { THEMES } from '../constants';
import type { Theme } from '../constants';
import { ObjectListPanel } from './ObjectListPanel';
import { NumberField } from './ui/NumberField';
import { BottomSheet } from './ui/BottomSheet';
import { DOCKED_PANELS_QUERY, useMediaQuery } from './ui/useMediaQuery';

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

export const Sidebar: React.FC<SidebarProps> = ({ mode, hall, setHall, objects, selectedIds, setSelectedIds, deleteObject, panelOpen, setPanelOpen, children }) => {
  const docked = useMediaQuery(DOCKED_PANELS_QUERY);
  const hasSelection = selectedIds.size > 0;
  const [hallExpanded, setHallExpanded] = useState(!hasSelection);
  useEffect(() => setHallExpanded(!hasSelection), [hasSelection]);
  const applyTheme = (theme: Theme) => setHall(prev => ({
    ...prev, wallColor: theme.wall, floorColor: theme.floor,
    wallRoughness: theme.wallRoughness, wallMetalness: theme.wallMetalness,
    floorRoughness: theme.floorRoughness, floorMetalness: theme.floorMetalness,
    baseboard: theme.baseboard,
  }));
  if (mode !== 'EDIT' || !panelOpen) return null;
  const content = (
    <div className="space-y-6 p-4">
      {hasSelection ? children : (
        <div className="space-y-3 py-4 text-center">
          <MousePointer2 className="mx-auto h-6 w-6 text-slate-400" />
          <p className="text-sm text-slate-700">點選場景中的物件即可編輯</p>
          <p className="text-xs leading-relaxed text-slate-500">Shift＋點選可多選；從左側「新增物件」放置新物件</p>
        </div>
      )}
      <section className="space-y-4">
        <button type="button" onClick={() => setHallExpanded(value => !value)} aria-expanded={hallExpanded} className="flex min-h-10 w-full items-center justify-between text-sm font-semibold text-slate-900">
          場地設定<ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${hallExpanded ? '' : '-rotate-90'}`} />
        </button>
        {hallExpanded && <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="ui-section-title">尺寸</h3>
            <div className="grid grid-cols-3 gap-3">
              <NumberField label="寬" value={hall.width} onChange={width => setHall(prev => ({ ...prev, width }))} unit="m" min={1} max={200} step={0.5} precision={1} />
              <NumberField label="長" value={hall.length} onChange={length => setHall(prev => ({ ...prev, length }))} unit="m" min={1} max={200} step={0.5} precision={1} />
              <NumberField label="高" value={hall.height} onChange={height => setHall(prev => ({ ...prev, height }))} unit="m" min={1} max={200} step={0.5} precision={1} />
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="ui-section-title">主題</h3>
            <div className="grid grid-cols-4 gap-3">
              {THEMES.map(theme => {
                const selected = hall.wallColor === theme.wall && hall.floorColor === theme.floor;
                return <button type="button" key={theme.id} aria-label={theme.name} aria-pressed={selected} onClick={() => applyTheme(theme)} className="flex min-h-10 flex-col items-center gap-2 rounded-lg py-1">
                  <span className={`relative h-8 w-8 overflow-hidden rounded-full border border-slate-200 ${selected ? 'ring-2 ring-blue-600 ring-offset-2' : ''}`}>
                    <span className="absolute inset-x-0 top-0 h-1/2" style={{ backgroundColor: theme.wall }} />
                    <span className="absolute inset-x-0 bottom-0 h-1/2" style={{ backgroundColor: theme.floor }} />
                  </span>
                  <span className="text-xs text-slate-600">{theme.name}</span>
                </button>;
              })}
            </div>
          </section>
        </div>}
      </section>
    </div>
  );
  const footer = <ObjectListPanel objects={objects} selectedIds={selectedIds} setSelectedIds={setSelectedIds} deleteObject={deleteObject} />;
  if (!docked) return <BottomSheet title="屬性" onClose={() => setPanelOpen(false)}>{content}{footer}</BottomSheet>;
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white xl:w-80">
      <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
      {footer}
    </aside>
  );
};
