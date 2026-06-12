import React, { useMemo } from 'react';
import * as THREE from 'three';
import { BanquetChair, EdgeOutline, Highlight, TableClothMaterial } from './shared';

export const RoundTable = ({ color, customSize = 6, tableCloth = 'linen', selected, isEditMode }: any) => {
  const config = useMemo(() => {
    const map: Record<number, { r: number, chairs: number }> = {
      4: { r: 0.6, chairs: 5 },
      5: { r: 0.75, chairs: 8 },
      6: { r: 0.9, chairs: 10 },
      7: { r: 1.05, chairs: 10 },
      8: { r: 1.2, chairs: 12 }
    };
    return map[customSize] || map[6];
  }, [customSize]);

  const edgeColor = useMemo(() => new THREE.Color(color).offsetHSL(0, 0.05, -0.15).getStyle(), [color]);

  return (
    <group>
      {/* Main tablecloth body */}
      <mesh position={[0, 0.375, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[config.r, config.r, 0.75, 32]} />
        <TableClothMaterial color={color} tableCloth={tableCloth} />
        {selected && isEditMode && <Highlight />}
        <EdgeOutline />
      </mesh>
      {/* Tablecloth rim — darker ring at bottom edge */}
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[config.r + 0.01, config.r + 0.01, 0.02, 32]} />
        <meshStandardMaterial color={edgeColor} roughness={0.8} />
      </mesh>
      {/* Table Top — cloth surface continuation */}
      <mesh position={[0, 0.76, 0]} receiveShadow>
         <cylinderGeometry args={[config.r - 0.02, config.r - 0.02, 0.01, 32]} />
         <TableClothMaterial color={color} tableCloth={tableCloth} />
         <EdgeOutline />
      </mesh>
      {/* Centerpiece circle */}
      <mesh position={[0, 0.77, 0]}>
         <cylinderGeometry args={[config.r * 0.35, config.r * 0.35, 0.005, 32]} />
         <meshStandardMaterial color="#c9a030" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Chairs */}
      {Array.from({ length: config.chairs }).map((_, i) => {
        const angle = (i / config.chairs) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, -angle, 0]}>
            <group position={[0, 0, config.r + 0.45]}>
              <BanquetChair />
            </group>
          </group>
        );
      })}
    </group>
  );
};

export const RectTable = ({ color, customSize = 6, tableCloth = 'linen', selected, isEditMode }: any) => {
  const config = useMemo(() => {
    const map: Record<number, { w: number, chairs: number }> = {
      6: { w: 1.8, chairs: 3 },
      8: { w: 2.4, chairs: 4 },
    };
    return map[customSize] || map[6];
  }, [customSize]);

  const edgeColor = useMemo(() => new THREE.Color(color).offsetHSL(0, 0.05, -0.15).getStyle(), [color]);

  const chairPositions = useMemo(() => {
    const positions: number[] = [];
    const spacing = config.w / (config.chairs + 1);
    for (let i = 1; i <= config.chairs; i++) {
      positions.push(-config.w / 2 + spacing * i);
    }
    return positions;
  }, [config]);

  return (
    <group>
      {/* Main tablecloth body */}
      <mesh position={[0, 0.375, 0]} castShadow receiveShadow>
        <boxGeometry args={[config.w, 0.75, 0.75]} />
        <TableClothMaterial color={color} tableCloth={tableCloth} />
        {selected && isEditMode && <Highlight />}
        <EdgeOutline />
      </mesh>
      {/* Tablecloth bottom trim */}
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[config.w + 0.02, 0.02, 0.77]} />
        <meshStandardMaterial color={edgeColor} roughness={0.8} />
      </mesh>
      {/* Table top — cloth surface */}
      <mesh position={[0, 0.76, 0]} receiveShadow>
        <boxGeometry args={[config.w - 0.04, 0.01, 0.71]} />
        <TableClothMaterial color={color} tableCloth={tableCloth} />
        <EdgeOutline />
      </mesh>
      {/* Chairs: config.chairs on each side */}
      {chairPositions.map((x, i) => (
        <React.Fragment key={i}>
           <group position={[x, 0, 0.6]}><BanquetChair /></group>
           <group position={[x, 0, -0.6]} rotation={[0, Math.PI, 0]}><BanquetChair /></group>
        </React.Fragment>
      ))}
    </group>
  );
};
