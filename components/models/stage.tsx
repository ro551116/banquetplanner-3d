import React, { useMemo } from 'react';
import * as THREE from 'three';
import { StairConfig } from '../../types';
import { EdgeOutline, Highlight } from './shared';

export const StairUnit = ({ width, stageHeight, color }: { width: number, stageHeight: number, color: string }) => {
  const stepHeight = 0.16; // Standard comfortable step height (meters)
  const numSteps = Math.max(1, Math.round(stageHeight / stepHeight));
  const actualStepHeight = stageHeight / numSteps;
  const stepDepth = 0.25; // Standard step depth
  const totalDepth = numSteps * stepDepth;

  return (
    <group>
      {Array.from({ length: numSteps }).map((_, i) => {
        // Steps descending from stage to floor
        // i=0 is closest to stage, i=numSteps-1 is furthest
        const h = stageHeight - (i * actualStepHeight); 
        const zPos = (i * stepDepth) + (stepDepth / 2); // Local Z relative to stair start
        
        return (
           <mesh key={i} position={[0, h/2, zPos]} receiveShadow castShadow>
              <boxGeometry args={[width, h, stepDepth]} />
              <meshStandardMaterial color={color} roughness={0.55} metalness={0.03} />
              <EdgeOutline />
           </mesh>
        );
      })}
    </group>
  );
};

export const Stage = ({ color, width = 6, depth = 4, height = 0.5, hasBackdrop, stairs = [], selected, isEditMode }: any) => {
  const trimColor = useMemo(() => new THREE.Color(color).offsetHSL(0, 0, -0.2).getStyle(), [color]);
  return (
  <group>
    {/* Main platform */}
    <mesh position={[0, height/2, 0]} receiveShadow castShadow>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.03} />
      {selected && isEditMode && <Highlight />}
      <EdgeOutline />
    </mesh>
    {/* Stage top surface — slightly reflective */}
    <mesh position={[0, height + 0.002, 0]} receiveShadow>
      <boxGeometry args={[width - 0.02, 0.004, depth - 0.02]} />
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
    </mesh>
    {/* Stage skirt trim — darker band around bottom */}
    <mesh position={[0, 0.03, depth/2 + 0.005]}>
      <boxGeometry args={[width, 0.06, 0.01]} />
      <meshStandardMaterial color={trimColor} roughness={0.6} />
    </mesh>
    <mesh position={[0, 0.03, -depth/2 - 0.005]}>
      <boxGeometry args={[width, 0.06, 0.01]} />
      <meshStandardMaterial color={trimColor} roughness={0.6} />
    </mesh>
    <mesh position={[-width/2 - 0.005, 0.03, 0]} rotation={[0, Math.PI / 2, 0]}>
      <boxGeometry args={[depth, 0.06, 0.01]} />
      <meshStandardMaterial color={trimColor} roughness={0.6} />
    </mesh>
    <mesh position={[width/2 + 0.005, 0.03, 0]} rotation={[0, Math.PI / 2, 0]}>
      <boxGeometry args={[depth, 0.06, 0.01]} />
      <meshStandardMaterial color={trimColor} roughness={0.6} />
    </mesh>
    {/* Edge trim top — metallic edge strip */}
    <mesh position={[0, height, depth/2 + 0.005]}>
      <boxGeometry args={[width + 0.02, 0.02, 0.01]} />
      <meshStandardMaterial color="#888" metalness={0.6} roughness={0.3} />
    </mesh>
    <mesh position={[0, height, -depth/2 - 0.005]}>
      <boxGeometry args={[width + 0.02, 0.02, 0.01]} />
      <meshStandardMaterial color="#888" metalness={0.6} roughness={0.3} />
    </mesh>
    <mesh position={[-width/2 - 0.005, height, 0]} rotation={[0, Math.PI / 2, 0]}>
      <boxGeometry args={[depth + 0.02, 0.02, 0.01]} />
      <meshStandardMaterial color="#888" metalness={0.6} roughness={0.3} />
    </mesh>
    <mesh position={[width/2 + 0.005, height, 0]} rotation={[0, Math.PI / 2, 0]}>
      <boxGeometry args={[depth + 0.02, 0.02, 0.01]} />
      <meshStandardMaterial color="#888" metalness={0.6} roughness={0.3} />
    </mesh>
    {hasBackdrop && (
      <group position={[0, height, -depth/2 + 0.1]}>
        <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 3, 0.1]} />
          <meshStandardMaterial color="#d8dce5" roughness={0.6} metalness={0.02} side={THREE.DoubleSide} />
        </mesh>
        {/* Backdrop panel */}
        <mesh position={[0, 1.5, 0.06]}>
           <planeGeometry args={[width - 0.4, 2.6]} />
           <meshStandardMaterial color="#eef1f6" roughness={0.5} metalness={0.05} side={THREE.DoubleSide} />
        </mesh>
        {/* Backdrop frame */}
        <mesh position={[0, 1.5, 0.07]}>
           <planeGeometry args={[width - 0.3, 2.7]} />
           <meshStandardMaterial color="#aaa" metalness={0.5} roughness={0.3} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>
    )}
    
    {/* Dynamic Stairs */}
    {stairs.map((stair: StairConfig) => {
      let position: [number, number, number] = [0, 0, 0];
      let rotation: [number, number, number] = [0, 0, 0];
      const stepDepth = 0.25;
      const numSteps = Math.max(1, Math.round(height / 0.16));
      const stairTotalDepth = numSteps * stepDepth;

      // Calculate position/rotation based on side
      // Note: Stairs render extending towards +Z in their local space
      if (stair.side === 'front') {
        // Front (positive Z)
        position = [stair.offset, 0, depth/2];
        rotation = [0, 0, 0];
      } else if (stair.side === 'back') {
        // Back (negative Z)
        position = [stair.offset, 0, -depth/2];
        rotation = [0, Math.PI, 0]; // Rotate 180 to face out
      } else if (stair.side === 'left') {
        // Left (negative X)
        position = [-width/2, 0, stair.offset];
        rotation = [0, -Math.PI/2, 0]; // Rotate -90 to face out left
      } else if (stair.side === 'right') {
        // Right (positive X)
        position = [width/2, 0, stair.offset];
        rotation = [0, Math.PI/2, 0]; // Rotate 90 to face out right
      }

      return (
        <group key={stair.id} position={new THREE.Vector3(...position)} rotation={new THREE.Euler(...rotation)}>
           <StairUnit width={stair.width} stageHeight={height} color={color} />
           {selected && isEditMode && (
             <group position={[0, height/2, stairTotalDepth/2]}>
               {/* Selection helper for stair */}
               <mesh visible={false}>
                  <boxGeometry args={[stair.width, height, stairTotalDepth]} />
               </mesh>
               <Highlight color="#fbbf24" />
             </group>
           )}
        </group>
      );
    })}
  </group>
  );
};

export const RedCarpet = ({ color, width = 1.5, depth = 10, selected, isEditMode }: any) => (
  <group>
    {/* Carpet body */}
    <mesh position={[0, 0.01, 0]} receiveShadow>
       <boxGeometry args={[width, 0.02, depth]} />
       <meshStandardMaterial color={color} roughness={0.85} metalness={0.02} />
       {selected && isEditMode && <Highlight />}
       <EdgeOutline />
    </mesh>
    {/* Gold edge trim */}
    <mesh position={[width/2, 0.012, 0]}>
       <boxGeometry args={[0.03, 0.02, depth]} />
       <meshStandardMaterial color="#c9a030" metalness={0.6} roughness={0.3} />
    </mesh>
    <mesh position={[-width/2, 0.012, 0]}>
       <boxGeometry args={[0.03, 0.02, depth]} />
       <meshStandardMaterial color="#c9a030" metalness={0.6} roughness={0.3} />
    </mesh>
  </group>
);
