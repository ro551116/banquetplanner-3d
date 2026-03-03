import React, { useState } from 'react';
import {
  PlusSquare, X, List, Grid3X3
} from 'lucide-react';
import { BanquetObject, ObjectType, HallConfig } from '../types';
import { createObjectConfig } from '../constants';

interface AdvancedAddModalProps {
  onClose: () => void;
  onAddObjects: (newObjects: BanquetObject[]) => void;
  hall: HallConfig;
}

export const AdvancedAddModal: React.FC<AdvancedAddModalProps> = ({ onClose, onAddObjects, hall }) => {
  const [activeTab, setActiveTab] = useState<'SIMPLE' | 'GRID'>('SIMPLE');

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
    const num = parseInt(val) || 0;
    setCounts(prev => ({ ...prev, [type]: Math.max(0, num) }));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[500px] border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <PlusSquare className="w-4 h-4 text-blue-600" /> 新增物件 (Add Objects)
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab('SIMPLE')}
            className={`flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-2 ${activeTab === 'SIMPLE' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <List className="w-3 h-3" /> 快速數量 (Simple)
          </button>
          <button
            onClick={() => setActiveTab('GRID')}
            className={`flex-1 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-2 ${activeTab === 'GRID' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Grid3X3 className="w-3 h-3" /> 進階排桌 (Layout)
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'SIMPLE' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">圓桌 (Round)</label>
                  <input type="number" min="0" className="w-full border rounded px-2 py-1.5 text-sm"
                    value={counts[ObjectType.ROUND_TABLE] || ''} onChange={e => handleSimpleCountChange(ObjectType.ROUND_TABLE, e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">長桌 (Rect)</label>
                  <input type="number" min="0" className="w-full border rounded px-2 py-1.5 text-sm"
                    value={counts[ObjectType.RECT_TABLE] || ''} onChange={e => handleSimpleCountChange(ObjectType.RECT_TABLE, e.target.value)} placeholder="0" />
                </div>
              </div>
              <hr className="border-slate-100" />
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">LED 帕燈</label>
                  <input type="number" min="0" className="w-full border rounded px-2 py-1.5 text-sm"
                    value={counts[ObjectType.LIGHT_PAR] || ''} onChange={e => handleSimpleCountChange(ObjectType.LIGHT_PAR, e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">電腦燈</label>
                  <input type="number" min="0" className="w-full border rounded px-2 py-1.5 text-sm"
                    value={counts[ObjectType.LIGHT_MOVING] || ''} onChange={e => handleSimpleCountChange(ObjectType.LIGHT_MOVING, e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">15吋喇叭</label>
                  <input type="number" min="0" className="w-full border rounded px-2 py-1.5 text-sm"
                    value={counts[ObjectType.SPEAKER_15] || ''} onChange={e => handleSimpleCountChange(ObjectType.SPEAKER_15, e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase">桌型選擇 (Type)</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="tableType"
                      checked={gridConfig.type === ObjectType.ROUND_TABLE}
                      onChange={() => setGridConfig({ ...gridConfig, type: ObjectType.ROUND_TABLE })}
                      className="text-blue-600"
                    /> 圓桌 (Round)
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="tableType"
                      checked={gridConfig.type === ObjectType.RECT_TABLE}
                      onChange={() => setGridConfig({ ...gridConfig, type: ObjectType.RECT_TABLE })}
                      className="text-blue-600"
                    /> 長桌 (Rect)
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">排 (Rows)</label>
                  <input type="number" min="1" max="50" className="w-full border rounded px-2 py-1.5 text-sm"
                    value={gridConfig.rows} onChange={(e) => setGridConfig({ ...gridConfig, rows: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">列 (Columns)</label>
                  <input type="number" min="1" max="20" className="w-full border rounded px-2 py-1.5 text-sm"
                    value={gridConfig.cols} onChange={(e) => setGridConfig({ ...gridConfig, cols: parseInt(e.target.value) || 1 })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">前後桌距 (Z Spacing - m)</label>
                  <input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm"
                    value={gridConfig.spacingZ} onChange={(e) => setGridConfig({ ...gridConfig, spacingZ: parseFloat(e.target.value) || 0 })} />
                  <div className="text-[10px] text-slate-400">總長度: {((gridConfig.rows - 1) * gridConfig.spacingZ).toFixed(1)}m (場地: {hall.length}m)</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">左右桌距 (X Spacing - m)</label>
                  <input type="number" step="0.1" className="w-full border rounded px-2 py-1.5 text-sm"
                    value={gridConfig.spacingX} onChange={(e) => setGridConfig({ ...gridConfig, spacingX: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-indigo-700">中央走道 (Center Aisle)</label>
                  <input type="checkbox" checked={gridConfig.hasAisle} onChange={(e) => setGridConfig({ ...gridConfig, hasAisle: e.target.checked })} className="toggle accent-indigo-600" />
                </div>
                {gridConfig.hasAisle && (
                  <div className="space-y-1 animate-in slide-in-from-top-2">
                    <label className="text-xs font-medium text-indigo-600">走道寬度 (m)</label>
                    <input type="number" step="0.1" className="w-full border border-indigo-200 rounded px-2 py-1.5 text-sm"
                      value={gridConfig.aisleWidth} onChange={(e) => setGridConfig({ ...gridConfig, aisleWidth: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex gap-2 bg-slate-50/50 rounded-b-xl">
          <button onClick={onClose} className="flex-1 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors">
            取消
          </button>
          <button onClick={handleConfirm} className="flex-1 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2">
            確認新增 ({totalTables} 物件)
          </button>
        </div>
      </div>
    </div>
  );
};
