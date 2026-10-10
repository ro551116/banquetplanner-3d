import React, { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { PathPoint } from '../types';

interface PathPlacementProps {
  color: string;
  /** Committed vertices in world XZ. */
  vertices: PathPoint[];
  snapStep: number;
  onAdd: (point: PathPoint) => void;
  onFinish: () => void;
  onUndo: () => void;
  /** Polygon mode (hall outline): clicking the first vertex closes and finishes the shape. */
  closed?: boolean;
  /** Open paths that may become a loop (partition walls): clicking the first vertex calls this instead of adding it. */
  onClose?: () => void;
}

const NO_RAYCAST = () => null;
const ELEVATION = 0.035;
/** Clicking within this distance of the last vertex (or double-clicking) finishes the path. */
const FINISH_RADIUS = 0.12;
/** A closed shape finishes when a click lands this close to its first vertex. */
const CLOSE_RADIUS = 0.3;

/**
 * Click-to-add polyline drawing for path objects (cable runs, flow arrows, dimensions) and the hall outline.
 * Left click/tap adds a vertex, clicking the last vertex again (or the first one of a closed shape) or Enter
 * finishes, Backspace removes the last vertex, Shift constrains the segment to 45° steps. Right drag and wheel
 * still move the camera.
 */
export function PathPlacement({ color, vertices, snapStep, onAdd, onFinish, onUndo, closed = false, onClose }: PathPlacementProps) {
  const { camera, gl, controls, invalidate } = useThree();
  const [cursor, setCursor] = useState<PathPoint | null>(null);
  const state = useRef({ vertices, onAdd, onFinish, onUndo, onClose });
  state.current = { vertices, onAdd, onFinish, onUndo, onClose };
  const closable = closed || !!onClose;

  useEffect(() => {
    const canvas = gl.domElement;
    const orbit = controls as unknown as { enabled: boolean } | null;
    const raycaster = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pointer = new THREE.Vector2();
    const hit = new THREE.Vector3();
    let gesture: { id: number; enabled: boolean } | null = null;
    const previousCursor = canvas.style.cursor;
    canvas.style.cursor = 'crosshair';

    const locate = (event: PointerEvent): PathPoint | null => {
      const bounds = canvas.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return null;
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(ground, hit)) return null;
      let point = { x: hit.x, z: hit.z };
      if (snapStep > 0) point = { x: Math.round(point.x / snapStep) * snapStep, z: Math.round(point.z / snapStep) * snapStep };
      const last = state.current.vertices[state.current.vertices.length - 1];
      if (event.shiftKey && last) {
        const length = Math.hypot(point.x - last.x, point.z - last.z);
        const angle = Math.round(Math.atan2(point.z - last.z, point.x - last.x) / (Math.PI / 4)) * (Math.PI / 4);
        point = { x: last.x + Math.cos(angle) * length, z: last.z + Math.sin(angle) * length };
      }
      return point;
    };
    const release = () => {
      const active = gesture;
      gesture = null;
      if (!active) return;
      if (orbit) orbit.enabled = active.enabled;
      if (canvas.hasPointerCapture(active.id)) canvas.releasePointerCapture(active.id);
    };
    const move = (event: PointerEvent) => {
      if (gesture && event.pointerId !== gesture.id) return;
      if (gesture) { event.stopImmediatePropagation(); event.preventDefault(); }
      setCursor(locate(event));
      invalidate();
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || gesture) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      gesture = { id: event.pointerId, enabled: orbit?.enabled ?? true };
      if (orbit) orbit.enabled = false;
      canvas.setPointerCapture(event.pointerId);
    };
    const up = (event: PointerEvent) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      const point = locate(event);
      release();
      if (!point) return;
      const { vertices: committed } = state.current;
      const last = committed[committed.length - 1];
      const first = committed[0];
      const nearFirst = committed.length >= 3 && Math.hypot(point.x - first.x, point.z - first.z) < CLOSE_RADIUS;
      if (nearFirst && closed) state.current.onFinish();
      else if (nearFirst && state.current.onClose) state.current.onClose();
      else if (last && Math.hypot(point.x - last.x, point.z - last.z) < FINISH_RADIUS) state.current.onFinish();
      else state.current.onAdd(point);
    };
    const cancelGesture = () => release();
    const leave = () => { if (!gesture) { setCursor(null); invalidate(); } };
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) return;
      if (event.key === 'Enter') { event.preventDefault(); state.current.onFinish(); }
      else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); state.current.onUndo(); }
    };
    canvas.addEventListener('pointerdown', down, true);
    canvas.addEventListener('pointermove', move, true);
    canvas.addEventListener('pointerup', up, true);
    canvas.addEventListener('pointercancel', cancelGesture, true);
    canvas.addEventListener('lostpointercapture', cancelGesture);
    canvas.addEventListener('pointerleave', leave);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', cancelGesture);
    return () => {
      canvas.removeEventListener('pointerdown', down, true);
      canvas.removeEventListener('pointermove', move, true);
      canvas.removeEventListener('pointerup', up, true);
      canvas.removeEventListener('pointercancel', cancelGesture, true);
      canvas.removeEventListener('lostpointercapture', cancelGesture);
      canvas.removeEventListener('pointerleave', leave);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', cancelGesture);
      release();
      canvas.style.cursor = previousCursor;
    };
  }, [gl, camera, controls, snapStep, closed, invalidate]);

  useEffect(() => { invalidate(); }, [vertices, invalidate]);

  const last = vertices[vertices.length - 1];
  const committed = vertices.map(point => [point.x, ELEVATION, point.z] as [number, number, number]);
  const total = vertices.reduce((sum, point, index) => index === 0 ? 0 : sum + Math.hypot(point.x - vertices[index - 1].x, point.z - vertices[index - 1].z), 0);
  const segment = last && cursor ? Math.hypot(cursor.x - last.x, cursor.z - last.z) : 0;
  return (
    <group userData={{ placementPreview: true }}>
      {committed.length > 1 && <Line points={committed} color={color} lineWidth={4} raycast={NO_RAYCAST} />}
      {last && cursor && <Line points={[[last.x, ELEVATION, last.z], [cursor.x, ELEVATION, cursor.z]]} color={color} lineWidth={2} dashed dashSize={0.18} gapSize={0.12} raycast={NO_RAYCAST} />}
      {closable && vertices.length >= 2 && <Line points={[cursor ? [cursor.x, ELEVATION, cursor.z] : committed[committed.length - 1], committed[0]]} color={color} lineWidth={1.5} transparent opacity={0.45} dashed dashSize={0.12} gapSize={0.12} raycast={NO_RAYCAST} />}
      {vertices.map((point, index) => <mesh key={index} position={[point.x, ELEVATION, point.z]} raycast={NO_RAYCAST}>
        <sphereGeometry args={[index === 0 ? 0.09 : 0.065, 16, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>)}
      {cursor && <mesh position={[cursor.x, 0.006, cursor.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
        <ringGeometry args={[0.08, 0.13, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} />
      </mesh>}
      {cursor && last && <Html position={[cursor.x, 0.35, cursor.z]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
        <div className="whitespace-nowrap rounded-md bg-white/95 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-800 shadow ring-1 ring-slate-200">
          {segment.toFixed(2)} m{vertices.length > 1 ? `・共 ${(total + segment).toFixed(2)} m` : ''}
        </div>
      </Html>}
    </group>
  );
}
