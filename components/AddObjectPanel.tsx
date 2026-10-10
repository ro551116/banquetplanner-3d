import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ObjectType } from '../types';
import { isPathType } from '../planning';
import { OBJECT_TYPE_META, OBJECT_GROUPS, getObjectLabel } from './objectTypeMeta';
import type { ObjectGroup } from './objectTypeMeta';
import { BottomSheet } from './ui/BottomSheet';
import { DOCKED_PANELS_QUERY, useMediaQuery } from './ui/useMediaQuery';

export interface AddObjectPanelProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  placingType: ObjectType | null;
  onBeginPlacement: (type: ObjectType) => void;
  setIsDrawMode: (v: boolean) => void;
  onOpenTrussBuilder: () => void;
}

export const AddObjectPanel: React.FC<AddObjectPanelProps> = ({ isOpen, setIsOpen, placingType, onBeginPlacement, setIsDrawMode, onOpenTrussBuilder }) => {
  const docked = useMediaQuery(DOCKED_PANELS_QUERY);
  const [group, setGroup] = useState<ObjectGroup>('venue');
  const choose = (type: ObjectType, mobile: boolean) => {
    setIsDrawMode(false);
    if (mobile) setIsOpen(false);
    if (type === ObjectType.TRUSS_STRUCTURE) onOpenTrussBuilder();
    else onBeginPlacement(type);
  };
  if (!isOpen) return null;
  const content = (mobile: boolean) => <div className="space-y-4 p-4">
    <div className="ui-segmented grid w-full grid-cols-4" role="tablist" aria-label="物件分類">
      {OBJECT_GROUPS.map(item => <button type="button" key={item.id} role="tab" aria-selected={group === item.id} className="ui-segment min-w-0 px-1" onClick={() => setGroup(item.id)}>{item.label}</button>)}
    </div>
    <p className={`text-xs leading-relaxed ${placingType ? 'text-blue-700' : 'text-slate-500'}`}>
      {placingType ? (isPathType(placingType) ? `繪製中：${getObjectLabel(placingType)}・點擊地面加節點，Enter 完成，Esc 取消` : `放置中：${getObjectLabel(placingType)}・點擊地面放置，Esc 取消`) : '點選後在場景中放置'}
    </p>
    <div className="grid grid-cols-2 gap-3">
      {(Object.entries(OBJECT_TYPE_META) as [ObjectType, typeof OBJECT_TYPE_META[ObjectType]][]).filter(([, meta]) => meta.palette && meta.group === group).map(([type, { Icon, label }]) => <button
        type="button" key={type} aria-pressed={placingType === type} onClick={() => choose(type, mobile)}
        className={`flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-lg border text-sm ${placingType === type ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}>
        <Icon className="h-5 w-5 text-slate-500" /><span>{label}</span>
      </button>)}
    </div>
  </div>;
  if (!docked) return <BottomSheet title="新增物件" onClose={() => setIsOpen(false)}>{content(true)}</BottomSheet>;
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <header className="flex shrink-0 items-center justify-between px-4 pt-4">
        <h2 className="text-base font-semibold">新增物件</h2>
        <button type="button" aria-label="關閉" className="ui-icon-btn" onClick={() => setIsOpen(false)}><X className="h-4 w-4" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{content(false)}</div>
    </aside>
  );
};
