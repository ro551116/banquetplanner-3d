import { useCallback } from 'react';
import { BanquetObject, ObjectType, HallConfig, StairConfig } from '../types';
import { INITIAL_OBJECTS, createObjectConfig } from '../constants';
import { generateLayout } from '../services/geminiService';
import { useHistory } from './useHistory';

export function useObjects() {
  const { state: objects, set: setObjects, undo, redo, canUndo, canRedo } = useHistory<BanquetObject[]>(INITIAL_OBJECTS);

  const addObject = useCallback((type: ObjectType, pos?: { x: number; y: number; z: number }) => {
    const newObj = createObjectConfig(type, pos);
    setObjects(prev => [...prev, newObj]);
    return newObj;
  }, [setObjects]);

  const updateObject = useCallback((id: string, updates: Partial<BanquetObject>) => {
    setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...updates } : obj));
  }, [setObjects]);

  const deleteObject = useCallback((id: string) => {
    setObjects(prev => prev.filter(obj => obj.id !== id));
  }, [setObjects]);

  const deleteByIds = useCallback((ids: Set<string>) => {
    setObjects(prev => prev.filter(obj => !ids.has(obj.id)));
  }, [setObjects]);

  const handleBatchUpdate = useCallback((updates: Record<string, Partial<BanquetObject>>) => {
    setObjects(prev => prev.map(obj => updates[obj.id] ? { ...obj, ...updates[obj.id] } : obj));
  }, [setObjects]);

  const handleBulkPropertyUpdate = useCallback((ids: Set<string>, updates: Partial<BanquetObject>) => {
    setObjects(prev => prev.map(obj => ids.has(obj.id) ? { ...obj, ...updates } : obj));
  }, [setObjects]);

  const handleBatchAddObjects = useCallback((newObjects: BanquetObject[]) => {
    setObjects(prev => [...prev, ...newObjects]);
    return new Set(newObjects.map(o => o.id));
  }, [setObjects]);

  const duplicateObjects = useCallback((ids: Set<string>) => {
    const duplicated: BanquetObject[] = [];
    setObjects(prev => {
      const toDuplicate = prev.filter(o => ids.has(o.id));
      const newObjs = toDuplicate.map(obj => ({
        ...obj,
        id: crypto.randomUUID(),
        position: { ...obj.position, x: obj.position.x + 1, z: obj.position.z + 1 },
        label: obj.label ? `${obj.label} (copy)` : '',
        stairs: obj.stairs?.map(s => ({ ...s, id: crypto.randomUUID() })),
      }));
      duplicated.push(...newObjs);
      return [...prev, ...newObjs];
    });
    return duplicated;
  }, [setObjects]);

  // --- Stair Management ---
  const handleAddStair = useCallback((stageId: string) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id !== stageId) return obj;
      const newStair: StairConfig = { id: crypto.randomUUID(), side: 'front', offset: 0, width: 1.5 };
      return { ...obj, stairs: [...(obj.stairs || []), newStair] };
    }));
  }, [setObjects]);

  const handleRemoveStair = useCallback((stageId: string, stairId: string) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id !== stageId) return obj;
      return { ...obj, stairs: (obj.stairs || []).filter(s => s.id !== stairId) };
    }));
  }, [setObjects]);

  const handleUpdateStair = useCallback((stageId: string, stairId: string, updates: Partial<StairConfig>) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id !== stageId) return obj;
      return { ...obj, stairs: (obj.stairs || []).map(s => s.id === stairId ? { ...s, ...updates } : s) };
    }));
  }, [setObjects]);

  const handleGenerate = useCallback(async (hall: HallConfig, prompt: string) => {
    const newLayout = await generateLayout(hall.width, hall.length, prompt);
    const newObjects = newLayout.map(item => ({
      id: crypto.randomUUID(),
      type: item.type || ObjectType.ROUND_TABLE,
      position: item.position || { x: 0, y: 0, z: 0 },
      rotation: item.rotation || { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: (item.type as string)?.includes('LIGHT') ? '#fbbf24' : '#ffffff',
      label: item.label,
      customSize: item.type === ObjectType.ROUND_TABLE ? 6 : undefined,
      customWidth: item.type === ObjectType.STAGE ? 6 : undefined,
      customDepth: item.type === ObjectType.STAGE ? 4 : undefined,
      customHeight: item.type === ObjectType.STAGE ? 0.5 : undefined,
      intensity: (item.type as string)?.includes('LIGHT') ? 1.5 : undefined,
      standType: 'TRIPOD' as const,
      stairs: item.type === ObjectType.STAGE ? [{ id: crypto.randomUUID(), side: 'front' as const, offset: 0, width: 2 }] : undefined
    })) as BanquetObject[];
    setObjects(newObjects);
    return newObjects;
  }, [setObjects]);

  return {
    objects,
    setObjects,
    addObject,
    updateObject,
    deleteObject,
    deleteByIds,
    handleBatchUpdate,
    handleBulkPropertyUpdate,
    handleBatchAddObjects,
    duplicateObjects,
    handleAddStair,
    handleRemoveStair,
    handleUpdateStair,
    handleGenerate,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
