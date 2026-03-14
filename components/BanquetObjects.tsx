import React, { useMemo } from 'react';
import { ObjectType, StairConfig, TableCloth } from '../types';
import { TABLE_CLOTH_MATERIALS } from '../constants';
import { Html, Edges, Outlines } from '@react-three/drei';
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
  arrayCount?: number;
  stairs?: StairConfig[];
  tableCloth?: TableCloth;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

// --- Shared Helper Components ---

const Highlight = ({ color = "#3b82f6" }: { color?: string }) => (
  <Edges scale={1.02} threshold={15} color={color} />
);

// SketchUp-style edge outline for all objects
const EdgeOutline = ({ thickness = 2 }: { thickness?: number }) => (
  <Outlines thickness={thickness} color="#555555" screenspace angle={0.2} />
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

const PlateBase = () => (
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

const RectTable = ({ color, customSize = 6, tableCloth = 'linen', selected, isEditMode }: any) => {
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
              <EdgeOutline />
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

const RedCarpet = ({ color, width = 1.5, depth = 10, selected, isEditMode }: any) => (
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

const Speaker = ({ type, color, standType, selected, isEditMode, tilt = 0, arrayCount = 4 }: any) => {
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


const Lighting = ({ type, color, intensity = 1, tilt = 0, selected, isEditMode, standType }: any) => {
  // Lighten fixture body for SketchUp-style visibility
  const bodyColor = '#a0a0a8';

  return (
    <group>
      {type === ObjectType.LIGHT_PAR && (() => {
        // Realistic 54-LED Par Can
        const canR = 0.15;         // front radius (30cm dia)
        const canRBack = 0.075;    // back radius (steep taper)
        const canD = 0.25;         // can depth
        const bodyColor = '#1a1a1e';
        const yokeColor = '#141418';
        const pivotY = 0.22;       // pivot height from ground
        const yokeT = 0.025;       // yoke arm thickness

        // 54 LED positions: 1+6+12+18+17
        const leds: [number, number][] = [[0, 0]];
        const rings = [
          { count: 6, r: 0.035 },
          { count: 12, r: 0.065 },
          { count: 18, r: 0.095 },
          { count: 17, r: 0.12 },
        ];
        rings.forEach(({ count, r }, ri) => {
          for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + (ri % 2 ? Math.PI / count : 0);
            leds.push([Math.cos(a) * r, Math.sin(a) * r]);
          }
        });

        return (
          <group>
            {/* === Yoke / Floor Stand === */}
            {[-1, 1].map(side => (
              <group key={side}>
                {/* Arm */}
                <mesh position={[side * (canR + yokeT / 2), pivotY / 2, 0]}>
                  <boxGeometry args={[yokeT, pivotY, 0.035]} />
                  <meshStandardMaterial color={yokeColor} metalness={0.6} roughness={0.35} />
                </mesh>
                {/* Foot (angled out) */}
                <mesh position={[side * (canR + 0.02), 0.01, 0]} rotation={[0, 0, side * -0.15]}>
                  <boxGeometry args={[0.05, 0.02, 0.055]} />
                  <meshStandardMaterial color={yokeColor} metalness={0.6} roughness={0.35} />
                </mesh>
                {/* Pivot bolt */}
                <mesh position={[side * (canR + 0.005), pivotY, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.01, 0.01, yokeT + 0.05, 12]} />
                  <meshStandardMaterial color="#3a3a42" metalness={0.7} roughness={0.2} />
                </mesh>
                {/* Locking knob */}
                <mesh position={[side * (canR + yokeT + 0.008), pivotY, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.018, 0.012, 0.015, 12]} />
                  <meshStandardMaterial color="#2a2a32" metalness={0.6} roughness={0.3} />
                </mesh>
              </group>
            ))}

            {/* === Head (tilts around pivot) === */}
            <group position={[0, pivotY, 0]} rotation={[tilt - 0.4, 0, 0]}>
              {/* Main can body — steep tapered cylinder, rotated to face Z */}
              <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[canR, canRBack, canD, 32]} />
                <meshStandardMaterial color={bodyColor} metalness={0.45} roughness={0.4} />
                {selected && isEditMode && <Highlight />}
                <EdgeOutline />
              </mesh>

              {/* Front bezel ring */}
              <mesh position={[0, 0, canD / 2 + 0.003]}>
                <torusGeometry args={[canR - 0.005, 0.006, 12, 32]} />
                <meshStandardMaterial color="#303038" metalness={0.7} roughness={0.2} />
              </mesh>

              {/* Recessed black interior face */}
              <mesh position={[0, 0, canD / 2 - 0.02]}>
                <circleGeometry args={[canR - 0.008, 32]} />
                <meshStandardMaterial color="#050508" roughness={0.95} metalness={0} />
              </mesh>

              {/* 54 LED beads */}
              {leds.map(([lx, ly], i) => (
                <mesh key={`led-${i}`} position={[lx, ly, canD / 2 - 0.015]}>
                  <circleGeometry args={[0.009, 10]} />
                  <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={intensity * 2.5}
                    toneMapped={false}
                  />
                </mesh>
              ))}

              {/* Back cap */}
              <mesh position={[0, 0, -canD / 2 - 0.001]}>
                <circleGeometry args={[canRBack, 24]} />
                <meshStandardMaterial color="#101014" metalness={0.3} roughness={0.6} />
              </mesh>

              {/* Heat sink fins on back (radial) */}
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i / 8) * Math.PI * 2;
                const fr = canRBack * 0.7;
                return (
                  <mesh key={`fin-${i}`} position={[Math.cos(a) * fr, Math.sin(a) * fr, -canD / 2 - 0.005]} rotation={[0, 0, a]}>
                    <boxGeometry args={[0.03, 0.004, 0.003]} />
                    <meshStandardMaterial color="#0a0a10" roughness={0.8} metalness={0.3} />
                  </mesh>
                );
              })}

              {/* DMX / Power connectors */}
              <mesh position={[0.025, -0.02, -canD / 2 - 0.012]}>
                <boxGeometry args={[0.022, 0.016, 0.018]} />
                <meshStandardMaterial color="#2a2a32" metalness={0.5} roughness={0.4} />
              </mesh>
              <mesh position={[-0.025, -0.02, -canD / 2 - 0.012]}>
                <boxGeometry args={[0.022, 0.016, 0.018]} />
                <meshStandardMaterial color="#2a2a32" metalness={0.5} roughness={0.4} />
              </mesh>

              {/* Safety loop (torus) */}
              <mesh position={[0, canRBack - 0.01, -canD / 2 - 0.008]}>
                <torusGeometry args={[0.012, 0.003, 8, 12]} />
                <meshStandardMaterial color="#3a3a42" metalness={0.7} roughness={0.2} />
              </mesh>

              <LightSource color={color} intensity={intensity} />
              {isEditMode && selected && (
                <mesh position={[0, 0, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
                  <coneGeometry args={[0.6, 2.4, 32, 1, true]} />
                  <meshBasicMaterial color={color} transparent opacity={0.1} wireframe />
                </mesh>
              )}
            </group>
          </group>
        );
      })()}

      {type === ObjectType.LIGHT_MOVING && (
         <group>
            {/* Base */}
            <mesh position={[0, 0.1, 0]} castShadow>
               <boxGeometry args={[0.3, 0.2, 0.3]} />
               <meshStandardMaterial color={bodyColor} metalness={0.4} roughness={0.4} />
               {selected && isEditMode && <Highlight />}
               <EdgeOutline />
            </mesh>
            {/* Pan Axis Collar Ring */}
            <mesh position={[0, 0.22, 0]}>
               <cylinderGeometry args={[0.16, 0.16, 0.04, 24]} />
               <meshStandardMaterial color="#909098" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Yoke — Two separated arm plates */}
            <group position={[0, 0.3, 0]}>
               {/* Left arm */}
               <mesh position={[-0.12, 0.15, 0]}>
                  <boxGeometry args={[0.03, 0.3, 0.1]} />
                  <meshStandardMaterial color={bodyColor} metalness={0.5} roughness={0.35} />
                  <EdgeOutline />
               </mesh>
               {/* Right arm */}
               <mesh position={[0.12, 0.15, 0]}>
                  <boxGeometry args={[0.03, 0.3, 0.1]} />
                  <meshStandardMaterial color={bodyColor} metalness={0.5} roughness={0.35} />
                  <EdgeOutline />
               </mesh>
               {/* Head */}
               <group position={[0, 0.1, 0]} rotation={[tilt, 0, 0]}>
                  <mesh castShadow rotation={[Math.PI/2, 0, 0]}>
                     <cylinderGeometry args={[0.08, 0.1, 0.3]} />
                     <meshStandardMaterial color={bodyColor} metalness={0.5} roughness={0.35} />
                     <EdgeOutline />
                  </mesh>
                  {/* Cooling fin rings */}
                  {[-0.06, 0, 0.06].map((zOff, i) => (
                     <mesh key={i} position={[0, 0, zOff]} rotation={[Math.PI/2, 0, 0]}>
                        <cylinderGeometry args={[0.105, 0.105, 0.015, 24]} />
                        <meshStandardMaterial color="#808088" metalness={0.6} roughness={0.3} />
                     </mesh>
                  ))}
                  {/* Lens */}
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
               <meshStandardMaterial color="#707078" metalness={0.6} roughness={0.35} />
            </mesh>
            {/* Adjustment Knob */}
            <mesh position={[0, 1.2, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 0.06]} />
                <meshStandardMaterial color="#606068" metalness={0.7} roughness={0.3} />
            </mesh>

            <group position={[0, 2, 0]}>
               {/* T-Bar */}
               <mesh>
                  <boxGeometry args={[1.5, 0.05, 0.05]} />
                  <meshStandardMaterial color={bodyColor} metalness={0.6} roughness={0.3} />
                  {selected && isEditMode && <Highlight />}
                  <EdgeOutline />
               </mesh>
               {/* 4 Par Cans */}
               {[-0.6, -0.2, 0.2, 0.6].map((x, i) => (
                  <group key={i} position={[x, -0.15, 0]} rotation={[tilt + 0.5, 0, 0]}>
                     <mesh castShadow rotation={[Math.PI/2, 0, 0]}>
                        <cylinderGeometry args={[0.08, 0.06, 0.2]} />
                        <meshStandardMaterial color={bodyColor} metalness={0.4} roughness={0.4} />
                        <EdgeOutline />
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

      {type === ObjectType.LIGHT_FOLLOWSPOT && (
         <group>
            {/* Tall tripod base */}
            {(() => {
              const hubHeight = 1.4;
              const legSpread = 0.65;
              const legRadius = 0.015;
              const legLength = Math.sqrt(hubHeight * hubHeight + legSpread * legSpread);
              const legAngle = Math.atan2(legSpread, hubHeight);
              return (
                <group>
                  {/* Central pole */}
                  <mesh position={[0, 0.75, 0]} castShadow>
                    <cylinderGeometry args={[0.02, 0.02, 1.5]} />
                    <meshStandardMaterial color="#707078" metalness={0.6} roughness={0.35} />
                  </mesh>
                  {/* Upper hub */}
                  <mesh position={[0, hubHeight, 0]}>
                    <cylinderGeometry args={[0.04, 0.04, 0.06]} />
                    <meshStandardMaterial color="#606068" metalness={0.7} roughness={0.3} />
                  </mesh>
                  {/* Legs */}
                  {[0, 120, 240].map((angle) => (
                    <group key={angle} rotation={[0, angle * (Math.PI / 180), 0]}>
                      <group position={[0, hubHeight / 2, legSpread / 2]} rotation={[-legAngle, 0, 0]}>
                        <mesh castShadow>
                          <cylinderGeometry args={[legRadius, legRadius, legLength]} />
                          <meshStandardMaterial color="#707078" metalness={0.6} roughness={0.35} />
                        </mesh>
                      </group>
                      <mesh position={[0, 0.015, legSpread]}>
                        <cylinderGeometry args={[0.025, 0.025, 0.03]} />
                        <meshStandardMaterial color="#505058" metalness={0.5} roughness={0.4} />
                      </mesh>
                    </group>
                  ))}
                </group>
              );
            })()}

            {/* Followspot head mount */}
            <group position={[0, 1.5, 0]} rotation={[tilt, 0, 0]}>
               {/* Tilt bracket */}
               <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[0.2, 0.06, 0.12]} />
                  <meshStandardMaterial color="#606068" metalness={0.6} roughness={0.3} />
               </mesh>
               {/* Main cylindrical body (~0.6m long) */}
               <mesh castShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 0.04, 0.2]}>
                  <cylinderGeometry args={[0.075, 0.075, 0.6, 16]} />
                  <meshStandardMaterial color={bodyColor} metalness={0.4} roughness={0.4} />
                  {selected && isEditMode && <Highlight />}
                  <EdgeOutline />
               </mesh>
               {/* Front lens housing (wider) */}
               <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.04, 0.52]}>
                  <cylinderGeometry args={[0.09, 0.075, 0.08, 16]} />
                  <meshStandardMaterial color={bodyColor} metalness={0.5} roughness={0.35} />
               </mesh>
               {/* Emissive lens face */}
               <mesh position={[0, 0.04, 0.56]}>
                  <circleGeometry args={[0.085, 16]} />
                  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity * 1.5} toneMapped={false} />
               </mesh>
               {/* Rear handle bars */}
               <mesh position={[0.08, 0.04, -0.15]}>
                  <cylinderGeometry args={[0.012, 0.012, 0.2]} />
                  <meshStandardMaterial color="#606068" metalness={0.6} roughness={0.3} />
               </mesh>
               <mesh position={[-0.08, 0.04, -0.15]}>
                  <cylinderGeometry args={[0.012, 0.012, 0.2]} />
                  <meshStandardMaterial color="#606068" metalness={0.6} roughness={0.3} />
               </mesh>
               {/* LightSource */}
               <group position={[0, 0.04, 0.56]}>
                  <LightSource color={color} intensity={intensity} />
               </group>
            </group>
         </group>
      )}

      {type === ObjectType.LIGHT_WASH && (
         <group position={[0, 0.1, 0]}>
            {/* Floor bracket (like PAR) */}
            <mesh position={[0, 0, 0]}>
               <boxGeometry args={[0.22, 0.05, 0.15]} />
               <meshStandardMaterial color={bodyColor} metalness={0.5} roughness={0.35} />
            </mesh>
            {/* Yoke bracket sides */}
            <mesh position={[-0.14, 0.1, 0]}>
               <boxGeometry args={[0.02, 0.18, 0.12]} />
               <meshStandardMaterial color={bodyColor} metalness={0.5} roughness={0.35} />
            </mesh>
            <mesh position={[0.14, 0.1, 0]}>
               <boxGeometry args={[0.02, 0.18, 0.12]} />
               <meshStandardMaterial color={bodyColor} metalness={0.5} roughness={0.35} />
            </mesh>
            {/* Wash head — wider & flatter rectangular body */}
            <group position={[0, 0.15, 0]} rotation={[tilt - 0.4, 0, 0]}>
               <mesh castShadow>
                  <boxGeometry args={[0.3, 0.12, 0.25]} />
                  <meshStandardMaterial color={bodyColor} metalness={0.4} roughness={0.4} />
                  {selected && isEditMode && <Highlight />}
                  <EdgeOutline />
               </mesh>
               {/* LED grid face — 4x3 array of emissive circles */}
               {[-0.09, -0.03, 0.03, 0.09].map((x, xi) =>
                  [-0.06, 0, 0.06].map((y, yi) => (
                     <mesh key={`${xi}-${yi}`} position={[x, y, 0.126]}>
                        <circleGeometry args={[0.022, 12]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity * 0.8} toneMapped={false} />
                     </mesh>
                  ))
               )}
               {/* Single LightSource for the whole panel */}
               <group position={[0, 0, 0.126]}>
                  <LightSource color={color} intensity={intensity} />
               </group>
            </group>
         </group>
      )}

      {type === ObjectType.LIGHT_STROBE && (
         <group>
            {/* Small yoke mount base */}
            <mesh position={[0, 0.03, 0]}>
               <boxGeometry args={[0.2, 0.06, 0.12]} />
               <meshStandardMaterial color={bodyColor} metalness={0.5} roughness={0.35} />
            </mesh>
            {/* Yoke arms */}
            <mesh position={[-0.22, 0.12, 0]}>
               <boxGeometry args={[0.02, 0.16, 0.08]} />
               <meshStandardMaterial color={bodyColor} metalness={0.5} roughness={0.35} />
            </mesh>
            <mesh position={[0.22, 0.12, 0]}>
               <boxGeometry args={[0.02, 0.16, 0.08]} />
               <meshStandardMaterial color={bodyColor} metalness={0.5} roughness={0.35} />
            </mesh>
            {/* Main rectangular panel */}
            <group position={[0, 0.18, 0]} rotation={[tilt, 0, 0]}>
               <mesh castShadow>
                  <boxGeometry args={[0.5, 0.3, 0.1]} />
                  <meshStandardMaterial color={bodyColor} metalness={0.4} roughness={0.4} />
                  {selected && isEditMode && <Highlight />}
                  <EdgeOutline />
               </mesh>
               {/* 4 large emissive circular cells (2x2) */}
               {[[-0.12, 0.05], [0.12, 0.05], [-0.12, -0.05], [0.12, -0.05]].map(([x, y], i) => (
                  <mesh key={i} position={[x, y, 0.051]}>
                     <circleGeometry args={[0.055, 16]} />
                     <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={intensity * 2.5} toneMapped={false} />
                  </mesh>
               ))}
               {/* LightSource */}
               <group position={[0, 0, 0.051]}>
                  <LightSource color="#ffffff" intensity={intensity} />
               </group>
            </group>
         </group>
      )}
    </group>
  );
};

const Equipment = ({ type, color, customWidth = 3, selected, isEditMode }: any) => {
  return (
    <group>
      {type === ObjectType.TRUSS_STRAIGHT && (() => {
        const length = customWidth;
        const tubeRadius = 0.025;
        const crossSection = 0.3;
        const half = crossSection / 2;
        const segmentLength = 0.5;
        const numSegments = Math.max(1, Math.floor(length / segmentLength));

        // Corner tube positions in YZ cross-section (truss runs along X)
        const corners: [number, number][] = [
          [-half, 0],
          [half, 0],
          [-half, crossSection],
          [half, crossSection],
        ];

        return (
          <group>
            {/* 4 corner tubes running full length along X */}
            {corners.map(([z, y], i) => (
              <mesh key={`tube-${i}`} position={[0, y + tubeRadius, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[tubeRadius, tubeRadius, length, 8]} />
                <meshStandardMaterial color={color} metalness={0.7} roughness={0.25} />
                <EdgeOutline thickness={1} />
              </mesh>
            ))}

            {/* Cross braces: diagonal V-patterns on each face */}
            {Array.from({ length: numSegments }).map((_, seg) => {
              const segStart = -length / 2 + seg * segmentLength;
              const segMid = segStart + segmentLength / 2;
              const segEnd = segStart + segmentLength;

              const braces: number[] = [];

              // Front face (z = half)
              braces.push(segStart, tubeRadius, half, segMid, crossSection - tubeRadius, half);
              braces.push(segMid, crossSection - tubeRadius, half, segEnd, tubeRadius, half);
              // Back face (z = -half)
              braces.push(segStart, tubeRadius, -half, segMid, crossSection - tubeRadius, -half);
              braces.push(segMid, crossSection - tubeRadius, -half, segEnd, tubeRadius, -half);
              // Top face (y = crossSection)
              braces.push(segStart, crossSection, -half + tubeRadius, segMid, crossSection, half - tubeRadius);
              braces.push(segMid, crossSection, half - tubeRadius, segEnd, crossSection, -half + tubeRadius);
              // Bottom face (y = 0)
              braces.push(segStart, tubeRadius * 2, -half + tubeRadius, segMid, tubeRadius * 2, half - tubeRadius);
              braces.push(segMid, tubeRadius * 2, half - tubeRadius, segEnd, tubeRadius * 2, -half + tubeRadius);

              const braceElements = [];
              for (let b = 0; b < braces.length; b += 6) {
                const x1 = braces[b], y1 = braces[b+1], z1 = braces[b+2];
                const x2 = braces[b+3], y2 = braces[b+4], z2 = braces[b+5];
                const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                const mx = (x1+x2)/2, my = (y1+y2)/2, mz = (z1+z2)/2;

                const dir = new THREE.Vector3(dx, dy, dz).normalize();
                const up = new THREE.Vector3(0, 1, 0);
                const quat = new THREE.Quaternion();
                quat.setFromUnitVectors(up, dir);

                braceElements.push(
                  <mesh key={`brace-${seg}-${b}`} position={[mx, my, mz]} quaternion={quat}>
                    <cylinderGeometry args={[tubeRadius * 0.6, tubeRadius * 0.6, dist, 6]} />
                    <meshStandardMaterial color={color} metalness={0.7} roughness={0.25} />
                  </mesh>
                );
              }
              return <React.Fragment key={`seg-${seg}`}>{braceElements}</React.Fragment>;
            })}

            {/* Selection highlight */}
            {selected && isEditMode && (
              <mesh position={[0, crossSection / 2, 0]} visible={false}>
                <boxGeometry args={[length, crossSection, crossSection]} />
                <Highlight />
              </mesh>
            )}
          </group>
        );
      })()}

      {type === ObjectType.EQUIPMENT_MIXER && (
        <group>
          {/* Table / desk */}
          <mesh position={[0, 0.375, 0]} castShadow>
            <boxGeometry args={[1.2, 0.75, 0.7]} />
            <meshStandardMaterial color="#2a2a32" roughness={0.6} metalness={0.15} />
            {selected && isEditMode && <Highlight />}
            <EdgeOutline />
          </mesh>

          {/* Console surface — angled ~15 degrees towards operator (+Z) */}
          <group position={[0, 0.78, -0.05]} rotation={[-0.26, 0, 0]}>
            <mesh castShadow>
              <boxGeometry args={[1.0, 0.04, 0.5]} />
              <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
              <EdgeOutline />
            </mesh>

            {/* Faders — row of 10 */}
            {Array.from({ length: 10 }).map((_, i) => (
              <mesh key={`fader-${i}`} position={[-0.36 + i * 0.08, 0.025, 0.05]}>
                <boxGeometry args={[0.02, 0.01, 0.08]} />
                <meshStandardMaterial color="#e0e0e0" metalness={0.6} roughness={0.3} />
              </mesh>
            ))}

            {/* Knob rows */}
            {Array.from({ length: 10 }).map((_, i) => {
              const x = -0.36 + i * 0.08;
              return (
                <React.Fragment key={`knob-${i}`}>
                  <mesh position={[x, 0.025, -0.08]}>
                    <cylinderGeometry args={[0.012, 0.012, 0.01, 8]} />
                    <meshStandardMaterial color="#c0c0c8" metalness={0.5} roughness={0.3} />
                  </mesh>
                  <mesh position={[x, 0.025, -0.14]}>
                    <cylinderGeometry args={[0.012, 0.012, 0.01, 8]} />
                    <meshStandardMaterial color="#c0c0c8" metalness={0.5} roughness={0.3} />
                  </mesh>
                </React.Fragment>
              );
            })}

            {/* Screen */}
            <mesh position={[0, 0.025, -0.2]}>
              <boxGeometry args={[0.3, 0.005, 0.08]} />
              <meshStandardMaterial color="#1a3a4a" emissive="#0a1a2a" emissiveIntensity={0.3} roughness={0.3} metalness={0.1} />
            </mesh>
          </group>

          {/* Chair behind console */}
          <group position={[0, 0, 0.65]}>
            <mesh position={[0, 0.4, 0]} castShadow>
              <boxGeometry args={[0.4, 0.05, 0.4]} />
              <meshStandardMaterial color="#404048" roughness={0.7} metalness={0.1} />
              <EdgeOutline thickness={1} />
            </mesh>
            <mesh position={[0, 0.65, 0.18]} castShadow>
              <boxGeometry args={[0.4, 0.3, 0.04]} />
              <meshStandardMaterial color="#404048" roughness={0.7} metalness={0.1} />
              <EdgeOutline thickness={1} />
            </mesh>
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.35]} />
              <meshStandardMaterial color="#606068" metalness={0.6} roughness={0.35} />
            </mesh>
            {[0, 72, 144, 216, 288].map((angle) => (
              <mesh key={angle} position={[Math.sin(angle * Math.PI / 180) * 0.2, 0.03, Math.cos(angle * Math.PI / 180) * 0.2]} rotation={[0, angle * Math.PI / 180, Math.PI / 2]}>
                <cylinderGeometry args={[0.012, 0.012, 0.2]} />
                <meshStandardMaterial color="#606068" metalness={0.6} roughness={0.35} />
              </mesh>
            ))}
          </group>
        </group>
      )}

      {type === ObjectType.EFFECTS_FOG && (
        <group>
          {/* Main body */}
          <mesh position={[0, 0.1, 0]} castShadow>
            <boxGeometry args={[0.5, 0.2, 0.25]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.3} />
            {selected && isEditMode && <Highlight />}
            <EdgeOutline />
          </mesh>

          {/* Front nozzle */}
          <mesh position={[0, 0.1, -0.15]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.025, 0.08, 8]} />
            <meshStandardMaterial color="#505058" metalness={0.6} roughness={0.3} />
            <EdgeOutline thickness={1} />
          </mesh>

          {/* Top handle — arch */}
          <group position={[0, 0.21, 0]}>
            <mesh position={[-0.12, 0.03, 0]}>
              <boxGeometry args={[0.02, 0.06, 0.02]} />
              <meshStandardMaterial color="#505058" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0.12, 0.03, 0]}>
              <boxGeometry args={[0.02, 0.06, 0.02]} />
              <meshStandardMaterial color="#505058" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.06, 0]}>
              <boxGeometry args={[0.26, 0.02, 0.02]} />
              <meshStandardMaterial color="#505058" metalness={0.6} roughness={0.3} />
              <EdgeOutline thickness={1} />
            </mesh>
          </group>

          {/* Rear cable */}
          <mesh position={[0, 0.06, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.08, 6]} />
            <meshStandardMaterial color="#2a2a30" roughness={0.8} metalness={0.1} />
          </mesh>

          {/* Status LED */}
          <mesh position={[0.15, 0.205, -0.05]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.008, 8]} />
            <meshStandardMaterial color="#00ff44" emissive="#00ff44" emissiveIntensity={2} toneMapped={false} />
          </mesh>

          {/* Rubber feet */}
          {[[0.2, 0.005, 0.08], [-0.2, 0.005, 0.08], [0.2, 0.005, -0.08], [-0.2, 0.005, -0.08]].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]}>
              <cylinderGeometry args={[0.015, 0.015, 0.01]} />
              <meshStandardMaterial color="#303038" roughness={0.9} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
};

// --- Venue Objects ---

const Venue = ({ type, color, selected, isEditMode, customWidth, customDepth, customHeight, tableCloth = 'linen' }: any) => {
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
  } else if (type === ObjectType.COCKTAIL_TABLE || type === ObjectType.PODIUM || type === ObjectType.DANCE_FLOOR || type === ObjectType.PROJECTION_SCREEN || type === ObjectType.LED_WALL || type === ObjectType.RECEPTION_DESK) {
    content = <Venue type={type} customWidth={props.customWidth} customDepth={props.customDepth} customHeight={props.customHeight} tableCloth={props.tableCloth} {...props} />;
  } else if (type === ObjectType.TRUSS_STRAIGHT || type === ObjectType.EQUIPMENT_MIXER || type === ObjectType.EFFECTS_FOG) {
    content = <Equipment type={type} customWidth={props.customWidth} {...props} />;
  } else if (type.includes('SPEAKER')) {
    content = <Speaker type={type} standType={props.standType} tilt={props.tilt} arrayCount={props.arrayCount} {...props} />;
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