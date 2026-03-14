import React, { useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls, Grid, PerspectiveCamera,
  Line, GizmoHelper, GizmoViewport
} from '@react-three/drei';
import * as THREE from 'three';
import { BanquetObject, HallConfig, ObjectType, DrawingPath } from '../types';
import { CameraRig } from './CameraRig';
import { ObjectWrapper, MultiSelectControls } from './ObjectWrapper';

/** Check if (x,z) falls on any stage and return the stage top Y, or 0 */
function getElevation(x: number, z: number, objects: BanquetObject[]): number {
  for (const obj of objects) {
    if (obj.type !== ObjectType.STAGE) continue;
    const w = (obj.customWidth || 6) / 2;
    const d = (obj.customDepth || 4) / 2;
    const h = obj.customHeight || 0.5;
    // Stage XZ bounds (centered at obj.position)
    const sx = obj.position.x;
    const sz = obj.position.z;
    if (x >= sx - w && x <= sx + w && z >= sz - d && z <= sz + d) {
      return h;
    }
  }
  return 0;
}

interface SceneCanvasProps {
  mode: 'EDIT' | 'VIEW';
  hall: HallConfig;
  objects: BanquetObject[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  viewIndex: number;
  viewEnvironment: 'day' | 'night';
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  isDrawMode: boolean;
  drawingColor: string;
  drawings: DrawingPath[];
  currentPath: THREE.Vector3[];
  startPath: (point: THREE.Vector3) => void;
  extendPath: (point: THREE.Vector3) => void;
  finishPath: () => void;
  draggedType: ObjectType | null;
  setDraggedType: (type: ObjectType | null) => void;
  addObject: (type: ObjectType, pos?: { x: number; y: number; z: number }) => any;
  handleBatchUpdate: (updates: Record<string, Partial<BanquetObject>>) => void;
  objectRefs: React.MutableRefObject<Record<string, THREE.Group | null>>;
}

export const SceneCanvas: React.FC<SceneCanvasProps> = ({
  mode, hall, objects, selectedIds, setSelectedIds,
  viewIndex, viewEnvironment, isDragging, setIsDragging,
  isDrawMode, drawingColor, drawings, currentPath,
  startPath, extendPath, finishPath,
  draggedType, setDraggedType, addObject,
  handleBatchUpdate, objectRefs
}) => {

  const handleFloorPointerDown = (e: any) => {
    if (mode !== 'EDIT') return;
    if (isDrawMode) {
      e.stopPropagation();
      startPath(e.point.clone());
    }
  };

  const handleFloorPointerMove = (e: any) => {
    if (!isDrawMode || mode !== 'EDIT' || currentPath.length === 0) return;
    e.stopPropagation();
    extendPath(e.point.clone());
  };

  const handleFloorPointerUp = (e: any) => {
    if (draggedType) {
      e.stopPropagation();
      const y = getElevation(e.point.x, e.point.z, objects);
      addObject(draggedType, { x: e.point.x, y, z: e.point.z });
      setDraggedType(null);
      return;
    }

    if (!isDrawMode || mode !== 'EDIT' || currentPath.length === 0) return;
    e.stopPropagation();
    finishPath();
  };

  const handleObjectDrop = (e: any) => {
    if (draggedType) {
      e.stopPropagation();
      const y = getElevation(e.point.x, e.point.z, objects);
      addObject(draggedType, { x: e.point.x, y, z: e.point.z });
      setDraggedType(null);
    }
  };

  const handlePointerMissed = (e: MouseEvent) => {
    if (mode === 'EDIT' && !isDrawMode && !isDragging) {
      setSelectedIds(new Set());
    }
  };

  const handleObjectPointerDown = useCallback((id: string, e: any) => {
    if (mode !== 'EDIT' || isDrawMode) return;
    e.stopPropagation();

    if (e.shiftKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelectedIds(prev => {
        if (prev.has(id)) return prev;
        return new Set([id]);
      });
    }
  }, [mode, isDrawMode, setSelectedIds]);

  return (
    <Canvas
      shadows
      camera={{ position: [10, 10, 10], fov: 45 }}
      gl={{
        preserveDrawingBuffer: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: mode === 'EDIT' ? 1.0 : (viewEnvironment === 'night' ? 0.8 : 1.1),
        antialias: true,
      }}
      dpr={[1, 2]}
      onPointerMissed={handlePointerMissed}
    >
      <PerspectiveCamera makeDefault position={[10, 10, 10]} fov={45} />
      <CameraRig viewIndex={viewIndex} mode={mode} />

      {/* ===== EDIT MODE ===== */}
      {mode === 'EDIT' ? (
        <>
          <color attach="background" args={['#f0f0f0']} />

          {/* SketchUp-style sun light */}
          <directionalLight
            position={[5, 10, 5]}
            intensity={1.5}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-25} shadow-camera-right={25}
            shadow-camera-top={25} shadow-camera-bottom={-25}
            shadow-camera-near={1} shadow-camera-far={60}
            shadow-bias={-0.0003}
          />
          {/* Fill light from opposite side */}
          <directionalLight position={[-5, 8, -3]} intensity={0.6} />
          <ambientLight intensity={0.8} />
        </>
      ) : (
        <>
          {/* ===== VIEW MODE ===== */}
          {viewEnvironment === 'day' ? (
            <>
              <color attach="background" args={['#f0f0f0']} />
              <directionalLight
                position={[5, 10, 5]}
                intensity={1.5}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-25} shadow-camera-right={25}
                shadow-camera-top={25} shadow-camera-bottom={-25}
                shadow-camera-near={1} shadow-camera-far={60}
                shadow-bias={-0.0003}
              />
              <directionalLight position={[-5, 8, -3]} intensity={0.6} />
              <ambientLight intensity={0.8} />
            </>
          ) : (
            <>
              <color attach="background" args={['#1a1a2e']} />
              <directionalLight
                position={[5, 10, 5]}
                intensity={0.8}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-25} shadow-camera-right={25}
                shadow-camera-top={25} shadow-camera-bottom={-25}
                shadow-camera-near={1} shadow-camera-far={60}
                shadow-bias={-0.0003}
              />
              <ambientLight intensity={0.3} />
            </>
          )}
        </>
      )}

      {mode === 'EDIT' && (
        <Grid
          position={[0, -0.01, 0]}
          args={[hall.width, hall.length]}
          cellSize={1} cellThickness={0.6} cellColor="#d0d0d0"
          sectionSize={5} sectionThickness={1.0} sectionColor="#b0b0b0"
          fadeDistance={40}
          infiniteGrid
        />
      )}

      {/* SketchUp-style RGB axis lines — EDIT mode only */}
      {mode === 'EDIT' && (
        <group>
          {/* X axis — Red */}
          <Line points={[[-50, 0, 0], [50, 0, 0]]} color="#FF0000" lineWidth={1.5} raycast={() => null} />
          {/* Z axis — Green (front/back in Three.js = green axis in SketchUp) */}
          <Line points={[[0, 0, -50], [0, 0, 50]]} color="#00CC00" lineWidth={1.5} raycast={() => null} />
          {/* Y axis — Blue (vertical, positive only up to ceiling) */}
          <Line points={[[0, 0, 0], [0, hall.height || 10, 0]]} color="#0000FF" lineWidth={1.5} raycast={() => null} />
        </group>
      )}

      {/* 3D axis indicator (Gizmo) — EDIT mode only */}
      {mode === 'EDIT' && (
        <GizmoHelper alignment="bottom-left" margin={[80, 80]}>
          <GizmoViewport axisColors={['#FF0000', '#0000FF', '#00CC00']} labelColor="black" />
        </GizmoHelper>
      )}

      <group>
        {/* Floor — outside area (neutral grey, click target) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow onPointerDown={handleFloorPointerDown} onPointerMove={handleFloorPointerMove} onPointerUp={handleFloorPointerUp}>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color={mode === 'VIEW' && viewEnvironment === 'night' ? '#0c1222' : '#b0b0b0'} roughness={0.95} />
        </mesh>
        {/* Floor — hall area with theme material (on top) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow onPointerDown={handleFloorPointerDown} onPointerMove={handleFloorPointerMove} onPointerUp={handleFloorPointerUp}>
          <planeGeometry args={[hall.width, hall.length]} />
          <meshStandardMaterial
            color={mode === 'VIEW' && viewEnvironment === 'night' ? '#1e293b' : hall.floorColor}
            roughness={hall.floorRoughness ?? 0.6}
            metalness={hall.floorMetalness ?? 0.05}
          />
        </mesh>

        {/* Walls */}
        <group>
          <mesh position={[0, hall.height / 2, -hall.length / 2]} receiveShadow>
            <boxGeometry args={[hall.width, hall.height, 0.1]} />
            <meshStandardMaterial color={hall.wallColor} roughness={hall.wallRoughness ?? 0.85} metalness={hall.wallMetalness ?? 0} />
          </mesh>
          <mesh position={[0, hall.height / 2, hall.length / 2]} receiveShadow>
            <boxGeometry args={[hall.width, hall.height, 0.1]} />
            <meshStandardMaterial color={hall.wallColor} roughness={hall.wallRoughness ?? 0.85} metalness={hall.wallMetalness ?? 0} />
          </mesh>
          <mesh position={[-hall.width / 2, hall.height / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
            <boxGeometry args={[hall.length, hall.height, 0.1]} />
            <meshStandardMaterial color={hall.wallColor} roughness={hall.wallRoughness ?? 0.85} metalness={hall.wallMetalness ?? 0} />
          </mesh>
          <mesh position={[hall.width / 2, hall.height / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
            <boxGeometry args={[hall.length, hall.height, 0.1]} />
            <meshStandardMaterial color={hall.wallColor} roughness={hall.wallRoughness ?? 0.85} metalness={hall.wallMetalness ?? 0} />
          </mesh>
        </group>

        {/* Baseboards */}
        {hall.baseboard && (
          <group>
            <mesh position={[0, 0.06, -hall.length / 2 + 0.06]}>
              <boxGeometry args={[hall.width, 0.12, 0.04]} />
              <meshStandardMaterial color={hall.baseboard} roughness={0.4} metalness={0.05} />
            </mesh>
            <mesh position={[0, 0.06, hall.length / 2 - 0.06]}>
              <boxGeometry args={[hall.width, 0.12, 0.04]} />
              <meshStandardMaterial color={hall.baseboard} roughness={0.4} metalness={0.05} />
            </mesh>
            <mesh position={[-hall.width / 2 + 0.06, 0.06, 0]} rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[hall.length, 0.12, 0.04]} />
              <meshStandardMaterial color={hall.baseboard} roughness={0.4} metalness={0.05} />
            </mesh>
            <mesh position={[hall.width / 2 - 0.06, 0.06, 0]} rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[hall.length, 0.12, 0.04]} />
              <meshStandardMaterial color={hall.baseboard} roughness={0.4} metalness={0.05} />
            </mesh>
          </group>
        )}
      </group>

      {/* Objects */}
      {objects.map((obj) => (
        <ObjectWrapper
          key={obj.id}
          ref={(el) => { objectRefs.current[obj.id] = el; }}
          obj={obj}
          isSelected={selectedIds.has(obj.id)}
          isEditMode={mode === 'EDIT'}
          onPointerDown={(e) => handleObjectPointerDown(obj.id, e)}
          onPointerUp={handleObjectDrop}
        />
      ))}

      {mode === 'EDIT' && (
        <MultiSelectControls selectedIds={selectedIds} objects={objects} objectRefs={objectRefs} onUpdate={handleBatchUpdate} onDraggingChange={setIsDragging} />
      )}

      {/* Drawings */}
      {drawings?.map((d) => (d?.points?.length > 1 ? (<Line key={d.id} points={d.points.map(p => [p.x, p.y + 0.02, p.z])} color={d.color} lineWidth={3} raycast={() => null} />) : null))}
      {currentPath.length > 1 && (<Line points={currentPath.map(p => [p.x, p.y + 0.02, p.z])} color={drawingColor} lineWidth={3} raycast={() => null} />)}

      {!isDrawMode && <OrbitControls makeDefault enabled={!isDragging && mode === 'EDIT' || mode === 'VIEW'} maxPolarAngle={Math.PI / 2 - 0.05} autoRotate={false} autoRotateSpeed={0.5} />}
    </Canvas>
  );
};
