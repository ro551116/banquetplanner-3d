import React, { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { BanquetObject } from '../types';
import { OBJECT_TYPE_META, getObjectDisplayName } from './objectTypeMeta';

interface ObjectListPanelProps {
  objects: BanquetObject[];
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  deleteObject: (id: string) => void;
}

export const ObjectListPanel: React.FC<ObjectListPanelProps> = ({ objects, selectedIds, setSelectedIds, deleteObject }) => {
  const [open, setOpen] = useState(false);
  const selectObject = (id: string, event: React.MouseEvent) => {
    if (!event.shiftKey) return setSelectedIds(new Set([id]));
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  return <section className="shrink-0 bg-white">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex h-10 w-full items-center justify-between border-t border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
      <span className="flex items-center gap-2">物件清單<span className="rounded-full bg-slate-100 px-2 text-xs tabular-nums">{objects.length}</span></span>
      <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="max-h-64 overflow-y-auto py-1">
      {objects.length === 0 && <p className="px-4 py-3 text-xs text-slate-500">尚未新增物件</p>}
      {objects.map(object => {
        const { Icon, label } = OBJECT_TYPE_META[object.type];
        const name = getObjectDisplayName(object);
        const selected = selectedIds.has(object.id);
        return <div key={object.id} className={`group flex items-center gap-1 px-2 ${selected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}>
          <button type="button" aria-pressed={selected} onClick={event => selectObject(object.id, event)} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left">
            <Icon className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
            <span className="shrink-0 text-xs text-slate-500">{label}</span>
          </button>
          <button type="button" aria-label={`刪除 ${name}`} onClick={() => {
            deleteObject(object.id);
            setSelectedIds(new Set([...selectedIds].filter(id => id !== object.id)));
          }} className="ui-icon-btn shrink-0 text-red-600 can-hover:opacity-0 can-hover:group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 coarse:opacity-100">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>;
      })}
    </div>}
  </section>;
};
