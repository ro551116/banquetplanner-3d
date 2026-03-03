import { useRef, useCallback } from 'react';
import { BanquetObject, HallConfig, DrawingPath } from '../types';

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
        if (!data.metadata && !data.hall) {
          if (!confirm("The file format might be different. Do you want to try importing anyway?")) return;
        }
        if (data.hall) setHall(data.hall);
        if (data.objects) setObjects(data.objects);
        if (data.drawings) setDrawings(data.drawings);
        setSelectedIds(new Set());
        setIsDrawMode(false);
        setMode('EDIT');
        alert("匯入成功！ (Import Successful)");
      } catch (err) {
        console.error("Import failed:", err);
        alert("匯入失敗，檔案格式錯誤 (Import Failed)");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }, [setHall, setObjects, setDrawings, setSelectedIds, setIsDrawMode, setMode]);

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
