import React, { useMemo, useEffect } from 'react';
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
  isCustomCouplerJoint,
  TRUSS_SEGMENT_COLORS,
  COUPLER_LENGTH_CM,
  splitMemberIntoBays,
} from '../../trussConfig';
import { Highlight } from './shared';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

interface TrussStructureModelProps {
  config: TrussStructureConfig;
  selected: boolean;
  isEditMode?: boolean;
  schematicColors?: boolean;
  color?: string;
}

const CROSS_SECTION = 0.3;
const TUBE_RADIUS = 0.025;
const COUPLER_SIZE = COUPLER_LENGTH_CM / 100;

const toMeters = (cm: number) => cm / 100;

/**
 * Normalizes geometry to non-indexed representation before merging,
 * ensuring index-attribute compatibility across all Three.js BufferGeometries.
 */
function toNonIndexedAndDispose(geom: THREE.BufferGeometry): THREE.BufferGeometry {
  if (geom.index) {
    const nonIndexed = geom.toNonIndexed();
    geom.dispose();
    return nonIndexed;
  }
  return geom;
}

/**
 * Builds a single merged BufferGeometry for a single box truss segment.
 * The segment runs along the X-axis from -length/2 to +length/2,
 * with its nominal cross-section centered at Y = 0, Z = 0.
 *
 * Details:
 * - 4 main chord tubes with 14 radial segments for smooth roundness.
 * - Machined end connection collar sleeves (radius 0.0285m) and conical spigot locator bosses.
 * - Rigid transverse end square perimeter frames.
 * - 4-sided diagonal V-truss bracing on Front (+Z), Back (-Z), Top (+Y), and Bottom (-Y) faces.
 * - Intermediate perimeter square frame rings between bays for structural plausibility.
 */
function buildTrussSegmentGeometry(length: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const half = CROSS_SECTION / 2 - TUBE_RADIUS;
  const tubeRadius = TUBE_RADIUS; // 0.025m
  const braceRadius = 0.01; // 20mm diameter brace tube
  const radialSegments = 14;

  const corners: [number, number][] = [
    [-half, -half],
    [half, -half],
    [-half, half],
    [half, half],
  ];

  // 1. Four main chords along X-axis
  corners.forEach(([y, z]) => {
    const chord = new THREE.CylinderGeometry(tubeRadius, tubeRadius, length, radialSegments);
    chord.rotateZ(Math.PI / 2);
    chord.translate(0, y, z);
    parts.push(chord);
  });

  // 2. Machined end spigot sleeve collars and conical spigot bosses on every chord end
  const collarLength = Math.min(0.032, length * 0.15);
  const collarRadius = tubeRadius + 0.0035; // 0.0285m
  const spigotLength = Math.min(0.014, length * 0.08);
  const spigotRadius = tubeRadius - 0.003; // 0.022m

  [-length / 2, length / 2].forEach((endX, endIdx) => {
    const dir = endIdx === 0 ? 1 : -1;
    const collarCenterX = endX + dir * (collarLength / 2);
    const spigotCenterX = endX + dir * (spigotLength / 2);

    corners.forEach(([y, z]) => {
      // Sleeve collar
      const collar = new THREE.CylinderGeometry(collarRadius, collarRadius, collarLength, radialSegments);
      collar.rotateZ(Math.PI / 2);
      collar.translate(collarCenterX, y, z);
      parts.push(collar);

      // Conical spigot boss
      const spigot = new THREE.CylinderGeometry(spigotRadius * 0.88, spigotRadius, spigotLength, radialSegments);
      spigot.rotateZ(Math.PI / 2);
      spigot.translate(spigotCenterX, y, z);
      parts.push(spigot);
    });
  });

  // Helper for adding brace tube between two 3D points
  const addTube = (
    p1: [number, number, number],
    p2: [number, number, number],
    r: number,
    segs = 10
  ) => {
    const a = new THREE.Vector3(...p1);
    const b = new THREE.Vector3(...p2);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 0.001) return;
    const tube = new THREE.CylinderGeometry(r, r, len, segs);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    tube.applyQuaternion(quat);
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    tube.translate(mid.x, mid.y, mid.z);
    parts.push(tube);
  };

  // 3. Transverse square perimeter frames at each end
  [-length / 2 + collarLength, length / 2 - collarLength].forEach((x) => {
    addTube([x, -half, -half], [x, -half, half], braceRadius, 10);
    addTube([x, half, -half], [x, half, half], braceRadius, 10);
    addTube([x, -half, -half], [x, half, -half], braceRadius, 10);
    addTube([x, -half, half], [x, half, half], braceRadius, 10);
  });

  // 4. Four-sided diagonal webbing
  if (length > 0.25) {
    const numBays = Math.max(1, Math.round(length / 0.45));
    const bayLen = length / numBays;

    for (let s = 0; s < numBays; s++) {
      const x0 = -length / 2 + s * bayLen;
      const x1 = x0 + bayLen / 2;
      const x2 = x0 + bayLen;

      // Front face (+Z = half)
      addTube([x0, -half, half], [x1, half, half], braceRadius, 10);
      addTube([x1, half, half], [x2, -half, half], braceRadius, 10);

      // Back face (-Z = -half)
      addTube([x0, -half, -half], [x1, half, -half], braceRadius, 10);
      addTube([x1, half, -half], [x2, -half, -half], braceRadius, 10);

      // Top face (+Y = half)
      addTube([x0, half, -half], [x1, half, half], braceRadius, 10);
      addTube([x1, half, half], [x2, half, -half], braceRadius, 10);

      // Bottom face (-Y = -half)
      addTube([x0, -half, -half], [x1, -half, half], braceRadius, 10);
      addTube([x1, -half, half], [x2, -half, -half], braceRadius, 10);

      // Intermediate transverse perimeter frame at bay boundaries
      if (s > 0) {
        addTube([x0, -half, -half], [x0, -half, half], braceRadius * 0.95, 10);
        addTube([x0, half, -half], [x0, half, half], braceRadius * 0.95, 10);
        addTube([x0, -half, -half], [x0, half, -half], braceRadius * 0.95, 10);
        addTube([x0, -half, half], [x0, half, half], braceRadius * 0.95, 10);
      }
    }
  } else if (length > 0.12) {
    // Short segments (e.g. 20cm): center transverse cross struts
    addTube([0, -half, -half], [0, half, half], braceRadius, 10);
    addTube([0, -half, half], [0, half, -half], braceRadius, 10);
  }

  const normalizedParts = parts.map(toNonIndexedAndDispose);
  const merged = mergeGeometries(normalizedParts)!;
  normalizedParts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Standard discrete section lengths in meters corresponding to TRUSS_SEGMENT_LENGTHS (200, 150, 100, 50, 20, 10 cm).
 * Only these finite standard lengths are kept in the global cache.
 */
const STANDARD_LENGTHS_M = new Set([2.0, 1.5, 1.0, 0.5, 0.2, 0.1]);

const standardSegmentGeometryCache = new Map<number, THREE.BufferGeometry>();

export function getStandardTrussSegmentGeometry(length: number): THREE.BufferGeometry {
  const key = Math.round(length * 100) / 100;
  let geom = standardSegmentGeometryCache.get(key);
  if (!geom) {
    geom = buildTrussSegmentGeometry(key);
    standardSegmentGeometryCache.set(key, geom);
  }
  return geom;
}

// Open welded corner cage; its logical span matches the engineering connector.
const couplerBlockGeometry: THREE.BufferGeometry = (() => {
  const parts: THREE.BufferGeometry[] = [];
  const half = COUPLER_SIZE / 2;
  for (const axis of [0, 1, 2]) {
    for (const a of [-half, half]) {
      for (const b of [-half, half]) {
        const tube = new THREE.CylinderGeometry(TUBE_RADIUS, TUBE_RADIUS, COUPLER_SIZE, 14);
        if (axis === 0) tube.rotateZ(Math.PI / 2);
        if (axis === 2) tube.rotateX(Math.PI / 2);
        const center = [0, 0, 0];
        center[(axis + 1) % 3] = a;
        center[(axis + 2) % 3] = b;
        tube.translate(center[0], center[1], center[2]);
        parts.push(tube);
      }
    }
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  return merged;
})();

/**
 * Static Heavy Steel Truss Base Plate Geometry:
 * 0.72m x 0.52m steel plate with 4 welded standoff spigots matching truss column chords.
 */
const trussBasePlateGeometry: THREE.BufferGeometry = (() => {
  const parts: THREE.BufferGeometry[] = [];
  const half = CROSS_SECTION / 2; // 0.15m

  // Heavy steel base plate (0.72m x 0.032m x 0.52m)
  // Sits from y = -0.024 to y = 0.008 (nominal center y = 0.025 relative to floor)
  const plate = new RoundedBoxGeometry(0.72, 0.032, 0.52, 2, 0.016);
  plate.translate(0, -0.008, 0);
  parts.push(plate);

  // 4 welded column standoff spigots matching truss chords
  const spigotRadius = 0.026;
  const spigotHeight = 0.032;
  const corners: [number, number][] = [
    [-half, -half],
    [half, -half],
    [-half, half],
    [half, half],
  ];

  corners.forEach(([cx, cz]) => {
    // Welded collar sleeve
    const spigot = new THREE.CylinderGeometry(spigotRadius, spigotRadius, spigotHeight, 12);
    spigot.translate(cx, 0.016, cz);
    parts.push(spigot);

    // Conical locator pin
    const pin = new THREE.CylinderGeometry(0.018, 0.022, 0.014, 12);
    pin.translate(cx, 0.034, cz);
    parts.push(pin);
  });

  // 4 rubber leveling feet under plate
  [
    [-0.30, -0.20],
    [0.30, -0.20],
    [-0.30, 0.20],
    [0.30, 0.20],
  ].forEach(([fx, fz]) => {
    const foot = new THREE.CylinderGeometry(0.022, 0.022, 0.008, 10);
    foot.translate(fx, -0.024 + 0.004, fz);
    parts.push(foot);
  });

  const normalizedParts = parts.map(toNonIndexedAndDispose);
  const merged = mergeGeometries(normalizedParts)!;
  normalizedParts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
})();

const CouplerCube: React.FC<{ position: THREE.Vector3 }> = ({ position }) => (
  <mesh position={position} geometry={couplerBlockGeometry} castShadow>
    <meshStandardMaterial color="#a1a5ad" metalness={0.82} roughness={0.25} />
  </mesh>
);

const BasePlate: React.FC<{ x: number; z: number; y?: number }> = ({ x, z, y = 0.025 }) => (
  <mesh position={[x, y, z]} geometry={trussBasePlateGeometry} receiveShadow castShadow>
    <meshStandardMaterial color="#222228" metalness={0.72} roughness={0.32} />
  </mesh>
);

/**
 * Single SegmentTruss Mesh:
 * Renders the entire truss segment in a SINGLE draw call.
 * Uses finite shared cache for standard section lengths (2.0, 1.5, 1.0, 0.5, 0.2, 0.1m).
 * Non-standard custom lengths are component-owned and disposed on unmount.
 */
const SegmentTruss: React.FC<{
  length: number;
  color: string;
}> = ({ length, color }) => {
  const roundedLength = Math.round(length * 100) / 100;
  const isStandard = STANDARD_LENGTHS_M.has(roundedLength);

  const geometry = useMemo(() => {
    if (isStandard) {
      return getStandardTrussSegmentGeometry(roundedLength);
    }
    return buildTrussSegmentGeometry(length);
  }, [length, roundedLength, isStandard]);

  useEffect(() => {
    if (!isStandard) {
      return () => {
        geometry.dispose();
      };
    }
  }, [geometry, isStandard]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} metalness={0.82} roughness={0.22} />
    </mesh>
  );
};

const OrientedSegment: React.FC<{
  start: THREE.Vector3;
  axis: THREE.Vector3;
  offset: number;
  lengthCm: TrussSegmentLength;
  color: string;
}> = ({ start, axis, offset, lengthCm, color }) => {
  const length = toMeters(lengthCm);
  const { center, quaternion } = useMemo(() => {
    const axisUnit = axis.clone().normalize();
    const centerPos = start.clone().add(axisUnit.clone().multiplyScalar(offset + length / 2));
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), axisUnit);
    return { center: centerPos, quaternion: quat };
  }, [start.x, start.y, start.z, axis.x, axis.y, axis.z, offset, length]);

  return (
    <group position={center} quaternion={quaternion}>
      <SegmentTruss length={length} color={color} />
    </group>
  );
};

const MemberRenderer: React.FC<{
  member: TrussMember;
  start: THREE.Vector3;
  axis: THREE.Vector3;
  schematicColors?: boolean;
  color: string;
  keyPrefix: string;
}> = ({ member, start, axis, schematicColors, color, keyPrefix }) => {
  let offset = 0;

  return (
    <group>
      {member.segments.map((segment, index) => {
        const segmentColor = schematicColors ? TRUSS_SEGMENT_COLORS[segment] : color;
        const currentOffset = offset;
        offset += toMeters(segment);

        return (
          <React.Fragment key={`${keyPrefix}-${index}`}>
            <OrientedSegment
              start={start}
              axis={axis}
              offset={currentOffset}
              lengthCm={segment}
              color={segmentColor}
            />
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
  const leftX = -width / 2 + COUPLER_SIZE / 2;
  const rightX = width / 2 - COUPLER_SIZE / 2;
  const legs = config.legs || { segments: [] };
  const rightLeg = getEffectiveRightLeg(config);
  const legBaseY = 0.04 + (config.kind === 'BOX' ? COUPLER_SIZE : 0);
  const bottomY = 0.04 + COUPLER_SIZE / 2;
  const topY = height + 0.04 - COUPLER_SIZE / 2;
  const attachY = toMeters(getEffectiveBeamAttachCm(config)) + 0.04 + COUPLER_SIZE / 2;
  const leftBeamLength = toMeters(getMemberLength(config.beam));
  const couplerMeters = toMeters(COUPLER_LENGTH_CM);
  const bayCount = getEffectiveBayCount(config);
  const tColumnX = config.kind === 'TSHAPE' ? leftX + leftBeamLength : 0;
  const customMembers = config.kind === 'CUSTOM' ? config.members || [] : [];
  const customBounds = getCustomBounds(customMembers);
  const customCenterX = (customBounds.minXCm + customBounds.maxXCm) / 2;
  const customCenterZ = (customBounds.minZCm + customBounds.maxZCm) / 2;
  const customHeight = toMeters(customBounds.heightCm);
  const customWidth = toMeters(customBounds.widthCm);
  const customDepth = toMeters(customBounds.depthCm);

  // Stable vectors for standard directions
  const vUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const vRight = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const vLeft = useMemo(() => new THREE.Vector3(-1, 0, 0), []);
  const vDepth = useMemo(() => new THREE.Vector3(0, 0, -1), []);

  const leftLegStart = useMemo(() => new THREE.Vector3(leftX, legBaseY, 0), [leftX, legBaseY]);
  const rightLegStart = useMemo(() => new THREE.Vector3(rightX, legBaseY, 0), [rightX, legBaseY]);
  const beamStart = useMemo(() => new THREE.Vector3(leftX + COUPLER_SIZE / 2, topY, 0), [leftX, topY]);
  const leftCouplerPos = useMemo(() => new THREE.Vector3(leftX, topY, 0), [leftX, topY]);
  const rightCouplerPos = useMemo(() => new THREE.Vector3(rightX, topY, 0), [rightX, topY]);

  const customToVector = (xCm: number, yCm: number, zCm = 0) =>
    new THREE.Vector3(
      toMeters(xCm - customCenterX),
      toMeters(yCm - customBounds.minYCm) + 0.04,
      -toMeters(zCm - customCenterZ)
    );

  const customMemberAxis = (member: (typeof customMembers)[number]) => {
    if (member.orientation === 'VERTICAL') return vUp;
    if (member.orientation === 'DEPTH') return vDepth;
    return member.direction === -1 ? vLeft : vRight;
  };

  const renderTwoLegFrame = () => (
    <>
      <MemberRenderer
        member={legs}
        start={leftLegStart}
        axis={vUp}
        schematicColors={schematicColors}
        color={renderColor}
        keyPrefix="left-leg"
      />
      <MemberRenderer
        member={rightLeg}
        start={rightLegStart}
        axis={vUp}
        schematicColors={schematicColors}
        color={renderColor}
        keyPrefix="right-leg"
      />
      {config.beam && (
        <MemberRenderer
          member={config.beam}
          start={beamStart}
          axis={vRight}
          schematicColors={schematicColors}
          color={renderColor}
          keyPrefix="beam"
        />
      )}
      <CouplerCube position={leftCouplerPos} />
      <CouplerCube position={rightCouplerPos} />
      <BasePlate x={leftX} z={0} />
      <BasePlate x={rightX} z={0} />
    </>
  );

  const interMemberJoints = useMemo(() => {
    if (config.kind !== 'CUSTOM') return [];
    return detectCustomJoints(customMembers).filter((joint) => isCustomCouplerJoint(joint, customMembers));
  }, [config.kind, customMembers]);

  const renderCustomStructure = () => (
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
      {interMemberJoints.map((joint) => (
        <CouplerCube key={joint.id} position={customToVector(joint.xCm, joint.yCm, joint.zCm)} />
      ))}
    </>
  );

  const multiBayData = useMemo(() => {
    if (config.kind !== 'MULTI_BAY') return null;
    const bayMembers = splitMemberIntoBays(config.beam, bayCount);
    let beamCursorX = -width / 2 + couplerMeters;
    let columnCursorX = -width / 2 + couplerMeters / 2;

    const beamStarts = bayMembers.map((bayMember) => {
      const startX = beamCursorX;
      beamCursorX += toMeters(getMemberLength(bayMember)) + couplerMeters;
      return startX;
    });

    const columnXs = Array.from({ length: bayCount + 1 }).map((_, index) => {
      const x = columnCursorX;
      columnCursorX += (index < bayMembers.length ? toMeters(getMemberLength(bayMembers[index])) : 0) + couplerMeters;
      return x;
    });

    return { bayMembers, beamStarts, columnXs };
  }, [config.kind, config.beam, bayCount, width, couplerMeters]);

  return (
    <group>
      {config.kind === 'TOWER' && (
        <>
          <MemberRenderer
            member={legs}
            start={new THREE.Vector3(0, 0.04, 0)}
            axis={vUp}
            schematicColors={schematicColors}
            color={renderColor}
            keyPrefix="tower-leg"
          />
          <BasePlate x={0} z={0} />
        </>
      )}

      {(config.kind === 'GOALPOST' || config.kind === 'BACKDROP') && renderTwoLegFrame()}

      {config.kind === 'BOX' && (
        <>
          {renderTwoLegFrame()}
          {config.bottomBeam && (
            <MemberRenderer
              member={config.bottomBeam}
              start={new THREE.Vector3(leftX + COUPLER_SIZE / 2, bottomY, 0)}
              axis={vRight}
              schematicColors={schematicColors}
              color={renderColor}
              keyPrefix="bottom-beam"
            />
          )}
          <CouplerCube position={new THREE.Vector3(leftX, bottomY, 0)} />
          <CouplerCube position={new THREE.Vector3(rightX, bottomY, 0)} />
        </>
      )}

      {config.kind === 'LSHAPE' && (
        <>
          <MemberRenderer
            member={legs}
            start={new THREE.Vector3(leftX, 0.04, 0)}
            axis={vUp}
            schematicColors={schematicColors}
            color={renderColor}
            keyPrefix="l-leg"
          />
          {config.beam && (
            <MemberRenderer
              member={config.beam}
              start={new THREE.Vector3(leftX + COUPLER_SIZE / 2, attachY, 0)}
              axis={vRight}
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
            axis={vUp}
            schematicColors={schematicColors}
            color={renderColor}
            keyPrefix="t-leg"
          />
          {config.beam && (
            <MemberRenderer
              member={config.beam}
              start={new THREE.Vector3(tColumnX - COUPLER_SIZE / 2, attachY, 0)}
              axis={vLeft}
              schematicColors={schematicColors}
              color={renderColor}
              keyPrefix="t-left-beam"
            />
          )}
          {config.beamRight && (
            <MemberRenderer
              member={config.beamRight}
              start={new THREE.Vector3(tColumnX + COUPLER_SIZE / 2, attachY, 0)}
              axis={vRight}
              schematicColors={schematicColors}
              color={renderColor}
              keyPrefix="t-right-beam"
            />
          )}
          <CouplerCube position={new THREE.Vector3(tColumnX, attachY, 0)} />
          <BasePlate x={tColumnX} z={0} />
        </>
      )}

      {config.kind === 'MULTI_BAY' && multiBayData && (
        <>
          {multiBayData.bayMembers.map((bayMember, index) => (
            <MemberRenderer
              key={`multi-beam-${index}`}
              member={bayMember}
              start={new THREE.Vector3(multiBayData.beamStarts[index], topY, 0)}
              axis={vRight}
              schematicColors={schematicColors}
              color={renderColor}
              keyPrefix={`multi-beam-${index}`}
            />
          ))}
          {multiBayData.columnXs.map((x, index) => (
            <React.Fragment key={`multi-column-${index}`}>
              <MemberRenderer
                member={legs}
                start={new THREE.Vector3(x, 0.04, 0)}
                axis={vUp}
                schematicColors={schematicColors}
                color={renderColor}
                keyPrefix={`multi-leg-${index}`}
              />
              <CouplerCube position={new THREE.Vector3(x, topY, 0)} />
              <BasePlate x={x} z={0} />
            </React.Fragment>
          ))}
        </>
      )}

      {config.kind === 'BACKDROP' && config.depthMember && (
        <>
          <MemberRenderer
            member={config.depthMember}
            start={new THREE.Vector3(leftX, topY, 0)}
            axis={vDepth}
            schematicColors={schematicColors}
            color={renderColor}
            keyPrefix="left-depth"
          />
          <MemberRenderer
            member={config.depthMember}
            start={new THREE.Vector3(rightX, topY, 0)}
            axis={vDepth}
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
          <boxGeometry
            args={[
              Math.max(config.kind === 'CUSTOM' ? customWidth : width, CROSS_SECTION) + 0.5,
              Math.max(config.kind === 'CUSTOM' ? customHeight : height, 0.4) + 0.5,
              Math.max(config.kind === 'CUSTOM' ? customDepth : depth, CROSS_SECTION) + 0.5,
            ]}
          />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Highlight />
        </mesh>
      )}
    </group>
  );
};
