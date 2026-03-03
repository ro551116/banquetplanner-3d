import React from 'react';
import {
  MousePointer2, Trash2, Type, Move3d, PaintBucket,
  Footprints, X
} from 'lucide-react';
import { BanquetObject, ObjectType, StairSide, TableCloth } from '../types';
import { TABLE_PRESETS, TABLE_CLOTH_MATERIALS } from '../constants';

interface PropertiesPanelProps {
  selectedIds: Set<string>;
  objects: BanquetObject[];
  updateObject: (id: string, updates: Partial<BanquetObject>) => void;
  deleteSelected: () => void;
  handleBulkPropertyUpdate: (ids: Set<string>, updates: Partial<BanquetObject>) => void;
  handleAddStair: (stageId: string) => void;
  handleRemoveStair: (stageId: string, stairId: string) => void;
  handleUpdateStair: (stageId: string, stairId: string, updates: Partial<import('../types').StairConfig>) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedIds, objects, updateObject, deleteSelected,
  handleBulkPropertyUpdate, handleAddStair, handleRemoveStair, handleUpdateStair
}) => {
  const selectedCount = selectedIds.size;
  const singleSelectedId = selectedCount === 1 ? Array.from(selectedIds)[0] : null;
  const selectedObj = singleSelectedId ? objects.find(o => o.id === singleSelectedId) : null;
  const isSelectedLight = selectedObj?.type.includes('LIGHT');

  return (
    <div className="p-5 border-t border-slate-200 bg-slate-50 max-h-[40vh] overflow-y-auto shadow-[inset_0_4px_6px_-1px_rgba(0,0,0,0.05)]">
      {selectedCount > 0 ? (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-1">
              <MousePointer2 className="w-3 h-3" />
              {selectedCount === 1 ? 'Selected Object' : `${selectedCount} Objects Selected`}
            </h3>
            <button onClick={deleteSelected} className="text-slate-400 hover:text-red-500 transition-colors" title="Delete (Del)">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Bulk Color Edit */}
          {selectedCount > 1 && (
            <div className="space-y-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <label className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-2">
                <PaintBucket className="w-3 h-3" /> 批量修改顏色 (Bulk Color)
              </label>
              <div className="flex items-center gap-2">
                <input type="color" className="w-full h-8 cursor-pointer rounded border border-slate-200" onChange={(e) => handleBulkPropertyUpdate(selectedIds, { color: e.target.value })} />
              </div>
            </div>
          )}

          {/* Single Object Editor */}
          {selectedObj && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Label</label>
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-slate-400" />
                  <input type="text" value={selectedObj.label || ''} onChange={(e) => updateObject(selectedObj.id, { label: e.target.value })} className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs" />
                </div>
              </div>

              {/* Position */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1"><Move3d className="w-3 h-3" /> Position (X, Y, Z)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-400">X</span>
                    <input type="number" step="0.1" value={Math.round(selectedObj.position.x * 100) / 100} onChange={(e) => updateObject(selectedObj.id, { position: { ...selectedObj.position, x: parseFloat(e.target.value) } })} className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-xs" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-400">Y (Height)</span>
                    <input type="number" step="0.1" value={Math.round(selectedObj.position.y * 100) / 100} onChange={(e) => updateObject(selectedObj.id, { position: { ...selectedObj.position, y: parseFloat(e.target.value) } })} className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-xs" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-400">Z</span>
                    <input type="number" step="0.1" value={Math.round(selectedObj.position.z * 100) / 100} onChange={(e) => updateObject(selectedObj.id, { position: { ...selectedObj.position, z: parseFloat(e.target.value) } })} className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-xs" />
                  </div>
                </div>
              </div>

              {/* Color */}
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={selectedObj.color} onChange={(e) => updateObject(selectedObj.id, { color: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                </div>
              </div>

              {/* Table Cloth Presets */}
              {(selectedObj.type === ObjectType.ROUND_TABLE || selectedObj.type === ObjectType.RECT_TABLE) && (
                <div className="space-y-3 border-t border-slate-200 pt-3">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                    <PaintBucket className="w-3 h-3" /> 桌布預設 (Table Cloth)
                  </label>
                  {/* Preset swatches */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {TABLE_PRESETS.map(p => {
                      const isActive = selectedObj.color === p.color && selectedObj.tableCloth === p.cloth;
                      return (
                        <button
                          key={p.id}
                          onClick={() => updateObject(selectedObj.id, { color: p.color, tableCloth: p.cloth })}
                          className={`group flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all ${isActive ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
                          title={`${p.name} (${TABLE_CLOTH_MATERIALS[p.cloth].label})`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full border-2 shadow-sm transition-transform group-hover:scale-110 ${isActive ? 'border-blue-400 scale-110' : 'border-slate-200'}`}
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="text-[9px] font-medium text-slate-500 leading-tight">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Material type selector */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-semibold text-slate-400 uppercase">材質 (Material)</label>
                    <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
                      {(Object.entries(TABLE_CLOTH_MATERIALS) as [TableCloth, typeof TABLE_CLOTH_MATERIALS[TableCloth]][]).map(([key, m]) => (
                        <button
                          key={key}
                          onClick={() => updateObject(selectedObj.id, { tableCloth: key })}
                          className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${(selectedObj.tableCloth || 'linen') === key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Pan */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-semibold text-slate-500 uppercase">
                  <span>Pan</span> <span>{Math.round(selectedObj.rotation.y * (180 / Math.PI))}°</span>
                </div>
                <input type="range" min={-Math.PI} max={Math.PI} step={0.1} value={selectedObj.rotation.y} onChange={(e) => updateObject(selectedObj.id, { rotation: { ...selectedObj.rotation, y: parseFloat(e.target.value) } })} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
              </div>

              {/* Round Table Size */}
              {selectedObj.type === ObjectType.ROUND_TABLE && (
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Size (Feet)</label>
                  <select value={selectedObj.customSize || 6} onChange={(e) => updateObject(selectedObj.id, { customSize: parseInt(e.target.value) })} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs">
                    <option value={4}>4 尺 (5人)</option>
                    <option value={5}>5 尺 (8人)</option>
                    <option value={6}>6 尺 (10人)</option>
                    <option value={8}>8 尺 (12人)</option>
                  </select>
                </div>
              )}

              {/* Red Carpet Dimensions */}
              {selectedObj.type === ObjectType.RED_CARPET && (
                <div className="space-y-2 border-t border-slate-200 pt-2">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Red Carpet Dimensions</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500">Width (m)</label>
                      <input type="number" step="0.1" min="0.5" value={selectedObj.customWidth || 1.5} onChange={(e) => updateObject(selectedObj.id, { customWidth: parseFloat(e.target.value) })} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500">Length (m)</label>
                      <input type="number" step="0.5" min="1" value={selectedObj.customDepth || 10} onChange={(e) => updateObject(selectedObj.id, { customDepth: parseFloat(e.target.value) })} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs" />
                    </div>
                  </div>
                </div>
              )}

              {/* Stage Config */}
              {selectedObj.type === ObjectType.STAGE && (
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <h4 className="text-[10px] font-bold text-slate-600 uppercase">Stage Configuration</h4>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-semibold">Width (m)</label>
                      <input type="number" step="0.5" value={selectedObj.customWidth} onChange={(e) => updateObject(selectedObj.id, { customWidth: parseFloat(e.target.value) })} className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-semibold">Depth (m)</label>
                      <input type="number" step="0.5" value={selectedObj.customDepth} onChange={(e) => updateObject(selectedObj.id, { customDepth: parseFloat(e.target.value) })} className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-semibold">Height (m)</label>
                      <input type="number" step="0.1" value={selectedObj.customHeight} onChange={(e) => updateObject(selectedObj.id, { customHeight: parseFloat(e.target.value) })} className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-xs" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1"><Footprints className="w-3 h-3" /> Stairs</label>
                      <button onClick={() => handleAddStair(selectedObj.id)} className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold hover:bg-blue-100 transition-colors">+ Add</button>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                      {(selectedObj.stairs || []).map((stair, idx) => (
                        <div key={stair.id} className="bg-slate-50 p-2 rounded border border-slate-100 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-slate-400 w-3">{idx + 1}</span>
                            <select
                              value={stair.side}
                              onChange={(e) => handleUpdateStair(selectedObj.id, stair.id, { side: e.target.value as StairSide })}
                              className="flex-1 bg-white border border-slate-200 text-[10px] rounded px-1 py-0.5"
                            >
                              <option value="front">Front (前)</option>
                              <option value="back">Back (後)</option>
                              <option value="left">Left (左)</option>
                              <option value="right">Right (右)</option>
                            </select>
                            <button onClick={() => handleRemoveStair(selectedObj.id, stair.id)} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-slate-400">Pos</span>
                              <input type="range" min={-5} max={5} step={0.1} value={stair.offset} onChange={(e) => handleUpdateStair(selectedObj.id, stair.id, { offset: parseFloat(e.target.value) })} className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-slate-400">Wid</span>
                              <input type="number" step="0.1" value={stair.width} onChange={(e) => handleUpdateStair(selectedObj.id, stair.id, { width: parseFloat(e.target.value) })} className="w-full bg-white border border-slate-200 rounded px-1 py-0.5 text-[10px]" />
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!selectedObj.stairs || selectedObj.stairs.length === 0) && (
                        <div className="text-[9px] text-slate-400 text-center py-2 italic">No stairs added</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Stand Type */}
              {(selectedObj.type === ObjectType.SPEAKER_15 || selectedObj.type === ObjectType.LIGHT_STAND) && (
                <div className="space-y-2 border-t border-slate-200 pt-2">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Stand Base</label>
                  <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
                    <button
                      onClick={() => updateObject(selectedObj.id, { standType: 'TRIPOD' })}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${!selectedObj.standType || selectedObj.standType === 'TRIPOD' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Tripod (腳架)
                    </button>
                    <button
                      onClick={() => updateObject(selectedObj.id, { standType: 'PLATE' })}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${selectedObj.standType === 'PLATE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Plate (鐵板)
                    </button>
                  </div>
                </div>
              )}

              {/* Light Controls */}
              {isSelectedLight && (
                <>
                  <div className="space-y-2 border-t border-slate-200 pt-2">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500 uppercase"><span>Head Tilt</span><span>{Math.round((selectedObj.rotation.x || 0) * (180 / Math.PI))}°</span></div>
                    <input type="range" min={-Math.PI / 2} max={Math.PI / 2} step={0.1} value={selectedObj.rotation.x || 0} onChange={(e) => updateObject(selectedObj.id, { rotation: { ...selectedObj.rotation, x: parseFloat(e.target.value) } })} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500 uppercase"><span>Intensity</span><span>{Math.round((selectedObj.intensity || 1) * 100)}%</span></div>
                    <input type="range" min={0} max={3} step={0.1} value={selectedObj.intensity || 1} onChange={(e) => updateObject(selectedObj.id, { intensity: parseFloat(e.target.value) })} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
          <MousePointer2 className="w-8 h-8 opacity-20" />
          <span className="text-xs font-medium">Select an object (Shift+Click for multiple)</span>
        </div>
      )}
    </div>
  );
};
