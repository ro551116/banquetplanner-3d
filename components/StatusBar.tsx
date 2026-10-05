import React from 'react';
import { BanquetObject } from '../types';
import { OBJECT_TYPE_META, getObjectDisplayName } from './objectTypeMeta';

interface StatusBarProps {
  mode: 'EDIT' | 'VIEW';
  isDrawMode: boolean;
  selectedIds: Set<string>;
  objects: BanquetObject[];
  placementLabel?: string;
}

export default function StatusBar({ mode, isDrawMode, selectedIds, objects, placementLabel }: StatusBarProps) {
  if (mode !== 'EDIT') return null;
  const selected = objects.find(object => selectedIds.has(object.id));
  const context = placementLabel ? `放置中：${placementLabel}` : isDrawMode ? '繪圖模式：在地面拖曳畫線' : selectedIds.size === 1 && selected ? `已選 1 個：${getObjectDisplayName(selected)}` : selectedIds.size > 0 ? `已選 ${selectedIds.size} 個` : '未選取・點選物件即可編輯（Shift 多選）';
  const groups = [
    { id: 'table', label: '桌' }, { id: 'venue', label: '場地' }, { id: 'audio', label: '音響' }, { id: 'lighting', label: '燈光' }, { id: 'other', label: '其他' },
  ];
  const counts = groups.map(group => {
    const matches = objects.filter(object => {
      const meta = OBJECT_TYPE_META[object.type];
      return group.id === 'table' ? meta.table : meta.group === group.id && !meta.table;
    });
    return { ...group, count: matches.length, Icon: matches.length ? OBJECT_TYPE_META[matches[0].type].Icon : null };
  });
  return <footer className="flex h-8 shrink-0 items-center justify-between gap-3 bg-white border-t border-slate-200 px-3 text-xs text-slate-600">
    <span className="min-w-0 truncate" title={context}>{context}</span>
    <div className="flex shrink-0 items-center gap-2 tabular-nums">{counts.map(({ id, label, count, Icon }) => count > 0 && Icon && <span key={id} className="inline-flex items-center gap-1" title={`${label}：${count}`} aria-label={`${label}：${count}`}><Icon size={14} />{count}</span>)}<span>共 {objects.length} 件</span></div>
  </footer>;
}
