import React, { useMemo } from 'react';
import * as THREE from 'three';
import { TrussMember, TrussSegmentLength, TrussStructureConfig } from '../../types';
import {
  customMemberHasBasePlate,
  detectCustomJoints,
  getCustomBounds,
  getCustomMemberStart,
  getEffectiveBayCount,
  getEffectiveBeamAttachCm,
  getEffectiveRightLeg,
  getMemberLength,
  getTrussDimensions,
  TRUSS_SEGMENT_COLORS,
} from '../../trussConfig';
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

const BasePlate = ({ x, z, y = 0.025 }: { x: number; z: number; y?: number }) => (
  <mesh position={[x, y, z]} receiveShadow castShadow>
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
  const width = config.kind === 'TOWER' ? 0 : toMeters(dims.widthCm);
  const depth = config.kind === 'CUSTOM'
    ? toMeters(dims.depthCm || 0)
    : config.kind === 'BACKDROP'
      ? toMeters(getMemberLength(config.depthMember))
      : 0;
  const renderColor = color || '#b8b8c0';
  const leftX = -width / 2;
  const rightX = width / 2;
  const legs = config.legs || { segments: [] };
  const rightLeg = getEffectiveRightLeg(config);
  const topY = height + 0.04;
  const attachY = toMeters(getEffectiveBeamAttachCm(config)) + 0.04;
  const leftBeamLength = toMeters(getMemberLength(config.beam));
  const bayCount = getEffectiveBayCount(config);
  const tColumnX = config.kind === 'TSHAPE' ? leftX + leftBeamLength : 0;
  const customMembers = config.kind === 'CUSTOM' ? config.members || [] : [];
  const customBounds = getCustomBounds(customMembers);
  const customCenterX = (customBounds.minXCm + customBounds.maxXCm) / 2;
  const customCenterZ = (customBounds.minZCm + customBounds.maxZCm) / 2;
  const customHeight = toMeters(customBounds.heightCm);
  const customWidth = toMeters(customBounds.widthCm);
  const customDepth = toMeters(customBounds.depthCm);
  const customToVector = (xCm: number, yCm: number, zCm = 0) => new THREE.Vector3(
    toMeters(xCm - customCenterX),
    toMeters(yCm - customBounds.minYCm) + 0.04,
    -toMeters(zCm - customCenterZ),
  );
  const customMemberAxis = (member: (typeof customMembers)[number]) => {
    if (member.orientation === 'VERTICAL') return new THREE.Vector3(0, 1, 0);
    if (member.orientation === 'DEPTH') return new THREE.Vector3(0, 0, -1);
    return new THREE.Vector3(member.direction === -1 ? -1 : 1, 0, 0);
  };

  const renderTwoLegFrame = () => (
    <>
      <MemberRenderer
        member={legs}
        start={new THREE.Vector3(leftX, 0.04, 0)}
        axis={new THREE.Vector3(0, 1, 0)}
        schematicColors={schematicColors}
        color={renderColor}
        keyPrefix="left-leg"
      />
      <MemberRenderer
        member={rightLeg}
        start={new THREE.Vector3(rightX, 0.04, 0)}
        axis={new THREE.Vector3(0, 1, 0)}
        schematicColors={schematicColors}
        color={renderColor}
        keyPrefix="right-leg"
      />
      {config.beam && (
        <MemberRenderer
          member={config.beam}
          start={new THREE.Vector3(leftX, topY, 0)}
          axis={new THREE.Vector3(1, 0, 0)}
          schematicColors={schematicColors}
          color={renderColor}
          keyPrefix="beam"
        />
      )}
      <CouplerCube position={new THREE.Vector3(leftX, topY, 0)} />
      <CouplerCube position={new THREE.Vector3(rightX, topY, 0)} />
      <BasePlate x={leftX} z={0} />
      <BasePlate x={rightX} z={0} />
    </>
  );

  const renderCustomStructure = () => {
    const interMemberJoints = detectCustomJoints(customMembers).filter(joint => joint.type === 'INTER_MEMBER');

    return (
      <>
        {customMembers.map((member, index) => {
          const start = getCustomMemberStart(member);
          const position = customToVector(start.xCm, start.yCm, start.zCm);
          const plateY = toMeters(start.yCm - customBounds.minYCm) + 0.025;

          return (
            <React.Fragment key={`custom-member-${member.id || index}`}>
              <MemberRenderer
                member={member}
                start={position}
                axis={customMemberAxis(member)}
                schematicColors={schematicColors}
                color={renderColor}
                keyPrefix={`custom-${member.id || index}`}
              />
              {customMemberHasBasePlate(member) && <BasePlate x={position.x} y={plateY} z={position.z} />}
            </React.Fragment>
          );
        })}
        {interMemberJoints.map(joint => (
          <CouplerCube key={joint.id} position={customToVector(joint.xCm, joint.yCm, joint.zCm)} />
        ))}
      </>
    );
  };

  return (
    <group>
      {config.kind === 'TOWER' ? (
        <>
          <MemberRenderer
            member={legs}
            start={new THREE.Vector3(0, 0.04, 0)}
            axis={new THREE.Vector3(0, 1, 0)}
            schematicColors={schematicColors}
            color={renderColor}
            keyPrefix="tower-leg"
          />
          <BasePlate x={0} z={0} />
        </>
      ) : null}

      {(config.kind === 'GOALPOST' || config.kind === 'BACKDROP') && renderTwoLegFrame()}

      {config.kind === 'BOX' && (
        <>
          {renderTwoLegFrame()}
          {config.bottomBeam && (
            <MemberRenderer
              member={config.bottomBeam}
              start={new THREE.Vector3(leftX, 0.04, 0)}
              axis={new THREE.Vector3(1, 0, 0)}
              schematicColors={schematicColors}
              color={renderColor}
              keyPrefix="bottom-beam"
            />
          )}
          <CouplerCube position={new THREE.Vector3(leftX, 0.04, 0)} />
          <CouplerCube position={new THREE.Vector3(rightX, 0.04, 0)} />
        </>
      )}

      {config.kind === 'LSHAPE' && (
        <>
          <MemberRenderer
            member={legs}
            start={new THREE.Vector3(leftX, 0.04, 0)}
            axis={new THREE.Vector3(0, 1, 0)}
            schematicColors={schematicColors}
            color={renderColor}
            keyPrefix="l-leg"
          />
          {config.beam && (
            <MemberRenderer
              member={config.beam}
              start={new THREE.Vector3(leftX, attachY, 0)}
              axis={new THREE.Vector3(1, 0, 0)}
              schematicColors={schematicColors}
              color={renderColor}
              keyPrefix="l-beam"
            />
          )}
          <CouplerCube position={new THREE.Vector3(leftX, attachY, 0)} />
          <BasePlate x={leftX} z={0} />
        </>
      )}

      {config.kind === 'TSHAPE' && (
        <>
          <MemberRenderer
            member={legs}
            start={new THREE.Vector3(tColumnX, 0.04, 0)}
            axis={new THREE.Vector3(0, 1, 0)}
            schematicColors={schematicColors}
            color={renderColor}
            keyPrefix="t-leg"
          />
          {config.beam && (
            <MemberRenderer
              member={config.beam}
              start={new THREE.Vector3(tColumnX, attachY, 0)}
              axis={new THREE.Vector3(-1, 0, 0)}
              schematicColors={schematicColors}
              color={renderColor}
              keyPrefix="t-left-beam"
            />
          )}
          {config.beamRight && (
            <MemberRenderer
              member={config.beamRight}
              start={new THREE.Vector3(tColumnX, attachY, 0)}
              axis={new THREE.Vector3(1, 0, 0)}
              schematicColors={schematicColors}
              color={renderColor}
              keyPrefix="t-right-beam"
            />
          )}
          <CouplerCube position={new THREE.Vector3(tColumnX - 0.08, attachY, 0)} />
          <CouplerCube position={new THREE.Vector3(tColumnX + 0.08, attachY, 0)} />
          <BasePlate x={tColumnX} z={0} />
        </>
      )}

      {config.kind === 'MULTI_BAY' && (
        <>
          {config.beam && (
            <MemberRenderer
              member={config.beam}
              start={new THREE.Vector3(leftX, topY, 0)}
              axis={new THREE.Vector3(1, 0, 0)}
              schematicColors={schematicColors}
              color={renderColor}
              keyPrefix="multi-beam"
            />
          )}
          {Array.from({ length: bayCount + 1 }).map((_, index) => {
            const x = leftX + (width * index) / bayCount;
            return (
              <React.Fragment key={`multi-column-${index}`}>
                <MemberRenderer
                  member={legs}
                  start={new THREE.Vector3(x, 0.04, 0)}
                  axis={new THREE.Vector3(0, 1, 0)}
                  schematicColors={schematicColors}
                  color={renderColor}
                  keyPrefix={`multi-leg-${index}`}
                />
                <CouplerCube position={new THREE.Vector3(x, topY, 0)} />
                <BasePlate x={x} z={0} />
              </React.Fragment>
            );
          })}
        </>
      )}

      {config.kind === 'BACKDROP' && config.depthMember && (
        <>
          <MemberRenderer
            member={config.depthMember}
            start={new THREE.Vector3(leftX, topY, 0)}
            axis={new THREE.Vector3(0, 0, -1)}
            schematicColors={schematicColors}
            color={renderColor}
            keyPrefix="left-depth"
          />
          <MemberRenderer
            member={config.depthMember}
            start={new THREE.Vector3(rightX, topY, 0)}
            axis={new THREE.Vector3(0, 0, -1)}
            schematicColors={schematicColors}
            color={renderColor}
            keyPrefix="right-depth"
          />
          <CouplerCube position={new THREE.Vector3(leftX, topY, -depth)} />
          <CouplerCube position={new THREE.Vector3(rightX, topY, -depth)} />
        </>
      )}

      {config.kind === 'CUSTOM' && renderCustomStructure()}

      {selected && isEditMode && (
        <mesh position={[0, Math.max(height, 0.4) / 2, config.kind === 'CUSTOM' ? 0 : -depth / 2]}>
          <boxGeometry args={[
            Math.max(config.kind === 'CUSTOM' ? customWidth : width, CROSS_SECTION) + 0.5,
            Math.max(config.kind === 'CUSTOM' ? customHeight : height, 0.4) + 0.5,
            Math.max(config.kind === 'CUSTOM' ? customDepth : depth, CROSS_SECTION) + 0.5,
          ]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Highlight />
        </mesh>
      )}
    </group>
  );
};
