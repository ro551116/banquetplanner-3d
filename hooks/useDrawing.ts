import { useState, useCallback } from 'react';
import * as THREE from 'three';
import { DrawingPath } from '../types';

export function useDrawing() {
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawingColor, setDrawingColor] = useState('#3b82f6');
  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<THREE.Vector3[]>([]);

  const startPath = useCallback((point: THREE.Vector3) => {
    setCurrentPath([point]);
  }, []);

  const extendPath = useCallback((point: THREE.Vector3) => {
    setCurrentPath(prev => [...prev, point]);
  }, []);

  const finishPath = useCallback(() => {
    setCurrentPath(prev => {
      if (prev.length > 1) {
        const newPath: DrawingPath = {
          id: crypto.randomUUID(),
          points: prev,
          color: drawingColor
        };
        setDrawings(d => [...d, newPath]);
      }
      return [];
    });
  }, [drawingColor]);

  const clearDrawings = useCallback(() => {
    setDrawings([]);
  }, []);

  return {
    isDrawMode,
    setIsDrawMode,
    drawingColor,
    setDrawingColor,
    drawings,
    setDrawings,
    currentPath,
    startPath,
    extendPath,
    finishPath,
    clearDrawings,
  };
}
