import React, { createContext, useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { BanquetObject } from '../types';
import { EditTool, EditorSession } from '../interaction';

interface ObjectEvents {
  onObjectPointerDown: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onObjectPointerOver: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onObjectPointerOut: (id: string, event: ThreeEvent<PointerEvent>) => void;
}
export const DirectManipulationContext = createContext<ObjectEvents | null>(null);

interface DirectManipulationProps {
  enabled: boolean;
  objects: BanquetObject[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  objectRefs: React.MutableRefObject<Record<string, THREE.Group | null>>;
  onCommit: (updates: Record<string, Partial<BanquetObject>>) => void;
  onDraggingChange: (active: boolean) => void;
  tool: EditTool;
  snapStep: number;
  sessionRef: React.MutableRefObject<EditorSession | null>;
  children: React.ReactNode;
}
interface InitialObject {
  object: BanquetObject;
  group: THREE.Group;
  position: THREE.Vector3;
  rotation: THREE.Euler;
}
interface CameraControlsState {
  enabled: boolean;
  enableRotate: boolean;
  enablePan: boolean;
  enableZoom: boolean;
}
interface Gesture {
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
  shiftOnly: boolean;
  orbitState: CameraControlsState | null;
  tool: EditTool;
  step: number;
  initial: InitialObject[];
  primary: InitialObject;
  center: THREE.Vector3;
  grab: THREE.Vector3;
  plane: THREE.Plane;
  unitsPerPixel: number;
}
const CURSORS: Record<EditTool, string> = { move: 'grab', rotate: 'ew-resize', height: 'ns-resize' };

export function DirectManipulation(props: DirectManipulationProps) {
  const { camera, gl, controls, invalidate } = useThree();
  const latest = useRef(props);
  latest.current = props;
  const handlers = useRef<ObjectEvents | null>(null);
  const events = useMemo<ObjectEvents>(() => ({
    onObjectPointerDown: (id, event) => handlers.current?.onObjectPointerDown(id, event),
    onObjectPointerOver: (id, event) => handlers.current?.onObjectPointerOver(id, event),
    onObjectPointerOut: (id, event) => handlers.current?.onObjectPointerOut(id, event),
  }), []);

  useEffect(() => {
    const canvas = gl.domElement;
    const orbit = controls as unknown as CameraControlsState | null;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    let gesture: Gesture | null = null;

    const finish = (commit: boolean) => {
      const active = gesture;
      if (!active) return false;
      gesture = null; // Releasing capture must not re-enter cancellation.
      const updates: Record<string, Partial<BanquetObject>> = {};
      for (const initial of active.initial) {
        const { group, object, position, rotation } = initial;
        if (!commit || !active.moved) {
          group.position.copy(position);
          group.rotation.copy(rotation);
        } else {
          const update: Partial<BanquetObject> = {};
          if (group.position.distanceToSquared(position) > 1e-12) {
            update.position = { x: group.position.x, y: group.position.y, z: group.position.z };
          }
          if (Math.abs(group.rotation.y - rotation.y) > 1e-9) {
            update.rotation = { ...object.rotation, y: object.rotation.y + group.rotation.y - rotation.y };
          }
          if (update.position || update.rotation) updates[object.id] = update;
        }
        group.updateMatrixWorld();
      }
      if (orbit && active.orbitState) Object.assign(orbit, active.orbitState);
      if (canvas.hasPointerCapture(active.pointerId)) canvas.releasePointerCapture(active.pointerId);
      canvas.style.cursor = '';
      latest.current.onDraggingChange(false);
      if (Object.keys(updates).length) latest.current.onCommit(updates);
      invalidate();
      return true;
    };
    const cancel = () => finish(false);
    const session = { cancel };
    latest.current.sessionRef.current = session;

    const move = (event: PointerEvent) => {
      const active = gesture;
      if (!active || event.pointerId !== active.pointerId || active.shiftOnly) return;
      const dx = event.clientX - active.x;
      const dy = event.clientY - active.y;
      if (!active.moved && dx * dx + dy * dy < 16) return;
      active.moved = true;
      canvas.style.cursor = active.tool === 'move' ? 'grabbing' : CURSORS[active.tool];
      const { step, primary, initial } = active;
      if (active.tool === 'move') {
        const bounds = canvas.getBoundingClientRect();
        ndc.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
        raycaster.setFromCamera(ndc, camera);
        if (!raycaster.ray.intersectPlane(active.plane, hit)) return;
        let x = primary.position.x + hit.x - active.grab.x;
        let z = primary.position.z + hit.z - active.grab.z;
        if (step > 0) { x = Math.round(x / step) * step; z = Math.round(z / step) * step; }
        for (const item of initial) item.group.position.set(item.position.x + x - primary.position.x, item.position.y, item.position.z + z - primary.position.z);
      } else if (active.tool === 'rotate') {
        let angle = dx * Math.PI / 360;
        if (step > 0) angle = Math.round(angle / (Math.PI / 12)) * Math.PI / 12;
        const cos = Math.cos(angle), sin = Math.sin(angle);
        for (const item of initial) {
          const x = item.position.x - active.center.x, z = item.position.z - active.center.z;
          item.group.position.set(active.center.x + x * cos + z * sin, item.position.y, active.center.z - x * sin + z * cos);
          item.group.rotation.y = item.rotation.y + angle;
        }
      } else {
        let y = primary.position.y - dy * active.unitsPerPixel;
        if (step > 0) y = Math.round(y / step) * step;
        const delta = y - primary.position.y;
        for (const item of initial) item.group.position.y = item.position.y + delta;
      }
      for (const item of initial) item.group.updateMatrixWorld();
      invalidate();
    };
    const up = (event: PointerEvent) => {
      if (gesture?.pointerId !== event.pointerId) return;
      move(event); // Include the final pointer position even if no move event was delivered.
      finish(true);
    };
    const lost = (event: PointerEvent) => { if (gesture?.pointerId === event.pointerId) cancel(); };
    const secondPointer = (event: PointerEvent) => { if (gesture && gesture.pointerId !== event.pointerId) cancel(); };
    const down = (id: string, event: ThreeEvent<PointerEvent>) => {
      const state = latest.current;
      if (!state.enabled || event.button !== 0 || gesture || event.isPrimary === false) return;
      event.stopPropagation();
      const ids = state.selectedIds.has(id) && !event.shiftKey ? state.selectedIds : new Set([id]);
      const initial: InitialObject[] = [];
      for (const object of state.objects) {
        const group = state.objectRefs.current[object.id];
        if (ids.has(object.id) && group) initial.push({ object, group, position: group.position.clone(), rotation: group.rotation.clone() });
      }
      const primary = initial.find(item => item.object.id === id);
      if (!primary) return;
      if (event.shiftKey) {
        state.setSelectedIds(previous => {
          const next = new Set(previous);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
        });
      } else if (!state.selectedIds.has(id)) state.setSelectedIds(new Set([id]));
      const center = new THREE.Vector3();
      for (const item of initial) center.add(item.position);
      center.divideScalar(initial.length);
      const grab = event.point.clone();
      const height = Math.max(1, canvas.clientHeight);
      const unitsPerPixel = camera instanceof THREE.PerspectiveCamera
        ? 2 * camera.position.distanceTo(grab) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / height
        : 0.01;
      gesture = {
        pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, shiftOnly: event.shiftKey,
        orbitState: orbit ? { enabled: orbit.enabled, enableRotate: orbit.enableRotate, enablePan: orbit.enablePan, enableZoom: orbit.enableZoom } : null,
        tool: state.tool, step: state.snapStep,
        initial, primary, center, grab, plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -grab.y), unitsPerPixel,
      };
      // Keep the first pointer registered so a second touch can take over for camera gestures.
      if (orbit) orbit.enableRotate = orbit.enablePan = orbit.enableZoom = false;
      canvas.setPointerCapture(event.pointerId);
      state.onDraggingChange(true);
    };
    handlers.current = {
      onObjectPointerDown: down,
      onObjectPointerOver: () => { if (latest.current.enabled && !gesture) canvas.style.cursor = CURSORS[latest.current.tool]; },
      onObjectPointerOut: () => { if (!gesture) canvas.style.cursor = ''; },
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', lost, true);
    window.addEventListener('blur', cancel);
    canvas.addEventListener('lostpointercapture', lost);
    canvas.addEventListener('pointerdown', secondPointer, true);
    return () => {
      cancel();
      handlers.current = null;
      if (latest.current.sessionRef.current === session) latest.current.sessionRef.current = null;
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', lost, true);
      window.removeEventListener('blur', cancel);
      canvas.removeEventListener('lostpointercapture', lost);
      canvas.removeEventListener('pointerdown', secondPointer, true);
    };
  }, [camera, gl, controls, invalidate]);

  // External changes cannot silently become part of a gesture's snapshot.
  useEffect(() => { props.sessionRef.current?.cancel(); }, [props.enabled, props.objects, props.tool, props.snapStep]);
  return <DirectManipulationContext.Provider value={events}>{props.children}</DirectManipulationContext.Provider>;
}
