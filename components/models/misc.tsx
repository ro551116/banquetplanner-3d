import React from 'react';
import * as THREE from 'three';
import { ObjectType } from '../../types';
import { EdgeOutline, Highlight, TableClothMaterial, TripodBase } from './shared';

export const Venue = ({ type, color, selected, isEditMode, customWidth, customDepth, customHeight, tableCloth = 'linen' }: any) => {
  return (
    <group>
      {/* COCKTAIL_TABLE — Standing height cocktail table */}
      {type === ObjectType.COCKTAIL_TABLE && (
        <group>
          {/* Table top */}
          <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.03, 24]} />
            <TableClothMaterial color={color} tableCloth={tableCloth} />
            {selected && isEditMode && <Highlight />}
            <EdgeOutline />
          </mesh>
          {/* Center pole */}
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 1.08]} />
            <meshStandardMaterial color="#707078" metalness={0.6} roughness={0.35} />
          </mesh>
          {/* Base plate */}
          <mesh position={[0, 0.01, 0]} receiveShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.02, 24]} />
            <meshStandardMaterial color="#606068" metalness={0.6} roughness={0.3} />
            <EdgeOutline thickness={1} />
          </mesh>
        </group>
      )}

      {/* PODIUM — Lectern / podium */}
      {type === ObjectType.PODIUM && (() => {
        const bodyColor = color || '#6b4226';
        const frontColor = new THREE.Color(bodyColor).offsetHSL(0, 0, -0.1).getStyle();
        return (
          <group>
            {/* Main body */}
            <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.6, 1.1, 0.5]} />
              <meshStandardMaterial color={bodyColor} roughness={0.6} metalness={0.05} />
              {selected && isEditMode && <Highlight />}
              <EdgeOutline />
            </mesh>
            {/* Front panel — darker shade */}
            <mesh position={[0, 0.55, 0.251]}>
              <planeGeometry args={[0.6, 1.1]} />
              <meshStandardMaterial color={frontColor} roughness={0.55} metalness={0.05} />
            </mesh>
            {/* Top surface with overhang */}
            <mesh position={[0, 1.11, 0]} castShadow>
              <boxGeometry args={[0.62, 0.02, 0.52]} />
              <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0.08} />
              <EdgeOutline thickness={1} />
            </mesh>
            {/* Microphone gooseneck */}
            <group position={[0.15, 1.12, 0]} rotation={[-0.26, 0, 0]}>
              <mesh position={[0, 0.175, 0]} castShadow>
                <cylinderGeometry args={[0.005, 0.005, 0.35]} />
                <meshStandardMaterial color="#303038" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Mic head */}
              <mesh position={[0, 0.36, 0]}>
                <sphereGeometry args={[0.015, 12, 12]} />
                <meshStandardMaterial color="#404048" metalness={0.6} roughness={0.4} />
              </mesh>
            </group>
          </group>
        );
      })()}

      {/* DANCE_FLOOR — Checkerboard dance floor */}
      {type === ObjectType.DANCE_FLOOR && (() => {
        const W = customWidth || 4;
        const D = customDepth || 4;
        const tilesX = Math.floor(W);
        const tilesZ = Math.floor(D);
        return (
          <group>
            {/* Main surface base */}
            <mesh position={[0, 0.005, 0]} receiveShadow>
              <boxGeometry args={[W, 0.01, D]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.1} />
              {selected && isEditMode && <Highlight />}
            </mesh>
            {/* Checkerboard tiles */}
            {Array.from({ length: tilesX }).map((_, ix) =>
              Array.from({ length: tilesZ }).map((_, iz) => {
                const isLight = (ix + iz) % 2 === 0;
                const tileX = -W / 2 + 0.5 + ix;
                const tileZ = -D / 2 + 0.5 + iz;
                return (
                  <mesh key={`${ix}-${iz}`} position={[tileX, 0.015, tileZ]} receiveShadow>
                    <boxGeometry args={[0.98, 0.01, 0.98]} />
                    <meshStandardMaterial
                      color={isLight ? '#e8e8e8' : '#2a2a2a'}
                      roughness={0.25}
                      metalness={0.15}
                    />
                  </mesh>
                );
              })
            )}
            {/* Metal edge trim — 4 borders */}
            <mesh position={[0, 0.015, D / 2 + 0.015]}>
              <boxGeometry args={[W + 0.06, 0.03, 0.03]} />
              <meshStandardMaterial color="#888890" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.015, -D / 2 - 0.015]}>
              <boxGeometry args={[W + 0.06, 0.03, 0.03]} />
              <meshStandardMaterial color="#888890" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[W / 2 + 0.015, 0.015, 0]}>
              <boxGeometry args={[0.03, 0.03, D]} />
              <meshStandardMaterial color="#888890" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[-W / 2 - 0.015, 0.015, 0]}>
              <boxGeometry args={[0.03, 0.03, D]} />
              <meshStandardMaterial color="#888890" metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
        );
      })()}

      {/* PROJECTION_SCREEN — Tripod projection screen */}
      {type === ObjectType.PROJECTION_SCREEN && (() => {
        const W = customWidth || 3;
        const H = customHeight || 1.7;
        const screenCenterY = 1.5;
        const screenTop = screenCenterY + H / 2;
        const screenBottom = screenCenterY - H / 2;
        const borderThick = 0.03;
        return (
          <group>
            {/* Tripod base */}
            <TripodBase />
            {/* Center pole extending above tripod */}
            <mesh position={[0, (screenTop + 0.05) / 2, 0]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, screenTop + 0.05]} />
              <meshStandardMaterial color="#707078" metalness={0.6} roughness={0.35} />
            </mesh>
            {/* Top roller bar */}
            <mesh position={[0, screenTop + 0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.03, 0.03, W + 0.06, 12]} />
              <meshStandardMaterial color="#606068" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Screen surface */}
            <mesh position={[0, screenCenterY, 0.01]} receiveShadow>
              <planeGeometry args={[W, H]} />
              <meshStandardMaterial color="#f5f5f5" roughness={0.3} metalness={0.02} side={THREE.DoubleSide} />
              {selected && isEditMode && <Highlight />}
            </mesh>
            {/* Black border — top */}
            <mesh position={[0, screenTop - borderThick / 2, 0.005]}>
              <boxGeometry args={[W + borderThick * 2, borderThick, 0.01]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
            </mesh>
            {/* Black border — bottom */}
            <mesh position={[0, screenBottom + borderThick / 2, 0.005]}>
              <boxGeometry args={[W + borderThick * 2, borderThick, 0.01]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
            </mesh>
            {/* Black border — left */}
            <mesh position={[-W / 2 - borderThick / 2, screenCenterY, 0.005]}>
              <boxGeometry args={[borderThick, H, 0.01]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
            </mesh>
            {/* Black border — right */}
            <mesh position={[W / 2 + borderThick / 2, screenCenterY, 0.005]}>
              <boxGeometry args={[borderThick, H, 0.01]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
            </mesh>
          </group>
        );
      })()}

      {/* LED_WALL — LED video wall */}
      {type === ObjectType.LED_WALL && (() => {
        const W = customWidth || 4;
        const H = customHeight || 2.25;
        const gridSpacing = 0.5;
        const hLines = Math.floor(H / gridSpacing) - 1;
        const vLines = Math.floor(W / gridSpacing) - 1;
        return (
          <group>
            {/* Back frame — black aluminum */}
            <mesh position={[0, H / 2, 0]} castShadow>
              <boxGeometry args={[W + 0.1, H + 0.1, 0.15]} />
              <meshStandardMaterial color="#1a1a1f" roughness={0.4} metalness={0.5} />
              {selected && isEditMode && <Highlight />}
              <EdgeOutline />
            </mesh>
            {/* LED surface — front face */}
            <mesh position={[0, H / 2, 0.076]}>
              <planeGeometry args={[W, H]} />
              <meshStandardMaterial
                color="#0a0a12"
                roughness={0.2}
                metalness={0.3}
                emissive="#111122"
                emissiveIntensity={0.3}
              />
            </mesh>
            {/* Grid lines — horizontal seams */}
            {Array.from({ length: hLines }).map((_, i) => {
              const y = (i + 1) * gridSpacing;
              return (
                <mesh key={`h-${i}`} position={[0, y, 0.077]}>
                  <boxGeometry args={[W, 0.005, 0.005]} />
                  <meshStandardMaterial color="#2a2a30" roughness={0.5} metalness={0.4} />
                </mesh>
              );
            })}
            {/* Grid lines — vertical seams */}
            {Array.from({ length: vLines }).map((_, i) => {
              const x = -W / 2 + (i + 1) * gridSpacing;
              return (
                <mesh key={`v-${i}`} position={[x, H / 2, 0.077]}>
                  <boxGeometry args={[0.005, H, 0.005]} />
                  <meshStandardMaterial color="#2a2a30" roughness={0.5} metalness={0.4} />
                </mesh>
              );
            })}
            {/* Support legs */}
            <mesh position={[-W / 3, 0.15, -0.12]} castShadow>
              <boxGeometry args={[0.1, 0.3, 0.4]} />
              <meshStandardMaterial color="#2a2a30" roughness={0.4} metalness={0.5} />
              <EdgeOutline thickness={1} />
            </mesh>
            <mesh position={[W / 3, 0.15, -0.12]} castShadow>
              <boxGeometry args={[0.1, 0.3, 0.4]} />
              <meshStandardMaterial color="#2a2a30" roughness={0.4} metalness={0.5} />
              <EdgeOutline thickness={1} />
            </mesh>
          </group>
        );
      })()}

      {/* RECEPTION_DESK — Check-in / registration desk */}
      {type === ObjectType.RECEPTION_DESK && (() => {
        const W = customWidth || 1.8;
        const legPositions: [number, number][] = [
          [W / 2 - 0.05, 0.27],
          [-W / 2 + 0.05, 0.27],
          [W / 2 - 0.05, -0.27],
          [-W / 2 + 0.05, -0.27],
        ];
        return (
          <group>
            {/* Table top */}
            <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
              <boxGeometry args={[W, 0.04, 0.6]} />
              <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
              {selected && isEditMode && <Highlight />}
              <EdgeOutline />
            </mesh>
            {/* Front skirt panel with tablecloth material */}
            <mesh position={[0, 0.39, 0.29]} castShadow>
              <boxGeometry args={[W, 0.72, 0.02]} />
              <TableClothMaterial color={color} tableCloth={tableCloth} />
              <EdgeOutline />
            </mesh>
            {/* 4 Legs */}
            {legPositions.map(([x, z], i) => (
              <mesh key={i} position={[x, 0.365, z]} castShadow>
                <cylinderGeometry args={[0.02, 0.02, 0.73]} />
                <meshStandardMaterial color="#707078" metalness={0.6} roughness={0.35} />
              </mesh>
            ))}
          </group>
        );
      })()}
    </group>
  );
};
