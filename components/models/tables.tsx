import React, { useMemo } from 'react';
import * as THREE from 'three';
import { ObjectType } from '../../types';
import { getRectTableSpec, getRoundTableSpec, getSeating, RECT_TABLE_DEPTH } from '../../planning';
import { BanquetChairs, ChairPlacement, Highlight, TableClothMaterial, useTextTexture } from './shared';
import { ChildChairs } from './wedding';
import { getRoundTableClothGeometry, getRectTableClothGeometry } from './cloth';
import type { ObjectModelProps } from './modelProps';

const TABLE_HEIGHT = 0.75;
/** Vegetarian marker spot on a rectangular table: in front of the seat, just inside the table edge. */
const rectMarkerAt = (placement: ChairPlacement): [number, number] => [placement.position[0], Math.sign(placement.position[2]) * (RECT_TABLE_DEPTH / 2 - 0.1)];

// Green tent marker for a vegetarian meal, standing on the cloth in front of the seat.
const vegetarianMarkerGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.05, 3).rotateY(Math.PI / 6).translate(0, 0.025, 0);
const vegetarianMarkerMaterial = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.5, metalness: 0.05 });
const standbyCardGeometry = new THREE.BoxGeometry(0.2, 0.12, 0.004).translate(0, 0.06, 0);

function VegetarianMarkers({ positions }: { positions: Array<[number, number]> }) {
  return <>
    {positions.map(([x, z], index) => <mesh key={index} geometry={vegetarianMarkerGeometry} material={vegetarianMarkerMaterial} position={[x, TABLE_HEIGHT + 0.004, z]} castShadow />)}
  </>;
}

/** "備" tent card in the middle of a standby table; readable from both sides. */
function StandbyCard({ position }: { position: [number, number, number] }) {
  const texture = useTextTexture('備', { width: 160, height: 96, background: '#fef3c7', color: '#92400e', fontSize: 72 });
  return (
    <mesh geometry={standbyCardGeometry} position={position} castShadow>
      <meshStandardMaterial map={texture} roughness={0.7} />
    </mesh>
  );
}

/** Splits placements: the first `childSeats` become high chairs; vegetarian markers go to the last seats. */
function useSeatGroups(placements: ChairPlacement[], childSeats: number, vegetarianSeats: number, markerAt: (placement: ChairPlacement) => [number, number]) {
  return useMemo(() => ({
    adults: placements.slice(childSeats),
    children: placements.slice(0, childSeats),
    vegetarian: placements.slice(placements.length - vegetarianSeats).map(markerAt),
  }), [placements, childSeats, vegetarianSeats, markerAt]);
}

export const RoundTable = ({
  color,
  customSize = 6,
  tableCloth = 'linen',
  selected,
  isEditMode,
  seatCount,
  childSeats,
  vegetarianSeats,
  standby,
}: ObjectModelProps) => {
  const spec = getRoundTableSpec(customSize);
  const seating = getSeating({ type: ObjectType.ROUND_TABLE, customSize, seatCount, childSeats, vegetarianSeats })!;

  // Procedural draped tablecloth with soft undulating skirt folds and rounded rim
  const clothGeometry = useMemo(() => {
    return getRoundTableClothGeometry(spec.r, TABLE_HEIGHT);
  }, [spec.r]);

  // Centerpiece charger accent colors
  const plateColor = useMemo(
    () => new THREE.Color(color).offsetHSL(0.08, 0.2, 0.25).getStyle(),
    [color]
  );

  // Chair placements: +Z is back, seats face inward towards table center
  const chairPlacements = useMemo(() => {
    const placements: ChairPlacement[] = [];
    const chairDistance = spec.r + 0.44;
    for (let i = 0; i < seating.seats; i++) {
      const angle = (i / seating.seats) * Math.PI * 2;
      placements.push({
        position: [Math.sin(angle) * chairDistance, 0, Math.cos(angle) * chairDistance],
        rotation: angle,
      });
    }
    return placements;
  }, [spec.r, seating.seats]);
  const markerAt = useMemo(() => (placement: ChairPlacement): [number, number] => {
    const scale = (spec.r - 0.14) / (spec.r + 0.44);
    return [placement.position[0] * scale, placement.position[2] * scale];
  }, [spec.r]);
  const seats = useSeatGroups(chairPlacements, seating.childSeats, seating.vegetarianSeats, markerAt);

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
          <cylinderGeometry args={[spec.r * 0.32, spec.r * 0.34, 0.005, 32]} />
          <meshStandardMaterial color="#c9a030" metalness={0.82} roughness={0.22} />
        </mesh>
        {/* Inner porcelain / lacquer inlay */}
        <mesh position={[0, 0.003, 0]} receiveShadow>
          <cylinderGeometry args={[spec.r * 0.26, spec.r * 0.26, 0.003, 32]} />
          <meshStandardMaterial color={plateColor} metalness={0.15} roughness={0.35} />
        </mesh>
      </group>

      {standby && <StandbyCard position={[0, 0.758, 0]} />}
      <VegetarianMarkers positions={seats.vegetarian} />
      {/* Instanced chairs around table */}
      {seats.adults.length > 0 && <BanquetChairs placements={seats.adults} />}
      {seats.children.length > 0 && <ChildChairs placements={seats.children} />}
    </group>
  );
};

export const RectTable = ({
  color,
  customSize = 6,
  tableCloth = 'linen',
  selected,
  isEditMode,
  chairLayout,
  childSeats,
  vegetarianSeats,
  standby,
}: ObjectModelProps) => {
  const spec = getRectTableSpec(customSize);
  const seating = getSeating({ type: ObjectType.RECT_TABLE, customSize, chairLayout, childSeats, vegetarianSeats })!;
  const layout = chairLayout ?? 'both';

  const clothGeometry = useMemo(() => {
    return getRectTableClothGeometry(spec.w, RECT_TABLE_DEPTH, TABLE_HEIGHT);
  }, [spec.w]);

  const runnerColor = useMemo(
    () => new THREE.Color(color).offsetHSL(0, 0.08, -0.16).getStyle(),
    [color]
  );

  // Front side (Z > 0) first, then the back side; chairs face the table.
  const chairPlacements = useMemo(() => {
    const placements: ChairPlacement[] = [];
    if (layout === 'none') return placements;
    const spacing = spec.w / (spec.chairsPerSide + 1);
    const zOffset = 0.58;
    for (const side of layout === 'both' ? [1, -1] : [1]) {
      for (let i = 1; i <= spec.chairsPerSide; i++) {
        placements.push({ position: [-spec.w / 2 + spacing * i, 0, side * zOffset], rotation: side > 0 ? 0 : Math.PI });
      }
    }
    return placements;
  }, [spec.w, spec.chairsPerSide, layout]);
  const seats = useSeatGroups(chairPlacements, seating.childSeats, seating.vegetarianSeats, rectMarkerAt);

  return (
    <group>
      {/* Procedural draped tablecloth with corner folds and box pleats */}
      <mesh geometry={clothGeometry} castShadow receiveShadow>
        <TableClothMaterial color={color} tableCloth={tableCloth} />
        {selected && isEditMode && <Highlight />}
      </mesh>

      {/* Table runner accent */}
      <mesh position={[0, 0.752, 0]} receiveShadow>
        <boxGeometry args={[spec.w, 0.004, 0.32]} />
        <meshStandardMaterial color={runnerColor} roughness={0.65} metalness={0.05} />
      </mesh>

      {standby && <StandbyCard position={[0, 0.756, 0]} />}
      <VegetarianMarkers positions={seats.vegetarian} />
      {seats.adults.length > 0 && <BanquetChairs placements={seats.adults} />}
      {seats.children.length > 0 && <ChildChairs placements={seats.children} />}
    </group>
  );
};
