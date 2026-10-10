import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BanquetObject, HallConfig, ObjectType } from '../types';
import { getHallBounds, getHallOutline, getPartitionSegments, getTableTop, getTrussBeams, getWallSegments, snapToWall, TRUSS_MOUNT_TYPES, trussMountPose } from '../planning';
import { BanquetObjectModel } from './BanquetObjects';
import { RenderSettingsContext } from './RenderSettings';

interface PlacementPreviewProps {
  pending: BanquetObject[];
  objects: BanquetObject[];
  hall: HallConfig;
  snapStep: number;
  /** `rotationY` is set when the object snapped onto a wall and must face into the room. */
  onPlace: (position: { x: number; y: number; z: number }, rotationY?: number) => void;
  onCancel: () => void;
}

const NO_RAYCAST = () => {};
const PREVIEW_SETTINGS = { showLabels: false, night: false };
/** How close (m) the pointer ray must pass a truss beam for a light to clamp onto it. */
const TRUSS_REACH = 0.6;

export function PlacementPreview({ pending, objects, hall, snapStep, onPlace, onCancel }: PlacementPreviewProps) {
  const root = useRef<THREE.Group>(null);
  const { camera, gl, controls, invalidate } = useThree();
  const callbacks = useRef({ onPlace, onCancel });
  callbacks.current = { onPlace, onCancel };
  const surfaces = useMemo(() => {
    if (pending.some(object => object.type === ObjectType.STAGE)) return [];
    return objects.filter(object => object.type === ObjectType.STAGE).map(object => {
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(object.rotation.x, object.rotation.y, object.rotation.z));
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3(object.position.x, object.position.y, object.position.z), rotation, new THREE.Vector3(1, 1, 1));
      const top = new THREE.Vector3(0, object.customHeight || 0.5, 0).applyMatrix4(matrix);
      const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
      return { plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, top), inverse: matrix.invert(), width: object.customWidth || 6, depth: object.customDepth || 4 };
    });
  }, [objects, pending]);

  useLayoutEffect(() => {
    const materials: Array<{ mesh: THREE.Mesh; originals: THREE.Material | THREE.Material[] }> = [];
    const materialCopies = new Map<THREE.Material, THREE.Material>();
    root.current?.traverse(object => {
      object.raycast = NO_RAYCAST;
      if (object instanceof THREE.Light) object.visible = false;
      if (object instanceof THREE.Mesh) {
        const originals = object.material;
        const copies = (Array.isArray(originals) ? originals : [originals]).map(material => {
          const cached = materialCopies.get(material);
          if (cached) return cached;
          const copy = material.clone();
          copy.transparent = true;
          copy.opacity = 0.38;
          copy.depthWrite = false;
          materialCopies.set(material, copy);
          return copy;
        });
        object.material = Array.isArray(originals) ? copies : copies[0];
        object.castShadow = false;
        materials.push({ mesh: object, originals });
      }
    });
    invalidate();
    return () => {
      materials.forEach(({ mesh, originals }) => { mesh.material = originals; });
      materialCopies.forEach(material => material.dispose());
    };
  }, [pending, invalidate]);

  // A single door or column snaps onto the nearest wall (hall outline or partition); a column's depth keeps it flush.
  const wallSnap = useMemo(() => {
    if (pending.length !== 1) return null;
    const [object] = pending;
    const depth = object.type === ObjectType.COLUMN ? (object.shape === 'round' ? object.customWidth : object.customDepth) ?? 0.6 : 0;
    return { type: object.type, depth, walls: [...getWallSegments(getHallOutline(hall)), ...getPartitionSegments(objects)] };
  }, [pending, hall.outline, hall.width, hall.length, objects]);

  // A tabletop number plate lands on the centre of the table under the pointer, turned with the table.
  const tableTops = useMemo(() => {
    if (pending.length !== 1 || pending[0].type !== ObjectType.TABLE_NUMBER || pending[0].plateStyle === 'floor') return [];
    return objects.flatMap(object => {
      const top = getTableTop(object);
      return top ? [{ object, top, plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -(object.position.y + top.height)) }] : [];
    });
  }, [pending, objects]);

  // A light set to stand on or hang from a truss clamps to the beam the pointer ray passes closest to and faces
  // into the hall (towards its centre); with no beam in reach there is nothing to place it on.
  const trussMount = useMemo(() => {
    const [object] = pending;
    if (pending.length !== 1 || !TRUSS_MOUNT_TYPES[object.type] || (object.mount !== 'upright' && object.mount !== 'inverted')) return null;
    const beams = objects.flatMap(getTrussBeams).map(beam => ({
      beam,
      start: new THREE.Vector3(beam.start.x, beam.start.y, beam.start.z),
      end: new THREE.Vector3(beam.end.x, beam.end.y, beam.end.z),
    }));
    const { centerX, centerZ } = getHallBounds(hall);
    return { mount: object.mount, beams, centerX, centerZ };
  }, [pending, objects, hall]);

  useEffect(() => {
    const canvas = gl.domElement;
    const orbit = controls as unknown as { enabled: boolean } | null;
    const raycaster = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pointer = new THREE.Vector2();
    const point = new THREE.Vector3();
    const candidate = new THREE.Vector3();
    const local = new THREE.Vector3();
    const position = new THREE.Vector3();
    const facing = new THREE.Vector3();
    let gesture: { id: number; enabled: boolean } | null = null;
    let snappedRotation: number | undefined;
    const previousCursor = canvas.style.cursor;
    canvas.style.cursor = 'crosshair';

    const locate = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return false;
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(ground, point)) return false;
      let distance = raycaster.ray.origin.distanceToSquared(point);
      for (const surface of surfaces) {
        if (!raycaster.ray.intersectPlane(surface.plane, candidate)) continue;
        local.copy(candidate).applyMatrix4(surface.inverse);
        if (Math.abs(local.x) > surface.width / 2 || Math.abs(local.z) > surface.depth / 2) continue;
        const next = raycaster.ray.origin.distanceToSquared(candidate);
        if (next < distance) { point.copy(candidate); distance = next; }
      }
      position.copy(point);
      if (snapStep > 0) {
        position.x = Math.round(position.x / snapStep) * snapStep;
        position.z = Math.round(position.z / snapStep) * snapStep;
      }
      snappedRotation = undefined;
      const snapped = wallSnap && snapToWall(wallSnap.type, position, wallSnap.walls, wallSnap.depth);
      if (snapped) {
        position.x = snapped.x;
        position.z = snapped.z;
        snappedRotation = snapped.rotationY;
      }
      // Re-evaluate elevation after snapping, including rotated/raised stages.
      position.y = 0;
      for (const surface of surfaces) {
        const normal = surface.plane.normal;
        if (Math.abs(normal.y) < 0.001) continue;
        const y = -(normal.x * position.x + normal.z * position.z + surface.plane.constant) / normal.y;
        local.set(position.x, y, position.z).applyMatrix4(surface.inverse);
        if (Math.abs(local.x) <= surface.width / 2 && Math.abs(local.z) <= surface.depth / 2) position.y = Math.max(position.y, y);
      }
      let nearestTop = Infinity;
      for (const { object, top, plane } of tableTops) {
        if (!raycaster.ray.intersectPlane(plane, candidate) || !top.contains(candidate)) continue;
        const range = raycaster.ray.origin.distanceToSquared(candidate);
        if (range >= nearestTop) continue;
        nearestTop = range;
        position.set(object.position.x, object.position.y + top.height, object.position.z);
        snappedRotation = object.rotation.y;
      }
      if (trussMount) {
        let best = TRUSS_REACH * TRUSS_REACH;
        let hit: (typeof trussMount.beams)[number] | null = null;
        for (const entry of trussMount.beams) {
          const range = raycaster.ray.distanceSqToSegment(entry.start, entry.end, undefined, candidate);
          if (range < best) { best = range; hit = entry; local.copy(candidate); }
        }
        if (!hit) return false;
        // Step along the beam from its start so a row of fixtures lands evenly spaced.
        const length = hit.start.distanceTo(hit.end);
        if (snapStep > 0 && length > 0) local.lerpVectors(hit.start, hit.end, Math.min(length, Math.round(local.distanceTo(hit.start) / snapStep) * snapStep) / length);
        facing.set(trussMount.centerX - local.x, 0, trussMount.centerZ - local.z);
        // A beam passing within 0.5 m of the centre has no inward side: face the way the camera looks.
        const across = (facing.x * (hit.end.z - hit.start.z) - facing.z * (hit.end.x - hit.start.x)) / Math.max(length, 1e-6);
        if (Math.abs(across) < 0.5) camera.getWorldDirection(facing);
        const pose = trussMountPose(hit.beam, local, trussMount.mount, facing);
        position.set(pose.position.x, pose.position.y, pose.position.z);
        snappedRotation = pose.rotationY;
      }
      if (root.current) {
        root.current.visible = true;
        root.current.position.copy(position);
        root.current.rotation.y = snappedRotation ?? 0;
        invalidate();
      }
      return true;
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
      if (!locate(event) && root.current?.visible) {
        root.current.visible = false;
        invalidate();
      }
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || gesture) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      gesture = { id: event.pointerId, enabled: orbit?.enabled ?? true };
      if (orbit) orbit.enabled = false;
      canvas.setPointerCapture(event.pointerId);
      locate(event);
    };
    const up = (event: PointerEvent) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      const valid = locate(event);
      release();
      if (valid) callbacks.current.onPlace({ x: position.x, y: position.y, z: position.z }, snappedRotation);
    };
    const cancel = () => { release(); callbacks.current.onCancel(); };
    const lost = () => { if (gesture) cancel(); };
    const leave = () => {
      if (!gesture && root.current?.visible) {
        root.current.visible = false;
        invalidate();
      }
    };
    canvas.addEventListener('pointerdown', down, true);
    canvas.addEventListener('pointermove', move, true);
    canvas.addEventListener('pointerup', up, true);
    canvas.addEventListener('pointercancel', cancel, true);
    canvas.addEventListener('lostpointercapture', lost);
    canvas.addEventListener('pointerleave', leave);
    window.addEventListener('blur', cancel);
    return () => {
      canvas.removeEventListener('pointerdown', down, true);
      canvas.removeEventListener('pointermove', move, true);
      canvas.removeEventListener('pointerup', up, true);
      canvas.removeEventListener('pointercancel', cancel, true);
      canvas.removeEventListener('lostpointercapture', lost);
      canvas.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', cancel);
      release();
      canvas.style.cursor = previousCursor;
    };
  }, [gl, camera, controls, surfaces, snapStep, wallSnap, tableTops, trussMount, invalidate]);

  return (
    <group ref={root} visible={false} userData={{ placementPreview: true }}>
      <RenderSettingsContext.Provider value={PREVIEW_SETTINGS}>
        {pending.map(object => (
          <group key={object.id} position={[object.position.x, object.position.y, object.position.z]} rotation={[(object.type.includes('LIGHT') || object.type.includes('SPEAKER')) ? 0 : object.rotation.x, object.rotation.y, object.rotation.z]}>
            <BanquetObjectModel {...object} label="" selected={false} isEditMode={false} tilt={object.rotation.x} />
          </group>
        ))}
      </RenderSettingsContext.Provider>
    </group>
  );
}
