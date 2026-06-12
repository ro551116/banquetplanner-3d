import React, { useMemo } from 'react';
import * as THREE from 'three';
import { ObjectType } from '../../types';
import { EdgeOutline, Highlight, PlateBase, TripodBase } from './shared';

export const Speaker = ({ type, color, standType, selected, isEditMode, tilt = 0, arrayCount = 4 }: any) => {
  // Lighten dark speaker colors for SketchUp-style visibility
  const cabinetColor = useMemo(() => new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.55).getStyle(), [color]);
  const grilleColor = useMemo(() => new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.35).getStyle(), [color]);
  return (
    <group>
      {type === ObjectType.SPEAKER_15 && (
        <group>
           {standType === 'PLATE' ? <PlateBase /> : <TripodBase />}
           <group position={[0, 1.2, 0]} rotation={[tilt, 0, 0]}>
              {/* Cabinet */}
              <mesh position={[0, 0.35, 0]} castShadow>
                 <boxGeometry args={[0.4, 0.7, 0.4]} />
                 <meshStandardMaterial color={cabinetColor} roughness={0.5} metalness={0.15} />
                 {selected && isEditMode && <Highlight />}
                 <EdgeOutline />
              </mesh>
              {/* Grille face */}
              <mesh position={[0, 0.35, 0.21]}>
                 <planeGeometry args={[0.36, 0.66]} />
                 <meshStandardMaterial color={grilleColor} roughness={0.95} metalness={0.1} />
              </mesh>
              {/* Horn rectangle (upper) */}
              <mesh position={[0, 0.52, 0.212]}>
                 <planeGeometry args={[0.3, 0.12]} />
                 <meshStandardMaterial color="#2a2a30" roughness={0.9} metalness={0.05} />
              </mesh>
              {/* Woofer circle (lower) */}
              <mesh position={[0, 0.25, 0.212]}>
                 <ringGeometry args={[0.08, 0.12, 24]} />
                 <meshStandardMaterial color="#3a3a40" roughness={0.85} metalness={0.1} />
              </mesh>
              {/* Woofer dust cap */}
              <mesh position={[0, 0.25, 0.213]}>
                 <circleGeometry args={[0.04, 16]} />
                 <meshStandardMaterial color="#2a2a30" roughness={0.9} metalness={0.05} />
              </mesh>
              {/* Brand badge */}
              <mesh position={[0, 0.1, 0.211]}>
                 <planeGeometry args={[0.1, 0.02]} />
                 <meshStandardMaterial color="#666" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Top handle */}
              <mesh position={[0, 0.71, 0]}>
                 <boxGeometry args={[0.18, 0.025, 0.06]} />
                 <meshStandardMaterial color="#707078" metalness={0.7} roughness={0.3} />
              </mesh>
           </group>
        </group>
      )}

      {type === ObjectType.SPEAKER_SUB && (
        <group>
          <mesh position={[0, 0.35, 0]} castShadow>
             <boxGeometry args={[0.7, 0.7, 0.8]} />
             <meshStandardMaterial color={cabinetColor} roughness={0.5} metalness={0.15} />
             {selected && isEditMode && <Highlight />}
             <EdgeOutline />
          </mesh>
          {/* Grille */}
          <mesh position={[0, 0.35, 0.41]}>
             <planeGeometry args={[0.65, 0.65]} />
             <meshStandardMaterial color={grilleColor} roughness={0.95} metalness={0.1} />
          </mesh>
          {/* Port tube circle */}
          <mesh position={[0, 0.35, 0.412]}>
             <ringGeometry args={[0.05, 0.08, 24]} />
             <meshStandardMaterial color="#2a2a30" roughness={0.9} metalness={0.05} />
          </mesh>
          {/* Handles */}
          <mesh position={[0.36, 0.35, 0]}>
            <boxGeometry args={[0.02, 0.15, 0.08]} />
            <meshStandardMaterial color="#707078" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[-0.36, 0.35, 0]}>
            <boxGeometry args={[0.02, 0.15, 0.08]} />
            <meshStandardMaterial color="#707078" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Caster wheels at bottom corners */}
          {[[0.28, 0.03, 0.33], [-0.28, 0.03, 0.33], [0.28, 0.03, -0.33], [-0.28, 0.03, -0.33]].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.025, 12]} />
              <meshStandardMaterial color="#404048" roughness={0.7} metalness={0.4} />
            </mesh>
          ))}
        </group>
      )}

      {type === ObjectType.SPEAKER_MONITOR && (
        <group rotation={[0.4, 0, 0]}>
           <mesh position={[0, 0.15, 0]} castShadow>
              <boxGeometry args={[0.5, 0.3, 0.4]} />
              <meshStandardMaterial color={cabinetColor} roughness={0.5} metalness={0.15} />
              {selected && isEditMode && <Highlight />}
              <EdgeOutline />
           </mesh>
           {/* Grille face */}
           <mesh position={[0, 0.15, 0.201]}>
              <planeGeometry args={[0.46, 0.26]} />
              <meshStandardMaterial color={grilleColor} roughness={0.95} metalness={0.1} />
           </mesh>
           {/* Rubber feet */}
           {[[0.2, 0, 0.15], [-0.2, 0, 0.15], [0.2, 0, -0.15], [-0.2, 0, -0.15]].map((p, i) => (
             <mesh key={i} position={p as [number, number, number]}>
               <cylinderGeometry args={[0.02, 0.02, 0.02]} />
               <meshStandardMaterial color="#404048" roughness={0.9} />
             </mesh>
           ))}
        </group>
      )}

      {type === ObjectType.SPEAKER_COLUMN && (
         <group>
            {/* Sub Base */}
            <mesh position={[0, 0.25, 0]} castShadow>
               <boxGeometry args={[0.4, 0.5, 0.5]} />
               <meshStandardMaterial color={cabinetColor} roughness={0.5} metalness={0.15} />
               {selected && isEditMode && <Highlight />}
               <EdgeOutline />
            </mesh>
            {/* Grille face */}
            <mesh position={[0, 0.25, 0.251]}>
               <planeGeometry args={[0.36, 0.46]} />
               <meshStandardMaterial color={grilleColor} roughness={0.95} metalness={0.1} />
            </mesh>
            {/* Column */}
            <mesh position={[0, 1.25, 0.1]} castShadow>
               <boxGeometry args={[0.12, 1.5, 0.1]} />
               <meshStandardMaterial color={cabinetColor} roughness={0.45} metalness={0.2} />
               <EdgeOutline />
            </mesh>
            {/* Column grille */}
            <mesh position={[0, 1.25, 0.151]}>
               <planeGeometry args={[0.1, 1.45]} />
               <meshStandardMaterial color={grilleColor} roughness={0.95} metalness={0.1} />
            </mesh>
            {/* LED driver dots on column face */}
            {[-0.45, -0.27, -0.09, 0.09, 0.27, 0.45, 0.63].map((yOff, i) => (
              <mesh key={i} position={[0, 0.8 + yOff, 0.152]}>
                <circleGeometry args={[0.018, 12]} />
                <meshStandardMaterial color="#2a2a30" roughness={0.8} metalness={0.15} />
              </mesh>
            ))}
         </group>
      )}

      {type === ObjectType.SPEAKER_LINE_ARRAY && (() => {
        const count = Math.max(2, Math.min(8, arrayCount));
        const boxW = 0.6;
        const boxH = 0.22;
        const boxD = 0.4;
        const baseY = 0.11; // bottom of first box at ground level

        return (
          <group>
            {/* Rigging frame at top */}
            <group position={[0, baseY + count * boxH + 0.08, 0]}>
              {/* Top bar */}
              <mesh>
                <boxGeometry args={[boxW + 0.1, 0.04, 0.04]} />
                <meshStandardMaterial color="#707078" metalness={0.7} roughness={0.3} />
                <EdgeOutline thickness={1} />
              </mesh>
              {/* Side bars */}
              <mesh position={[boxW / 2 + 0.03, -0.06, 0]}>
                <boxGeometry args={[0.03, 0.12, 0.04]} />
                <meshStandardMaterial color="#707078" metalness={0.7} roughness={0.3} />
              </mesh>
              <mesh position={[-(boxW / 2 + 0.03), -0.06, 0]}>
                <boxGeometry args={[0.03, 0.12, 0.04]} />
                <meshStandardMaterial color="#707078" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Rigging pin */}
              <mesh position={[0, 0.05, 0]}>
                <cylinderGeometry args={[0.015, 0.015, 0.08]} />
                <meshStandardMaterial color="#606068" metalness={0.7} roughness={0.3} />
              </mesh>
            </group>

            {/* Array boxes */}
            {Array.from({ length: count }).map((_, i) => {
              const splayAngle = (count - 1 - i) * 0.04; // ~2.3 degrees progressive splay from top
              const yPos = baseY + i * boxH;

              return (
                <group key={i} position={[0, yPos, 0]} rotation={[splayAngle, 0, 0]}>
                  {/* Cabinet box (trapezoid approximated with box) */}
                  <mesh position={[0, boxH / 2, 0]} castShadow>
                    <boxGeometry args={[boxW, boxH, boxD]} />
                    <meshStandardMaterial color={cabinetColor} roughness={0.5} metalness={0.15} />
                    {i === 0 && selected && isEditMode && <Highlight />}
                    <EdgeOutline thickness={1} />
                  </mesh>
                  {/* Grille face */}
                  <mesh position={[0, boxH / 2, boxD / 2 + 0.001]}>
                    <planeGeometry args={[boxW - 0.04, boxH - 0.03]} />
                    <meshStandardMaterial color={grilleColor} roughness={0.95} metalness={0.1} />
                  </mesh>
                  {/* Horn (upper rectangle on grille) */}
                  <mesh position={[0, boxH / 2 + 0.035, boxD / 2 + 0.002]}>
                    <planeGeometry args={[boxW - 0.1, 0.06]} />
                    <meshStandardMaterial color="#2a2a30" roughness={0.9} metalness={0.05} />
                  </mesh>
                  {/* Driver (lower circle on grille) */}
                  <mesh position={[0, boxH / 2 - 0.035, boxD / 2 + 0.002]}>
                    <ringGeometry args={[0.02, 0.035, 16]} />
                    <meshStandardMaterial color="#3a3a40" roughness={0.85} metalness={0.1} />
                  </mesh>
                  {/* Seam line between boxes */}
                  {i < count - 1 && (
                    <mesh position={[0, 0, boxD / 2 + 0.003]}>
                      <planeGeometry args={[boxW + 0.01, 0.005]} />
                      <meshStandardMaterial color="#1a1a1f" roughness={0.9} />
                    </mesh>
                  )}
                </group>
              );
            })}
          </group>
        );
      })()}
    </group>
  );
};
