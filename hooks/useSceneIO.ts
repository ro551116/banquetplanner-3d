import { useRef, useCallback, useEffect } from 'react';
import { BanquetObject, HallConfig, DrawingPath } from '../types';

const STORAGE_KEY = 'banquet3d-scene';
const SAVE_DEBOUNCE = 1000; // ms

interface UseSceneIOParams {
  hall: HallConfig;
  objects: BanquetObject[];
  drawings: DrawingPath[];
  setHall: (hall: HallConfig) => void;
  setObjects: (objects: BanquetObject[]) => void;
  setDrawings: (drawings: DrawingPath[]) => void;
  setSelectedIds: (ids: Set<string>) => void;
  setIsDrawMode: (v: boolean) => void;
  setMode: (mode: 'EDIT' | 'VIEW') => void;
}

export function useSceneIO({
  hall, objects, drawings,
  setHall, setObjects, setDrawings,
  setSelectedIds, setIsDrawMode, setMode
}: UseSceneIOParams) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const initializedRef = useRef(false);

  // --- Auto-load from localStorage on mount ---
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.hall) setHall(data.hall);
      if (data.objects) setObjects(data.objects);
      if (data.drawings) setDrawings(data.drawings);
    } catch {
      // corrupted data — ignore
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Auto-save to localStorage on changes (debounced) ---
  useEffect(() => {
    // Skip the very first render (before load completes)
    if (!initializedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        const data = JSON.stringify({ hall, objects, drawings });
        localStorage.setItem(STORAGE_KEY, data);
      } catch {
        // storage full — ignore
      }
    }, SAVE_DEBOUNCE);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [hall, objects, drawings]);

  // --- Export JSON file ---
  const exportScene = useCallback(() => {
    const sceneData = {
      metadata: { appName: "BanquetPlanner 3D", version: "1.0", timestamp: new Date().toISOString() },
      hall, objects, drawings
    };
    const blob = new Blob([JSON.stringify(sceneData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `banquet-scene-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [hall, objects, drawings]);

  // --- Import JSON file ---
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        if (data.hall) setHall(data.hall);
        if (data.objects) setObjects(data.objects);
        if (data.drawings) setDrawings(data.drawings);
        setSelectedIds(new Set());
        setIsDrawMode(false);
        setMode('EDIT');
      } catch (err) {
        console.error("Import failed:", err);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }, [setHall, setObjects, setDrawings, setSelectedIds, setIsDrawMode, setMode]);

  // --- Screenshot ---
  const takeScreenshot = useCallback(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      try {
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        link.setAttribute('download', `banquet-view-${timestamp}.png`);
        link.setAttribute('href', dataURL);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error("Screenshot failed:", err);
      }
    }
  }, []);

  return {
    fileInputRef,
    exportScene,
    handleImportClick,
    handleFileChange,
    takeScreenshot,
  };
}
