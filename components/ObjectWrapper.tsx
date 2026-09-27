import React, { useCallback, useContext } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { BanquetObject } from '../types';
import { BanquetObjectModel } from './BanquetObjects';
import { DirectManipulationContext } from './DirectManipulation';

export interface ObjectWrapperProps {
  obj: BanquetObject;
  isSelected: boolean;
  isEditMode: boolean;
  objectRefs: React.MutableRefObject<Record<string, THREE.Group | null>>;
}

export const ObjectWrapper = React.memo<ObjectWrapperProps>(
  ({ obj, isSelected, isEditMode, objectRefs }) => {
    const directContext = useContext(DirectManipulationContext);

    const handleRef = useCallback((el: THREE.Group | null) => {
      if (el) {
        el.userData.objectId = obj.id;
        objectRefs.current[obj.id] = el;
      } else {
        delete objectRefs.current[obj.id];
      }
    }, [objectRefs, obj.id]);

    const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
      if (!isEditMode) return;
      if (directContext?.onObjectPointerDown) {
        directContext.onObjectPointerDown(obj.id, e);
      }
    }, [isEditMode, directContext, obj.id]);

    const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
      if (!isEditMode) return;
      if (directContext?.onObjectPointerOver) {
        directContext.onObjectPointerOver(obj.id, e);
      }
    }, [isEditMode, directContext, obj.id]);

    const handlePointerOut = useCallback((e: ThreeEvent<PointerEvent>) => {
      if (!isEditMode) return;
      if (directContext?.onObjectPointerOut) {
        directContext.onObjectPointerOut(obj.id, e);
      }
    }, [isEditMode, directContext, obj.id]);

    return (
      <group
        ref={handleRef}
        userData={{ objectId: obj.id }}
        position={[obj.position.x, obj.position.y, obj.position.z]}
        rotation={[
          // Lights & speakers: rotation.x is head tilt only (passed via tilt prop), not whole-object rotation
          (obj.type.includes('LIGHT') || obj.type.includes('SPEAKER')) ? 0 : obj.rotation.x,
          obj.rotation.y,
          obj.rotation.z
        ]}
        onPointerDown={handlePointerDown}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <BanquetObjectModel
          type={obj.type}
          color={obj.color}
          selected={isSelected && isEditMode}
          isEditMode={isEditMode}
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
          arrayCount={obj.arrayCount}
          trussStructure={obj.trussStructure}
          trussSchematicColors={obj.trussSchematicColors}
        />
      </group>
    );
  }
);
