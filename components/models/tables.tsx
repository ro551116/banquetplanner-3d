import React, { useMemo } from 'react';
import * as THREE from 'three';
import { BanquetChairs, Highlight, TableClothMaterial } from './shared';
import { getRoundTableClothGeometry, getRectTableClothGeometry } from './cloth';

export interface RoundTableProps {
  color: string;
  customSize?: number;
  tableCloth?: string;
  selected?: boolean;
  isEditMode?: boolean;
}

export const RoundTable = ({
  color,
  customSize = 6,
  tableCloth = 'linen',
  selected,
  isEditMode,
}: RoundTableProps) => {
  const config = useMemo(() => {
    const map: Record<number, { r: number; chairs: number }> = {
      4: { r: 0.6, chairs: 5 },
      5: { r: 0.75, chairs: 8 },
      6: { r: 0.9, chairs: 10 },
      7: { r: 1.05, chairs: 10 },
      8: { r: 1.2, chairs: 12 },
    };
    return map[customSize] || map[6];
  }, [customSize]);

  // Procedural draped tablecloth with soft undulating skirt folds and rounded rim
  const clothGeometry = useMemo(() => {
    return getRoundTableClothGeometry(config.r, 0.75);
  }, [config.r]);

  // Centerpiece charger accent colors
  const plateColor = useMemo(
    () => new THREE.Color(color).offsetHSL(0.08, 0.2, 0.25).getStyle(),
    [color]
  );

  // Instanced chair placements: +Z is back, seats face inward towards table center
  const chairPlacements = useMemo(() => {
    const placements: Array<{ position: [number, number, number]; rotation: number }> = [];
    const chairDistance = config.r + 0.44;
    for (let i = 0; i < config.chairs; i++) {
      const angle = (i / config.chairs) * Math.PI * 2;
      const x = Math.sin(angle) * chairDistance;
      const z = Math.cos(angle) * chairDistance;
      // Facing table center from (x, z): local -Z points inward when rotation = angle
      placements.push({
        position: [x, 0, z],
        rotation: angle,
      });
    }
    return placements;
  }, [config.r, config.chairs]);

  return (
    <group>
      {/* Procedural draped tablecloth */}
      <mesh geometry={clothGeometry} castShadow receiveShadow>
        <TableClothMaterial color={color} tableCloth={tableCloth} />
        {selected && isEditMode && <Highlight />}
      </mesh>

      {/* Centerpiece charger plate with metallic rim */}
      <group position={[0, 0.752, 0]}>
        <mesh receiveShadow>
          <cylinderGeometry args={[config.r * 0.32, config.r * 0.34, 0.005, 32]} />
          <meshStandardMaterial color="#c9a030" metalness={0.82} roughness={0.22} />
        </mesh>
        {/* Inner porcelain / lacquer inlay */}
        <mesh position={[0, 0.003, 0]} receiveShadow>
          <cylinderGeometry args={[config.r * 0.26, config.r * 0.26, 0.003, 32]} />
          <meshStandardMaterial color={plateColor} metalness={0.15} roughness={0.35} />
        </mesh>
      </group>

      {/* Instanced chairs around table */}
      <BanquetChairs placements={chairPlacements} />
    </group>
  );
};

export interface RectTableProps {
  color: string;
  customSize?: number;
  tableCloth?: string;
  selected?: boolean;
  isEditMode?: boolean;
}

export const RectTable = ({
  color,
  customSize = 6,
  tableCloth = 'linen',
  selected,
  isEditMode,
}: RectTableProps) => {
  const config = useMemo(() => {
    const map: Record<number, { w: number; chairs: number }> = {
      6: { w: 1.8, chairs: 3 },
      8: { w: 2.4, chairs: 4 },
    };
    return map[customSize] || map[6];
  }, [customSize]);

  const clothGeometry = useMemo(() => {
    return getRectTableClothGeometry(config.w, 0.75, 0.75);
  }, [config.w]);

  const runnerColor = useMemo(
    () => new THREE.Color(color).offsetHSL(0, 0.08, -0.16).getStyle(),
    [color]
  );

  // Instanced chair placements on front and back sides
  const chairPlacements = useMemo(() => {
    const placements: Array<{ position: [number, number, number]; rotation: number }> = [];
    const spacing = config.w / (config.chairs + 1);
    const zOffset = 0.58;

    for (let i = 1; i <= config.chairs; i++) {
      const x = -config.w / 2 + spacing * i;
      // Front chairs (Z > 0): face -Z towards table (rotation = 0)
      placements.push({
        position: [x, 0, zOffset],
        rotation: 0,
      });
      // Back chairs (Z < 0): face +Z towards table (rotation = Math.PI)
      placements.push({
        position: [x, 0, -zOffset],
        rotation: Math.PI,
      });
    }
    return placements;
  }, [config.w, config.chairs]);

  return (
    <group>
      {/* Procedural draped tablecloth with corner folds and box pleats */}
      <mesh geometry={clothGeometry} castShadow receiveShadow>
        <TableClothMaterial color={color} tableCloth={tableCloth} />
        {selected && isEditMode && <Highlight />}
      </mesh>

      {/* Table runner accent */}
      <mesh position={[0, 0.752, 0]} receiveShadow>
        <boxGeometry args={[config.w, 0.004, 0.32]} />
        <meshStandardMaterial color={runnerColor} roughness={0.65} metalness={0.05} />
      </mesh>

      {/* Instanced chairs on both sides */}
      <BanquetChairs placements={chairPlacements} />
    </group>
  );
};
