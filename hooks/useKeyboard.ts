import { useEffect, useRef } from 'react';
import { BanquetObject } from '../types';
import { EditTool } from '../interaction';

export interface UseKeyboardParams {
  enabled: boolean;
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
  onCancel: () => boolean;
  busy: boolean;
  tool: EditTool;
  setTool: (tool: EditTool) => void;
  snapStep: number;
}

export function useKeyboard({
  enabled,
  mode,
  selectedIds,
  objects,
  deleteByIds,
  handleBatchUpdate,
  setSelectedIds,
  setIsDrawMode,
  undo,
  redo,
  duplicateObjects,
  onCancel,
  busy,
  tool,
  setTool,
  snapStep,
}: UseKeyboardParams) {
  const selectedIdsRef = useRef(selectedIds);
  const objectsRef = useRef(objects);
  const toolRef = useRef(tool);
  const snapStepRef = useRef(snapStep);
  const busyRef = useRef(busy);
  const onCancelRef = useRef(onCancel);
  const setToolRef = useRef(setTool);

  selectedIdsRef.current = selectedIds;
  objectsRef.current = objects;
  toolRef.current = tool;
  snapStepRef.current = snapStep;
  busyRef.current = busy;
  onCancelRef.current = onCancel;
  setToolRef.current = setTool;

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCancelRef.current()) {
        e.preventDefault();
        return;
      }
      // Guard input / textarea / select / contenteditable
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable ||
        target?.closest?.('[contenteditable="true"]')
      ) {
        return;
      }

      const metaOrCtrl = e.metaKey || e.ctrlKey;

      // Undo: Ctrl+Z (without Shift)
      if (metaOrCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        // During active manipulation, Ctrl/Cmd+Z first cancels instead of undoing older committed objects
        if (onCancelRef.current()) {
          return;
        }
        if (busyRef.current) {
          return;
        }
        undo();
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((metaOrCtrl && e.key.toLowerCase() === 'z' && e.shiftKey) || (metaOrCtrl && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        if (busyRef.current) {
          return;
        }
        redo();
        return;
      }

      // Remaining shortcuts only active in EDIT mode
      if (mode !== 'EDIT') return;

      // Escape key: invokes onCancel first; if consumed don't clear selection; otherwise clear selection and drawing
      if (e.key === 'Escape') {
        e.preventDefault();
        const consumed = onCancelRef.current();
        if (!consumed) {
          setSelectedIds(new Set());
          setIsDrawMode(false);
        }
        return;
      }

      // Tool shortcuts (G / R / H) in edit only
      if (!metaOrCtrl && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'g') {
          e.preventDefault();
          if (!busyRef.current) setToolRef.current('move');
          return;
        }
        if (k === 'r') {
          e.preventDefault();
          if (!busyRef.current) setToolRef.current('rotate');
          return;
        }
        if (k === 'h') {
          e.preventDefault();
          if (!busyRef.current) setToolRef.current('height');
          return;
        }
      }

      // Duplicate: Ctrl+D / Cmd+D
      if (metaOrCtrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (busyRef.current) return;
        const ids = selectedIdsRef.current;
        if (ids.size > 0) {
          const newObjs = duplicateObjects(ids);
          setSelectedIds(new Set(newObjs.map(o => o.id)));
        }
        return;
      }

      // Delete: Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (busyRef.current) return;
        const ids = selectedIdsRef.current;
        if (ids.size > 0) {
          deleteByIds(ids);
          setSelectedIds(new Set());
        }
        return;
      }

      // Arrow nudges
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (busyRef.current) return;
        const ids = selectedIdsRef.current;
        const objs = objectsRef.current;
        if (ids.size === 0) return;

        e.preventDefault();

        const currentSnap = snapStepRef.current;
        const baseDist = currentSnap > 0 ? currentSnap : 0.1;
        const dist = e.shiftKey ? baseDist * 10 : baseDist;

        const baseAngleDeg = currentSnap > 0 ? 15 : 1;
        const angleDeg = e.shiftKey ? baseAngleDeg * 10 : baseAngleDeg;
        const angleRad = (angleDeg * Math.PI) / 180;

        const currentTool = toolRef.current;
        const updates: Record<string, Partial<BanquetObject>> = {};

        const selected = objs.filter(object => ids.has(object.id));
        if (currentTool === 'move') {
          const dx = e.key === 'ArrowLeft' ? -dist : e.key === 'ArrowRight' ? dist : 0;
          const dz = e.key === 'ArrowUp' ? -dist : e.key === 'ArrowDown' ? dist : 0;
          for (const object of selected) {
            updates[object.id] = { position: { ...object.position, x: object.position.x + dx, z: object.position.z + dz } };
          }
        } else if (currentTool === 'height') {
          const dy = e.key === 'ArrowUp' ? dist : e.key === 'ArrowDown' ? -dist : 0;
          if (dy === 0) return;
          for (const object of selected) updates[object.id] = { position: { ...object.position, y: object.position.y + dy } };
        } else {
          const angle = e.key === 'ArrowLeft' ? -angleRad : e.key === 'ArrowRight' ? angleRad : 0;
          if (angle === 0 || selected.length === 0) return;
          const cx = selected.reduce((sum, object) => sum + object.position.x, 0) / selected.length;
          const cz = selected.reduce((sum, object) => sum + object.position.z, 0) / selected.length;
          const cos = Math.cos(angle), sin = Math.sin(angle);
          for (const object of selected) {
            const x = object.position.x - cx, z = object.position.z - cz;
            updates[object.id] = {
              position: { x: cx + x * cos + z * sin, y: object.position.y, z: cz - x * sin + z * cos },
              rotation: { ...object.rotation, y: object.rotation.y + angle },
            };
          }
        }
        if (Object.keys(updates).length) handleBatchUpdate(updates);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, mode, deleteByIds, handleBatchUpdate, setSelectedIds, setIsDrawMode, undo, redo, duplicateObjects]);
}
