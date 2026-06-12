import React from 'react';
import * as THREE from 'three';
import { ObjectType } from '../../types';
import { EdgeOutline, Highlight } from './shared';

export const Equipment = ({ type, color, customWidth = 3, selected, isEditMode }: any) => {
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
