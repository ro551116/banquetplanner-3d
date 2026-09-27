import React, { useContext } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RenderSettingsContext } from '../RenderSettings';
import { ObjectType } from '../../types';
import { Highlight, LightSource, PlateBase, TripodBase } from './shared';
import { SoftBox, GrilleMaterial } from './details';

// Module-level shared geometries — lazily initialized singletons (zero GC churn / duplicate allocations)
let _parLensGeom: THREE.BufferGeometry | null = null;
function getParLensGeometry(): THREE.BufferGeometry {
  if (!_parLensGeom) {
    const geoms: THREE.BufferGeometry[] = [];
    const baseGeom = new THREE.CircleGeometry(0.018, 14);
    const leds: [number, number][] = [[0, 0]];
    const rings = [
      { count: 6, r: 0.048 },
      { count: 12, r: 0.096 },
    ];
    rings.forEach(({ count, r }, ri) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + (ri % 2 ? Math.PI / count : 0);
        leds.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    });

    leds.forEach(([lx, ly]) => {
      const g = baseGeom.clone();
      g.translate(lx, ly, 0);
      geoms.push(g);
    });
    baseGeom.dispose();

    const merged = mergeGeometries(geoms, false);
    geoms.forEach((g) => g.dispose());
    _parLensGeom = merged;
  }
  return _parLensGeom;
}

let _washLensGeom: THREE.BufferGeometry | null = null;
function getWashLensGeometry(): THREE.BufferGeometry {
  if (!_washLensGeom) {
    const geoms: THREE.BufferGeometry[] = [];
    const baseGeom = new THREE.CircleGeometry(0.022, 12);
    const xs = [-0.10, -0.035, 0.035, 0.10];
    const ys = [-0.05, 0, 0.05];

    xs.forEach((x) => {
      ys.forEach((y) => {
        const g = baseGeom.clone();
        g.translate(x, y, 0);
        geoms.push(g);
      });
    });
    baseGeom.dispose();

    const merged = mergeGeometries(geoms, false);
    geoms.forEach((g) => g.dispose());
    _washLensGeom = merged;
  }
  return _washLensGeom;
}

let _strobeCellsGeom: THREE.BufferGeometry | null = null;
function getStrobeCellsGeometry(): THREE.BufferGeometry {
  if (!_strobeCellsGeom) {
    const geoms: THREE.BufferGeometry[] = [];
    const baseGeom = new THREE.CircleGeometry(0.056, 18);
    const coords: [number, number][] = [
      [-0.13, 0.055],
      [0.13, 0.055],
      [-0.13, -0.055],
      [0.13, -0.055],
    ];

    coords.forEach(([cx, cy]) => {
      const g = baseGeom.clone();
      g.translate(cx, cy, 0);
      geoms.push(g);
    });
    baseGeom.dispose();

    const merged = mergeGeometries(geoms, false);
    geoms.forEach((g) => g.dispose());
    _strobeCellsGeom = merged;
  }
  return _strobeCellsGeom;
}

let panelLightUniformsReady = false;

// A rectangular emitter, not a visible solid standing in for light in the air.
const PanelLight = ({ color, intensity, width, height }: {
  color: string;
  intensity: number;
  width: number;
  height: number;
}) => {
  const { night } = useContext(RenderSettingsContext);
  if (intensity <= 0) return null;
  if (!panelLightUniformsReady) {
    RectAreaLightUniformsLib.init();
    panelLightUniformsReady = true;
  }
  return (
    <rectAreaLight
      color={color}
      width={width}
      height={height}
      intensity={intensity * (night ? 32 : 24) / (width * height)}
      rotation={[0, Math.PI, 0]}
    />
  );
};

// Tour-grade LED Par Can — single merged 19-diode honeycomb lens, double scissor floor yoke
const LedPar = ({
  color,
  intensity,
  tilt,
  selected,
  isEditMode,
}: {
  color: string;
  intensity: number;
  tilt: number;
  selected?: boolean;
  isEditMode?: boolean;
}) => {
  const canR = 0.155; // front radius
  const canRBack = 0.135; // back radius
  const canD = 0.14; // slim body depth
  const bodyColor = '#1c1c22';
  const yokeColor = '#141418';
  const pivotY = 0.20; // pivot height from ground
  const yokeT = 0.024; // yoke arm thickness

  return (
    <group>
      {/* Scissor Floor Yoke Bracket resting on floor at Y = 0 */}
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* Main upright arm */}
          <mesh position={[side * (canR + yokeT / 2), pivotY / 2, 0]}>
            <boxGeometry args={[yokeT, pivotY, 0.035]} />
            <meshStandardMaterial color={yokeColor} metalness={0.65} roughness={0.32} />
          </mesh>
          {/* Splayed floor foot */}
          <mesh
            position={[side * (canR + 0.02), 0.01, 0]}
            rotation={[0, 0, side * -0.15]}
          >
            <boxGeometry args={[0.055, 0.02, 0.06]} />
            <meshStandardMaterial color={yokeColor} metalness={0.65} roughness={0.32} />
          </mesh>
          {/* Friction pivot bolt */}
          <mesh
            position={[side * (canR + 0.005), pivotY, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.012, 0.012, yokeT + 0.04, 12]} />
            <meshStandardMaterial color="#404048" metalness={0.75} roughness={0.2} />
          </mesh>
          {/* Star locking knob */}
          <mesh
            position={[side * (canR + yokeT + 0.012), pivotY, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.022, 0.014, 0.018, 6]} />
            <meshStandardMaterial color="#22222a" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      ))}

      {/* Head: Tilts around pivot axis */}
      <group position={[0, pivotY, 0]} rotation={[tilt - 0.4, 0, 0]}>
        {/* Main beveled cylindrical body */}
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[canR, canRBack, canD, 24]} />
          <meshStandardMaterial color={bodyColor} metalness={0.55} roughness={0.35} />
          {selected && isEditMode && <Highlight />}
        </mesh>

        {/* Stepped front lens bezel ring */}
        <mesh position={[0, 0, canD / 2 + 0.004]}>
          <torusGeometry args={[canR - 0.006, 0.008, 12, 32]} />
          <meshStandardMaterial color="#303038" metalness={0.7} roughness={0.25} />
        </mesh>

        {/* 4 Gel frame retaining clips */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * (canR + 0.002),
              Math.sin(angle) * (canR + 0.002),
              canD / 2 + 0.006,
            ]}
          >
            <boxGeometry args={[0.012, 0.012, 0.01]} />
            <meshStandardMaterial color="#404048" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}

        {/* Recessed anti-reflective dark interior baffle */}
        <mesh position={[0, 0, canD / 2 + 0.001]}>
          <circleGeometry args={[canR - 0.01, 32]} />
          <meshStandardMaterial color="#06060a" roughness={0.95} metalness={0} />
        </mesh>

        {/* 19 High-power LED lenses merged into 1 mesh */}
        <mesh geometry={getParLensGeometry()} position={[0, 0, canD / 2 + 0.003]}>
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={intensity * 1.6}
            toneMapped={false}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>

        {/* Rear cap & cooling vents */}
        <mesh position={[0, 0, -canD / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[canRBack, 24]} />
          <meshStandardMaterial color="#121218" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, -canD / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[canRBack * 0.65, 16]} />
          <GrilleMaterial color="#222228" roughness={0.6} metalness={0.5} />
        </mesh>

        {/* Rear heatsink fin louvers */}
        {[-0.08, -0.04, 0, 0.04, 0.08].map((fx, i) => (
          <mesh key={i} position={[fx, 0, -canD / 2 - 0.01]}>
            <boxGeometry args={[0.006, 0.14, 0.018]} />
            <meshStandardMaterial color="#0c0c12" roughness={0.8} metalness={0.4} />
          </mesh>
        ))}

        {/* DMX / Powercon connectors & safety eyelet */}
        <mesh position={[0.035, -0.05, -canD / 2 - 0.02]}>
          <boxGeometry args={[0.022, 0.018, 0.02]} />
          <meshStandardMaterial color="#2e2e38" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[-0.035, -0.05, -canD / 2 - 0.02]}>
          <boxGeometry args={[0.022, 0.018, 0.02]} />
          <meshStandardMaterial color="#2e2e38" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.07, -canD / 2 - 0.014]}>
          <torusGeometry args={[0.012, 0.003, 8, 14]} />
          <meshStandardMaterial color="#505058" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Emit from the aperture; the lens matrix supplies the visible glow. */}
        <group position={[0, 0, canD / 2 + 0.013]}>
          <LightSource color={color} intensity={intensity} />
        </group>
      </group>
    </group>
  );
};

// Moving Head: Sculpted aerodynamic head + molded base + U-yoke
const MovingHead = ({
  color,
  intensity,
  tilt,
  selected,
  isEditMode,
}: {
  color: string;
  intensity: number;
  tilt: number;
  selected?: boolean;
  isEditMode?: boolean;
}) => {
  const baseColor = '#1c1c22';
  const shellColor = '#24242a';
  const armX = 0.14;
  const armH = 0.26;
  const pivotY = 0.35;
  const headLen = 0.30;

  return (
    <group>
      {/* Molded Aerodynamic Base with beveled edges */}
      <SoftBox
        size={[0.32, 0.10, 0.25]}
        position={[0, 0.06, 0]}
        radius={0.018}
        color={baseColor}
        roughness={0.42}
        metalness={0.48}
      >
        {selected && isEditMode && <Highlight />}
      </SoftBox>

      {/* 4 Rubber feet resting flat on floor at Y = 0 */}
      {[
        [0.12, 0.01, 0.09],
        [-0.12, 0.01, 0.09],
        [0.12, 0.01, -0.09],
        [-0.12, 0.01, -0.09],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <cylinderGeometry args={[0.018, 0.02, 0.02, 12]} />
          <meshStandardMaterial color="#141418" roughness={0.9} />
        </mesh>
      ))}

      {/* Front backlit OLED display & rotary encoder */}
      <mesh position={[0, 0.06, 0.126]}>
        <boxGeometry args={[0.11, 0.038, 0.002]} />
        <meshStandardMaterial
          color="#061c10"
          emissive="#1ed760"
          emissiveIntensity={0.5}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0.08, 0.06, 0.128]}>
        <cylinderGeometry args={[0.012, 0.012, 0.006, 16]} />
        <meshStandardMaterial color="#383840" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Recessed side carry handles */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.165, 0.06, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.034, 0.008, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#3a3a42" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}

      {/* Pan collar */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.115, 0.125, 0.03, 24]} />
        <meshStandardMaterial color="#32323a" metalness={0.65} roughness={0.28} />
      </mesh>

      {/* U-Yoke Assembly */}
      <group position={[0, 0.135, 0]}>
        {/* Bottom yoke hub */}
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.28, 0.04, 0.10]} />
          <meshStandardMaterial color={shellColor} metalness={0.52} roughness={0.35} />
        </mesh>
        {/* Sculpted arms with beveled shoulders */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * armX, armH / 2, 0]}>
              <boxGeometry args={[0.034, armH, 0.09]} />
              <meshStandardMaterial color={shellColor} metalness={0.52} roughness={0.35} />
            </mesh>
            <mesh
              position={[side * armX, armH, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.045, 0.045, 0.034, 16]} />
              <meshStandardMaterial color={shellColor} metalness={0.52} roughness={0.35} />
            </mesh>
            {/* Tilt-lock lever */}
            <mesh
              position={[side * (armX + 0.026), armH, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.02, 0.015, 0.018, 12]} />
              <meshStandardMaterial color="#18181e" metalness={0.7} roughness={0.25} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Sculpted Head (tilts smoothly between arms) */}
      <group position={[0, pivotY, 0]} rotation={[tilt, 0, 0]}>
        {/* Side pivot hubs */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.11, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.046, 0.046, 0.03, 16]} />
            <meshStandardMaterial color="#1a1a20" metalness={0.65} roughness={0.3} />
          </mesh>
        ))}

        {/* Sculpted head body */}
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.084, 0.104, headLen, 24]} />
          <meshStandardMaterial color={shellColor} metalness={0.52} roughness={0.35} />
        </mesh>

        {/* Side ventilation grilles */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.09, 0, 0]}
            rotation={[0, side * (Math.PI / 2), 0]}
          >
            <planeGeometry args={[0.12, 0.08]} />
            <GrilleMaterial color="#1a1a20" roughness={0.6} metalness={0.5} />
          </mesh>
        ))}

        {/* Rounded rear dome cap */}
        <mesh
          position={[0, 0, -headLen / 2]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1, 0.55, 1]}
        >
          <sphereGeometry args={[0.104, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color={shellColor} metalness={0.52} roughness={0.35} />
        </mesh>

        {/* Rear cooling fin louvers */}
        {[-0.09, -0.04, 0.01].map((zOff, i) => (
          <mesh key={i} position={[0, 0, zOff]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.098 - i * 0.004, 0.004, 8, 24]} />
            <meshStandardMaterial color="#1a1a20" metalness={0.65} roughness={0.3} />
          </mesh>
        ))}

        {/* Stepped front lens bezel */}
        <mesh
          position={[0, 0, headLen / 2 + 0.024]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.094, 0.084, 0.048, 24]} />
          <meshStandardMaterial color="#16161c" metalness={0.65} roughness={0.25} />
        </mesh>

        {/* Convex front objective lens element */}
        <mesh
          position={[0, 0, headLen / 2 + 0.044]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1, 0.45, 1]}
        >
          <sphereGeometry args={[0.08, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={intensity * 2.0}
            toneMapped={false}
            metalness={0.05}
            roughness={0.15}
          />
        </mesh>

        {/* The optical source follows the front objective and head tilt. */}
        <group position={[0, 0, headLen / 2 + 0.082]}>
          <LightSource color={color} intensity={intensity} />
        </group>
      </group>
    </group>
  );
};

export const Lighting = ({
  type,
  color,
  intensity = 1,
  tilt = 0,
  selected,
  isEditMode,
  standType,
}: {
  type: ObjectType;
  color: string;
  intensity?: number;
  tilt?: number;
  selected?: boolean;
  isEditMode?: boolean;
  standType?: string;
}) => {
  const bodyColor = '#202026';
  const isPar = type === ObjectType.LIGHT_PAR || type === ObjectType.LIGHT;

  return (
    <group>
      {/* Tour-grade LED Par Can (or legacy LIGHT counterpart) */}
      {isPar && (
        <LedPar
          color={color}
          intensity={intensity}
          tilt={tilt}
          selected={selected}
          isEditMode={isEditMode}
        />
      )}

      {/* Moving Head Spot/Beam */}
      {type === ObjectType.LIGHT_MOVING && (
        <MovingHead
          color={color}
          intensity={intensity}
          tilt={tilt}
          selected={selected}
          isEditMode={isEditMode}
        />
      )}

      {/* T-Bar Stand with 4 suspended Par/Spot fixtures */}
      {type === ObjectType.LIGHT_STAND && (
        <group>
          {standType === 'PLATE' ? <PlateBase /> : <TripodBase />}

          {/* Lower Extension Mast */}
          <mesh position={[0, 1.35, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.7, 16]} />
            <meshStandardMaterial color="#686870" metalness={0.78} roughness={0.26} />
          </mesh>

          {/* Telescopic Lock Collar & T-Handle */}
          <mesh position={[0, 1.55, 0]}>
            <cylinderGeometry args={[0.034, 0.034, 0.06, 16]} />
            <meshStandardMaterial color="#25252b" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0.035, 1.55, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.008, 0.008, 0.06, 12]} />
            <meshStandardMaterial color="#404048" metalness={0.8} roughness={0.2} />
          </mesh>

          {/* Upper Extension Mast */}
          <mesh position={[0, 1.85, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.6, 16]} />
            <meshStandardMaterial color="#888890" metalness={0.82} roughness={0.22} />
          </mesh>

          {/* Top T-Bar & Fixtures */}
          <group position={[0, 2.15, 0]}>
            {/* Structural Crossbar */}
            <mesh>
              <boxGeometry args={[1.5, 0.05, 0.05]} />
              <meshStandardMaterial color={bodyColor} metalness={0.65} roughness={0.3} />
              {selected && isEditMode && <Highlight />}
            </mesh>
            {/* End caps */}
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.755, 0, 0]}>
                <boxGeometry args={[0.01, 0.054, 0.054]} />
                <meshStandardMaterial color="#15151a" roughness={0.8} />
              </mesh>
            ))}

            {/* 4 Suspended Touring Fixtures */}
            {[-0.55, -0.18, 0.18, 0.55].map((x, i) => (
              <group key={i} position={[x, -0.06, 0]}>
                {/* O-Clamp Spigot Mount */}
                <mesh position={[0, 0.02, 0]}>
                  <cylinderGeometry args={[0.028, 0.028, 0.035, 16]} />
                  <meshStandardMaterial color="#383842" metalness={0.75} roughness={0.25} />
                </mesh>

                {/* Fixture head tilting below crossbar */}
                <group position={[0, -0.12, 0]} rotation={[tilt + 0.45, 0, 0]}>
                  {/* Yoke arm */}
                  <mesh position={[0, 0.06, 0]}>
                    <cylinderGeometry args={[0.01, 0.01, 0.08, 12]} />
                    <meshStandardMaterial color="#202026" metalness={0.6} roughness={0.3} />
                  </mesh>

                  {/* Refined Can Body */}
                  <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.082, 0.068, 0.22, 20]} />
                    <meshStandardMaterial color={bodyColor} metalness={0.55} roughness={0.35} />
                  </mesh>

                  {/* Stepped Front Bezel */}
                  <mesh position={[0, 0, 0.114]}>
                    <torusGeometry args={[0.078, 0.007, 10, 24]} />
                    <meshStandardMaterial color="#303038" metalness={0.7} roughness={0.25} />
                  </mesh>

                  {/* Emissive Front Lens */}
                  <mesh position={[0, 0, 0.118]}>
                    <circleGeometry args={[0.074, 20]} />
                    <meshStandardMaterial
                      color={color}
                      emissive={color}
                      emissiveIntensity={intensity * 1.5}
                      toneMapped={false}
                      roughness={0.2}
                      metalness={0.1}
                    />
                  </mesh>

                  {/* Rear cooling fin louvers */}
                  <mesh position={[0, 0, -0.112]}>
                    <circleGeometry args={[0.065, 16]} />
                    <GrilleMaterial color="#25252c" roughness={0.6} metalness={0.5} />
                  </mesh>

                  {/* Light Source */}
                  <group position={[0, 0, 0.12]}>
                    <LightSource color={color} intensity={intensity} />
                  </group>
                </group>
              </group>
            ))}
          </group>
        </group>
      )}

      {/* Followspot: Elongated dual-condenser barrel, forced-air cooling, steering handles & tripod */}
      {type === ObjectType.LIGHT_FOLLOWSPOT && (
        <group>
          {/* Heavy-duty followspot tripod stand resting on floor */}
          {(() => {
            const hubHeight = 1.45;
            const legSpread = 0.65;
            const legRadius = 0.016;
            const legLength = Math.sqrt(hubHeight * hubHeight + legSpread * legSpread);
            const legAngle = Math.atan2(legSpread, hubHeight);
            return (
              <group>
                {/* Central structural chrome column */}
                <mesh position={[0, 0.725, 0]} castShadow>
                  <cylinderGeometry args={[0.026, 0.026, 1.45, 16]} />
                  <meshStandardMaterial color="#707078" metalness={0.8} roughness={0.24} />
                </mesh>

                {/* Upper hub collar */}
                <mesh position={[0, hubHeight, 0]}>
                  <cylinderGeometry args={[0.045, 0.045, 0.07, 16]} />
                  <meshStandardMaterial color="#25252c" metalness={0.7} roughness={0.3} />
                </mesh>

                {/* 3 Wide heavy-duty tripod legs with lock caster wheels */}
                {[0, 120, 240].map((angle) => (
                  <group key={angle} rotation={[0, angle * (Math.PI / 180), 0]}>
                    <group
                      position={[0, hubHeight / 2, legSpread / 2]}
                      rotation={[-legAngle, 0, 0]}
                    >
                      <mesh castShadow>
                        <cylinderGeometry args={[legRadius, legRadius, legLength, 12]} />
                        <meshStandardMaterial color="#707078" metalness={0.75} roughness={0.28} />
                      </mesh>
                    </group>
                    {/* Locking swivel caster wheel resting on floor (Y = 0) */}
                    <mesh position={[0, 0.02, legSpread]}>
                      <cylinderGeometry args={[0.024, 0.024, 0.03, 14]} />
                      <meshStandardMaterial color="#303038" metalness={0.6} roughness={0.4} />
                    </mesh>
                  </group>
                ))}
              </group>
            );
          })()}

          {/* Followspot Head Assembly at Y = 1.50m */}
          <group position={[0, 1.50, 0]} rotation={[tilt, 0, 0]}>
            {/* Swivel Fork Yoke Bracket */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.22, 0.06, 0.14]} />
              <meshStandardMaterial color="#383842" metalness={0.7} roughness={0.28} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.11, 0.06, 0]}>
                <boxGeometry args={[0.02, 0.12, 0.08]} />
                <meshStandardMaterial color="#383842" metalness={0.7} roughness={0.28} />
              </mesh>
            ))}

            {/* Rear Lamp Housing with massive cooling cowl */}
            <mesh position={[0, 0.06, -0.16]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.095, 0.095, 0.32, 20]} />
              <meshStandardMaterial color={bodyColor} metalness={0.52} roughness={0.35} />
            </mesh>
            {/* Rear ventilation grille */}
            <mesh position={[0, 0.06, -0.322]} rotation={[0, Math.PI, 0]}>
              <circleGeometry args={[0.088, 18]} />
              <GrilleMaterial color="#2a2a30" roughness={0.65} metalness={0.5} />
            </mesh>

            {/* Mid-body optical chamber with color boomerang & framing shutters */}
            <mesh position={[0, 0.06, 0.10]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.082, 0.092, 0.22, 20]} />
              <meshStandardMaterial color={bodyColor} metalness={0.52} roughness={0.35} />
              {selected && isEditMode && <Highlight />}
            </mesh>
            {/* 4 Boomerang color selector levers */}
            {[-0.03, -0.01, 0.01, 0.03].map((zPos, i) => (
              <mesh key={i} position={[0.09, 0.12, 0.08 + zPos]}>
                <boxGeometry args={[0.012, 0.05, 0.01]} />
                <meshStandardMaterial color="#505058" metalness={0.8} roughness={0.25} />
              </mesh>
            ))}

            {/* Front optical barrel with zoom & focus adjustment rings */}
            <mesh position={[0, 0.06, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.088, 0.082, 0.30, 20]} />
              <meshStandardMaterial color={bodyColor} metalness={0.52} roughness={0.35} />
            </mesh>
            {[0.28, 0.44].map((z, i) => (
              <mesh key={i} position={[0, 0.06, z]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.089, 0.005, 8, 24]} />
                <meshStandardMaterial color="#404048" metalness={0.8} roughness={0.2} />
              </mesh>
            ))}

            {/* Flared front objective hood */}
            <mesh position={[0, 0.06, 0.54]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.105, 0.088, 0.08, 20]} />
              <meshStandardMaterial color="#1a1a20" metalness={0.6} roughness={0.3} />
            </mesh>

            {/* High-power front objective lens face */}
            <mesh position={[0, 0.06, 0.582]}>
              <circleGeometry args={[0.098, 24]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={intensity * 1.8}
                toneMapped={false}
                roughness={0.15}
                metalness={0.1}
              />
            </mesh>

            {/* Rear operator steering handles */}
            {[-1, 1].map((side) => (
              <group key={side} position={[side * 0.12, 0.06, -0.28]}>
                <mesh position={[0, 0, -0.06]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.012, 0.012, 0.12, 12]} />
                  <meshStandardMaterial color="#151518" roughness={0.9} />
                </mesh>
              </group>
            ))}

            {/* Top spotter sight rail */}
            <mesh position={[0, 0.17, 0.2]}>
              <boxGeometry args={[0.015, 0.015, 0.4]} />
              <meshStandardMaterial color="#303038" metalness={0.7} roughness={0.3} />
            </mesh>

            {/* Project from the flat front lens without a mesh light cone. */}
            <group position={[0, 0.06, 0.59]}>
              <LightSource color={color} intensity={intensity} />
            </group>
          </group>
        </group>
      )}

      {/* LED Wash Panel: Die-cast weatherproof chassis with 4x3 lens matrix */}
      {type === ObjectType.LIGHT_WASH && (
        <group>
          {/* Floor Bracket Base resting on floor at Y = 0 */}
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.30, 0.04, 0.18]} />
            <meshStandardMaterial color={bodyColor} metalness={0.6} roughness={0.35} />
          </mesh>
          {/* Floor rubber pads */}
          {[
            [0.12, 0.005, 0.07],
            [-0.12, 0.005, 0.07],
            [0.12, 0.005, -0.07],
            [-0.12, 0.005, -0.07],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]}>
              <boxGeometry args={[0.03, 0.01, 0.03]} />
              <meshStandardMaterial color="#141418" roughness={0.9} />
            </mesh>
          ))}

          {/* Sturdy dual yoke arms */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.19, 0.09, 0]}>
              <boxGeometry args={[0.024, 0.16, 0.10]} />
              <meshStandardMaterial color={bodyColor} metalness={0.6} roughness={0.35} />
            </mesh>
          ))}

          {/* Wash Head Tilting between arms at Y = 0.16m */}
          <group position={[0, 0.16, 0]} rotation={[tilt - 0.4, 0, 0]}>
            {/* Main beveled wash chassis */}
            <SoftBox
              size={[0.36, 0.16, 0.22]}
              radius={0.015}
              color={bodyColor}
              roughness={0.42}
              metalness={0.52}
            >
              {selected && isEditMode && <Highlight />}
            </SoftBox>

            {/* Recessed dark optical face baffle */}
            <mesh position={[0, 0, 0.111]}>
              <planeGeometry args={[0.33, 0.14]} />
              <meshStandardMaterial color="#08080c" roughness={0.95} metalness={0} />
            </mesh>

            {/* 4x3 Merged Lens Matrix (1 draw call) */}
            <mesh geometry={getWashLensGeometry()} position={[0, 0, 0.113]}>
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={intensity * 1.3}
                toneMapped={false}
                roughness={0.2}
                metalness={0.1}
              />
            </mesh>

            {/* Rear cooling fin matrix & vents */}
            <mesh position={[0, 0, -0.112]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[0.30, 0.12]} />
              <GrilleMaterial color="#222228" roughness={0.6} metalness={0.5} />
            </mesh>

            {/* Broad rectangular emission follows the planar LED matrix. */}
            <group position={[0, 0, 0.115]}>
              <PanelLight color={color} intensity={intensity} width={0.33} height={0.14} />
            </group>
          </group>
        </group>
      )}

      {/* Strobe / Blinder: Shallow housing, high-intensity strobe line & 4 blinder cells */}
      {type === ObjectType.LIGHT_STROBE && (
        <group>
          {/* Floor Bracket resting on floor at Y = 0 */}
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.34, 0.04, 0.14]} />
            <meshStandardMaterial color={bodyColor} metalness={0.6} roughness={0.35} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.25, 0.10, 0]}>
              <boxGeometry args={[0.024, 0.18, 0.08]} />
              <meshStandardMaterial color={bodyColor} metalness={0.6} roughness={0.35} />
            </mesh>
          ))}

          {/* Strobe Head Tilting at Y = 0.18m */}
          <group position={[0, 0.18, 0]} rotation={[tilt, 0, 0]}>
            {/* Shallow beveled housing */}
            <SoftBox
              size={[0.48, 0.28, 0.12]}
              radius={0.015}
              color={bodyColor}
              roughness={0.42}
              metalness={0.52}
            >
              {selected && isEditMode && <Highlight />}
            </SoftBox>

            {/* Dark recessed face plate */}
            <mesh position={[0, 0, 0.061]}>
              <planeGeometry args={[0.45, 0.25]} />
              <meshStandardMaterial color="#0a0a0f" roughness={0.9} metalness={0.1} />
            </mesh>

            {/* Central high-intensity linear strobe tube / line */}
            <mesh position={[0, 0, 0.063]}>
              <boxGeometry args={[0.42, 0.024, 0.006]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive="#ffffff"
                emissiveIntensity={intensity * 3.0}
                toneMapped={false}
              />
            </mesh>

            {/* 4 Large Blinder Reflector Cells merged into 1 geometry */}
            <mesh geometry={getStrobeCellsGeometry()} position={[0, 0, 0.062]}>
              <meshStandardMaterial
                color="#ffffff"
                emissive="#ffffff"
                emissiveIntensity={intensity * 1.6}
                toneMapped={false}
                roughness={0.25}
                metalness={0.1}
              />
            </mesh>

            {/* Rear cooling louvers */}
            <mesh position={[0, 0, -0.062]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[0.40, 0.22]} />
              <GrilleMaterial color="#222228" roughness={0.6} metalness={0.5} />
            </mesh>

            {/* Rectangular emission from the strobe face, not a spotlight cone. */}
            <group position={[0, 0, 0.065]}>
              <PanelLight color="#ffffff" intensity={intensity} width={0.45} height={0.25} />
            </group>
          </group>
        </group>
      )}
    </group>
  );
};
