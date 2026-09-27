import React, { useMemo } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import {
  OrbitControls, Grid, PerspectiveCamera,
  Line, GizmoHelper, GizmoViewport
} from '@react-three/drei';
import * as THREE from 'three';
import { BanquetObject, HallConfig, DrawingPath } from '../types';
import { CameraRig } from './CameraRig';
import { ObjectWrapper } from './ObjectWrapper';
import { SceneEnvironment } from './SceneEnvironment';
import { RenderSettingsContext } from './RenderSettings';
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { DirectManipulation } from './DirectManipulation';
import { PlacementPreview } from './PlacementPreview';
import { EditTool, EditorSession } from '../interaction';


interface SceneCanvasProps {
  mode: 'EDIT' | 'VIEW';
  hall: HallConfig;
  objects: BanquetObject[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  viewIndex: number;
  viewRequest: number;
  viewEnvironment: 'day' | 'night';
  showLabels: boolean;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  isDrawMode: boolean;
  drawingColor: string;
  drawings: DrawingPath[];
  currentPath: THREE.Vector3[];
  startPath: (point: THREE.Vector3) => void;
  extendPath: (point: THREE.Vector3) => void;
  finishPath: () => void;
  tool: EditTool;
  snapStep: number;
  sessionRef: React.MutableRefObject<EditorSession | null>;
  pendingPlacement: BanquetObject[] | null;
  onPlace: (position: { x: number; y: number; z: number }) => void;
  onCancel: () => void;
  handleBatchUpdate: (updates: Record<string, Partial<BanquetObject>>) => void;
  objectRefs: React.MutableRefObject<Record<string, THREE.Group | null>>;
}

export const SceneCanvas: React.FC<SceneCanvasProps> = ({
  mode, hall, objects, selectedIds, setSelectedIds,
  viewIndex, viewRequest, viewEnvironment, showLabels, isDragging, setIsDragging,
  isDrawMode, drawingColor, drawings, currentPath,
  startPath, extendPath, finishPath,
  tool, snapStep, sessionRef, pendingPlacement, onPlace, onCancel,
  handleBatchUpdate, objectRefs
}) => {
  const night = mode === 'VIEW' && viewEnvironment === 'night';
  const renderSettings = useMemo(() => ({ night, showLabels: mode === 'EDIT' || showLabels }), [night, mode, showLabels]);

  const handleFloorPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (mode !== 'EDIT' || e.button !== 0 || pendingPlacement) return;
    if (isDrawMode) {
      e.stopPropagation();
      startPath(e.point.clone());
    }
  };

  const handleFloorPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDrawMode || mode !== 'EDIT' || currentPath.length === 0) return;
    e.stopPropagation();
    extendPath(e.point.clone());
  };

  const handleFloorPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!isDrawMode || mode !== 'EDIT' || currentPath.length === 0) return;
    e.stopPropagation();
    finishPath();
  };


  const handlePointerMissed = (e: MouseEvent) => {
    if (e.button === 0 && mode === 'EDIT' && !pendingPlacement && !isDrawMode && !isDragging) {
      setSelectedIds(new Set());
    }
  };


  return (
    <Canvas
      shadows="soft"
      camera={{ position: [10, 10, 10], fov: 45 }}
      gl={{
        preserveDrawingBuffer: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        antialias: true,
        powerPreference: 'high-performance',
      }}
      dpr={[1, 1.5]}
      onPointerMissed={handlePointerMissed}
    >
      <RenderSettingsContext.Provider value={renderSettings}>
      <PerspectiveCamera makeDefault position={[10, 10, 10]} fov={45} />
      <CameraRig viewIndex={viewIndex} viewRequest={viewRequest} hall={hall} objects={objects} />
      <SceneEnvironment
        hall={hall}
        night={night}
        onPointerDown={handleFloorPointerDown}
        onPointerMove={handleFloorPointerMove}
        onPointerUp={handleFloorPointerUp}
      />

      {mode === 'EDIT' && (
        <Grid
          position={[0, 0.008, 0]}
          args={[hall.width, hall.length]}
          cellSize={1} cellThickness={0.35} cellColor="#a8a29a"
          sectionSize={5} sectionThickness={0.6} sectionColor="#797c7c"
          fadeDistance={Math.max(hall.width, hall.length) * 2}
        />
      )}

      {/* 3D axis indicator (Gizmo) — EDIT mode only */}
      {mode === 'EDIT' && (
        <GizmoHelper alignment="bottom-left" margin={[80, 80]}>
          <GizmoViewport axisColors={['#bc6262', '#6c86b5', '#6f987e']} labelColor="black" />
        </GizmoHelper>
      )}

      {/* Objects */}
      <DirectManipulation
        enabled={mode === 'EDIT' && !isDrawMode && !pendingPlacement}
        objects={objects} selectedIds={selectedIds} setSelectedIds={setSelectedIds}
        objectRefs={objectRefs} onCommit={handleBatchUpdate} onDraggingChange={setIsDragging}
        tool={tool} snapStep={snapStep} sessionRef={sessionRef}
      >
        {objects.map(obj => (
          <ObjectWrapper key={obj.id} obj={obj} isSelected={selectedIds.has(obj.id)} isEditMode={mode === 'EDIT'} objectRefs={objectRefs} />
        ))}
      </DirectManipulation>
      {mode === 'EDIT' && pendingPlacement && (
        <PlacementPreview pending={pendingPlacement} objects={objects} snapStep={snapStep} onPlace={onPlace} onCancel={onCancel} />
      )}

      {/* Drawings */}
      {drawings?.map((d) => (d?.points?.length > 1 ? (<Line key={d.id} points={d.points.map(p => [p.x, p.y + 0.02, p.z])} color={d.color} lineWidth={3} raycast={() => null} />) : null))}
      {currentPath.length > 1 && (<Line points={currentPath.map(p => [p.x, p.y + 0.02, p.z])} color={drawingColor} lineWidth={3} raycast={() => null} />)}

      {mode === 'VIEW' && (
        <EffectComposer multisampling={2} disableNormalPass>
          <N8AO halfRes quality="performance" aoRadius={0.6} distanceFalloff={1} intensity={1.4} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
      <OrbitControls makeDefault enabled={!isDrawMode && !isDragging} minDistance={0.5} maxDistance={Math.max(hall.width, hall.length, hall.height) * 8} maxPolarAngle={Math.PI / 2 - 0.015} enableDamping={mode === 'VIEW'} dampingFactor={0.12} />
      </RenderSettingsContext.Provider>
    </Canvas>
  );
};
