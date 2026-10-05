import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HallConfig, BanquetObject, ObjectType } from '../types';

interface CameraRigProps {
  viewIndex: number;
  viewRequest: number;
  hall: HallConfig;
  objects: BanquetObject[];
}

interface OrbitControlsLike {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

interface CameraDestination {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

// Fit actual corners in camera space instead of guessing a distance from room width.
// `aspect` is the live canvas size from R3F, so a resize in the same commit (panels opening, View mode) fits the new viewport.
function framing(index: number, camera: THREE.PerspectiveCamera, aspect: number, hall: HallConfig, objects: BanquetObject[]): CameraDestination {
  const target = new THREE.Vector3(0, hall.height / 2, 0);
  const direction = new THREE.Vector3(1.15, 0.95, 1.35).normalize();
  const half = new THREE.Vector3(hall.width / 2, hall.height / 2, hall.length / 2);
  const rotation = new THREE.Euler();
  if (index === 1) direction.set(0, 1, 0.0001).normalize();
  if (index === 3) direction.set(1, 0.38, 0.12).normalize();
  const stage = index === 2 ? objects.find(object => object.type === ObjectType.STAGE) : undefined;
  if (stage) {
    // ObjectWrapper renders dimensions directly (its stored scale is not applied).
    const height = stage.customHeight || 0.5;
    const presentationHeight = height + (stage.hasBackdrop ? 3.5 : 2.5);
    half.set((stage.customWidth || 6) / 2 + 0.7, presentationHeight / 2, (stage.customDepth || 4) / 2 + 0.8);
    rotation.set(stage.rotation.x, stage.rotation.y, stage.rotation.z);
    target.set(0, presentationHeight / 2, 0).applyEuler(rotation).add(new THREE.Vector3(stage.position.x, stage.position.y, stage.position.z));
    direction.set(0, 0.14, 1).applyEuler(rotation).normalize();
  }
  const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const tanH = tanV * Math.max(0.1, aspect);
  const corners: THREE.Vector3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    corners.push(new THREE.Vector3(x * half.x, y * half.y, z * half.z).applyEuler(rotation));
  }
  // Corners relative to target + offset; returns the smallest distance that keeps every corner in the frustum.
  const offset = new THREE.Vector3();
  const relative = new THREE.Vector3();
  const fit = () => {
    let needed = 1;
    for (const corner of corners) {
      relative.subVectors(corner, offset);
      needed = Math.max(needed, relative.dot(direction) + Math.max(Math.abs(relative.dot(right)) / tanH, Math.abs(relative.dot(up)) / tanV));
    }
    return needed;
  };
  let distance = fit();
  // A symmetric fit around the room centre leaves the far wall's headroom empty: the near floor edge binds the
  // bottom of the frame while the top stays loose. Shift the aim to the centre of the projected bounds and refit.
  for (let pass = 0; pass < 3; pass++) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const corner of corners) {
      relative.subVectors(corner, offset);
      const depth = distance - relative.dot(direction);
      const sx = relative.dot(right) / depth;
      const sy = relative.dot(up) / depth;
      minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
    }
    offset.addScaledVector(right, ((minX + maxX) / 2) * distance).addScaledVector(up, ((minY + maxY) / 2) * distance);
    distance = fit();
  }
  target.add(offset);
  return { target, position: direction.multiplyScalar(distance * 1.06).add(target) };
}

export function CameraRig({ viewIndex, viewRequest, hall, objects }: CameraRigProps) {
  const { controls, camera, size, invalidate } = useThree();
  const latestObjects = useRef(objects);
  latestObjects.current = objects;
  const destination = useRef<CameraDestination | null>(null);
  const fitted = useRef(false);
  const manuallyMoved = useRef(false);
  const previousRequest = useRef(viewRequest);

  useEffect(() => {
    if (!controls) return;
    const orbit = controls as unknown as OrbitControlsLike;
    const stop = () => {
      destination.current = null;
      manuallyMoved.current = true;
    };
    orbit.addEventListener('start', stop);
    return () => orbit.removeEventListener('start', stop);
  }, [controls]);

  useEffect(() => {
    if (!controls || !(camera instanceof THREE.PerspectiveCamera)) return;
    const requested = previousRequest.current !== viewRequest;
    previousRequest.current = viewRequest;
    if (requested) manuallyMoved.current = false;
    // Resize/dimension changes track the preset until the user takes the camera.
    if (manuallyMoved.current && !requested) return;
    const next = framing(viewIndex, camera, size.width / Math.max(1, size.height), hall, latestObjects.current);
    camera.far = Math.max(1000, Math.max(hall.width, hall.length, hall.height) * 20);
    camera.updateProjectionMatrix();
    if (!fitted.current) {
      camera.position.copy(next.position);
      const orbit = controls as unknown as OrbitControlsLike;
      orbit.target.copy(next.target);
      orbit.update();
      fitted.current = true;
    } else {
      destination.current = next;
    }
    invalidate();
  }, [controls, camera, invalidate, viewIndex, viewRequest, size.width, size.height, hall.width, hall.length, hall.height]);

  useFrame((_, delta) => {
    const next = destination.current;
    if (!next || !controls) return;
    const orbit = controls as unknown as OrbitControlsLike;
    const alpha = 1 - Math.exp(-7 * Math.min(delta, 0.1));
    camera.position.lerp(next.position, alpha);
    orbit.target.lerp(next.target, alpha);
    if (camera.position.distanceToSquared(next.position) < 0.0001 && orbit.target.distanceToSquared(next.target) < 0.0001) {
      camera.position.copy(next.position);
      orbit.target.copy(next.target);
      destination.current = null;
    }
    orbit.update();
    invalidate();
  });
  return null;
}
