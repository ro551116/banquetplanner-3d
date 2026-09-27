import React, { useMemo } from 'react';
import * as THREE from 'three';
import { ObjectType } from '../../types';
import { Highlight, PlateBase, TripodBase } from './shared';
import { SoftBox, GrilleMaterial } from './details';

// Module-level shared geometries — lazily initialized singletons (zero GC churn / duplicate allocations)
let _paCabinetGeom: THREE.BufferGeometry | null = null;
function getPaCabinetGeometry(): THREE.BufferGeometry {
  if (!_paCabinetGeom) {
    const shape = new THREE.Shape();
    const frontW = 0.44;
    const rearW = 0.28;
    const depth = 0.38;
    const halfD = depth / 2;
    // Front face at -halfD so rotateX(-PI/2) maps front to world +Z
    shape.moveTo(-frontW / 2, -halfD);
    shape.lineTo(frontW / 2, -halfD);
    shape.lineTo(rearW / 2, halfD);
    shape.lineTo(-rearW / 2, halfD);
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 0.68,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    // rotateX(-PI/2): old Z (0..0.68) -> world +Y, old Y (-halfD) -> world +Z front!
    geom.rotateX(-Math.PI / 2);
    geom.center();
    geom.computeBoundingBox();
    const minY = geom.boundingBox!.min.y;
    geom.translate(0, -minY, 0); // bottom sits at Y = 0
    _paCabinetGeom = geom;
  }
  return _paCabinetGeom;
}

let _monitorGeom: THREE.BufferGeometry | null = null;
function getMonitorGeometry(): THREE.BufferGeometry {
  if (!_monitorGeom) {
    const shape = new THREE.Shape();
    // In local (x, y): rotateY(-PI/2) maps local +x to world +Z front, +y to world +Y
    shape.moveTo(0.20, 0.02);
    shape.lineTo(0.22, 0.07);
    shape.lineTo(-0.12, 0.33);
    shape.lineTo(-0.20, 0.31);
    shape.lineTo(-0.20, 0.02);
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 0.50,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.012,
      bevelThickness: 0.012,
    });
    // rotateY(-PI/2): local +X (front lip 0.22) -> world +Z!
    geom.rotateY(-Math.PI / 2);
    geom.computeBoundingBox();
    const minX = geom.boundingBox!.min.x;
    const maxX = geom.boundingBox!.max.x;
    const minY = geom.boundingBox!.min.y;
    geom.translate(-(minX + maxX) / 2, -minY + 0.02, 0); // bottom sits at Y = 0.02
    _monitorGeom = geom;
  }
  return _monitorGeom;
}

export const Speaker = ({
  type,
  color,
  standType,
  selected,
  isEditMode,
  tilt = 0,
  arrayCount = 4,
}: {
  type: ObjectType;
  color: string;
  standType?: string;
  selected?: boolean;
  isEditMode?: boolean;
  tilt?: number;
  arrayCount?: number;
}) => {
  const cabinetColor = color || '#222226';
  const grilleColor = useMemo(
    () => new THREE.Color(cabinetColor).multiplyScalar(0.72).getStyle(),
    [cabinetColor]
  );

  const isPaSpeaker = type === ObjectType.SPEAKER_15 || type === ObjectType.SPEAKER;

  return (
    <group>
      {/* 15" PA Speaker (or legacy SPEAKER counterpart) */}
      {isPaSpeaker && (
        <group>
          {standType === 'PLATE' ? <PlateBase /> : <TripodBase />}

          <group position={[0, 1.2, 0]} rotation={[tilt, 0, 0]}>
            {/* Pole socket collar */}
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.026, 0.032, 0.04, 16]} />
              <meshStandardMaterial color="#18181e" metalness={0.7} roughness={0.3} />
            </mesh>

            {/* Trapezoidal beveled cabinet (full width at front +Z) */}
            <mesh geometry={getPaCabinetGeometry()} castShadow receiveShadow>
              <meshStandardMaterial color={cabinetColor} roughness={0.76} metalness={0.15} />
              {selected && isEditMode && <Highlight />}
            </mesh>

            {/* Protective grille mounted just outside the beveled front surface */}
            <mesh position={[0, 0.355, 0.207]}>
              <planeGeometry args={[0.40, 0.66]} />
              <GrilleMaterial color={grilleColor} roughness={0.55} metalness={0.65} />
            </mesh>

            {/* Brand badge on lower front */}
            <mesh position={[0, 0.04, 0.210]}>
              <boxGeometry args={[0.08, 0.018, 0.003]} />
              <meshStandardMaterial color="#c0c0c8" metalness={0.9} roughness={0.2} />
            </mesh>

            {/* Recessed ergonomic side handles */}
            {[-1, 1].map((side) => (
              <group key={side} position={[side * 0.198, 0.355, 0]} rotation={[0, side * -0.22, 0]}>
                <mesh>
                  <boxGeometry args={[0.015, 0.14, 0.06]} />
                  <meshStandardMaterial color="#18181e" metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh position={[side * 0.005, 0, 0]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.10, 12]} />
                  <meshStandardMaterial color="#404048" metalness={0.8} roughness={0.25} />
                </mesh>
              </group>
            ))}

            {/* Top carry handle */}
            <mesh position={[0, 0.718, 0]}>
              <boxGeometry args={[0.18, 0.024, 0.065]} />
              <meshStandardMaterial color="#303038" metalness={0.7} roughness={0.3} />
            </mesh>

            {/* Rear amplifier panel with cooling fins */}
            <mesh position={[0, 0.355, -0.207]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[0.18, 0.38]} />
              <meshStandardMaterial color="#16161c" metalness={0.6} roughness={0.35} />
            </mesh>
            {[-0.06, -0.02, 0.02, 0.06].map((x, i) => (
              <mesh key={i} position={[x, 0.355, -0.212]}>
                <boxGeometry args={[0.006, 0.24, 0.014]} />
                <meshStandardMaterial color="#101014" metalness={0.7} roughness={0.3} />
              </mesh>
            ))}
          </group>
        </group>
      )}

      {/* Subwoofer: Substantial touring cabinet with recessed feet & grille */}
      {type === ObjectType.SPEAKER_SUB && (
        <group>
          {/* Main substantial beveled cabinet */}
          <SoftBox
            size={[0.72, 0.60, 0.76]}
            position={[0, 0.325, 0]}
            radius={0.02}
            color={cabinetColor}
            roughness={0.76}
            metalness={0.15}
          >
            {selected && isEditMode && <Highlight />}
          </SoftBox>

          {/* Perforated grille framed by the cabinet's rounded perimeter */}
          <mesh position={[0, 0.325, 0.382]}>
            <planeGeometry args={[0.66, 0.54]} />
            <GrilleMaterial color={grilleColor} roughness={0.5} metalness={0.65} />
          </mesh>

          {/* Heavy-duty 4-point metal pocket handles (2 per side) */}
          {[-1, 1].flatMap((side) =>
            [-0.16, 0.16].map((z, zi) => (
              <group
                key={`${side}-${zi}`}
                position={[side * 0.362, 0.325, z]}
                rotation={[0, side * (Math.PI / 2), 0]}
              >
                <mesh>
                  <boxGeometry args={[0.14, 0.08, 0.015]} />
                  <meshStandardMaterial color="#1a1a20" metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh position={[0, 0, 0.005]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.009, 0.009, 0.11, 12]} />
                  <meshStandardMaterial color="#505058" metalness={0.8} roughness={0.2} />
                </mesh>
              </group>
            ))
          )}

          {/* Top M20 pole mount socket */}
          <mesh position={[0, 0.627, 0]}>
            <cylinderGeometry args={[0.035, 0.04, 0.015, 16]} />
            <meshStandardMaterial color="#18181e" metalness={0.8} roughness={0.25} />
          </mesh>

          {/* Stacking interlock foot cups on top panel */}
          {[
            [0.28, 0.626, 0.28],
            [-0.28, 0.626, 0.28],
            [0.28, 0.626, -0.28],
            [-0.28, 0.626, -0.28],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]}>
              <cylinderGeometry args={[0.038, 0.034, 0.006, 16]} />
              <meshStandardMaterial color="#141418" roughness={0.8} metalness={0.3} />
            </mesh>
          ))}

          {/* 4 Heavy-duty rubber stacking feet resting flat on floor at Y = 0 */}
          {[
            [0.28, 0.0125, 0.28],
            [-0.28, 0.0125, 0.28],
            [0.28, 0.0125, -0.28],
            [-0.28, 0.0125, -0.28],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]}>
              <cylinderGeometry args={[0.032, 0.036, 0.025, 16]} />
              <meshStandardMaterial color="#1c1c20" roughness={0.9} metalness={0.1} />
            </mesh>
          ))}

          {/* Rear connection dish */}
          <mesh position={[0, 0.325, -0.381]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.16, 0.24]} />
            <meshStandardMaterial color="#141418" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* Stage Monitor: True Wedge Geometry on floor */}
      {type === ObjectType.SPEAKER_MONITOR && (() => {
        const angleX = -Math.atan2(0.34, 0.26);
        return (
          <group>
            {/* True wedge cabinet resting at Y = 0.02 */}
            <mesh geometry={getMonitorGeometry()} castShadow receiveShadow>
              <meshStandardMaterial color={cabinetColor} roughness={0.76} metalness={0.15} />
              {selected && isEditMode && <Highlight />}
            </mesh>

            {/* Baffle slope follows the wedge profile, clear of its bevel */}
            <mesh position={[0, 0.223, 0.060]} rotation={[angleX, 0, 0]}>
              <planeGeometry args={[0.46, 0.41]} />
              <GrilleMaterial color={grilleColor} roughness={0.55} metalness={0.65} />
            </mesh>

            {/* 4 Rubber skid feet resting on floor (Y = 0 to 0.02) */}
            {[
              [0.21, 0.01, 0.14],
              [-0.21, 0.01, 0.14],
              [0.21, 0.01, -0.14],
              [-0.21, 0.01, -0.14],
            ].map((p, i) => (
              <mesh key={i} position={p as [number, number, number]}>
                <cylinderGeometry args={[0.022, 0.022, 0.02, 12]} />
                <meshStandardMaterial color="#1c1c20" roughness={0.9} metalness={0.05} />
              </mesh>
            ))}

            {/* Side recessed handle pockets */}
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                position={[side * 0.255, 0.18, 0]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[0.026, 0.026, 0.015, 16]} />
                <meshStandardMaterial color="#16161c" metalness={0.7} roughness={0.3} />
              </mesh>
            ))}

            {/* Rear recessed Speakon dish */}
            <mesh position={[0, 0.16, -0.205]}>
              <boxGeometry args={[0.10, 0.06, 0.01]} />
              <meshStandardMaterial color="#141418" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        );
      })()}

      {/* Column Speaker: Stable compact subwoofer base + rigid pole + slender array */}
      {type === ObjectType.SPEAKER_COLUMN && (
        <group>
          {/* Sub Base Unit resting on floor */}
          <SoftBox
            size={[0.38, 0.42, 0.46]}
            position={[0, 0.23, 0]}
            radius={0.02}
            color={cabinetColor}
            roughness={0.76}
            metalness={0.15}
          >
            {selected && isEditMode && <Highlight />}
          </SoftBox>

          {/* Sub Base Front Grille */}
          <mesh position={[0, 0.23, 0.232]}>
            <planeGeometry args={[0.34, 0.38]} />
            <GrilleMaterial color={grilleColor} roughness={0.5} metalness={0.65} />
          </mesh>

          {/* Sub Rubber Feet on floor */}
          {[
            [0.15, 0.01, 0.18],
            [-0.15, 0.01, 0.18],
            [0.15, 0.01, -0.18],
            [-0.15, 0.01, -0.18],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]}>
              <cylinderGeometry args={[0.022, 0.022, 0.02, 12]} />
              <meshStandardMaterial color="#1c1c20" roughness={0.9} />
            </mesh>
          ))}

          {/* Top handle on sub unit */}
          <mesh position={[0, 0.443, -0.08]}>
            <boxGeometry args={[0.14, 0.02, 0.04]} />
            <meshStandardMaterial color="#222228" metalness={0.6} roughness={0.35} />
          </mesh>

          {/* Aluminum Extension Spacer Pole */}
          <mesh position={[0, 0.77, 0.06]}>
            <cylinderGeometry args={[0.02, 0.02, 0.66, 16]} />
            <meshStandardMaterial color="#505058" metalness={0.82} roughness={0.25} />
          </mesh>
          {/* Extension lock collar */}
          <mesh position={[0, 0.46, 0.06]}>
            <cylinderGeometry args={[0.03, 0.03, 0.04, 16]} />
            <meshStandardMaterial color="#222228" metalness={0.7} roughness={0.3} />
          </mesh>

          {/* Slender Curved Line Array Column */}
          <group position={[0, 1.53, 0.06]}>
            <SoftBox
              size={[0.11, 0.86, 0.13]}
              radius={0.015}
              color={cabinetColor}
              roughness={0.72}
              metalness={0.18}
            />

            {/* Continuous micro-perforated front grille */}
            <mesh position={[0, 0, 0.067]}>
              <planeGeometry args={[0.095, 0.84]} />
              <GrilleMaterial color={grilleColor} roughness={0.55} metalness={0.65} />
            </mesh>

            {/* Rear ergonomic grip channel */}
            <mesh position={[0, 0, -0.066]}>
              <boxGeometry args={[0.04, 0.30, 0.01]} />
              <meshStandardMaterial color="#18181e" metalness={0.6} roughness={0.4} />
            </mesh>
          </group>
        </group>
      )}

      {/* Line Array: Credible repeated curved boxes with rigging & flybar */}
      {type === ObjectType.SPEAKER_LINE_ARRAY && (() => {
        const count = Math.max(2, Math.min(8, arrayCount || 4));
        const boxW = 0.64;
        const boxH = 0.22;
        const boxD = 0.42;

        const isPlateStand = standType === 'PLATE';
        const isTripodStand = standType === 'TRIPOD';

        // Support point Y:
        // - Tripod: stand mast top is at 1.2m
        // - Plate: ground stack plate sits at Y = 0..0.04, stack starts at 0.05
        // - Flown default: array ground clearance starts at 0.11
        const supportY = isTripodStand ? 1.20 : isPlateStand ? 0.05 : 0.11;

        return (
          <group>
            {/* 1. Stationary Base / Support (does NOT rotate with tilt) */}
            {isPlateStand && (
              <group position={[0, 0.02, 0]}>
                {/* Heavy-duty ground-stack steel plate frame */}
                <mesh>
                  <boxGeometry args={[0.76, 0.04, 0.54]} />
                  <meshStandardMaterial color="#282830" metalness={0.8} roughness={0.25} />
                </mesh>
                {/* Leveling screw outriggers */}
                {[
                  [0.35, 0.02, 0.24],
                  [-0.35, 0.02, 0.24],
                  [0.35, 0.02, -0.24],
                  [-0.35, 0.02, -0.24],
                ].map((p, i) => (
                  <mesh key={i} position={p as [number, number, number]}>
                    <cylinderGeometry args={[0.024, 0.028, 0.04, 12]} />
                    <meshStandardMaterial color="#404048" metalness={0.8} roughness={0.2} />
                  </mesh>
                ))}
              </group>
            )}

            {isTripodStand && (
              <group position={[0, 0, 0]}>
                <TripodBase />
                {/* Stand mount adapter collar at 1.2m */}
                <mesh position={[0, 1.20, 0]}>
                  <cylinderGeometry args={[0.036, 0.042, 0.05, 16]} />
                  <meshStandardMaterial color="#25252b" metalness={0.8} roughness={0.25} />
                </mesh>
              </group>
            )}

            {/* 2. Tiltable Array Assembly (pivots about the support top) */}
            <group position={[0, supportY, 0]} rotation={[tilt, 0, 0]}>
              {/* Top Flybar Rigging Frame / Bumper Grid */}
              <group position={[0, count * boxH + 0.08, 0]}>
                {/* Main steel bumper perimeter */}
                <mesh>
                  <boxGeometry args={[boxW + 0.08, 0.045, boxD + 0.06]} />
                  <meshStandardMaterial color="#383840" metalness={0.82} roughness={0.25} />
                </mesh>
                {/* Central shackle pick beam */}
                <mesh position={[0, 0.035, 0]}>
                  <boxGeometry args={[0.06, 0.04, boxD + 0.08]} />
                  <meshStandardMaterial color="#484852" metalness={0.85} roughness={0.2} />
                </mesh>
                {/* Hoist shackle bow */}
                <mesh position={[0, 0.09, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <torusGeometry args={[0.035, 0.01, 8, 16]} />
                  <meshStandardMaterial color="#909098" metalness={0.9} roughness={0.15} />
                </mesh>
                {/* Side rigging drop plates */}
                {[-1, 1].map((side) => (
                  <mesh key={side} position={[side * (boxW / 2 + 0.025), -0.06, 0]}>
                    <boxGeometry args={[0.02, 0.12, 0.16]} />
                    <meshStandardMaterial color="#303038" metalness={0.8} roughness={0.25} />
                  </mesh>
                ))}
              </group>

              {/* Curved Repeated Line Array Cabinets */}
              {Array.from({ length: count }).map((_, i) => {
                const splayAngle = (count - 1 - i) * 0.045;
                const yPos = i * boxH;

                return (
                  <group key={i} position={[0, yPos, 0]} rotation={[splayAngle, 0, 0]}>
                    {/* Trapezoidal beveled cabinet */}
                    <SoftBox
                      size={[boxW, boxH, boxD]}
                      position={[0, boxH / 2, 0]}
                      radius={0.015}
                      color={cabinetColor}
                      roughness={0.76}
                      metalness={0.15}
                    >
                      {i === 0 && selected && isEditMode && <Highlight />}
                    </SoftBox>

                    {/* Recessed perforated steel grille face */}
                    <mesh position={[0, boxH / 2, boxD / 2 + 0.002]}>
                      <planeGeometry args={[boxW - 0.04, boxH - 0.03]} />
                      <GrilleMaterial color={grilleColor} roughness={0.55} metalness={0.65} />
                    </mesh>

                    {/* Side laser-cut aluminum rigging brackets with lock pins */}
                    {[-1, 1].map((side) => (
                      <group
                        key={side}
                        position={[side * (boxW / 2 + 0.006), boxH / 2, 0]}
                      >
                        <mesh>
                          <boxGeometry args={[0.012, boxH * 0.85, 0.14]} />
                          <meshStandardMaterial color="#505058" metalness={0.8} roughness={0.25} />
                        </mesh>
                        <mesh position={[0, boxH * 0.3, 0.04]} rotation={[0, 0, Math.PI / 2]}>
                          <cylinderGeometry args={[0.006, 0.006, 0.02, 10]} />
                          <meshStandardMaterial color="#c0c0c8" metalness={0.9} roughness={0.2} />
                        </mesh>
                        <mesh position={[0, -boxH * 0.3, -0.04]} rotation={[0, 0, Math.PI / 2]}>
                          <cylinderGeometry args={[0.006, 0.006, 0.02, 10]} />
                          <meshStandardMaterial color="#c0c0c8" metalness={0.9} roughness={0.2} />
                        </mesh>
                      </group>
                    ))}

                    {/* Inter-box seam shadow */}
                    {i < count - 1 && (
                      <mesh position={[0, 0, boxD / 2 + 0.003]}>
                        <planeGeometry args={[boxW + 0.01, 0.006]} />
                        <meshStandardMaterial color="#101014" roughness={0.95} />
                      </mesh>
                    )}
                  </group>
                );
              })}
            </group>
          </group>
        );
      })()}
    </group>
  );
};
