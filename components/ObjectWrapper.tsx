import React, { useRef, useEffect } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { BanquetObject } from '../types';
import { BanquetObjectModel } from './BanquetObjects';

// --- Object Wrapper ---
interface ObjectWrapperProps {
  obj: BanquetObject;
  isSelected: boolean;
  isEditMode: boolean;
  onPointerDown: (e: any) => void;
  onPointerUp?: (e: any) => void;
}

export const ObjectWrapper = React.memo(React.forwardRef<THREE.Group, ObjectWrapperProps>(
  ({ obj, isSelected, isEditMode, onPointerDown, onPointerUp }, ref) => {
    return (
      <group
        ref={ref}
        position={[obj.position.x, obj.position.y, obj.position.z]}
        rotation={[obj.rotation.x, obj.rotation.y, obj.rotation.z]}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <BanquetObjectModel
          type={obj.type}
          color={obj.color}
          selected={isSelected && isEditMode}
          label={obj.label}
          customSize={obj.customSize}
          customWidth={obj.customWidth}
          customDepth={obj.customDepth}
          customHeight={obj.customHeight}
          hasBackdrop={obj.hasBackdrop}
          tilt={obj.rotation.x}
          intensity={obj.intensity}
          standType={obj.standType}
          stairs={obj.stairs}
          tableCloth={obj.tableCloth}
        />
      </group>
    );
  }
));

// --- Multi Select Controls ---
interface MultiSelectControlsProps {
  selectedIds: Set<string>;
  objects: BanquetObject[];
  objectRefs: React.MutableRefObject<Record<string, THREE.Group | null>>;
  onUpdate: (updates: Record<string, Partial<BanquetObject>>) => void;
  onDraggingChange: (isDragging: boolean) => void;
}

export const MultiSelectControls: React.FC<MultiSelectControlsProps> = ({
  selectedIds, objects, objectRefs, onUpdate, onDraggingChange
}) => {
  const pivotRef = useRef<THREE.Group>(null);
  const dragStartRef = useRef(new THREE.Vector3());

  useEffect(() => {
    if (selectedIds.size === 0 || !pivotRef.current) return;

    const selectedObjs = objects.filter(o => selectedIds.has(o.id));
    if (selectedObjs.length === 0) return;

    const center = new THREE.Vector3();
    selectedObjs.forEach(o => {
      center.add(new THREE.Vector3(o.position.x, o.position.y, o.position.z));
    });
    center.divideScalar(selectedObjs.length);

    pivotRef.current.position.copy(center);
    pivotRef.current.rotation.set(0, 0, 0);
    pivotRef.current.updateMatrixWorld();
  }, [selectedIds, objects]);

  const handleMouseDown = () => {
    onDraggingChange(true);
    if (pivotRef.current) {
      dragStartRef.current.copy(pivotRef.current.position);
    }
  };

  const handleObjectChange = () => {
    if (!pivotRef.current) return;

    const currentPos = pivotRef.current.position;
    const delta = new THREE.Vector3().subVectors(currentPos, dragStartRef.current);

    selectedIds.forEach(id => {
      const group = objectRefs.current[id];
      const objState = objects.find(o => o.id === id);
      if (group && objState) {
        group.position.set(
          objState.position.x + delta.x,
          objState.position.y + delta.y,
          objState.position.z + delta.z
        );
      }
    });
  };

  const handleMouseUp = () => {
    onDraggingChange(false);
    if (!pivotRef.current) return;

    const currentPos = pivotRef.current.position;
    const delta = new THREE.Vector3().subVectors(currentPos, dragStartRef.current);

    if (delta.lengthSq() < 0.0001) return;

    const updates: Record<string, Partial<BanquetObject>> = {};
    selectedIds.forEach(id => {
      const objState = objects.find(o => o.id === id);
      if (objState) {
        updates[id] = {
          position: {
            x: objState.position.x + delta.x,
            y: objState.position.y + delta.y,
            z: objState.position.z + delta.z
          }
        };
      }
    });

    onUpdate(updates);
  };

  if (selectedIds.size === 0) return null;

  return (
    <>
      <group ref={pivotRef} />
      <TransformControls
        object={pivotRef}
        mode="translate"
        translationSnap={0.1}
        showY={false}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onObjectChange={handleObjectChange}
      />
    </>
  );
};
