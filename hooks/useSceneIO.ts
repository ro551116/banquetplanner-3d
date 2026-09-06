import { useState, useRef, useCallback, useEffect } from 'react';
import { BanquetObject, HallConfig, DrawingPath } from '../types';
import { scenesApi } from '../services/scenesApi';
import { INITIAL_HALL, INITIAL_OBJECTS } from '../constants';

const SAVE_DEBOUNCE = 2000; // ms

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface SceneSnapshot {
  sceneId: string;
  hall: HallConfig;
  objects: BanquetObject[];
  drawings: DrawingPath[];
}

interface UseSceneIOParams {
  sceneId: string | null;
  hall: HallConfig;
  objects: BanquetObject[];
  drawings: DrawingPath[];
  setHall: (hall: HallConfig) => void;
  setObjects: (objects: BanquetObject[]) => void;
  resetObjects: (objects: BanquetObject[]) => void;
  setDrawings: (drawings: DrawingPath[]) => void;
  setSelectedIds: (ids: Set<string>) => void;
  setIsDrawMode: (v: boolean) => void;
  setMode: (mode: 'EDIT' | 'VIEW') => void;
}

export function useSceneIO({
  sceneId, hall, objects, drawings,
  setHall, setObjects, resetObjects, setDrawings,
  setSelectedIds, setIsDrawMode, setMode
}: UseSceneIOParams) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const requestGenRef = useRef(0);
  const currentSceneIdRef = useRef<string | null>(sceneId);
  currentSceneIdRef.current = sceneId;

  const cleanBaselineRef = useRef<SceneSnapshot | null>(null);
  const lastSeenTupleRef = useRef<{ hall: HallConfig; objects: BanquetObject[]; drawings: DrawingPath[] } | null>(null);
  const latestSnapshotRef = useRef<SceneSnapshot | null>(null);
  const latestRevisionRef = useRef(0);
  const savedRevisionRef = useRef(0);

  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
  const debounceTimerRef = useRef<number | undefined>(undefined);

  const executeSave = useCallback(async (): Promise<void> => {
    if (inFlightPromiseRef.current) {
      await inFlightPromiseRef.current;
    }

    if (!latestSnapshotRef.current || latestRevisionRef.current <= savedRevisionRef.current) {
      return;
    }

    const snapshot = latestSnapshotRef.current;
    const revision = latestRevisionRef.current;
    const targetSceneId = snapshot.sceneId;

    setSaveStatus('saving');
    setSaveError(null);

    const savePromise = (async () => {
      try {
        await scenesApi.update(targetSceneId, {
          data: {
            hall: snapshot.hall,
            objects: snapshot.objects,
            drawings: snapshot.drawings,
          },
        });

        if (currentSceneIdRef.current === targetSceneId) {
          savedRevisionRef.current = Math.max(savedRevisionRef.current, revision);
          if (latestRevisionRef.current === savedRevisionRef.current) {
            setSaveStatus('saved');
          } else {
            setSaveStatus('dirty');
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = window.setTimeout(() => {
              executeSave().catch(() => {});
            }, SAVE_DEBOUNCE);
          }
        }
      } catch (err: unknown) {
        if (currentSceneIdRef.current === targetSceneId) {
          setSaveStatus('error');
          setSaveError(err instanceof Error ? err.message : 'Failed to save scene');
        }
        throw err;
      } finally {
        if (inFlightPromiseRef.current === savePromise) {
          inFlightPromiseRef.current = null;
        }
      }
    })();

    inFlightPromiseRef.current = savePromise;
    await savePromise;
  }, []);

  const flushSave = useCallback(async (): Promise<void> => {
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = undefined;

    while (inFlightPromiseRef.current || latestRevisionRef.current > savedRevisionRef.current) {
      if (inFlightPromiseRef.current) {
        await inFlightPromiseRef.current;
      }
      if (latestRevisionRef.current > savedRevisionRef.current) {
        await executeSave();
      }
    }
  }, [executeSave]);

  // --- Load scene from API ---
  const loadScene = useCallback(async (id: string): Promise<boolean> => {
    if (currentSceneIdRef.current && (latestRevisionRef.current > savedRevisionRef.current || inFlightPromiseRef.current)) {
      try {
        await flushSave();
      } catch (err) {
        console.error('Failed to flush current scene before switching:', err);
        return false;
      }
    }

    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = undefined;

    setIsLoading(true);
    setSaveError(null);
    const myGen = ++requestGenRef.current;

    try {
      const scene = await scenesApi.get(id);
      if (myGen !== requestGenRef.current) {
        return false;
      }

      const data = scene.data ?? {};
      const targetHall = data.hall ?? INITIAL_HALL;
      const targetObjects = data.objects ?? INITIAL_OBJECTS;
      const targetDrawings = data.drawings ?? [];

      setHall(targetHall);
      resetObjects(targetObjects);
      setDrawings(targetDrawings);
      setSelectedIds(new Set());
      setIsDrawMode(false);
      setMode('EDIT');

      cleanBaselineRef.current = {
        sceneId: id,
        hall: targetHall,
        objects: targetObjects,
        drawings: targetDrawings,
      };
      lastSeenTupleRef.current = {
        hall: targetHall,
        objects: targetObjects,
        drawings: targetDrawings,
      };
      latestSnapshotRef.current = {
        sceneId: id,
        hall: targetHall,
        objects: targetObjects,
        drawings: targetDrawings,
      };
      latestRevisionRef.current = 0;
      savedRevisionRef.current = 0;
      setSaveStatus('idle');
      setIsLoading(false);
      return true;
    } catch (err: unknown) {
      if (myGen === requestGenRef.current) {
        setIsLoading(false);
        setSaveError(err instanceof Error ? err.message : 'Failed to load scene');
      }
      return false;
    }
  }, [flushSave, setHall, resetObjects, setDrawings, setSelectedIds, setIsDrawMode, setMode]);

  // --- Change detection for auto-save ---
  useEffect(() => {
    if (!sceneId || isLoading) return;

    if (!lastSeenTupleRef.current || cleanBaselineRef.current?.sceneId !== sceneId) {
      lastSeenTupleRef.current = { hall, objects, drawings };
      return;
    }

    const changed =
      hall !== lastSeenTupleRef.current.hall ||
      objects !== lastSeenTupleRef.current.objects ||
      drawings !== lastSeenTupleRef.current.drawings;

    if (changed) {
      lastSeenTupleRef.current = { hall, objects, drawings };
      latestRevisionRef.current++;
      latestSnapshotRef.current = { sceneId, hall, objects, drawings };
      setSaveStatus('dirty');
      setSaveError(null);

      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = window.setTimeout(() => {
        executeSave().catch(() => {});
      }, SAVE_DEBOUNCE);
    }
  }, [sceneId, hall, objects, drawings, isLoading, executeSave]);

  // --- Warn before unload if dirty or saving ---
  useEffect(() => {
    const isUnsaved = saveStatus === 'dirty' || saveStatus === 'saving';
    if (!isUnsaved) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveStatus]);

  // --- Export JSON file ---
  const exportScene = useCallback(() => {
    const sceneData = {
      metadata: { appName: 'BanquetPlanner 3D', version: '1.0', timestamp: new Date().toISOString() },
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
        console.error('Import failed:', err);
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
        console.error('Screenshot failed:', err);
      }
    }
  }, []);

  return {
    fileInputRef,
    loadScene,
    flushSave,
    saveStatus,
    saveError,
    isLoading,
    exportScene,
    handleImportClick,
    handleFileChange,
    takeScreenshot,
  };
}
