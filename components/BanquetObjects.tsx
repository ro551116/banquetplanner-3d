import React, { useMemo } from 'react';
import { ObjectType, StairConfig, TableCloth } from '../types';
import { TABLE_CLOTH_MATERIALS } from '../constants';
import { Html, Edges } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

interface BanquetModelProps {
  type: ObjectType;
  color: string;
  selected: boolean;
  isEditMode?: boolean;
  label?: string;
  customSize?: number;
  customWidth?: number;
  customDepth?: number;
  customHeight?: number;
  hasBackdrop?: boolean;
  intensity?: number;
  tilt?: number;
  standType?: 'TRIPOD' | 'PLATE';
  stairs?: StairConfig[];
  tableCloth?: TableCloth;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

// --- Shared Helper Components ---

const Highlight = ({ color = "#3b82f6" }: { color?: string }) => (
  <Edges scale={1.02} threshold={15} color={color} />
);

const Label = ({ text }: { text: string }) => (
  <Html position={[0, 2, 0]} center distanceFactor={15} zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
    <div className="bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded shadow-sm whitespace-nowrap backdrop-blur-sm border border-white/10">
      {text}
    </div>
  </Html>
);

const LightSource = ({ color, intensity }: { color: string, intensity: number }) => {
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

const TripodBase = () => {
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
        <meshStandardMaterial color="#3a3a3f" metalness={0.6} roughness={0.35} />
      </mesh>

      {/* Upper Hub (Leg Junction) */}
      <mesh position={[0, hubHeight, 0]}>
         <cylinderGeometry args={[0.04, 0.04, 0.06]} />
         <meshStandardMaterial color="#2a2a30" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Lower Hub (Strut Junction) */}
      <mesh position={[0, lowerHubH, 0]}>
         <cylinderGeometry args={[0.035, 0.035, 0.06]} />
         <meshStandardMaterial color="#2a2a30" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Legs & Struts Group */}
      {[0, 120, 240].map((angle) => (
        <group key={angle} rotation={[0, angle * (Math.PI / 180), 0]}>

          {/* Leg: Pivot at center of leg length to simplify rotation placement */}
          {/* Position is midpoint of the leg vector */}
          <group position={[0, hubHeight/2, legSpread/2]} rotation={[-legAngle, 0, 0]}>
             <mesh position={[0, 0, 0]} castShadow>
                <cylinderGeometry args={[legRadius, legRadius, legLength]} />
                <meshStandardMaterial color="#3a3a3f" metalness={0.6} roughness={0.35} />
             </mesh>
          </group>

          {/* Foot */}
          <mesh position={[0, 0.015, legSpread]}>
             <cylinderGeometry args={[0.02, 0.02, 0.03]} />
             <meshStandardMaterial color="#1a1a1f" metalness={0.5} roughness={0.4} />
          </mesh>

          {/* Strut */}
          <group
             position={[0, lowerHubH + strutDy/2, strutDz/2]}
             rotation={[strutAngle, 0, 0]}
          >
             <mesh castShadow>
                <cylinderGeometry args={[0.01, 0.01, strutLength]} />
                <meshStandardMaterial color="#4a4a52" metalness={0.6} roughness={0.35} />
             </mesh>
          </group>
        </group>
      ))}
    </group>
  );
};

const PlateBase = () => (
  <group>
    <mesh position={[0, 0.025, 0]} receiveShadow>
      <boxGeometry args={[0.6, 0.05, 0.6]} />
      <meshStandardMaterial color="#2a2a30" metalness={0.6} roughness={0.3} />
    </mesh>
    <mesh position={[0, 0.6, 0]} castShadow>
      <cylinderGeometry args={[0.025, 0.025, 1.2]} />
      <meshStandardMaterial color="#3a3a3f" metalness={0.6} roughness={0.35} />
    </mesh>
  </group>
);

const BanquetChair = () => (
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
    </mesh>
    {/* Back */}
    <mesh position={[0, 0.7, 0.2]} rotation={[-0.1, 0, 0]} castShadow>
       <boxGeometry args={[0.42, 0.5, 0.04]} />
       <meshStandardMaterial color="#e8e0d0" roughness={0.7} metalness={0.02} />
    </mesh>
  </group>
);

// --- Specific Object Implementations ---

const TableClothMaterial = ({ color, tableCloth }: { color: string; tableCloth: string }) => {
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

const RoundTable = ({ color, customSize = 6, tableCloth = 'linen', selected, isEditMode }: any) => {
  const config = useMemo(() => {
    const map: Record<number, { r: number, chairs: number }> = {
      4: { r: 0.6, chairs: 5 },
      5: { r: 0.75, chairs: 8 },
      6: { r: 0.9, chairs: 10 },
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

const RectTable = ({ color, tableCloth = 'linen', selected, isEditMode }: any) => {
  const edgeColor = useMemo(() => new THREE.Color(color).offsetHSL(0, 0.05, -0.15).getStyle(), [color]);
  return (
    <group>
      {/* Main tablecloth body */}
      <mesh position={[0, 0.375, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.75, 0.75]} />
        <TableClothMaterial color={color} tableCloth={tableCloth} />
        {selected && isEditMode && <Highlight />}
      </mesh>
      {/* Tablecloth bottom trim */}
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[1.82, 0.02, 0.77]} />
        <meshStandardMaterial color={edgeColor} roughness={0.8} />
      </mesh>
      {/* Table top — cloth surface */}
      <mesh position={[0, 0.76, 0]} receiveShadow>
        <boxGeometry args={[1.76, 0.01, 0.71]} />
        <TableClothMaterial color={color} tableCloth={tableCloth} />
      </mesh>
      {/* Chairs: 3 on each side */}
      {[-0.6, 0, 0.6].map((x, i) => (
        <React.Fragment key={i}>
           <group position={[x, 0, 0.6]}><BanquetChair /></group>
           <group position={[x, 0, -0.6]} rotation={[0, Math.PI, 0]}><BanquetChair /></group>
        </React.Fragment>
      ))}
    </group>
  );
};

const StairUnit = ({ width, stageHeight, color }: { width: number, stageHeight: number, color: string }) => {
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
           </mesh>
        );
      })}
    </group>
  );
};

const Stage = ({ color, width = 6, depth = 4, height = 0.5, hasBackdrop, stairs = [], selected, isEditMode }: any) => {
  const trimColor = useMemo(() => new THREE.Color(color).offsetHSL(0, 0, -0.2).getStyle(), [color]);
  return (
  <group>
    {/* Main platform */}
    <mesh position={[0, height/2, 0]} receiveShadow castShadow>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.03} />
      {selected && isEditMode && <Highlight />}
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
          <meshStandardMaterial color="#d8dce5" roughness={0.6} metalness={0.02} />
        </mesh>
        {/* Backdrop panel */}
        <mesh position={[0, 1.5, 0.06]}>
           <planeGeometry args={[width - 0.4, 2.6]} />
           <meshStandardMaterial color="#eef1f6" roughness={0.5} metalness={0.05} />
        </mesh>
        {/* Backdrop frame */}
        <mesh position={[0, 1.5, 0.07]}>
           <planeGeometry args={[width - 0.3, 2.7]} />
           <meshStandardMaterial color="#aaa" metalness={0.5} roughness={0.3} transparent opacity={0.3} />
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

const RedCarpet = ({ width = 1.5, depth = 10, selected, isEditMode }: any) => (
  <group>
    {/* Carpet body */}
    <mesh position={[0, 0.01, 0]} receiveShadow>
       <boxGeometry args={[width, 0.02, depth]} />
       <meshStandardMaterial color="#9f1239" roughness={0.85} metalness={0.02} />
       {selected && isEditMode && <Highlight />}
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

const Speaker = ({ type, color, standType, selected, isEditMode, tilt = 0 }: any) => {
  return (
    <group>
      {type === ObjectType.SPEAKER_15 && (
        <group>
           {standType === 'PLATE' ? <PlateBase /> : <TripodBase />}
           <group position={[0, 1.2, 0]} rotation={[tilt, 0, 0]}>
              {/* Cabinet */}
              <mesh position={[0, 0.35, 0]} castShadow>
                 <boxGeometry args={[0.4, 0.7, 0.4]} />
                 <meshStandardMaterial color={color} roughness={0.5} metalness={0.15} />
                 {selected && isEditMode && <Highlight />}
              </mesh>
              {/* Grille face */}
              <mesh position={[0, 0.35, 0.21]}>
                 <planeGeometry args={[0.36, 0.66]} />
                 <meshStandardMaterial color="#111" roughness={0.95} metalness={0.1} />
              </mesh>
              {/* Brand badge */}
              <mesh position={[0, 0.1, 0.211]}>
                 <planeGeometry args={[0.1, 0.02]} />
                 <meshStandardMaterial color="#666" metalness={0.8} roughness={0.2} />
              </mesh>
           </group>
        </group>
      )}

      {type === ObjectType.SPEAKER_SUB && (
        <group>
          <mesh position={[0, 0.35, 0]} castShadow>
             <boxGeometry args={[0.7, 0.7, 0.8]} />
             <meshStandardMaterial color="#222228" roughness={0.5} metalness={0.15} />
             {selected && isEditMode && <Highlight />}
          </mesh>
          {/* Grille */}
          <mesh position={[0, 0.35, 0.41]}>
             <planeGeometry args={[0.65, 0.65]} />
             <meshStandardMaterial color="#0a0a0a" roughness={0.95} metalness={0.1} />
          </mesh>
          {/* Handles */}
          <mesh position={[0.36, 0.35, 0]}>
            <boxGeometry args={[0.02, 0.15, 0.08]} />
            <meshStandardMaterial color="#444" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[-0.36, 0.35, 0]}>
            <boxGeometry args={[0.02, 0.15, 0.08]} />
            <meshStandardMaterial color="#444" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      )}

      {type === ObjectType.SPEAKER_MONITOR && (
        <group rotation={[0.4, 0, 0]}>
           <mesh position={[0, 0.15, 0]} castShadow>
              <boxGeometry args={[0.5, 0.3, 0.4]} />
              <meshStandardMaterial color="#2d2d33" roughness={0.5} metalness={0.15} />
              {selected && isEditMode && <Highlight />}
           </mesh>
           {/* Grille face */}
           <mesh position={[0, 0.15, 0.201]}>
              <planeGeometry args={[0.46, 0.26]} />
              <meshStandardMaterial color="#111" roughness={0.95} metalness={0.1} />
           </mesh>
           {/* Rubber feet */}
           {[[0.2, 0, 0.15], [-0.2, 0, 0.15], [0.2, 0, -0.15], [-0.2, 0, -0.15]].map((p, i) => (
             <mesh key={i} position={p as [number, number, number]}>
               <cylinderGeometry args={[0.02, 0.02, 0.02]} />
               <meshStandardMaterial color="#111" roughness={0.9} />
             </mesh>
           ))}
        </group>
      )}

      {type === ObjectType.SPEAKER_COLUMN && (
         <group>
            {/* Sub Base */}
            <mesh position={[0, 0.25, 0]} castShadow>
               <boxGeometry args={[0.4, 0.5, 0.5]} />
               <meshStandardMaterial color="#2d2d33" roughness={0.5} metalness={0.15} />
               {selected && isEditMode && <Highlight />}
            </mesh>
            {/* Grille face */}
            <mesh position={[0, 0.25, 0.251]}>
               <planeGeometry args={[0.36, 0.46]} />
               <meshStandardMaterial color="#111" roughness={0.95} metalness={0.1} />
            </mesh>
            {/* Column */}
            <mesh position={[0, 1.25, -0.1]} castShadow>
               <boxGeometry args={[0.12, 1.5, 0.1]} />
               <meshStandardMaterial color="#2d2d33" roughness={0.45} metalness={0.2} />
            </mesh>
            {/* Column grille */}
            <mesh position={[0, 1.25, -0.049]}>
               <planeGeometry args={[0.1, 1.45]} />
               <meshStandardMaterial color="#111" roughness={0.95} metalness={0.1} />
            </mesh>
         </group>
      )}
    </group>
  );
};

const Lighting = ({ type, color, intensity = 1, tilt = 0, selected, isEditMode, standType }: any) => {
  const bulbColor = new THREE.Color(color).offsetHSL(0, 0, 0.2); // brighter emission version
  
  return (
    <group>
      {type === ObjectType.LIGHT_PAR && (
        <group position={[0, 0.1, 0]}>
           {/* Floor bracket */}
           <mesh position={[0, 0, 0]}>
             <boxGeometry args={[0.2, 0.05, 0.15]} />
             <meshStandardMaterial color="#2a2a30" metalness={0.5} roughness={0.35} />
           </mesh>
           {/* Head */}
           <group position={[0, 0.15, 0]} rotation={[tilt - 0.5, 0, 0]}>
              <mesh castShadow rotation={[Math.PI/2, 0, 0]}>
                 <cylinderGeometry args={[0.1, 0.08, 0.25, 16]} />
                 <meshStandardMaterial color="#333338" metalness={0.4} roughness={0.4} />
                 {selected && isEditMode && <Highlight />}
              </mesh>
              {/* Lens */}
              <mesh position={[0, 0, 0.13]}>
                 <circleGeometry args={[0.08, 16]} />
                 <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
              </mesh>
              <LightSource color={color} intensity={intensity} />

              {/* Light Cone Helper in Edit Mode */}
              {isEditMode && selected && (
                 <mesh position={[0, 0, 1]} rotation={[Math.PI/2, 0, 0]}>
                    <coneGeometry args={[0.5, 2, 32, 1, true]} />
                    <meshBasicMaterial color={color} transparent opacity={0.1} wireframe />
                 </mesh>
              )}
           </group>
        </group>
      )}

      {type === ObjectType.LIGHT_MOVING && (
         <group>
            {/* Base */}
            <mesh position={[0, 0.1, 0]} castShadow>
               <boxGeometry args={[0.3, 0.2, 0.3]} />
               <meshStandardMaterial color="#2a2a30" metalness={0.4} roughness={0.4} />
               {selected && isEditMode && <Highlight />}
            </mesh>
            {/* Yoke (Arms) */}
            <group position={[0, 0.3, 0]}>
               <mesh>
                  <boxGeometry args={[0.25, 0.3, 0.1]} />
                  <meshStandardMaterial color="#333338" metalness={0.5} roughness={0.35} />
               </mesh>
               {/* Head */}
               <group position={[0, 0.1, 0]} rotation={[tilt, 0, 0]}>
                  <mesh castShadow rotation={[Math.PI/2, 0, 0]}>
                     <cylinderGeometry args={[0.08, 0.1, 0.3]} />
                     <meshStandardMaterial color="#444450" metalness={0.5} roughness={0.35} />
                  </mesh>
                  <mesh position={[0, 0, 0.16]}>
                     <circleGeometry args={[0.07, 16]} />
                     <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity * 2} toneMapped={false} />
                  </mesh>
                  <LightSource color={color} intensity={intensity} />
               </group>
            </group>
         </group>
      )}

      {type === ObjectType.LIGHT_STAND && (
         <group>
            {standType === 'PLATE' ? <PlateBase /> : <TripodBase />}

            {/* Extension Pole */}
            <mesh position={[0, 1.6, 0]}>
               <cylinderGeometry args={[0.02, 0.02, 0.8]} />
               <meshStandardMaterial color="#3a3a3f" metalness={0.6} roughness={0.35} />
            </mesh>
            {/* Adjustment Knob */}
            <mesh position={[0, 1.2, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 0.06]} />
                <meshStandardMaterial color="#2a2a30" metalness={0.7} roughness={0.3} />
            </mesh>

            <group position={[0, 2, 0]}>
               {/* T-Bar */}
               <mesh>
                  <boxGeometry args={[1.5, 0.05, 0.05]} />
                  <meshStandardMaterial color="#2a2a30" metalness={0.6} roughness={0.3} />
                  {selected && isEditMode && <Highlight />}
               </mesh>
               {/* 4 Par Cans */}
               {[-0.6, -0.2, 0.2, 0.6].map((x, i) => (
                  <group key={i} position={[x, -0.15, 0]} rotation={[tilt + 0.5, 0, 0]}>
                     <mesh castShadow rotation={[Math.PI/2, 0, 0]}>
                        <cylinderGeometry args={[0.08, 0.06, 0.2]} />
                        <meshStandardMaterial color="#333338" metalness={0.4} roughness={0.4} />
                     </mesh>
                     <mesh position={[0, 0, 0.11]}>
                        <circleGeometry args={[0.06, 16]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
                     </mesh>
                     <LightSource color={color} intensity={intensity} />
                  </group>
               ))}
            </group>
         </group>
      )}
    </group>
  );
};

// --- Main Component ---

export const BanquetObjectModel: React.FC<BanquetModelProps> = (props) => {
  const { type, label } = props;
  
  let content = null;
  
  if (type === ObjectType.ROUND_TABLE) {
    content = <RoundTable {...props} />;
  } else if (type === ObjectType.RECT_TABLE) {
    content = <RectTable {...props} />;
  } else if (type === ObjectType.STAGE) {
    content = <Stage width={props.customWidth} depth={props.customDepth} height={props.customHeight} hasBackdrop={props.hasBackdrop} stairs={props.stairs} {...props} />;
  } else if (type === ObjectType.RED_CARPET) {
    content = <RedCarpet width={props.customWidth} depth={props.customDepth} {...props} />;
  } else if (type.includes('SPEAKER')) {
    content = <Speaker type={type} standType={props.standType} tilt={props.tilt} {...props} />;
  } else if (type.includes('LIGHT')) {
    content = <Lighting type={type} intensity={props.intensity} tilt={props.tilt} {...props} />;
  }

  return (
    <group>
      {content}
      {label && <Label text={label} />}
    </group>
  );
};