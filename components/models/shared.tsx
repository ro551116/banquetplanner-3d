import React, { useMemo } from 'react';
import { Html, Edges, Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { TABLE_CLOTH_MATERIALS } from '../../constants';

export const Highlight = ({ color = "#3b82f6" }: { color?: string }) => (
  <Edges scale={1.02} threshold={15} color={color} />
);

// SketchUp-style edge outline for all objects
export const EdgeOutline = ({ thickness = 2 }: { thickness?: number }) => (
  <Outlines thickness={thickness} color="#555555" screenspace angle={0.2} />
);

export const Label = ({ text }: { text: string }) => (
  <Html position={[0, 2, 0]} center distanceFactor={15} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
    <div className="bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded shadow-sm whitespace-nowrap backdrop-blur-sm border border-white/10">
      {text}
    </div>
  </Html>
);

export const LightSource = ({ color, intensity }: { color: string, intensity: number }) => {
  const target = useMemo(() => {
    const t = new THREE.Object3D();
    t.position.set(0, 0, 5); // Target is 5 meters in front (local Z)
    return t;
  }, []);

  // Don't render light if intensity is 0 to save performance
  if (intensity <= 0) return null;

  return (
    <>
      <primitive object={target} />
      <spotLight 
        color={color} 
        intensity={intensity * 20} // Multiplier for visibility against environment lights
        distance={20}
        angle={0.6}
        penumbra={0.4}
        target={target}
        castShadow
        shadow-bias={-0.0001}
      />
    </>
  );
};

export const TripodBase = () => {
  // Geometry Constants
  const hubHeight = 0.85; // Height where legs attach
  const legSpread = 0.6;  // Radius of legs on the floor
  const legRadius = 0.015;

  // Leg Calculation
  const legLength = Math.sqrt(hubHeight * hubHeight + legSpread * legSpread);
  const legAngle = Math.atan2(legSpread, hubHeight); // Angle from vertical

  // Strut Calculation
  const lowerHubH = 0.3; // Height of the sliding hub
  const connectH = 0.45; // Height where strut connects to the leg (absolute Y)

  // Calculate Z position on the leg at connectH height
  // Leg goes from (0, hubHeight, 0) to (0, 0, legSpread)
  // Linear interpolation: Z(y) = legSpread * (1 - y/hubHeight)
  const connectZ = legSpread * (1 - connectH / hubHeight);

  const strutDy = connectH - lowerHubH;
  const strutDz = connectZ;
  const strutLength = Math.sqrt(strutDy * strutDy + strutDz * strutDz);
  const strutAngle = Math.atan2(strutDz, strutDy);

  return (
    <group>
      {/* Central Pole */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 1.2]} />
        <meshStandardMaterial color="#707078" metalness={0.6} roughness={0.35} />
      </mesh>

      {/* Upper Hub (Leg Junction) */}
      <mesh position={[0, hubHeight, 0]}>
         <cylinderGeometry args={[0.04, 0.04, 0.06]} />
         <meshStandardMaterial color="#606068" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Lower Hub (Strut Junction) */}
      <mesh position={[0, lowerHubH, 0]}>
         <cylinderGeometry args={[0.035, 0.035, 0.06]} />
         <meshStandardMaterial color="#606068" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Legs & Struts Group */}
      {[0, 120, 240].map((angle) => (
        <group key={angle} rotation={[0, angle * (Math.PI / 180), 0]}>

          {/* Leg: Pivot at center of leg length to simplify rotation placement */}
          {/* Position is midpoint of the leg vector */}
          <group position={[0, hubHeight/2, legSpread/2]} rotation={[-legAngle, 0, 0]}>
             <mesh position={[0, 0, 0]} castShadow>
                <cylinderGeometry args={[legRadius, legRadius, legLength]} />
                <meshStandardMaterial color="#707078" metalness={0.6} roughness={0.35} />
             </mesh>
          </group>

          {/* Foot */}
          <mesh position={[0, 0.015, legSpread]}>
             <cylinderGeometry args={[0.02, 0.02, 0.03]} />
             <meshStandardMaterial color="#505058" metalness={0.5} roughness={0.4} />
          </mesh>

          {/* Strut */}
          <group
             position={[0, lowerHubH + strutDy/2, strutDz/2]}
             rotation={[strutAngle, 0, 0]}
          >
             <mesh castShadow>
                <cylinderGeometry args={[0.01, 0.01, strutLength]} />
                <meshStandardMaterial color="#808088" metalness={0.6} roughness={0.35} />
             </mesh>
          </group>
        </group>
      ))}
    </group>
  );
};

export const PlateBase = () => (
  <group>
    <mesh position={[0, 0.025, 0]} receiveShadow>
      <boxGeometry args={[0.6, 0.05, 0.6]} />
      <meshStandardMaterial color="#606068" metalness={0.6} roughness={0.3} />
      <EdgeOutline thickness={1} />
    </mesh>
    <mesh position={[0, 0.6, 0]} castShadow>
      <cylinderGeometry args={[0.025, 0.025, 1.2]} />
      <meshStandardMaterial color="#3a3a3f" metalness={0.6} roughness={0.35} />
    </mesh>
  </group>
);

export const BanquetChair = () => (
  <group>
    {/* Legs */}
    {[ [0.18, 0.2], [-0.18, 0.2], [0.18, -0.18], [-0.18, -0.18] ].map((pos, i) => (
      <mesh key={i} position={[pos[0], 0.225, pos[1]]} castShadow>
        <cylinderGeometry args={[0.015, 0.012, 0.45]} />
        <meshStandardMaterial color="#c9a030" metalness={0.8} roughness={0.25} />
      </mesh>
    ))}
    {/* Seat */}
    <mesh position={[0, 0.45, 0]} castShadow>
      <boxGeometry args={[0.42, 0.06, 0.42]} />
      <meshStandardMaterial color="#e8e0d0" roughness={0.7} metalness={0.02} />
      <EdgeOutline thickness={1} />
    </mesh>
    {/* Back */}
    <mesh position={[0, 0.7, 0.2]} rotation={[-0.1, 0, 0]} castShadow>
       <boxGeometry args={[0.42, 0.5, 0.04]} />
       <meshStandardMaterial color="#e8e0d0" roughness={0.7} metalness={0.02} />
       <EdgeOutline thickness={1} />
    </mesh>
  </group>
);

// --- Specific Object Implementations ---

export const TableClothMaterial = ({ color, tableCloth }: { color: string; tableCloth: string }) => {
  const mat = TABLE_CLOTH_MATERIALS[tableCloth as keyof typeof TABLE_CLOTH_MATERIALS] || TABLE_CLOTH_MATERIALS.linen;
  const sheenColor = useMemo(() => {
    if (!mat.sheenColorFactor) return undefined;
    return new THREE.Color(color).lerp(new THREE.Color('#ffffff'), mat.sheenColorFactor);
  }, [color, mat.sheenColorFactor]);

  return (
    <meshPhysicalMaterial
      color={color}
      roughness={mat.roughness}
      metalness={mat.metalness}
      clearcoat={mat.clearcoat ?? 0}
      clearcoatRoughness={mat.clearcoatRoughness ?? 0}
      sheen={mat.sheen ?? 0}
      sheenRoughness={mat.sheenRoughness ?? 0.25}
      sheenColor={sheenColor}
    />
  );
};
