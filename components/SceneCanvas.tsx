import React, { useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls, Grid, PerspectiveCamera, Environment,
  Line, SoftShadows, Stars, ContactShadows
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ToneMapping, N8AO, SMAA } from '@react-three/postprocessing';
import * as THREE from 'three';
import { BanquetObject, HallConfig, ObjectType, DrawingPath } from '../types';
import { CameraRig } from './CameraRig';
import { ObjectWrapper, MultiSelectControls } from './ObjectWrapper';

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
      addObject(draggedType, { x: e.point.x, y: 0, z: e.point.z });
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
      addObject(draggedType, { x: e.point.x, y: e.point.y, z: e.point.z });
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
          <color attach="background" args={['#e8ecf1']} />

          {/* Three-point lighting for depth */}
          {/* Key light — main directional */}
          <directionalLight
            position={[10, 20, 5]}
            intensity={1.5}
            castShadow
            shadow-mapSize={[4096, 4096]}
            shadow-camera-left={-25} shadow-camera-right={25}
            shadow-camera-top={25} shadow-camera-bottom={-25}
            shadow-camera-near={1} shadow-camera-far={60}
            shadow-bias={-0.0003}
          />
          {/* Fill light — softer from opposite side */}
          <directionalLight
            position={[-8, 12, -6]}
            intensity={0.4}
          />
          {/* Rim light — subtle backlight for edge separation */}
          <directionalLight
            position={[0, 8, -15]}
            intensity={0.3}
          />
          {/* Ambient — enough to see into shadows without washing out */}
          <ambientLight intensity={0.5} />

          {/* HDR Environment for reflections */}
          <Environment preset="city" background={false} />

          {/* Contact shadows for object grounding */}
          <ContactShadows
            position={[0, 0.001, 0]}
            opacity={0.2}
            scale={50}
            blur={2.5}
            far={10}
            resolution={256}
          />

          {/* Post-processing: AO + AA */}
          <EffectComposer multisampling={0}>
            <N8AO
              aoRadius={0.3}
              intensity={1.0}
              distanceFalloff={0.3}
            />
            <SMAA />
          </EffectComposer>
        </>
      ) : (
        <>
          {/* ===== VIEW MODE ===== */}
          {viewEnvironment === 'day' ? (
            <>
              <color attach="background" args={['#dce4ef']} />
              {/* Key light */}
              <directionalLight
                position={[12, 18, 8]}
                intensity={1.8}
                castShadow
                shadow-mapSize={[4096, 4096]}
                shadow-camera-left={-25} shadow-camera-right={25}
                shadow-camera-top={25} shadow-camera-bottom={-25}
                shadow-camera-near={1} shadow-camera-far={60}
                shadow-bias={-0.0003}
              />
              {/* Fill light */}
              <directionalLight position={[-8, 12, -4]} intensity={0.4} />
              {/* Rim */}
              <directionalLight position={[0, 6, -15]} intensity={0.25} />
              <ambientLight intensity={0.3} />

              <Environment preset="lobby" background={false} />

              <ContactShadows
                position={[0, 0.001, 0]}
                opacity={0.25}
                scale={50}
                blur={2.5}
                far={10}
                resolution={256}
              />
            </>
          ) : (
            <>
              <color attach="background" args={['#0a0e1a']} />
              <ambientLight intensity={0.08} color="#b8c4e0" />
              {/* Main overhead warm downlight */}
              <spotLight
                position={[0, hall.height - 0.5, 0]}
                angle={0.9} penumbra={0.8} intensity={2.5}
                color="#ffeedd"
                castShadow
                shadow-mapSize={[4096, 4096]}
                shadow-bias={-0.0003}
              />
              {/* Accent side lights */}
              <pointLight position={[-hall.width / 2 + 1, hall.height - 1, -hall.length / 3]} intensity={0.6} color="#c8a060" distance={15} decay={2} />
              <pointLight position={[hall.width / 2 - 1, hall.height - 1, hall.length / 3]} intensity={0.6} color="#c8a060" distance={15} decay={2} />
              <Stars radius={100} depth={50} count={3000} factor={3} saturation={0} fade speed={0.5} />
              <Environment preset="night" background={false} />
            </>
          )}

          <EffectComposer multisampling={0}>
            <N8AO
              aoRadius={0.3}
              intensity={viewEnvironment === 'night' ? 1.2 : 1.0}
              distanceFalloff={0.3}
            />
            <Bloom
              luminanceThreshold={viewEnvironment === 'night' ? 0.6 : 1.2}
              mipmapBlur
              intensity={viewEnvironment === 'night' ? 0.8 : 0.3}
              radius={0.5}
            />
            <Vignette eskil={false} offset={0.1} darkness={viewEnvironment === 'night' ? 0.5 : 0.2} />
            <SMAA />
            <ToneMapping />
          </EffectComposer>

          <SoftShadows size={2} samples={8} focus={0.5} />
        </>
      )}

      {mode === 'EDIT' && (
        <Grid
          position={[0, -0.01, 0]}
          args={[hall.width, hall.length]}
          cellSize={1} cellThickness={0.6} cellColor="#94a3b8"
          sectionSize={5} sectionThickness={1.0} sectionColor="#475569"
          fadeDistance={40}
          infiniteGrid
        />
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
