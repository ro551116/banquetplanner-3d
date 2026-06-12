import React, { useMemo } from 'react';
import * as THREE from 'three';
import { TrussMember, TrussSegmentLength, TrussStructureConfig } from '../../types';
import { getMemberLength, getTrussDimensions, TRUSS_SEGMENT_COLORS } from '../../trussConfig';
import { Highlight } from './shared';

interface TrussStructureModelProps {
  config: TrussStructureConfig;
  selected: boolean;
  isEditMode?: boolean;
  schematicColors?: boolean;
  color?: string;
}

const CROSS_SECTION = 0.3;
const TUBE_RADIUS = 0.025;
const COUPLER_SIZE = 0.18;

const toMeters = (cm: number) => cm / 100;

const CylinderBetween = ({
  start,
  end,
  radius,
  color,
}: {
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
  color: string;
}) => {
  const { midpoint, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const direction = new THREE.Vector3().subVectors(b, a);
    const length = direction.length();
    const midpoint = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
    return { midpoint, quaternion, length };
  }, [start, end]);

  if (length <= 0) return null;

  return (
    <mesh position={midpoint} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, length, 6]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.25} />
    </mesh>
  );
};

const SegmentTruss = ({
  length,
  color,
}: {
  length: number;
  color: string;
}) => {
  const half = CROSS_SECTION / 2;
  const braceStep = 0.5;
  const segments = Math.max(1, Math.ceil(length / braceStep));
  const corners: [number, number][] = [
    [-half, -half],
    [half, -half],
    [-half, half],
    [half, half],
  ];

  return (
    <group>
      {corners.map(([y, z], i) => (
        <mesh key={`main-${i}`} position={[0, y, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[TUBE_RADIUS, TUBE_RADIUS, length, 8]} />
          <meshStandardMaterial color={color} metalness={0.7} roughness={0.25} />
        </mesh>
      ))}

      {Array.from({ length: segments }).map((_, segmentIndex) => {
        const startX = -length / 2 + segmentIndex * (length / segments);
        const midX = startX + (length / segments) / 2;
        const endX = startX + (length / segments);
        const r = TUBE_RADIUS * 0.6;

        return (
          <React.Fragment key={`brace-${segmentIndex}`}>
            <CylinderBetween start={[startX, -half, half]} end={[midX, half, half]} radius={r} color={color} />
            <CylinderBetween start={[midX, half, half]} end={[endX, -half, half]} radius={r} color={color} />
            <CylinderBetween start={[startX, -half, -half]} end={[midX, half, -half]} radius={r} color={color} />
            <CylinderBetween start={[midX, half, -half]} end={[endX, -half, -half]} radius={r} color={color} />
            <CylinderBetween start={[startX, half, -half]} end={[midX, half, half]} radius={r} color={color} />
            <CylinderBetween start={[midX, half, half]} end={[endX, half, -half]} radius={r} color={color} />
          </React.Fragment>
        );
      })}
    </group>
  );
};

const OrientedSegment = ({
  start,
  axis,
  offset,
  lengthCm,
  color,
}: {
  start: THREE.Vector3;
  axis: THREE.Vector3;
  offset: number;
  lengthCm: TrussSegmentLength;
  color: string;
}) => {
  const length = toMeters(lengthCm);
  const axisUnit = axis.clone().normalize();
  const center = start.clone().add(axisUnit.clone().multiplyScalar(offset + length / 2));
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), axisUnit);

  return (
    <group position={center} quaternion={quaternion}>
      <SegmentTruss length={length} color={color} />
    </group>
  );
};

const CouplerCube = ({ position }: { position: THREE.Vector3 }) => (
  <mesh position={position} castShadow>
    <boxGeometry args={[COUPLER_SIZE, COUPLER_SIZE, COUPLER_SIZE]} />
    <meshStandardMaterial color="#050505" metalness={0.35} roughness={0.5} />
  </mesh>
);

const BasePlate = ({ x, z }: { x: number; z: number }) => (
  <mesh position={[x, 0.025, z]} receiveShadow castShadow>
    <boxGeometry args={[0.72, 0.05, 0.52]} />
    <meshStandardMaterial color="#050505" metalness={0.45} roughness={0.45} />
  </mesh>
);

const MemberRenderer = ({
  member,
  start,
  axis,
  schematicColors,
  color,
  keyPrefix,
}: {
  member: TrussMember;
  start: THREE.Vector3;
  axis: THREE.Vector3;
  schematicColors?: boolean;
  color: string;
  keyPrefix: string;
}) => {
  const axisUnit = axis.clone().normalize();
  let offset = 0;

  return (
    <group>
      {member.segments.map((segment, index) => {
        const segmentColor = schematicColors ? TRUSS_SEGMENT_COLORS[segment] : color;
        const currentOffset = offset;
        offset += toMeters(segment);

        return (
          <React.Fragment key={`${keyPrefix}-${index}`}>
            <OrientedSegment start={start} axis={axisUnit} offset={currentOffset} lengthCm={segment} color={segmentColor} />
            {index < member.segments.length - 1 && (
              <CouplerCube position={start.clone().add(axisUnit.clone().multiplyScalar(offset))} />
            )}
          </React.Fragment>
        );
      })}
    </group>
  );
};

export const TrussStructureModel: React.FC<TrussStructureModelProps> = ({
  config,
  selected,
  isEditMode,
  schematicColors,
  color = '#b8b8c0',
}) => {
  const dims = getTrussDimensions(config);
  const height = toMeters(dims.heightCm);
  const width = config.kind === 'TOWER' ? 0 : toMeters(getMemberLength(config.beam));
  const depth = config.kind === 'BACKDROP' ? toMeters(getMemberLength(config.depthMember)) : 0;
  const renderColor = color || '#b8b8c0';
  const leftX = -width / 2;
  const rightX = width / 2;

  return (
    <group>
      {config.kind === 'TOWER' ? (
        <>
          <MemberRenderer
            member={config.legs}
            start={new THREE.Vector3(0, 0.04, 0)}
            axis={new THREE.Vector3(0, 1, 0)}
            schematicColors={schematicColors}
            color={renderColor}
            keyPrefix="tower-leg"
          />
          <BasePlate x={0} z={0} />
        </>
      ) : (
        <>
          <MemberRenderer
            member={config.legs}
            start={new THREE.Vector3(leftX, 0.04, 0)}
            axis={new THREE.Vector3(0, 1, 0)}
            schematicColors={schematicColors}
            color={renderColor}
            keyPrefix="left-leg"
          />
          <MemberRenderer
            member={config.legs}
            start={new THREE.Vector3(rightX, 0.04, 0)}
            axis={new THREE.Vector3(0, 1, 0)}
            schematicColors={schematicColors}
            color={renderColor}
            keyPrefix="right-leg"
          />
          {config.beam && (
            <MemberRenderer
              member={config.beam}
              start={new THREE.Vector3(leftX, height + 0.04, 0)}
              axis={new THREE.Vector3(1, 0, 0)}
              schematicColors={schematicColors}
              color={renderColor}
              keyPrefix="beam"
            />
          )}
          <CouplerCube position={new THREE.Vector3(leftX, height + 0.04, 0)} />
          <CouplerCube position={new THREE.Vector3(rightX, height + 0.04, 0)} />
          <BasePlate x={leftX} z={0} />
          <BasePlate x={rightX} z={0} />
        </>
      )}

      {config.kind === 'BACKDROP' && config.depthMember && (
        <>
          <MemberRenderer
            member={config.depthMember}
            start={new THREE.Vector3(leftX, height + 0.04, 0)}
            axis={new THREE.Vector3(0, 0, -1)}
            schematicColors={schematicColors}
            color={renderColor}
            keyPrefix="left-depth"
          />
          <MemberRenderer
            member={config.depthMember}
            start={new THREE.Vector3(rightX, height + 0.04, 0)}
            axis={new THREE.Vector3(0, 0, -1)}
            schematicColors={schematicColors}
            color={renderColor}
            keyPrefix="right-depth"
          />
          <CouplerCube position={new THREE.Vector3(leftX, height + 0.04, -depth)} />
          <CouplerCube position={new THREE.Vector3(rightX, height + 0.04, -depth)} />
        </>
      )}

      {selected && isEditMode && (
        <mesh position={[0, Math.max(height, 0.4) / 2, -depth / 2]}>
          <boxGeometry args={[Math.max(width, CROSS_SECTION) + 0.5, Math.max(height, 0.4) + 0.5, Math.max(depth, CROSS_SECTION) + 0.5]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Highlight />
        </mesh>
      )}
    </group>
  );
};
