import { useCallback } from 'react';
import { BanquetObject, StairConfig } from '../types';
import { INITIAL_OBJECTS } from '../constants';
import { useHistory } from './useHistory';
import { cloneTrussConfig } from '../trussConfig';

function applyUpdates(object: BanquetObject, updates: Partial<BanquetObject>): BanquetObject {
  const unchanged = (Object.keys(updates) as Array<keyof BanquetObject>).every(key => {
    if (Object.is(object[key], updates[key])) return true;
    if (key === 'position' || key === 'rotation' || key === 'scale') {
      const next = updates[key];
      return next !== undefined && object[key].x === next.x && object[key].y === next.y && object[key].z === next.z;
    }
    return false;
  });
  return unchanged ? object : { ...object, ...updates };
}

function updateMatching(objects: BanquetObject[], matches: (object: BanquetObject) => boolean, updates: Partial<BanquetObject>): BanquetObject[] {
  let changed = false;
  const next = objects.map(object => {
    const updated = matches(object) ? applyUpdates(object, updates) : object;
    if (updated !== object) changed = true;
    return updated;
  });
  return changed ? next : objects;
}

export function useObjects() {
  const { state: objects, set: setObjects, undo, redo, reset: resetObjects, canUndo, canRedo } = useHistory<BanquetObject[]>(INITIAL_OBJECTS);

  const updateObject = useCallback((id: string, updates: Partial<BanquetObject>, mergeKey?: string) => {
    setObjects(prev => updateMatching(prev, obj => obj.id === id, updates), { mergeKey });
  }, [setObjects]);

  const deleteObject = useCallback((id: string) => {
    setObjects(prev => prev.some(obj => obj.id === id) ? prev.filter(obj => obj.id !== id) : prev);
  }, [setObjects]);

  const deleteByIds = useCallback((ids: Set<string>) => {
    setObjects(prev => prev.some(obj => ids.has(obj.id)) ? prev.filter(obj => !ids.has(obj.id)) : prev);
  }, [setObjects]);

  const handleBatchUpdate = useCallback((updates: Record<string, Partial<BanquetObject>>) => {
    setObjects(prev => prev.map(obj => updates[obj.id] ? { ...obj, ...updates[obj.id] } : obj));
  }, [setObjects]);

  const handleBulkPropertyUpdate = useCallback((ids: Set<string>, updates: Partial<BanquetObject>, mergeKey?: string) => {
    setObjects(prev => updateMatching(prev, obj => ids.has(obj.id), updates), { mergeKey });
  }, [setObjects]);

  const handleBatchAddObjects = useCallback((newObjects: BanquetObject[]) => {
    setObjects(prev => [...prev, ...newObjects]);
    return new Set(newObjects.map(o => o.id));
  }, [setObjects]);

  const duplicateObjects = useCallback((ids: Set<string>) => {
    const toDuplicate = objects.filter(o => ids.has(o.id));
    if (toDuplicate.length === 0) return [];
    const newObjs = toDuplicate.map(obj => ({
      ...obj,
      id: crypto.randomUUID(),
      position: { ...obj.position, x: obj.position.x + 1, z: obj.position.z + 1 },
      label: obj.label ? `${obj.label} (copy)` : '',
      stairs: obj.stairs?.map(s => ({ ...s, id: crypto.randomUUID() })),
      trussStructure: obj.trussStructure ? {
        ...cloneTrussConfig(obj.trussStructure),
        groupId: crypto.randomUUID(),
        quantity: 1,
      } : undefined,
    }));
    setObjects(prev => [...prev, ...newObjs]);
    return newObjs;
  }, [objects, setObjects]);

  // --- Stair Management ---
  const handleAddStair = useCallback((stageId: string) => {
    const newStair: StairConfig = { id: crypto.randomUUID(), side: 'front', offset: 0, width: 1.5 };
    setObjects(prev => prev.map(obj => {
      if (obj.id !== stageId) return obj;
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


  return {
    objects,
    setObjects,
    resetObjects,
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
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
