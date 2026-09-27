import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { ObjectType } from '../../types';
import { Highlight, TableClothMaterial, TripodBase } from './shared';

export interface VenueProps {
  type: ObjectType;
  color: string;
  selected?: boolean;
  isEditMode?: boolean;
  customWidth?: number;
  customDepth?: number;
  customHeight?: number;
  tableCloth?: string;
}

// Cached procedural textures
let danceFloorTexture: THREE.DataTexture | undefined;
function getDanceFloorTexture(): THREE.DataTexture {
  if (danceFloorTexture) return danceFloorTexture;
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  const seamWidth = 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const tx = Math.floor(x / half);
      const ty = Math.floor(y / half);
      const isSeam =
        x < seamWidth ||
        Math.abs(x - half) < seamWidth ||
        x >= size - seamWidth ||
        y < seamWidth ||
        Math.abs(y - half) < seamWidth ||
        y >= size - seamWidth;

      if (isSeam) {
        data[idx] = 18;
        data[idx + 1] = 18;
        data[idx + 2] = 22;
      } else {
        const isLight = (tx + ty) % 2 === 0;
        const val = isLight ? 245 : 25;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
      }
      data[idx + 3] = 255;
    }
  }

  danceFloorTexture = new THREE.DataTexture(data, size, size);
  danceFloorTexture.wrapS = THREE.RepeatWrapping;
  danceFloorTexture.wrapT = THREE.RepeatWrapping;
  danceFloorTexture.magFilter = THREE.LinearFilter;
  danceFloorTexture.minFilter = THREE.LinearMipmapLinearFilter;
  danceFloorTexture.generateMipmaps = true;
  danceFloorTexture.needsUpdate = true;
  return danceFloorTexture;
}

let ledModuleTexture: THREE.DataTexture | undefined;
function getLedModuleTexture(): THREE.DataTexture {
  if (ledModuleTexture) return ledModuleTexture;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const seam = 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const isSeam = x < seam || x >= size - seam || y < seam || y >= size - seam;
      const val = isSeam ? 10 : 38;
      data[idx] = val;
      data[idx + 1] = val + 2;
      data[idx + 2] = val + 6;
      data[idx + 3] = 255;
    }
  }

  ledModuleTexture = new THREE.DataTexture(data, size, size);
  ledModuleTexture.wrapS = THREE.RepeatWrapping;
  ledModuleTexture.wrapT = THREE.RepeatWrapping;
  ledModuleTexture.magFilter = THREE.LinearFilter;
  ledModuleTexture.minFilter = THREE.LinearMipmapLinearFilter;
  ledModuleTexture.generateMipmaps = true;
  ledModuleTexture.needsUpdate = true;
  return ledModuleTexture;
}

function TiledSurfaceGeometry({ width, height, depth, repeatX, repeatY }: {
  width: number; height: number; depth?: number; repeatX: number; repeatY: number;
}) {
  const geometry = useMemo(() => {
    const result = depth === undefined
      ? new THREE.PlaneGeometry(width, height)
      : new THREE.BoxGeometry(width, height, depth);
    const uv = result.attributes.uv;
    const first = depth === undefined ? 0 : 8;
    const end = depth === undefined ? uv.count : 12;
    for (let i = first; i < end; i++) {
      uv.setXY(i, uv.getX(i) * repeatX, uv.getY(i) * repeatY);
    }
    return result;
  }, [width, height, depth, repeatX, repeatY]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}

let leafGeometry: THREE.BufferGeometry | undefined;
function getLeafGeometry() {
  if (leafGeometry) return leafGeometry;
  const positions: number[] = [];
  const indices: number[] = [];
  const rows = 12;
  const columns = 6;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const halfWidth = Math.pow(Math.sin(Math.PI * t), 0.8) * 0.12;
    for (let column = 0; column <= columns; column++) {
      const across = column / columns * 2 - 1;
      positions.push(
        across * halfWidth,
        t * 0.44,
        0.09 * t * t + 0.035 * across * across * Math.sin(Math.PI * t),
      );
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
      }
    }
  }
  leafGeometry = new THREE.BufferGeometry();
  leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  leafGeometry.setIndex(indices);
  leafGeometry.computeVertexNormals();
  return leafGeometry;
}

export const Venue = ({
  type,
  color,
  selected,
  isEditMode,
  customWidth,
  customDepth,
  customHeight,
  tableCloth = 'linen',
}: VenueProps) => {
  return (
    <group>
      {/* COCKTAIL_TABLE — Standing height poseur table with refined stem, beveled base and softly rounded top */}
      {type === ObjectType.COCKTAIL_TABLE && (
        <group>
          {/* Table top with soft bullnose beveled edge */}
          <group position={[0, 1.1, 0]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.32, 0.32, 0.024, 32]} />
              <TableClothMaterial color={color} tableCloth={tableCloth} />
              {selected && isEditMode && <Highlight />}
            </mesh>
            {/* Top edge rollover trim */}
            <mesh position={[0, -0.013, 0]}>
              <cylinderGeometry args={[0.315, 0.315, 0.004, 32]} />
              <meshStandardMaterial color="#222228" roughness={0.5} metalness={0.5} />
            </mesh>
          </group>

          {/* Under-table mounting flange */}
          <mesh position={[0, 1.082, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.012, 24]} />
            <meshStandardMaterial color="#282830" metalness={0.7} roughness={0.3} />
          </mesh>

          {/* Telescopic dual-stage brushed aluminum column */}
          {/* Upper column */}
          <mesh position={[0, 0.78, 0]} castShadow>
            <cylinderGeometry args={[0.022, 0.022, 0.58, 24]} />
            <meshStandardMaterial color="#656872" metalness={0.84} roughness={0.2} />
          </mesh>
          {/* Center collar sleeve */}
          <mesh position={[0, 0.48, 0]}>
            <cylinderGeometry args={[0.032, 0.032, 0.04, 24]} />
            <meshStandardMaterial color="#282830" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Lower heavy column */}
          <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.028, 0.028, 0.46, 24]} />
            <meshStandardMaterial color="#555860" metalness={0.84} roughness={0.2} />
          </mesh>

          {/* Weighted beveled disc base */}
          <group position={[0, 0, 0]}>
            {/* Main cast iron base plate */}
            <mesh position={[0, 0.012, 0]} receiveShadow>
              <cylinderGeometry args={[0.22, 0.25, 0.02, 32]} />
              <meshStandardMaterial color="#26262e" metalness={0.78} roughness={0.28} />
            </mesh>
            {/* Floor rubber protector ring */}
            <mesh position={[0, 0.002, 0]}>
              <cylinderGeometry args={[0.252, 0.252, 0.004, 32]} />
              <meshStandardMaterial color="#141418" roughness={0.9} metalness={0.05} />
            </mesh>
          </group>
        </group>
      )}

      {/* PODIUM — Architectural presentation lectern with sloped reading deck, open back, internal shelf and curved gooseneck mic */}
      {type === ObjectType.PODIUM && (() => {
        const bodyColor = color || '#5c3a21';
        const panelColor = new THREE.Color(bodyColor).offsetHSL(0, 0.05, -0.12).getStyle();
        const trimColor = new THREE.Color(bodyColor).offsetHSL(0, 0.1, 0.15).getStyle();

        return (
          <group>
            {/* Recessed plinth toe kick (floor to 0.08m) */}
            <mesh position={[0, 0.04, 0]} receiveShadow>
              <boxGeometry args={[0.56, 0.08, 0.44]} />
              <meshStandardMaterial color="#1a1a20" roughness={0.75} metalness={0.2} />
              {selected && isEditMode && <Highlight />}
            </mesh>

            {/* Main body column (hollow back towards speaker at -Z) */}
            {/* Front modesty face */}
            <mesh position={[0, 0.58, 0.22]} castShadow receiveShadow>
              <boxGeometry args={[0.62, 1.0, 0.04]} />
              <meshStandardMaterial color={bodyColor} roughness={0.45} metalness={0.05} />
            </mesh>
            {/* Front decorative recessed architectural panel */}
            <mesh position={[0, 0.58, 0.245]}>
              <boxGeometry args={[0.48, 0.82, 0.012]} />
              <meshStandardMaterial color={panelColor} roughness={0.5} metalness={0.04} />
            </mesh>
            {/* Front architectural raised perimeter trim */}
            <mesh position={[0, 0.58, 0.248]}>
              <boxGeometry args={[0.50, 0.84, 0.004]} />
              <meshStandardMaterial color={trimColor} roughness={0.35} metalness={0.3} />
            </mesh>

            {/* Left side panel */}
            <mesh position={[-0.29, 0.58, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.04, 1.0, 0.46]} />
              <meshStandardMaterial color={bodyColor} roughness={0.45} metalness={0.05} />
            </mesh>
            {/* Right side panel */}
            <mesh position={[0.29, 0.58, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.04, 1.0, 0.46]} />
              <meshStandardMaterial color={bodyColor} roughness={0.45} metalness={0.05} />
            </mesh>

            {/* Internal notes / water glass shelf (accessible from open back) */}
            <mesh position={[0, 0.68, -0.02]} receiveShadow>
              <boxGeometry args={[0.54, 0.02, 0.38]} />
              <meshStandardMaterial color={panelColor} roughness={0.55} metalness={0.04} />
            </mesh>

            {/* Sloped reading surface (angled 14 degrees down towards speaker at -Z) */}
            <group position={[0, 1.10, 0]} rotation={[0.24, 0, 0]}>
              {/* Sloped deck board */}
              <mesh position={[0, 0, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.66, 0.024, 0.52]} />
                <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.06} />
              </mesh>
              {/* Paper stop ledge at lower edge (-Z) */}
              <mesh position={[0, 0.018, -0.245]}>
                <boxGeometry args={[0.58, 0.02, 0.016]} />
                <meshStandardMaterial color={trimColor} metalness={0.5} roughness={0.3} />
              </mesh>
              {/* Shock-mount microphone base plate */}
              <mesh position={[0.16, 0.014, 0.12]}>
                <cylinderGeometry args={[0.025, 0.025, 0.006, 20]} />
                <meshStandardMaterial color="#1e1e24" metalness={0.8} roughness={0.25} />
              </mesh>
            </group>

            {/* Gooseneck microphone: curving upward and back towards speaker */}
            <group position={[0.16, 1.13, 0.12]}>
              {/* Flexible ribbed gooseneck segments */}
              <mesh position={[0, 0.06, 0]} castShadow>
                <cylinderGeometry args={[0.0045, 0.0045, 0.12, 12]} />
                <meshStandardMaterial color="#303038" metalness={0.7} roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.16, -0.04]} rotation={[-0.45, 0, 0]} castShadow>
                <cylinderGeometry args={[0.004, 0.004, 0.12, 12]} />
                <meshStandardMaterial color="#303038" metalness={0.7} roughness={0.35} />
              </mesh>
              {/* Cardioid microphone capsule head with windscreen */}
              <group position={[0, 0.22, -0.09]} rotation={[-0.55, 0, 0]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.008, 0.008, 0.038, 16]} />
                  <meshStandardMaterial color="#1c1c20" roughness={0.8} metalness={0.1} />
                </mesh>
                {/* Gold indicator band */}
                <mesh position={[0, -0.014, 0]}>
                  <cylinderGeometry args={[0.0085, 0.0085, 0.003, 16]} />
                  <meshStandardMaterial color="#c9a030" metalness={0.8} roughness={0.25} />
                </mesh>
              </group>
            </group>
          </group>
        );
      })()}

      {/* DANCE_FLOOR — Unified modular surface with procedural checkerboard texture, avoiding per-tile draw calls */}
      {type === ObjectType.DANCE_FLOOR && (() => {
        const W = customWidth || 4;
        const D = customDepth || 4;
        const floorH = 0.024;
        const rampW = 0.08;

        return (
          <group>
            {/* Unified high-gloss dance floor deck */}
            <mesh position={[0, floorH / 2, 0]} receiveShadow>
              <TiledSurfaceGeometry width={W} height={floorH} depth={D} repeatX={W / 2} repeatY={D / 2} />
              <meshPhysicalMaterial
                map={getDanceFloorTexture()}
                roughness={0.18}
                metalness={0.08}
                clearcoat={0.85}
                clearcoatRoughness={0.1}
              />
              {selected && isEditMode && <Highlight />}
            </mesh>

            {/* Beveled aluminum perimeter transition ramps (flush with floor at outside edge) */}
            {/* Front ramp */}
            <mesh position={[0, floorH / 2, D / 2 + rampW / 2]}>
              <boxGeometry args={[W + rampW * 2, floorH, rampW]} />
              <meshStandardMaterial color="#9ea0a8" metalness={0.82} roughness={0.24} />
            </mesh>
            {/* Back ramp */}
            <mesh position={[0, floorH / 2, -D / 2 - rampW / 2]}>
              <boxGeometry args={[W + rampW * 2, floorH, rampW]} />
              <meshStandardMaterial color="#9ea0a8" metalness={0.82} roughness={0.24} />
            </mesh>
            {/* Left ramp */}
            <mesh position={[-W / 2 - rampW / 2, floorH / 2, 0]}>
              <boxGeometry args={[rampW, floorH, D]} />
              <meshStandardMaterial color="#9ea0a8" metalness={0.82} roughness={0.24} />
            </mesh>
            {/* Right ramp */}
            <mesh position={[W / 2 + rampW / 2, floorH / 2, 0]}>
              <boxGeometry args={[rampW, floorH, D]} />
              <meshStandardMaterial color="#9ea0a8" metalness={0.82} roughness={0.24} />
            </mesh>
          </group>
        );
      })()}

      {/* PROJECTION_SCREEN — Tripod projection screen with extruded aluminum roller housing, matte white surface and tension bar */}
      {type === ObjectType.PROJECTION_SCREEN && (() => {
        const W = customWidth || 3;
        const H = customHeight || 1.7;
        const screenCenterY = 1.5;
        const screenTop = screenCenterY + H / 2;
        const screenBottom = screenCenterY - H / 2;
        const borderW = 0.04;

        return (
          <group>
            {/* Tripod base at floor */}
            <TripodBase />

            {/* Telescoping chrome upright extension mast */}
            <mesh position={[0, (screenTop + 0.12) / 2, 0]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, screenTop + 0.12, 16]} />
              <meshStandardMaterial color="#686a72" metalness={0.8} roughness={0.25} />
            </mesh>

            {/* Top rolled aluminum housing casing */}
            <group position={[0, screenTop + 0.035, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.035, 0.035, W + 0.14, 16]} />
                <meshStandardMaterial color="#35353d" metalness={0.78} roughness={0.28} />
              </mesh>
              {/* End caps */}
              <mesh position={[-W / 2 - 0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.038, 0.038, 0.015, 16]} />
                <meshStandardMaterial color="#1a1a20" roughness={0.8} metalness={0.2} />
              </mesh>
              <mesh position={[W / 2 + 0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.038, 0.038, 0.015, 16]} />
                <meshStandardMaterial color="#1a1a20" roughness={0.8} metalness={0.2} />
              </mesh>
              {/* Top mounting bracket / hanger */}
              <mesh position={[0, 0.03, 0]}>
                <boxGeometry args={[0.08, 0.04, 0.04]} />
                <meshStandardMaterial color="#202028" metalness={0.6} roughness={0.4} />
              </mesh>
            </group>

            {/* Matte white projection screen fabric */}
            <mesh position={[0, screenCenterY, 0.01]} receiveShadow>
              <planeGeometry args={[W, H]} />
              <meshStandardMaterial
                color="#fbfbfe"
                roughness={0.88}
                metalness={0.0}
                side={THREE.DoubleSide}
              />
              {selected && isEditMode && <Highlight />}
            </mesh>

            {/* Contrast black masking borders */}
            {/* Top border */}
            <mesh position={[0, screenTop - borderW / 2, 0.012]}>
              <boxGeometry args={[W + borderW * 2, borderW, 0.004]} />
              <meshStandardMaterial color="#141416" roughness={0.9} />
            </mesh>
            {/* Bottom border */}
            <mesh position={[0, screenBottom + borderW / 2, 0.012]}>
              <boxGeometry args={[W + borderW * 2, borderW, 0.004]} />
              <meshStandardMaterial color="#141416" roughness={0.9} />
            </mesh>
            {/* Left border */}
            <mesh position={[-W / 2 - borderW / 2, screenCenterY, 0.012]}>
              <boxGeometry args={[borderW, H, 0.004]} />
              <meshStandardMaterial color="#141416" roughness={0.9} />
            </mesh>
            {/* Right border */}
            <mesh position={[W / 2 + borderW / 2, screenCenterY, 0.012]}>
              <boxGeometry args={[borderW, H, 0.004]} />
              <meshStandardMaterial color="#141416" roughness={0.9} />
            </mesh>

            {/* Bottom weighted drop bar */}
            <mesh position={[0, screenBottom - 0.012, 0.012]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.016, 0.016, W + 0.08, 12]} />
              <meshStandardMaterial color="#222228" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        );
      })()}

      {/* LED_WALL — Modular video wall with procedural 500mm module seams, back aluminum frame and heavy ballast stabilizer legs */}
      {type === ObjectType.LED_WALL && (() => {
        const W = customWidth || 4;
        const H = customHeight || 2.25;
        const frameDepth = 0.12;

        const railCount = Math.max(3, Math.round(H / 0.5) + 1);

        return (
          <group>
            {/* Front LED display face with module seam bump texture and subtle emissive glow */}
            <mesh position={[0, H / 2 + 0.01, 0.062]} receiveShadow>
              <TiledSurfaceGeometry width={W} height={H} repeatX={W / 0.5} repeatY={H / 0.5} />
              <meshStandardMaterial
                map={getLedModuleTexture()}
                roughness={0.32}
                metalness={0.12}
                emissive="#0c1018"
                emissiveIntensity={0.25}
              />
              {selected && isEditMode && <Highlight />}
            </mesh>

            {/* Perimeter extruded black aluminum module enclosure */}
            <mesh position={[0, H / 2 + 0.01, 0]} castShadow>
              <boxGeometry args={[W + 0.02, H + 0.02, frameDepth]} />
              <meshStandardMaterial color="#18181e" roughness={0.4} metalness={0.65} />
            </mesh>

            {/* Rear aluminum ladder frame horizontal rails */}
            {Array.from({ length: railCount }).map((_, i) => {
              const yPos = 0.1 + (i / (railCount - 1)) * (H - 0.2);
              return (
                <mesh key={i} position={[0, yPos, -frameDepth / 2 - 0.02]} castShadow>
                  <boxGeometry args={[W - 0.04, 0.04, 0.04]} />
                  <meshStandardMaterial color="#2a2a34" metalness={0.75} roughness={0.3} />
                </mesh>
              );
            })}

            {/* Heavy floor outrigger ballast supports & diagonal kick braces */}
            {[-W / 3, W / 3].map((xPos, idx) => (
              <group key={idx} position={[xPos, 0, 0]}>
                {/* Outrigger floor beam extending backwards */}
                <mesh position={[0, 0.04, -0.32]} castShadow receiveShadow>
                  <boxGeometry args={[0.08, 0.08, 0.72]} />
                  <meshStandardMaterial color="#202026" roughness={0.5} metalness={0.6} />
                </mesh>
                {/* Leveling screw jacks */}
                <mesh position={[0, 0.015, -0.64]}>
                  <cylinderGeometry args={[0.04, 0.04, 0.03, 12]} />
                  <meshStandardMaterial color="#111116" roughness={0.8} />
                </mesh>
                <mesh position={[0, 0.015, 0.02]}>
                  <cylinderGeometry args={[0.04, 0.04, 0.03, 12]} />
                  <meshStandardMaterial color="#111116" roughness={0.8} />
                </mesh>
                {/* Diagonal stability brace strut */}
                <group position={[0, (H * 0.55 + 0.08) / 2, -0.355]} rotation={[Math.atan2(0.57, H * 0.55 - 0.08), 0, 0]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.018, 0.018, Math.hypot(H * 0.55 - 0.08, 0.57), 12]} />
                    <meshStandardMaterial color="#3a3c46" metalness={0.8} roughness={0.25} />
                  </mesh>
                </group>
              </group>
            ))}
          </group>
        );
      })()}

      {/* RECEPTION_DESK — Check-in / registration desk with elevated transaction counter, working surface, modesty panel and foot recess */}
      {type === ObjectType.RECEPTION_DESK && (() => {
        const W = customWidth || 1.8;
        const deskD = 0.68;
        const counterH = 1.05;
        const deskH = 0.75;
        const plinthH = 0.09;

        return (
          <group>
            {/* Recessed foot plinth / kickplate (floor to 0.09m) */}
            <mesh position={[0, plinthH / 2, 0.04]} receiveShadow>
              <boxGeometry args={[W - 0.08, plinthH, deskD - 0.12]} />
              <meshStandardMaterial color="#16161c" roughness={0.85} metalness={0.15} />
              {selected && isEditMode && <Highlight />}
            </mesh>

            {/* Front modesty panel with subtle architectural reveals */}
            <mesh position={[0, plinthH + (counterH - plinthH) / 2 - 0.02, deskD / 2 - 0.02]} castShadow>
              <boxGeometry args={[W, counterH - plinthH - 0.04, 0.03]} />
              <TableClothMaterial color={color} tableCloth={tableCloth} />
            </mesh>

            {/* Structural gable end panels (left and right) */}
            <mesh position={[-W / 2 + 0.015, counterH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.03, counterH, deskD]} />
              <meshStandardMaterial color="#26262e" roughness={0.45} metalness={0.1} />
            </mesh>
            <mesh position={[W / 2 - 0.015, counterH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.03, counterH, deskD]} />
              <meshStandardMaterial color="#26262e" roughness={0.45} metalness={0.1} />
            </mesh>

            {/* Upper elevated transaction counter (height 1.05m) */}
            <mesh position={[0, counterH, deskD / 2 - 0.14]} castShadow receiveShadow>
              <boxGeometry args={[W + 0.02, 0.035, 0.32]} />
              <meshStandardMaterial color="#2b2b34" roughness={0.35} metalness={0.15} />
            </mesh>

            {/* Lower working desk surface for attendant / laptops (height 0.75m) */}
            <mesh position={[0, deskH, -0.12]} receiveShadow>
              <boxGeometry args={[W - 0.08, 0.028, 0.44]} />
              <meshStandardMaterial color="#222228" roughness={0.45} metalness={0.1} />
            </mesh>
          </group>
        );
      })()}

      {/* DECOR — Architectural event planter with fluted vessel, soil bed and restrained lush botanical foliage */}
      {type === ObjectType.DECOR && (() => {
        const potH = 0.65;
        const potTopR = 0.23;
        const potBaseR = 0.17;

        return (
          <group>
            {/* Tapered architectural planter pot */}
            <mesh position={[0, potH / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[potTopR, potBaseR, potH, 24]} />
              <meshStandardMaterial color="#282830" roughness={0.65} metalness={0.12} />
              {selected && isEditMode && <Highlight />}
            </mesh>

            {/* Top rim collar */}
            <mesh position={[0, potH - 0.015, 0]}>
              <cylinderGeometry args={[potTopR + 0.012, potTopR, 0.03, 24]} />
              <meshStandardMaterial color="#222228" roughness={0.55} metalness={0.15} />
            </mesh>

            {/* Organic soil / dark mulch bed */}
            <mesh position={[0, potH - 0.02, 0]} receiveShadow>
              <cylinderGeometry args={[potTopR - 0.01, potTopR - 0.02, 0.02, 20]} />
              <meshStandardMaterial color="#1a1410" roughness={0.92} metalness={0.02} />
            </mesh>

            {/* Botanical Foliage: natural curving stems and broad sculptural leaves */}
            {/* Central upright stem */}
            <group position={[0, potH - 0.02, 0]}>
              <mesh position={[0, 0.35, 0]} castShadow>
                <cylinderGeometry args={[0.012, 0.016, 0.72, 10]} />
                <meshStandardMaterial color="#283a24" roughness={0.6} />
              </mesh>
              {/* Top crowning leaf */}
              <mesh geometry={getLeafGeometry()} position={[0, 0.56, 0]} rotation={[0.2, 0, 0]} scale={0.85} castShadow>
                <meshStandardMaterial color="#34542d" roughness={0.65} side={THREE.DoubleSide} />
              </mesh>
            </group>

            {/* Radiating architectural leaves at natural angles and heights */}
            {[
              { angle: 0, h: 0.22, tilt: 0.42, scale: 1.0 },
              { angle: 72, h: 0.32, tilt: 0.38, scale: 1.1 },
              { angle: 144, h: 0.26, tilt: 0.45, scale: 0.95 },
              { angle: 216, h: 0.38, tilt: 0.35, scale: 1.15 },
              { angle: 288, h: 0.28, tilt: 0.40, scale: 1.05 },
            ].map(({ angle, h, tilt, scale }, idx) => {
              const rad = (angle * Math.PI) / 180;
              return (
                <group key={idx} position={[0, potH + h, 0]} rotation={[0, rad, 0]}>
                  {/* Stem branch */}
                  <mesh
                    position={[0, 0.12 * scale, 0.06 * scale]}
                    rotation={[-tilt, 0, 0]}
                    castShadow
                  >
                    <cylinderGeometry
                      args={[0.007 * scale, 0.01 * scale, 0.28 * scale, 8]}
                    />
                    <meshStandardMaterial color="#2d4228" roughness={0.6} />
                  </mesh>
                  {/* Broad sculptural foliage leaf */}
                  <mesh
                    geometry={getLeafGeometry()}
                    scale={scale}
                    position={[0, 0.24 * scale, 0.16 * scale]}
                    rotation={[0.75 + tilt, 0, 0]}
                    castShadow
                  >
                    <meshStandardMaterial
                      color="#32522b"
                      roughness={0.65}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })()}
    </group>
  );
};
