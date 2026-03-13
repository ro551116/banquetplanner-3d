import { useRef, useCallback, useEffect } from 'react';
import { BanquetObject, HallConfig, DrawingPath } from '../types';
import { scenesApi } from '../services/scenesApi';

const SAVE_DEBOUNCE = 2000; // ms

interface UseSceneIOParams {
  sceneId: string | null;
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
  sceneId, hall, objects, drawings,
  setHall, setObjects, setDrawings,
  setSelectedIds, setIsDrawMode, setMode
}: UseSceneIOParams) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const loadedRef = useRef(false);
  const saveCountRef = useRef(0);

  // --- Load scene from API ---
  const loadScene = useCallback(async (id: string) => {
    try {
      const scene = await scenesApi.get(id);
      loadedRef.current = false; // prevent auto-save during load
      if (scene.data.hall) setHall(scene.data.hall);
      if (scene.data.objects) setObjects(scene.data.objects);
      if (scene.data.drawings) setDrawings(scene.data.drawings ?? []);
      // Allow auto-save after a tick
      setTimeout(() => { loadedRef.current = true; saveCountRef.current = 0; }, 100);
    } catch (err) {
      console.error('Load scene failed:', err);
    }
  }, [setHall, setObjects, setDrawings]);

  // --- Auto-save to API (debounced) ---
  useEffect(() => {
    if (!sceneId || !loadedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await scenesApi.update(sceneId, {
          data: { hall, objects, drawings },
        });
        saveCountRef.current++;
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }, SAVE_DEBOUNCE);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [sceneId, hall, objects, drawings]);

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
        // Mark as loaded so auto-save kicks in
        loadedRef.current = true;
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
    loadScene,
    exportScene,
    handleImportClick,
    handleFileChange,
    takeScreenshot,
  };
}
