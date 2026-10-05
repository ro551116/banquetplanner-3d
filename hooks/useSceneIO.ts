import { useState, useRef, useCallback, useEffect } from 'react';
import { BanquetObject, HallConfig, DrawingPath } from '../types';
import { scenesApi } from '../services/scenesApi';
import { ApiError } from '../services/apiFetch';
import { normalizeSceneData } from '../services/sceneData';
import { INITIAL_OBJECTS } from '../constants';

const SAVE_DEBOUNCE = 2000; // ms

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

export function captureThumbnail(): string | null {
  const source = document.querySelector('canvas');
  if (!source || !source.width || !source.height) return null;
  try {
    const thumbnail = document.createElement('canvas');
    thumbnail.width = 480;
    thumbnail.height = 270;
    const context = thumbnail.getContext('2d');
    if (!context) return null;
    const scale = Math.max(480 / source.width, 270 / source.height);
    const width = 480 / scale;
    const height = 270 / scale;
    context.drawImage(source, (source.width - width) / 2, (source.height - height) / 2, width, height, 0, 0, 480, 270);
    return thumbnail.toDataURL('image/jpeg', 0.72);
  } catch {
    return null;
  }
}

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
  onNotice: (message: string, error?: boolean) => void;
}

export function useSceneIO({
  sceneId, hall, objects, drawings,
  setHall, setObjects, resetObjects, setDrawings,
  setSelectedIds, setIsDrawMode, setMode, onNotice
}: UseSceneIOParams) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sceneName, setSceneName] = useState('');
  useEffect(() => {
    if (!sceneId && !isLoading) setSceneName('');
  }, [sceneId, isLoading]);

  const requestGenRef = useRef(0);
  const currentSceneIdRef = useRef<string | null>(sceneId);
  currentSceneIdRef.current = sceneId;
  // Whether the loaded scene already has a list thumbnail; viewing alone should not re-upload one.
  const loadedThumbnailRef = useRef(false);

  const cleanBaselineRef = useRef<SceneSnapshot | null>(null);
  const lastSeenTupleRef = useRef<{ hall: HallConfig; objects: BanquetObject[]; drawings: DrawingPath[] } | null>(null);
  const latestSnapshotRef = useRef<SceneSnapshot | null>(null);
  const latestRevisionRef = useRef(0);
  const savedRevisionRef = useRef(0);

  const serverUpdatedAtRef = useRef<string | undefined>(undefined);
  const conflictRef = useRef(false);
  const retryBlockedRef = useRef(false);
  const retryIndexRef = useRef(0);
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
  const debounceTimerRef = useRef<number | undefined>(undefined);
  const retryTimerRef = useRef<number | undefined>(undefined);
  const clearSaveTimers = useCallback(() => {
    clearTimeout(debounceTimerRef.current);
    clearTimeout(retryTimerRef.current);
    debounceTimerRef.current = retryTimerRef.current = undefined;
  }, []);

  const executeSave = useCallback(async (overwrite = false): Promise<void> => {
    // Multiple waiters must re-check the lock after each await, not just once.
    while (inFlightPromiseRef.current) await inFlightPromiseRef.current;
    if (conflictRef.current && !overwrite) throw new Error('版本衝突，自動儲存已暫停');
    if (!latestSnapshotRef.current || (!overwrite && latestRevisionRef.current <= savedRevisionRef.current)) return;
    const snapshot = latestSnapshotRef.current;
    if (snapshot.sceneId !== currentSceneIdRef.current) return;
    const revision = latestRevisionRef.current;
    const generation = requestGenRef.current;
    clearSaveTimers();
    setSaveStatus(conflictRef.current ? 'conflict' : 'saving');
    setSaveError(null);
    const savePromise = (async () => {
      try {
        const result = await scenesApi.update(snapshot.sceneId, {
          data: { hall: snapshot.hall, objects: snapshot.objects, drawings: snapshot.drawings },
          ...(overwrite ? {} : { baseUpdatedAt: serverUpdatedAtRef.current }),
        });
        if (generation !== requestGenRef.current || currentSceneIdRef.current !== snapshot.sceneId) return;
        serverUpdatedAtRef.current = result.updated_at;
        conflictRef.current = false;
        retryBlockedRef.current = false;
        retryIndexRef.current = 0;
        savedRevisionRef.current = Math.max(savedRevisionRef.current, revision);
        setSaveStatus(latestRevisionRef.current === savedRevisionRef.current ? 'saved' : 'dirty');
        if (latestRevisionRef.current > savedRevisionRef.current) {
          debounceTimerRef.current = window.setTimeout(() => { executeSave().catch(() => {}); }, SAVE_DEBOUNCE);
        }
      } catch (error) {
        if (generation === requestGenRef.current && currentSceneIdRef.current === snapshot.sceneId) {
          const message = error instanceof Error ? error.message : '無法儲存場景';
          const conflict = error instanceof ApiError && error.status === 409;
          conflictRef.current = conflictRef.current || conflict;
          retryBlockedRef.current = error instanceof ApiError && error.status >= 400 && error.status < 500
            && error.status !== 408 && error.status !== 429;
          setSaveStatus(conflictRef.current ? 'conflict' : 'error');
          setSaveError(conflict ? '場景已在其他地方更新，自動儲存已暫停' : message);
          if (!conflictRef.current && !retryBlockedRef.current && latestRevisionRef.current > savedRevisionRef.current) {
            const delays = [2000, 5000, 15000, 30000];
            const delay = delays[Math.min(retryIndexRef.current++, delays.length - 1)];
            retryTimerRef.current = window.setTimeout(() => { executeSave().catch(() => {}); }, delay);
          }
        }
        throw error;
      } finally {
        if (inFlightPromiseRef.current === savePromise) inFlightPromiseRef.current = null;
      }
    })();
    inFlightPromiseRef.current = savePromise;
    await savePromise;
  }, [clearSaveTimers]);

  const flushSave = useCallback(async (): Promise<void> => {
    clearSaveTimers();
    if (conflictRef.current) throw new Error('版本衝突，自動儲存已暫停');
    while (inFlightPromiseRef.current || latestRevisionRef.current > savedRevisionRef.current) {
      await executeSave();
    }
  }, [executeSave, clearSaveTimers]);

  // --- Load scene from API ---
  const loadScene = useCallback(async (id: string, discardLocal = false): Promise<boolean> => {
    if (!discardLocal && currentSceneIdRef.current && (latestRevisionRef.current > savedRevisionRef.current || inFlightPromiseRef.current)) {
      try {
        await flushSave();
      } catch (err) {
        console.error('Failed to flush current scene before switching:', err);
        return false;
      }
    }

    clearSaveTimers();
    if (discardLocal && inFlightPromiseRef.current) await inFlightPromiseRef.current.catch(() => {});

    setIsLoading(true);
    setSaveError(null);
    const myGen = ++requestGenRef.current;

    try {
      const scene = await scenesApi.get(id);
      if (myGen !== requestGenRef.current) {
        return false;
      }

      const data = normalizeSceneData(scene.data);
      if (data.repaired > 0) console.warn(`場景資料已修復 ${data.repaired} 處`);
      setSceneName(scene.name);
      loadedThumbnailRef.current = Boolean(scene.thumbnail);
      serverUpdatedAtRef.current = scene.updated_at;
      conflictRef.current = false;
      retryBlockedRef.current = false;
      retryIndexRef.current = 0;
      const targetHall = data.hall;
      // A freshly created scene has no objects yet: start from the default stage and speakers.
      const targetObjects = data.present.objects ? data.objects : INITIAL_OBJECTS;
      const targetDrawings = data.drawings;

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
  }, [flushSave, clearSaveTimers, setHall, resetObjects, setDrawings, setSelectedIds, setIsDrawMode, setMode]);

  const resolveConflictReload = useCallback(async () => {
    const id = currentSceneIdRef.current;
    if (id && !(await loadScene(id, true))) throw new Error('無法載入最新版本，請稍後再試');
  }, [loadScene]);
  const resolveConflictOverwrite = useCallback(() => executeSave(true), [executeSave]);

  useEffect(() => {
    return () => { clearSaveTimers(); };
  }, [sceneId, clearSaveTimers]);
  useEffect(() => () => { requestGenRef.current++; }, []);

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
      if (conflictRef.current || retryBlockedRef.current) return;
      // Keep a scheduled backoff when further edits arrive during an outage.
      if (retryTimerRef.current !== undefined) return;
      setSaveStatus('dirty');
      setSaveError(null);
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = window.setTimeout(() => {
        executeSave().catch(() => {});
      }, SAVE_DEBOUNCE);
    }
  }, [sceneId, hall, objects, drawings, isLoading, executeSave]);

  // Read revision refs at unload time, including errors and conflicts.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!currentSceneIdRef.current || latestRevisionRef.current <= savedRevisionRef.current) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

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

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    try {
      if (!file) return;
      const data = normalizeSceneData(JSON.parse(await file.text()));
      if (!data.valid) throw new Error('invalid scene');
      if (!window.confirm('匯入會取代目前場景中檔案所含的場地、物件與標註，確定匯入？')) return;
      // Replace only what the file contains; a hall-only file must not wipe objects or drawings.
      if (data.present.hall) setHall(data.hall);
      if (data.present.objects) setObjects(data.objects);
      if (data.present.drawings) setDrawings(data.drawings);
      setSelectedIds(new Set());
      setIsDrawMode(false);
      setMode('EDIT');
      onNotice(data.repaired ? `匯入成功，已修復 ${data.repaired} 處資料。` : '場景匯入成功。');
    } catch {
      onNotice('檔案格式不正確，未匯入任何內容。', true);
    } finally {
      input.value = '';
    }
  }, [setHall, setObjects, setDrawings, setSelectedIds, setIsDrawMode, setMode, onNotice]);

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

  // Refresh the list thumbnail only when the scene has none yet or was edited during this visit.
  const shouldRefreshThumbnail = useCallback(
    () => !loadedThumbnailRef.current || latestRevisionRef.current > 0,
    [],
  );

  return {
    fileInputRef,
    loadScene,
    flushSave,
    resolveConflictReload,
    resolveConflictOverwrite,
    saveStatus,
    saveError,
    sceneName,
    isLoading,
    exportScene,
    handleImportClick,
    handleFileChange,
    takeScreenshot,
    shouldRefreshThumbnail,
  };
}
