import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
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
import { SMAAEffect, SMAAPreset, ToneMappingMode, type EffectComposer as EffectComposerImpl } from 'postprocessing';
import { DirectManipulation } from './DirectManipulation';
import { PlacementPreview } from './PlacementPreview';
import { PathPlacement } from './PathPlacement';
import { EditTool, EditorSession } from '../interaction';
import { getHallBounds } from '../planning';
import { SceneCaptureBridge, SCREENSHOT_LONG_EDGE, TOUCH_SCREENSHOT_LONG_EDGE, type SceneCapture } from './SceneCapture';
import { TOUCH_POINTER_QUERY, useMediaQuery } from './ui/useMediaQuery';

/**
 * SMAA after tone mapping: N8AO composites onto a resolved image, so hardware MSAA no longer reaches the final edges.
 * The effect decodes its lookup images asynchronously; on-demand rendering needs one more frame once they are in.
 */
function PreviewAntialiasing() {
  const invalidate = useThree(state => state.invalidate);
  const effect = useMemo(() => new SMAAEffect({ preset: SMAAPreset.HIGH }), []);
  useEffect(() => {
    // postprocessing's typings declare only `change`; SMAAEffect also dispatches `load`.
    const events = effect as unknown as THREE.EventDispatcher<{ load: object }>;
    const onLoad = () => invalidate();
    events.addEventListener('load', onLoad);
    invalidate(); // the images may already have loaded before this subscription
    return () => events.removeEventListener('load', onLoad);
  }, [effect, invalidate]);
  return <primitive object={effect} />;
}

/**
 * VIEW-mode post-processing. @react-three/postprocessing 2.16 never disposes its composer, so each EDIT→VIEW round
 * trip left the composer buffers and N8AO targets behind. This layout cleanup runs before the composer's own, which
 * detaches the passes, so `dispose()` still reaches every pass and, through the effect passes, every effect.
 */
function PreviewEffects({ touch, composerRef }: { touch: boolean; composerRef: React.RefObject<EffectComposerImpl> }) {
  useLayoutEffect(() => {
    const composer = composerRef.current;
    return () => composer?.dispose();
  }, [composerRef]);
  return (
    <EffectComposer ref={composerRef} multisampling={0} disableNormalPass>
      {/* Desktops get full-resolution 64-sample AO; touch devices keep the cheap half-resolution pass. */}
      <N8AO halfRes={touch} quality={touch ? 'performance' : 'high'} aoRadius={0.6} distanceFalloff={1} intensity={touch ? 1.4 : 3} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <PreviewAntialiasing />
    </EffectComposer>
  );
}

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
  onPlace: (position: { x: number; y: number; z: number }, rotationY?: number) => void;
  onCancel: () => void;
  /** Set while a path object (cable run, flow arrow, dimension) is being drawn instead of placed. */
  pathDrawing: React.ComponentProps<typeof PathPlacement> | null;
  handleBatchUpdate: (updates: Record<string, Partial<BanquetObject>>) => void;
  objectRefs: React.MutableRefObject<Record<string, THREE.Group | null>>;
  /** Receives the screenshot function while the canvas is mounted. */
  captureRef: React.MutableRefObject<SceneCapture | null>;
}

export const SceneCanvas: React.FC<SceneCanvasProps> = ({
  mode, hall, objects, selectedIds, setSelectedIds,
  viewIndex, viewRequest, viewEnvironment, showLabels, isDragging, setIsDragging,
  isDrawMode, drawingColor, drawings, currentPath,
  startPath, extendPath, finishPath,
  tool, snapStep, sessionRef, pendingPlacement, onPlace, onCancel, pathDrawing,
  handleBatchUpdate, objectRefs, captureRef
}) => {
  const night = mode === 'VIEW' && viewEnvironment === 'night';
  const renderSettings = useMemo(() => ({ night, showLabels: mode === 'EDIT' || showLabels }), [night, mode, showLabels]);
  const touch = useMediaQuery(TOUCH_POINTER_QUERY);
  const composerRef = useRef<EffectComposerImpl>(null);
  const floorDown = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  // The grid covers the hall's bounding box but stays on whole-meter lines (5 m sections) so it matches snapping.
  const bounds = getHallBounds(hall);
  const gridX = Math.round(bounds.centerX / 5) * 5, gridZ = Math.round(bounds.centerZ / 5) * 5;
  const gridWidth = bounds.width + 2 * Math.abs(bounds.centerX - gridX), gridLength = bounds.length + 2 * Math.abs(bounds.centerZ - gridZ);

  const handleFloorPointerDown = (e: ThreeEvent<PointerEvent>) => {
    floorDown.current = null;
    if (mode !== 'EDIT' || e.button !== 0 || pendingPlacement) return;
    if (isDrawMode) {
      e.stopPropagation();
      startPath(e.point.clone());
    }
    else {
      floorDown.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    }
  };

  const handleFloorPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDrawMode || mode !== 'EDIT' || currentPath.length === 0) return;
    e.stopPropagation();
    extendPath(e.point.clone());
  };

  const handleFloorPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const down = floorDown.current;
    floorDown.current = null;
    if (mode !== 'EDIT' || e.button !== 0 || pendingPlacement) return;
    if (isDrawMode) {
      if (currentPath.length === 0) return;
      e.stopPropagation();
      finishPath();
    } else if (down?.pointerId === e.pointerId && !e.shiftKey && !isDragging
      && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 4) {
      setSelectedIds(new Set());
    }
  };


  const handlePointerMissed = (e: MouseEvent) => {
    if (e.button === 0 && !e.shiftKey && mode === 'EDIT' && !pendingPlacement && !isDrawMode && !isDragging) {
      setSelectedIds(new Set());
    }
  };


  return (
    <Canvas
      frameloop="demand"
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
      <SceneCaptureBridge captureRef={captureRef} composerRef={composerRef} longEdge={touch ? TOUCH_SCREENSHOT_LONG_EDGE : SCREENSHOT_LONG_EDGE} />
      <SceneEnvironment
        hall={hall}
        night={night}
        onPointerDown={handleFloorPointerDown}
        onPointerMove={handleFloorPointerMove}
        onPointerUp={handleFloorPointerUp}
      />

      {mode === 'EDIT' && (
        <Grid
          position={[gridX, 0.008, gridZ]}
          args={[gridWidth, gridLength]}
          cellSize={1} cellThickness={0.35} cellColor="#a8a29a"
          sectionSize={5} sectionThickness={0.6} sectionColor="#797c7c"
          fadeDistance={Math.max(gridWidth, gridLength) * 2}
        />
      )}

      {/* 3D axis indicator (Gizmo) — EDIT mode only; top-left keeps it clear of the bottom floating bars. */}
      {mode === 'EDIT' && (
        <GizmoHelper alignment="top-left" margin={[56, 56]}>
          <GizmoViewport axisColors={['#bc6262', '#6c86b5', '#6f987e']} labelColor="black" />
        </GizmoHelper>
      )}

      {/* Objects */}
      <DirectManipulation
        enabled={mode === 'EDIT' && !isDrawMode && !pendingPlacement && !pathDrawing}
        objects={objects} selectedIds={selectedIds} setSelectedIds={setSelectedIds}
        objectRefs={objectRefs} onCommit={handleBatchUpdate} onDraggingChange={setIsDragging}
        tool={tool} snapStep={snapStep} sessionRef={sessionRef}
      >
        {objects.map(obj => (
          <ObjectWrapper key={obj.id} obj={obj} isSelected={selectedIds.has(obj.id)} isEditMode={mode === 'EDIT'} objectRefs={objectRefs} />
        ))}
      </DirectManipulation>
      {mode === 'EDIT' && (pathDrawing
        ? <PathPlacement {...pathDrawing} />
        : pendingPlacement && <PlacementPreview pending={pendingPlacement} objects={objects} hall={hall} snapStep={snapStep} onPlace={onPlace} onCancel={onCancel} />
      )}

      {/* Drawings */}
      {drawings?.map((d) => (d?.points?.length > 1 ? (<Line key={d.id} points={d.points.map(p => [p.x, p.y + 0.02, p.z])} color={d.color} lineWidth={3} raycast={() => null} />) : null))}
      {currentPath.length > 1 && (<Line points={currentPath.map(p => [p.x, p.y + 0.02, p.z])} color={drawingColor} lineWidth={3} raycast={() => null} />)}

      {mode === 'VIEW' && <PreviewEffects touch={touch} composerRef={composerRef} />}
      <OrbitControls makeDefault enabled={!isDrawMode && !isDragging} minDistance={0.5} maxDistance={Math.max(bounds.width, bounds.length, hall.height) * 8} maxPolarAngle={Math.PI / 2 - 0.015} enableDamping={mode === 'VIEW'} dampingFactor={0.12} />
      </RenderSettingsContext.Provider>
    </Canvas>
  );
};
