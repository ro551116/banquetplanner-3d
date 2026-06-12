import React from 'react';
import * as THREE from 'three';
import { ObjectType } from '../../types';
import { EdgeOutline, Highlight, LightSource, PlateBase, TripodBase } from './shared';

// Translucent beam cone, apex at the lens opening toward +Z
const BeamCone = ({ color, intensity, radius, length }: { color: string; intensity: number; radius: number; length: number }) => {
  if (intensity <= 0) return null;
  return (
    <mesh position={[0, 0, length / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <coneGeometry args={[radius, length, 32, 1, true]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={Math.min(0.18, 0.04 + intensity * 0.035)}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
};

// Slim LED Par Can — 54-bead face, double-bracket floor yoke
const LedPar = ({ color, intensity, tilt, selected, isEditMode }: any) => {
  const canR = 0.155;        // front radius
  const canRBack = 0.135;    // back radius (slim par, near-straight)
  const canD = 0.13;         // slim body depth
  const bodyColor = '#1a1a1e';
  const yokeColor = '#141418';
  const pivotY = 0.2;        // pivot height from ground
  const yokeT = 0.025;       // yoke arm thickness

  // 54 LED positions: 1+6+12+18+17
  const leds: [number, number][] = [[0, 0]];
  const rings = [
    { count: 6, r: 0.034 },
    { count: 12, r: 0.063 },
    { count: 18, r: 0.092 },
    { count: 17, r: 0.118 },
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
        {/* Slim can body */}
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[canR, canRBack, canD, 32]} />
          <meshStandardMaterial color={bodyColor} metalness={0.45} roughness={0.4} />
          {selected && isEditMode && <Highlight />}
          <EdgeOutline />
        </mesh>

        {/* Front bezel ring */}
        <mesh position={[0, 0, canD / 2 + 0.003]}>
          <torusGeometry args={[canR - 0.005, 0.007, 12, 32]} />
          <meshStandardMaterial color="#303038" metalness={0.7} roughness={0.2} />
        </mesh>

        {/* Recessed black interior face */}
        <mesh position={[0, 0, canD / 2 - 0.012]}>
          <circleGeometry args={[canR - 0.008, 32]} />
          <meshStandardMaterial color="#050508" roughness={0.95} metalness={0} />
        </mesh>

        {/* 54 LED beads — moderate emissive so beads stay readable */}
        {leds.map(([lx, ly], i) => (
          <mesh key={`led-${i}`} position={[lx, ly, canD / 2 - 0.008]}>
            <circleGeometry args={[0.0095, 10]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={intensity * 1.3}
              toneMapped={false}
            />
          </mesh>
        ))}

        {/* Back cap */}
        <mesh position={[0, 0, -canD / 2 - 0.001]}>
          <circleGeometry args={[canRBack, 24]} />
          <meshStandardMaterial color="#101014" metalness={0.3} roughness={0.6} />
        </mesh>

        {/* Vertical heat-sink fins across the back */}
        {Array.from({ length: 7 }, (_, i) => {
          const fx = (i - 3) * 0.03;
          const fh = Math.sqrt(Math.max(0.002, canRBack * canRBack - fx * fx)) * 2 * 0.85;
          return (
            <mesh key={`fin-${i}`} position={[fx, 0, -canD / 2 - 0.008]}>
              <boxGeometry args={[0.006, fh, 0.016]} />
              <meshStandardMaterial color="#0a0a10" roughness={0.8} metalness={0.3} />
            </mesh>
          );
        })}

        {/* DMX / Power connectors */}
        {[0.03, -0.03].map((x, i) => (
          <mesh key={`conn-${i}`} position={[x, -canRBack + 0.04, -canD / 2 - 0.022]}>
            <boxGeometry args={[0.022, 0.016, 0.018]} />
            <meshStandardMaterial color="#2a2a32" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}

        {/* Safety loop */}
        <mesh position={[0, canRBack - 0.01, -canD / 2 - 0.012]}>
          <torusGeometry args={[0.012, 0.003, 8, 12]} />
          <meshStandardMaterial color="#3a3a42" metalness={0.7} roughness={0.2} />
        </mesh>

        <group position={[0, 0, canD / 2]}>
          <BeamCone color={color} intensity={intensity} radius={0.5} length={2.2} />
        </group>
        <LightSource color={color} intensity={intensity} />
      </group>
    </group>
  );
};

// Moving Head Beam — base + U-yoke + bullet head with front lens
const MovingHead = ({ color, intensity, tilt, selected, isEditMode }: any) => {
  const baseColor = '#222228';
  const shellColor = '#2a2a30';
  const baseH = 0.1;
  const armX = 0.135;       // arm offset from center
  const armH = 0.27;        // arm height
  const pivotY = baseH + 0.03 + armH - 0.07; // head pivot height
  const headLen = 0.3;

  return (
    <group>
      {/* === Base === */}
      <mesh position={[0, baseH / 2, 0]} castShadow>
        <boxGeometry args={[0.3, baseH, 0.24]} />
        <meshStandardMaterial color={baseColor} metalness={0.4} roughness={0.45} />
        {selected && isEditMode && <Highlight />}
        <EdgeOutline />
      </mesh>
      {/* Display panel */}
      <mesh position={[0, baseH / 2, 0.121]}>
        <boxGeometry args={[0.1, 0.035, 0.002]} />
        <meshStandardMaterial color="#0a2818" emissive="#1fd07a" emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      {/* Side carry handles */}
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * 0.16, baseH / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.035, 0.008, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#3a3a42" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* Pan collar */}
      <mesh position={[0, baseH + 0.015, 0]}>
        <cylinderGeometry args={[0.115, 0.125, 0.03, 24]} />
        <meshStandardMaterial color="#36363e" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* === Yoke (U shape) === */}
      <group position={[0, baseH + 0.03, 0]}>
        {/* Bottom hub */}
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.26, 0.04, 0.09]} />
          <meshStandardMaterial color={shellColor} metalness={0.5} roughness={0.35} />
          <EdgeOutline />
        </mesh>
        {/* Arms with rounded tops */}
        {[-1, 1].map(side => (
          <group key={side}>
            <mesh position={[side * armX, armH / 2, 0]}>
              <boxGeometry args={[0.032, armH, 0.085]} />
              <meshStandardMaterial color={shellColor} metalness={0.5} roughness={0.35} />
              <EdgeOutline />
            </mesh>
            <mesh position={[side * armX, armH, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.0425, 0.0425, 0.032, 16]} />
              <meshStandardMaterial color={shellColor} metalness={0.5} roughness={0.35} />
            </mesh>
            {/* Tilt-lock knob */}
            <mesh position={[side * (armX + 0.025), armH, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.02, 0.015, 0.018, 12]} />
              <meshStandardMaterial color="#16161a" metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
        ))}
      </group>

      {/* === Head (tilts between arms) === */}
      <group position={[0, pivotY, 0]} rotation={[tilt, 0, 0]}>
        {/* Side pivot hubs */}
        {[-1, 1].map(side => (
          <mesh key={side} position={[side * 0.105, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.045, 0.045, 0.03, 16]} />
            <meshStandardMaterial color="#1c1c22" metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
        {/* Main body — tapers toward the lens */}
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.082, 0.102, headLen, 24]} />
          <meshStandardMaterial color={shellColor} metalness={0.5} roughness={0.35} />
          <EdgeOutline />
        </mesh>
        {/* Rounded rear cap */}
        <mesh position={[0, 0, -headLen / 2]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.55, 1]}>
          <sphereGeometry args={[0.102, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color={shellColor} metalness={0.5} roughness={0.35} />
        </mesh>
        {/* Cooling rib rings */}
        {[-0.09, -0.04, 0.01].map((zOff, i) => (
          <mesh key={i} position={[0, 0, zOff]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.097 - i * 0.004, 0.004, 8, 24]} />
            <meshStandardMaterial color="#1c1c22" metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
        {/* Front lens housing */}
        <mesh position={[0, 0, headLen / 2 + 0.025]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.092, 0.082, 0.05, 24]} />
          <meshStandardMaterial color="#16161a" metalness={0.6} roughness={0.25} />
        </mesh>
        {/* Convex front lens */}
        <mesh position={[0, 0, headLen / 2 + 0.045]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.45, 1]}>
          <sphereGeometry args={[0.078, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={intensity * 2}
            toneMapped={false}
            metalness={0}
            roughness={0.2}
          />
        </mesh>

        <group position={[0, 0, headLen / 2 + 0.05]}>
          <BeamCone color={color} intensity={intensity} radius={0.22} length={3} />
        </group>
        <LightSource color={color} intensity={intensity} />
      </group>
    </group>
  );
};

export const Lighting = ({ type, color, intensity = 1, tilt = 0, selected, isEditMode, standType }: any) => {
  // Lighten fixture body for SketchUp-style visibility
  const bodyColor = '#a0a0a8';

  return (
    <group>
      {type === ObjectType.LIGHT_PAR && (
        <LedPar color={color} intensity={intensity} tilt={tilt} selected={selected} isEditMode={isEditMode} />
      )}

      {type === ObjectType.LIGHT_MOVING && (
        <MovingHead color={color} intensity={intensity} tilt={tilt} selected={selected} isEditMode={isEditMode} />
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
