import { useEffect, useRef } from 'react';
import { BanquetObject } from '../types';

interface UseKeyboardParams {
  mode: 'EDIT' | 'VIEW';
  selectedIds: Set<string>;
  objects: BanquetObject[];
  deleteByIds: (ids: Set<string>) => void;
  handleBatchUpdate: (updates: Record<string, Partial<BanquetObject>>) => void;
  setSelectedIds: (ids: Set<string>) => void;
  setIsDrawMode: (v: boolean) => void;
  undo: () => void;
  redo: () => void;
  duplicateObjects: (ids: Set<string>) => BanquetObject[];
}

export function useKeyboard({
  mode, selectedIds, objects,
  deleteByIds, handleBatchUpdate,
  setSelectedIds, setIsDrawMode,
  undo, redo, duplicateObjects
}: UseKeyboardParams) {
  const selectedIdsRef = useRef(selectedIds);
  const objectsRef = useRef(objects);
  selectedIdsRef.current = selectedIds;
  objectsRef.current = objects;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const metaOrCtrl = e.metaKey || e.ctrlKey;

      // Undo/Redo works in both modes
      if (metaOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (metaOrCtrl && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      if (mode !== 'EDIT') return;

      const ids = selectedIdsRef.current;
      const objs = objectsRef.current;

      // Duplicate
      if (metaOrCtrl && e.key === 'd') {
        e.preventDefault();
        if (ids.size > 0) {
          const newObjs = duplicateObjects(ids);
          setSelectedIds(new Set(newObjs.map(o => o.id)));
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (ids.size > 0) {
          deleteByIds(ids);
          setSelectedIds(new Set());
        }
      } else if (e.key === 'Escape') {
        setSelectedIds(new Set());
        setIsDrawMode(false);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (ids.size > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 1 : 0.1;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dz = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;

          const updates: Record<string, Partial<BanquetObject>> = {};
          ids.forEach(id => {
            const obj = objs.find(o => o.id === id);
            if (obj) {
              updates[id] = { position: { ...obj.position, x: obj.position.x + dx, z: obj.position.z + dz } };
            }
          });
          handleBatchUpdate(updates);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, deleteByIds, handleBatchUpdate, setSelectedIds, setIsDrawMode, undo, redo, duplicateObjects]);
}
