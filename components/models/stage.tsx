import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { StairConfig } from '../../types';
import { Highlight, TableClothMaterial } from './shared';
import { createBackdropClothGeometry, createStagePleatedSkirtGeometry } from './cloth';

export interface StairUnitProps {
  width: number;
  stageHeight: number;
  color: string;
}

export const StairUnit = ({ width, stageHeight, color }: StairUnitProps) => {
  const stepHeight = 0.16; // Standard step rise
  const numSteps = Math.max(1, Math.round(stageHeight / stepHeight));
  const actualStepHeight = stageHeight / numSteps;
  const stepDepth = 0.25; // Standard tread depth
  const treadThickness = 0.028;


  return (
    <group>
      {Array.from({ length: numSteps }).map((_, i) => {
        // Steps descending from stage deck (i=0) to floor (i=numSteps-1)
        const stepTopY = stageHeight - i * actualStepHeight;
        const zPos = i * stepDepth + stepDepth / 2;
        const riserH = stepTopY - treadThickness;

        return (
          <group key={i}>
            {/* Step tread platform */}
            <mesh position={[0, stepTopY - treadThickness / 2, zPos]} receiveShadow castShadow>
              <boxGeometry args={[width, treadThickness, stepDepth]} />
              <meshStandardMaterial color={color} roughness={0.65} metalness={0.04} />
            </mesh>

            {/* Aluminum nosing / safety edge on tread front */}
            <mesh position={[0, stepTopY - treadThickness / 2, zPos + stepDepth / 2 - 0.008]}>
              <boxGeometry args={[width + 0.002, treadThickness + 0.002, 0.016]} />
              <meshStandardMaterial color="#b0b2ba" metalness={0.8} roughness={0.24} />
            </mesh>

            {/* Step riser structure down to floor */}
            {riserH > 0.01 && (
              <mesh position={[0, riserH / 2, zPos]} receiveShadow castShadow>
                <boxGeometry args={[width - 0.01, riserH, stepDepth - 0.015]} />
                <meshStandardMaterial color="#232328" roughness={0.7} metalness={0.1} />
              </mesh>
            )}

            {/* Side stringer brackets (left and right) */}
            <mesh position={[-width / 2 + 0.008, stepTopY / 2, zPos]}>
              <boxGeometry args={[0.016, stepTopY, stepDepth]} />
              <meshStandardMaterial color="#303038" metalness={0.6} roughness={0.35} />
            </mesh>
            <mesh position={[width / 2 - 0.008, stepTopY / 2, zPos]}>
              <boxGeometry args={[0.016, stepTopY, stepDepth]} />
              <meshStandardMaterial color="#303038" metalness={0.6} roughness={0.35} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

export interface StageProps {
  color: string;
  width?: number;
  depth?: number;
  height?: number;
  hasBackdrop?: boolean;
  stairs?: StairConfig[];
  selected?: boolean;
  isEditMode?: boolean;
}

export const Stage = ({
  color,
  width = 6,
  depth = 4,
  height = 0.5,
  hasBackdrop = false,
  stairs = [],
  selected,
  isEditMode,
}: StageProps) => {
  const deckThickness = 0.04; // 40mm standard stage deck
  const deckCenterY = height - deckThickness / 2;
  const skirtH = Math.max(0.05, height - 0.03);

  // Pleated fabric skirts for the stage sides
  const frontBackSkirt = useMemo(
    () => createStagePleatedSkirtGeometry(width, skirtH, 0.12),
    [width, skirtH]
  );
  useEffect(() => () => frontBackSkirt.dispose(), [frontBackSkirt]);

  const leftRightSkirt = useMemo(
    () => createStagePleatedSkirtGeometry(depth, skirtH, 0.12),
    [depth, skirtH]
  );
  useEffect(() => () => leftRightSkirt.dispose(), [leftRightSkirt]);

  // Backdrop drape geometry with vertical gathered folds
  const backdropCloth = useMemo(
    () => (hasBackdrop ? createBackdropClothGeometry(width, 3.0, 0.16) : null),
    [hasBackdrop, width]
  );
  useEffect(() => () => backdropCloth?.dispose(), [backdropCloth]);

  // Leg positions: 4 corners, plus intermediate supports for large stages
  const legPositions = useMemo(() => {
    const list: [number, number][] = [
      [-width / 2 + 0.08, -depth / 2 + 0.08],
      [width / 2 - 0.08, -depth / 2 + 0.08],
      [-width / 2 + 0.08, depth / 2 - 0.08],
      [width / 2 - 0.08, depth / 2 - 0.08],
    ];
    if (width > 4) {
      list.push([0, -depth / 2 + 0.08], [0, depth / 2 - 0.08]);
    }
    if (depth > 3) {
      list.push([-width / 2 + 0.08, 0], [width / 2 - 0.08, 0]);
    }
    return list;
  }, [width, depth]);

  const legH = height - deckThickness;

  return (
    <group>
      {/* Main anti-slip stage deck surface: top at exact height */}
      <mesh position={[0, deckCenterY, 0]} receiveShadow castShadow>
        <boxGeometry args={[width, deckThickness, depth]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.06} />
        {selected && isEditMode && <Highlight />}
      </mesh>

      {/* Extruded satin aluminum perimeter frame profile around deck */}
      <mesh position={[0, deckCenterY, depth / 2 - 0.006]}>
        <boxGeometry args={[width + 0.01, deckThickness + 0.004, 0.012]} />
        <meshStandardMaterial color="#8e9098" metalness={0.82} roughness={0.25} />
      </mesh>
      <mesh position={[0, deckCenterY, -depth / 2 + 0.006]}>
        <boxGeometry args={[width + 0.01, deckThickness + 0.004, 0.012]} />
        <meshStandardMaterial color="#8e9098" metalness={0.82} roughness={0.25} />
      </mesh>
      <mesh position={[-width / 2 + 0.006, deckCenterY, 0]}>
        <boxGeometry args={[0.012, deckThickness + 0.004, depth + 0.01]} />
        <meshStandardMaterial color="#8e9098" metalness={0.82} roughness={0.25} />
      </mesh>
      <mesh position={[width / 2 - 0.006, deckCenterY, 0]}>
        <boxGeometry args={[0.012, deckThickness + 0.004, depth + 0.01]} />
        <meshStandardMaterial color="#8e9098" metalness={0.82} roughness={0.25} />
      </mesh>

      {/* Pleated fabric skirting around stage base */}
      {/* Front skirt */}
      <mesh position={[0, 0.01, depth / 2]} castShadow receiveShadow>
        <primitive object={frontBackSkirt} attach="geometry" />
        <TableClothMaterial color={color} tableCloth="linen" />
      </mesh>
      {/* Back skirt */}
      <mesh position={[0, 0.01, -depth / 2]} rotation={[0, Math.PI, 0]} castShadow receiveShadow>
        <primitive object={frontBackSkirt} attach="geometry" />
        <TableClothMaterial color={color} tableCloth="linen" />
      </mesh>
      {/* Left skirt */}
      <mesh position={[-width / 2, 0.01, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
        <primitive object={leftRightSkirt} attach="geometry" />
        <TableClothMaterial color={color} tableCloth="linen" />
      </mesh>
      {/* Right skirt */}
      <mesh position={[width / 2, 0.01, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        <primitive object={leftRightSkirt} attach="geometry" />
        <TableClothMaterial color={color} tableCloth="linen" />
      </mesh>

      {/* Stage riser legs with rubber leveling feet resting on floor */}
      {legPositions.map(([lx, lz], idx) => (
        <group key={idx} position={[lx, 0, lz]}>
          {/* Telescopic aluminum leg */}
          <mesh position={[0, legH / 2, 0]} castShadow>
            <cylinderGeometry args={[0.024, 0.024, legH, 12]} />
            <meshStandardMaterial color="#60626a" metalness={0.78} roughness={0.28} />
          </mesh>
          {/* Leveling foot plate on floor */}
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.038, 0.042, 0.02, 16]} />
            <meshStandardMaterial color="#1a1a20" roughness={0.85} metalness={0.1} />
          </mesh>
        </group>
      ))}

      {/* Modular Backdrop with authentic draped fabric folds */}
      {hasBackdrop && (
        <group position={[0, height, -depth / 2 + 0.1]}>
          {/* Upright support poles */}
          <mesh position={[-width / 2 + 0.15, 1.55, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 3.1, 16]} />
            <meshStandardMaterial color="#3a3c44" metalness={0.75} roughness={0.3} />
          </mesh>
          <mesh position={[width / 2 - 0.15, 1.55, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 3.1, 16]} />
            <meshStandardMaterial color="#3a3c44" metalness={0.75} roughness={0.3} />
          </mesh>
          {/* Top crossbar */}
          <mesh position={[0, 3.08, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, width, 16]} />
            <meshStandardMaterial color="#3a3c44" metalness={0.75} roughness={0.3} />
          </mesh>
          {/* Upright base mounting plates */}
          <mesh position={[-width / 2 + 0.15, 0.01, 0]}>
            <boxGeometry args={[0.22, 0.02, 0.22]} />
            <meshStandardMaterial color="#282830" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[width / 2 - 0.15, 0.01, 0]}>
            <boxGeometry args={[0.22, 0.02, 0.22]} />
            <meshStandardMaterial color="#282830" metalness={0.7} roughness={0.35} />
          </mesh>

          {/* Draped backdrop fabric with vertical folds */}
          {backdropCloth && (
            <mesh position={[0, 0.02, 0.03]} castShadow receiveShadow>
              <primitive object={backdropCloth} attach="geometry" />
              <meshStandardMaterial
                color="#eef1f6"
                roughness={0.75}
                metalness={0.03}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>
      )}

      {/* Dynamic Stairs */}
      {stairs.map((stair: StairConfig) => {
        let position: [number, number, number] = [0, 0, 0];
        let rotation: [number, number, number] = [0, 0, 0];
        const stepDepth = 0.25;
        const numSteps = Math.max(1, Math.round(height / 0.16));
        const stairTotalDepth = numSteps * stepDepth;

        if (stair.side === 'front') {
          position = [stair.offset, 0, depth / 2];
          rotation = [0, 0, 0];
        } else if (stair.side === 'back') {
          position = [stair.offset, 0, -depth / 2];
          rotation = [0, Math.PI, 0];
        } else if (stair.side === 'left') {
          position = [-width / 2, 0, stair.offset];
          rotation = [0, -Math.PI / 2, 0];
        } else if (stair.side === 'right') {
          position = [width / 2, 0, stair.offset];
          rotation = [0, Math.PI / 2, 0];
        }

        return (
          <group
            key={stair.id}
            position={new THREE.Vector3(...position)}
            rotation={new THREE.Euler(...rotation)}
          >
            <StairUnit width={stair.width} stageHeight={height} color={color} />
            {selected && isEditMode && (
              <group position={[0, height / 2, stairTotalDepth / 2]}>
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

export interface RedCarpetProps {
  color: string;
  width?: number;
  depth?: number;
  selected?: boolean;
  isEditMode?: boolean;
}

export const RedCarpet = ({
  color,
  width = 1.5,
  depth = 10,
  selected,
  isEditMode,
}: RedCarpetProps) => {
  const carpetThickness = 0.006; // 6mm realistic pile height
  const borderInset = 0.07;
  const borderWidth = 0.016;

  return (
    <group>
      {/* Plush velvet carpet body with soft low-profile thickness */}
      <mesh position={[0, carpetThickness / 2, 0]} receiveShadow>
        <boxGeometry args={[width, carpetThickness, depth]} />
        <meshPhysicalMaterial
          color={color}
          roughness={0.82}
          metalness={0.0}
          sheen={0.88}
          sheenRoughness={0.28}
          sheenColor="#ff6575"
        />
        {selected && isEditMode && <Highlight />}
      </mesh>

      {/* Inset woven gold/brass border ribbon along left and right */}
      <mesh position={[-width / 2 + borderInset, carpetThickness + 0.0005, 0]}>
        <boxGeometry args={[borderWidth, 0.001, depth - 0.08]} />
        <meshStandardMaterial color="#c9a030" metalness={0.72} roughness={0.32} />
      </mesh>
      <mesh position={[width / 2 - borderInset, carpetThickness + 0.0005, 0]}>
        <boxGeometry args={[borderWidth, 0.001, depth - 0.08]} />
        <meshStandardMaterial color="#c9a030" metalness={0.72} roughness={0.32} />
      </mesh>
      {/* Inset border cross lines at ends */}
      <mesh position={[0, carpetThickness + 0.0005, -depth / 2 + borderInset]}>
        <boxGeometry args={[width - borderInset * 2 + borderWidth, 0.001, borderWidth]} />
        <meshStandardMaterial color="#c9a030" metalness={0.72} roughness={0.32} />
      </mesh>
      <mesh position={[0, carpetThickness + 0.0005, depth / 2 - borderInset]}>
        <boxGeometry args={[width - borderInset * 2 + borderWidth, 0.001, borderWidth]} />
        <meshStandardMaterial color="#c9a030" metalness={0.72} roughness={0.32} />
      </mesh>

      {/* Low-profile brushed brass transition binder plates at ends */}
      <mesh position={[0, 0.0035, -depth / 2]}>
        <boxGeometry args={[width, 0.005, 0.035]} />
        <meshStandardMaterial color="#b89430" metalness={0.82} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.0035, depth / 2]}>
        <boxGeometry args={[width, 0.005, 0.035]} />
        <meshStandardMaterial color="#b89430" metalness={0.82} roughness={0.25} />
      </mesh>
    </group>
  );
};
