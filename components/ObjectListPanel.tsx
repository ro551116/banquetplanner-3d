import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronUp, Trash2, List,
  Disc, Maximize, Box, ScrollText, Music, MonitorPlay,
  MoveVertical, Lightbulb, Zap, GripHorizontal, Speaker
} from 'lucide-react';
import { BanquetObject, ObjectType } from '../types';

const TYPE_INFO: Record<string, { label: string; icon: React.ReactNode }> = {
  [ObjectType.ROUND_TABLE]: { label: '圓桌', icon: <Disc className="w-3 h-3" /> },
  [ObjectType.RECT_TABLE]: { label: '長桌', icon: <Maximize className="w-3 h-3" /> },
  [ObjectType.STAGE]: { label: '舞台', icon: <Box className="w-3 h-3" /> },
  [ObjectType.RED_CARPET]: { label: '紅地毯', icon: <ScrollText className="w-3 h-3" /> },
  [ObjectType.SPEAKER_15]: { label: '15吋喇叭', icon: <Music className="w-3 h-3" /> },
  [ObjectType.SPEAKER_SUB]: { label: '超低音', icon: <Speaker className="w-3 h-3" /> },
  [ObjectType.SPEAKER_MONITOR]: { label: '監聽喇叭', icon: <MonitorPlay className="w-3 h-3" /> },
  [ObjectType.SPEAKER_COLUMN]: { label: '音柱喇叭', icon: <MoveVertical className="w-3 h-3" /> },
  [ObjectType.LIGHT_PAR]: { label: 'LED 帕燈', icon: <Lightbulb className="w-3 h-3" /> },
  [ObjectType.LIGHT_MOVING]: { label: '電腦燈', icon: <Zap className="w-3 h-3" /> },
  [ObjectType.LIGHT_STAND]: { label: 'T型燈桿', icon: <GripHorizontal className="w-3 h-3" /> },
};

interface ObjectListPanelProps {
  objects: BanquetObject[];
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  deleteObject: (id: string) => void;
}

export const ObjectListPanel: React.FC<ObjectListPanelProps> = ({
  objects, selectedIds, setSelectedIds, deleteObject
}) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedIds(next);
    } else {
      setSelectedIds(new Set([id]));
    }
  };

  // Build summary chips: count by type
  const typeCounts: Record<string, number> = {};
  objects.forEach(o => {
    typeCounts[o.type] = (typeCounts[o.type] || 0) + 1;
  });

  return (
    <div ref={panelRef} className="relative border-t border-slate-200">
      {/* Toggle bar */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2 text-[10px] font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
      >
        <List className="w-3 h-3 flex-shrink-0" />
        <div className="flex-1 flex items-center gap-1.5 overflow-hidden">
          {objects.length === 0 ? (
            <span className="text-slate-400 italic">無物件</span>
          ) : (
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {Object.entries(typeCounts).map(([type, count]) => {
                const info = TYPE_INFO[type];
                if (!info) return null;
                return (
                  <span key={type} className="inline-flex items-center gap-0.5 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap flex-shrink-0">
                    {info.icon} {count}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <ChevronUp className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>

      {/* Floating list */}
      {open && objects.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 bg-white border border-slate-200 rounded-t-lg shadow-lg z-40 max-h-64 overflow-y-auto">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
            <span className="text-[10px] font-bold text-slate-500 uppercase">場景物件 ({objects.length})</span>
          </div>
          <div className="py-1">
            {objects.map(obj => {
              const isSelected = selectedIds.has(obj.id);
              const info = TYPE_INFO[obj.type] || { label: obj.type, icon: <Box className="w-3 h-3" /> };
              const displayName = obj.label || info.label;
              return (
                <div
                  key={obj.id}
                  onClick={(e) => handleClick(obj.id, e)}
                  className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-[11px] transition-colors group
                    ${isSelected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className="flex-shrink-0 text-slate-400">{info.icon}</span>
                  <span className="flex-1 truncate">{displayName}</span>
                  <span className="text-[9px] text-slate-400 flex-shrink-0">{info.label}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteObject(obj.id); }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
