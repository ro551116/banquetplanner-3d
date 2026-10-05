import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ObjectType } from '../types';
import type { BanquetObject, HallConfig } from '../types';
import { createObjectConfig } from '../constants';
import { getObjectLabel } from './objectTypeMeta';

interface AdvancedAddModalProps {
  onClose: () => void;
  onAddObjects: (newObjects: BanquetObject[]) => void;
  hall: HallConfig;
}

export const AdvancedAddModal: React.FC<AdvancedAddModalProps> = ({ onClose, onAddObjects, hall }) => {
  const [activeTab, setActiveTab] = useState<'SIMPLE' | 'GRID'>('SIMPLE');
  const id = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
      }
      if (event.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button, input, select');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => {
      window.removeEventListener('keydown', handleKey, true);
      previousFocus?.focus();
    };
  }, []);

  // Simple Mode State
  const [counts, setCounts] = useState<Record<string, number>>({
    [ObjectType.ROUND_TABLE]: 0,
    [ObjectType.RECT_TABLE]: 0,
    [ObjectType.SPEAKER_15]: 0,
    [ObjectType.LIGHT_PAR]: 0,
    [ObjectType.LIGHT_MOVING]: 0
  });

  // Grid Mode State
  const [gridConfig, setGridConfig] = useState({
    type: ObjectType.ROUND_TABLE,
    rows: 4,
    cols: 3,
    spacingX: 3.5,
    spacingZ: 3.5,
    hasAisle: true,
    aisleWidth: 2.0
  });

  const handleSimpleCountChange = (type: string, val: string) => {
    const num = Number(val);
    setCounts(prev => ({ ...prev, [type]: Number.isFinite(num) ? Math.min(1000, Math.max(0, Math.trunc(num))) : 0 }));
  };

  const generateSimpleObjects = () => {
    const newObjects: BanquetObject[] = [];

    const addSimpleGrid = (type: ObjectType, count: number, startX: number, startZ: number, spacing: number) => {
      const cols = Math.ceil(Math.sqrt(count));
      for (let i = 0; i < count; i++) {
        const obj = createObjectConfig(type);
        const col = i % cols;
        const row = Math.floor(i / cols);
        obj.position.x = (col * spacing) + startX;
        obj.position.z = (row * spacing) + startZ;
        obj.label = `${i + 1}`;
        newObjects.push(obj);
      }
    };

    if (counts[ObjectType.ROUND_TABLE] > 0) addSimpleGrid(ObjectType.ROUND_TABLE, counts[ObjectType.ROUND_TABLE], -2, 0, 3);
    if (counts[ObjectType.RECT_TABLE] > 0) addSimpleGrid(ObjectType.RECT_TABLE, counts[ObjectType.RECT_TABLE], 2, 0, 2.5);

    let xPos = -5;
    [ObjectType.LIGHT_PAR, ObjectType.LIGHT_MOVING, ObjectType.SPEAKER_15].forEach(type => {
      const count = counts[type] || 0;
      for (let i = 0; i < count; i++) {
        const obj = createObjectConfig(type as ObjectType);
        obj.position.x = xPos + (i * 1);
        obj.position.z = -5;
        newObjects.push(obj);
      }
      xPos += (count * 1) + 2;
    });

    return newObjects;
  };

  const generateGridObjects = () => {
    const { type, rows, cols, spacingX, spacingZ, hasAisle, aisleWidth } = gridConfig;
    const newObjects: BanquetObject[] = [];

    const totalWidth = (cols - 1) * spacingX + (cols > 1 && hasAisle ? aisleWidth : 0);
    const totalDepth = (rows - 1) * spacingZ;

    const startX = -totalWidth / 2;
    const startZ = -totalDepth / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const obj = createObjectConfig(type);

        let x = startX + (c * spacingX);
        let z = startZ + (r * spacingZ);

        if (hasAisle && cols > 1) {
          if (c >= cols / 2) {
            x += aisleWidth;
          }
        }

        obj.position.x = x;
        obj.position.z = z;
        obj.label = `${r + 1}-${c + 1}`;

        newObjects.push(obj);
      }
    }
    return newObjects;
  };

  const handleConfirm = () => {
    if (activeTab === 'SIMPLE') {
      onAddObjects(generateSimpleObjects());
    } else {
      onAddObjects(generateGridObjects());
    }
    onClose();
  };

  const totalTables = activeTab === 'SIMPLE'
    ? Object.values(counts).reduce((a: number, b: number) => a + b, 0)
    : gridConfig.rows * gridConfig.cols;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="flex max-h-[90dvh] w-full max-w-[500px] flex-col rounded-xl bg-white shadow-xl animate-scale-in">
        <header className="flex shrink-0 items-center justify-between p-4">
          <h2 id={`${id}-title`} className="text-base font-semibold">批次新增</h2>
          <button ref={closeRef} type="button" onClick={onClose} className="ui-icon-btn" aria-label="關閉"><X className="h-4 w-4" /></button>
        </header>
        <div className="ui-segmented mx-4 flex" role="tablist" aria-label="新增方式">
          <button type="button" role="tab" aria-selected={activeTab === 'SIMPLE'} className="ui-segment flex-1" onClick={() => setActiveTab('SIMPLE')}>快速數量</button>
          <button type="button" role="tab" aria-selected={activeTab === 'GRID'} className="ui-segment flex-1" onClick={() => setActiveTab('GRID')}>排桌陣列</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {activeTab === 'SIMPLE' ? (
            <div className="grid grid-cols-2 gap-4">
              {[ObjectType.ROUND_TABLE, ObjectType.RECT_TABLE, ObjectType.LIGHT_PAR, ObjectType.LIGHT_MOVING, ObjectType.SPEAKER_15].map(type => <div key={type} className="space-y-1.5">
                <label htmlFor={`${id}-${type}`} className="ui-label">{getObjectLabel(type)}</label>
                <input id={`${id}-${type}`} type="number" min={0} max={1000} step={1} value={counts[type]} onChange={event => handleSimpleCountChange(type, event.target.value)} className="ui-input" />
              </div>)}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label htmlFor={`${id}-type`} className="ui-label">桌型</label>
                <select id={`${id}-type`} className="ui-input" value={gridConfig.type} onChange={event => setGridConfig(prev => ({ ...prev, type: event.target.value as ObjectType }))}>
                  <option value={ObjectType.ROUND_TABLE}>圓桌</option><option value={ObjectType.RECT_TABLE}>長桌</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor={`${id}-rows`} className="ui-label">排數</label>
                  <input id={`${id}-rows`} type="number" min={1} max={50} step={1} value={gridConfig.rows} className="ui-input" onChange={event => setGridConfig(prev => ({ ...prev, rows: Math.min(50, Math.max(1, Math.trunc(Number(event.target.value) || 1))) }))} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`${id}-cols`} className="ui-label">列數</label>
                  <input id={`${id}-cols`} type="number" min={1} max={20} step={1} value={gridConfig.cols} className="ui-input" onChange={event => setGridConfig(prev => ({ ...prev, cols: Math.min(20, Math.max(1, Math.trunc(Number(event.target.value) || 1))) }))} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`${id}-spacing-z`} className="ui-label">前後桌距（公尺）</label>
                  <input id={`${id}-spacing-z`} type="number" min={0} max={200} step={0.1} value={gridConfig.spacingZ} className="ui-input" onChange={event => setGridConfig(prev => ({ ...prev, spacingZ: Math.min(200, Math.max(0, Number(event.target.value) || 0)) }))} />
                  <p className="text-xs leading-relaxed text-slate-500">總長度：{((gridConfig.rows - 1) * gridConfig.spacingZ).toFixed(1)} 公尺；場地：{hall.length} 公尺</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`${id}-spacing-x`} className="ui-label">左右桌距（公尺）</label>
                  <input id={`${id}-spacing-x`} type="number" min={0} max={200} step={0.1} value={gridConfig.spacingX} className="ui-input" onChange={event => setGridConfig(prev => ({ ...prev, spacingX: Math.min(200, Math.max(0, Number(event.target.value) || 0)) }))} />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex min-h-10 items-center justify-between">
                  <label htmlFor={`${id}-aisle`} className="ui-label">中央走道</label>
                  <input id={`${id}-aisle`} type="checkbox" checked={gridConfig.hasAisle} className="h-5 w-5 accent-blue-600" onChange={event => setGridConfig(prev => ({ ...prev, hasAisle: event.target.checked }))} />
                </div>
                {gridConfig.hasAisle && <div className="space-y-1.5">
                  <label htmlFor={`${id}-aisle-width`} className="ui-label">走道寬度（公尺）</label>
                  <input id={`${id}-aisle-width`} type="number" min={0} max={200} step={0.1} value={gridConfig.aisleWidth} className="ui-input" onChange={event => setGridConfig(prev => ({ ...prev, aisleWidth: Math.min(200, Math.max(0, Number(event.target.value) || 0)) }))} />
                </div>}
              </div>
            </div>
          )}
        </div>
        <footer className="flex shrink-0 gap-3 p-4">
          <button type="button" onClick={onClose} className="ui-btn-secondary flex-1">取消</button>
          <button type="button" onClick={handleConfirm} className="ui-btn-primary flex-1">新增 {totalTables} 個物件</button>
        </footer>
      </div>
    </div>
  );
};
