import React from 'react';
import { TrussMember, TrussSegmentLength, TrussStructureConfig } from '../types';
import {
  COUPLER_LENGTH_CM,
  customMemberHasBasePlate,
  detectCustomJoints,
  formatTrussTitle,
  getCustomBounds,
  getCustomMemberStart,
  getEffectiveBayCount,
  getEffectiveBeamAttachCm,
  getEffectiveRightLeg,
  getMemberLength,
  getTrussDimensions,
  isCustomCouplerJoint,
  TRUSS_SEGMENT_COLORS,
  TRUSS_SEGMENT_LENGTHS,
} from '../trussConfig';

interface TrussDiagramProps {
  config: TrussStructureConfig;
  quantityOverride?: number;
  svgId?: string;
  className?: string;
}

const VIEWBOX_WIDTH = 1280;
const VIEWBOX_HEIGHT = 720;
const BAR = 25;
const COUPLER = 25;
const BASE_PLATE_W = 92;
const BASE_PLATE_H = 12;

const drawMemberSegments = (
  member: TrussMember,
  startX: number,
  startY: number,
  axis: 'x' | 'y',
  scale: number,
  keyPrefix: string,
  direction: 1 | -1 = 1,
) => {
  let offset = 0;
  const elements: React.ReactNode[] = [];

  member.segments.forEach((segment, index) => {
    const segmentPx = segment * scale;
    const x = axis === 'x'
      ? (direction === 1 ? startX + offset : startX - offset - segmentPx)
      : startX - BAR / 2;
    const y = axis === 'x' ? startY - BAR / 2 : startY - offset - segmentPx;
    const w = axis === 'x' ? segmentPx : BAR;
    const h = axis === 'x' ? BAR : segmentPx;
    const labelX = axis === 'x' ? x + w / 2 : startX;
    const labelY = axis === 'x' ? startY + 5 : y + h / 2 + 4;

    elements.push(
      <g key={`${keyPrefix}-segment-${index}`}>
        <rect
          x={x}
          y={y}
          width={Math.max(1, w)}
          height={Math.max(1, h)}
          fill={TRUSS_SEGMENT_COLORS[segment]}
          stroke="#111"
          strokeWidth={1.5}
        />
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          fontSize={18}
          fontWeight={700}
          fill="#111"
          transform={axis === 'y' ? `rotate(-90 ${labelX} ${labelY - 4})` : undefined}
        >
          {segment}
        </text>
      </g>
    );

    offset += segmentPx;
  });

  return elements;
};

const BasePlate = ({ x, y }: { x: number; y: number }) => (
  <rect x={x - BASE_PLATE_W / 2} y={y} width={BASE_PLATE_W} height={BASE_PLATE_H} fill="#111" />
);

const Joint = ({ x, y }: { x: number; y: number }) => (
  <rect x={x - COUPLER / 2} y={y - COUPLER / 2} width={COUPLER} height={COUPLER} fill="#111" />
);

// 90-degree corner coupler: fills the space between leg top and beam.
// y = top of coupler (same as beam centerline), extends down by couplerPx to meet the leg top.
const CornerCoupler = ({ x, y, couplerPx }: { x: number; y: number; couplerPx: number }) => (
  <rect x={x - BAR / 2} y={y} width={BAR} height={Math.max(1, couplerPx)} fill="#111" />
);

const Legend = () => (
  <g transform="translate(38 112)">
    <text x={0} y={0} fontSize={22} fontWeight={800} fill="#111">圖例</text>
    <g transform="translate(0 34)">
      <rect x={0} y={-12} width={25} height={25} fill="#111" />
      <text x={34} y={3} fontSize={16} fill="#111">對接頭</text>
    </g>
    {TRUSS_SEGMENT_LENGTHS.map((length, index) => (
      <g key={length} transform={`translate(0 ${76 + index * 42})`}>
        <rect
          x={0}
          y={-16}
          width={length === 10 ? 52 : 86}
          height={length <= 20 ? 16 : 22}
          fill={TRUSS_SEGMENT_COLORS[length]}
          stroke="#111"
          strokeWidth={1}
        />
        <text x={104} y={1} fontSize={16} fontWeight={700} fill="#111">{length}cm 段</text>
      </g>
    ))}
    <g transform={`translate(0 ${76 + TRUSS_SEGMENT_LENGTHS.length * 42})`}>
      <rect x={0} y={-13} width={86} height={12} fill="#111" />
      <text x={104} y={0} fontSize={16} fill="#111">鐵板</text>
    </g>
  </g>
);

const ViewLabel = ({ x, y, children }: { x: number; y: number; children: React.ReactNode }) => (
  <text x={x} y={y} textAnchor="middle" fontSize={18} fontWeight={800} fill="#111">{children}</text>
);

export const TrussDiagram: React.FC<TrussDiagramProps> = ({
  config,
  quantityOverride,
  svgId,
  className = '',
}) => {
  const dims = getTrussDimensions(config);
  const customMembers = config.kind === 'CUSTOM' ? config.members || [] : [];
  const customBounds = getCustomBounds(customMembers);
  const customJoints = detectCustomJoints(customMembers);
  const hasCustomDepth = customMembers.some(member => member.orientation === 'DEPTH');
  const hasSideView = Boolean((config.kind === 'BACKDROP' && config.depthMember) || (config.kind === 'CUSTOM' && hasCustomDepth));
  const contentLeft = 260;
  const contentTop = 92;
  const contentBottom = 636;
  const contentHeight = contentBottom - contentTop;
  const frontWidth = hasSideView ? 560 : 900;
  const sideWidth = hasSideView ? 280 : 0;
  const sharedScale = Math.min(
    frontWidth / Math.max(120, dims.widthCm + 80),
    contentHeight / Math.max(120, dims.heightCm + 80),
    hasSideView ? sideWidth / Math.max(120, (dims.depthCm || 0) + 80) : Infinity,
  );
  const frontScale = sharedScale;
  const sideScale = sharedScale;
  const frontDrawWidth = config.kind === 'TOWER' ? 0 : dims.widthCm * frontScale;
  const frontCenterX = contentLeft + frontWidth / 2;
  const leftX = frontCenterX - frontDrawWidth / 2;
  const rightX = frontCenterX + frontDrawWidth / 2;
  const isRectangularCornerKind = config.kind === 'GOALPOST' || config.kind === 'BACKDROP' || config.kind === 'BOX';
  const leftCornerX = isRectangularCornerKind ? leftX + COUPLER_LENGTH_CM * frontScale / 2 : leftX;
  const rightCornerX = isRectangularCornerKind ? rightX - COUPLER_LENGTH_CM * frontScale / 2 : rightX;
  const topBeamStartX = isRectangularCornerKind ? leftX + COUPLER_LENGTH_CM * frontScale : leftX;
  const bottomBeamStartX = topBeamStartX;
  const baseY = contentBottom - 18;
  const couplerPx = COUPLER_LENGTH_CM * frontScale;
  const topY = isRectangularCornerKind
    ? baseY - dims.heightCm * frontScale
    : baseY - (dims.heightCm - COUPLER_LENGTH_CM) * frontScale;
  const beamY = isRectangularCornerKind ? topY + BAR / 2 : topY;
  const bottomBeamY = baseY - BAR / 2;
  const sideX = contentLeft + frontWidth + 112;
  const sideDepthPx = (dims.depthCm || 0) * sideScale;
  const sideBaseY = contentBottom - 18;
  const sideTopY = config.kind === 'BACKDROP'
    ? sideBaseY - dims.heightCm * sideScale
    : sideBaseY - (dims.heightCm - COUPLER_LENGTH_CM) * sideScale;
  const legs = config.legs || { segments: [] };
  const rightLeg = getEffectiveRightLeg(config);
  const leftBeamCm = getMemberLength(config.beam);
  const attachY = baseY - (getEffectiveBeamAttachCm(config) + COUPLER_LENGTH_CM) * frontScale;
  const bayCount = getEffectiveBayCount(config);
  const tColumnX = config.kind === 'TSHAPE'
    ? leftX + leftBeamCm * frontScale
    : frontCenterX;
  const customLeftX = frontCenterX - (customBounds.widthCm * frontScale) / 2;

  const displayedConfig = {
    ...config,
    quantity: quantityOverride ?? config.quantity,
  };

  const renderTwoLegTopBeam = () => (
    <g>
      {drawMemberSegments(legs, leftCornerX, baseY, 'y', frontScale, 'left-leg')}
      {drawMemberSegments(rightLeg, rightCornerX, baseY, 'y', frontScale, 'right-leg')}
      {config.beam && drawMemberSegments(config.beam, topBeamStartX, beamY, 'x', frontScale, 'beam')}
      <CornerCoupler x={leftCornerX} y={topY} couplerPx={couplerPx} />
      <CornerCoupler x={rightCornerX} y={topY} couplerPx={couplerPx} />
      <BasePlate x={leftCornerX} y={baseY + 14} />
      <BasePlate x={rightCornerX} y={baseY + 14} />
    </g>
  );

  const mapCustomFrontX = (xCm: number) => customLeftX + (xCm - customBounds.minXCm) * frontScale;
  const mapCustomFrontY = (yCm: number) => baseY - (yCm - customBounds.minYCm) * frontScale;
  const mapCustomSideZ = (zCm: number) => sideX + (zCm - customBounds.minZCm) * sideScale;
  const mapCustomSideY = (yCm: number) => sideBaseY - (yCm - customBounds.minYCm) * sideScale;
  const customDepthIds = new Set(customMembers.filter(member => member.orientation === 'DEPTH').map(member => member.id));
  const customDepthJoints = customJoints.filter(joint => (
    isCustomCouplerJoint(joint, customMembers) && joint.memberIds.some(memberId => customDepthIds.has(memberId))
  ));
  const customSideVerticalIds = new Set(
    customDepthJoints.flatMap(joint => joint.memberIds)
      .filter(memberId => customMembers.some(member => member.id === memberId && member.orientation === 'VERTICAL')),
  );

  const renderCustomStructure = () => (
    <g>
      {customMembers.map((member, index) => {
        const start = getCustomMemberStart(member);
        const key = `custom-${member.id || index}`;

        if (member.orientation === 'VERTICAL') {
          return (
            <g key={key}>
              {drawMemberSegments(member, mapCustomFrontX(start.xCm), mapCustomFrontY(start.yCm), 'y', frontScale, key)}
              {customMemberHasBasePlate(member) && <BasePlate x={mapCustomFrontX(start.xCm)} y={mapCustomFrontY(start.yCm) + 14} />}
            </g>
          );
        }

        if (member.orientation === 'HORIZONTAL') {
          return drawMemberSegments(
            member,
            mapCustomFrontX(start.xCm),
            mapCustomFrontY(start.yCm),
            'x',
            frontScale,
            key,
            member.direction === -1 ? -1 : 1,
          );
        }

        return null;
      })}
      {customJoints
        .filter(joint => isCustomCouplerJoint(joint, customMembers))
        .map(joint => (
          <Joint key={joint.id} x={mapCustomFrontX(joint.xCm)} y={mapCustomFrontY(joint.yCm)} />
        ))}
    </g>
  );

  const renderCustomSideView = () => (
    <g>
      <ViewLabel x={sideX + sideDepthPx / 2} y={86}>側視圖</ViewLabel>
      {customMembers
        .filter(member => member.orientation === 'VERTICAL' && customSideVerticalIds.has(member.id))
        .map((member, index) => {
          const start = getCustomMemberStart(member);
          const key = `custom-side-vertical-${member.id || index}`;

          return (
            <g key={key}>
              {drawMemberSegments(member, mapCustomSideZ(start.zCm), mapCustomSideY(start.yCm), 'y', sideScale, key)}
              {customMemberHasBasePlate(member) && <BasePlate x={mapCustomSideZ(start.zCm)} y={mapCustomSideY(start.yCm) + 14} />}
            </g>
          );
        })}
      {customMembers
        .filter(member => member.orientation === 'DEPTH')
        .map((member, index) => {
          const start = getCustomMemberStart(member);
          return drawMemberSegments(
            member,
            mapCustomSideZ(start.zCm),
            mapCustomSideY(start.yCm),
            'x',
            sideScale,
            `custom-side-depth-${member.id || index}`,
          );
        })}
      {customDepthJoints.map(joint => (
        <Joint key={`side-${joint.id}`} x={mapCustomSideZ(joint.zCm)} y={mapCustomSideY(joint.yCm)} />
      ))}
    </g>
  );

  return (
    <svg
      id={svgId}
      className={className}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={formatTrussTitle(displayedConfig, quantityOverride)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#fff" />
      <text x={VIEWBOX_WIDTH / 2} y={46} textAnchor="middle" fontSize={30} fontWeight={900} fill="#111">
        {formatTrussTitle(displayedConfig, quantityOverride)}
      </text>
      <Legend />

      <line x1={226} y1={84} x2={226} y2={660} stroke="#ddd" strokeWidth={2} />

      <ViewLabel x={frontCenterX} y={86}>正視圖</ViewLabel>
      {config.kind === 'TOWER' && (
        <g>
          {drawMemberSegments(legs, frontCenterX, baseY, 'y', frontScale, 'tower-leg')}
          <BasePlate x={frontCenterX} y={baseY + 14} />
        </g>
      )}

      {(config.kind === 'GOALPOST' || config.kind === 'BACKDROP') && renderTwoLegTopBeam()}

      {config.kind === 'BOX' && (
        <g>
          {renderTwoLegTopBeam()}
          {config.bottomBeam && drawMemberSegments(config.bottomBeam, bottomBeamStartX, bottomBeamY, 'x', frontScale, 'bottom-beam')}
          <Joint x={leftCornerX} y={bottomBeamY} />
          <Joint x={rightCornerX} y={bottomBeamY} />
        </g>
      )}

      {config.kind === 'LSHAPE' && (
        <g>
          {drawMemberSegments(legs, leftX, baseY, 'y', frontScale, 'l-leg')}
          {config.beam && drawMemberSegments(config.beam, leftX, attachY, 'x', frontScale, 'l-beam')}
          <CornerCoupler x={leftX} y={attachY} couplerPx={couplerPx} />
          <BasePlate x={leftX} y={baseY + 14} />
        </g>
      )}

      {config.kind === 'TSHAPE' && (
        <g>
          {drawMemberSegments(legs, tColumnX, baseY, 'y', frontScale, 't-leg')}
          {config.beam && drawMemberSegments(config.beam, tColumnX, attachY, 'x', frontScale, 't-left-beam', -1)}
          {config.beamRight && drawMemberSegments(config.beamRight, tColumnX, attachY, 'x', frontScale, 't-right-beam')}
          <CornerCoupler x={tColumnX} y={attachY} couplerPx={couplerPx} />
          <BasePlate x={tColumnX} y={baseY + 14} />
        </g>
      )}

      {config.kind === 'MULTI_BAY' && (
        <g>
          {config.beam && drawMemberSegments(config.beam, leftX, topY, 'x', frontScale, 'multi-beam')}
          {Array.from({ length: bayCount + 1 }).map((_, index) => {
              const x = leftX + (frontDrawWidth * index) / bayCount;
              return (
                <g key={`multi-column-${index}`}>
                {drawMemberSegments(legs, x, baseY, 'y', frontScale, `multi-leg-${index}`)}
                <CornerCoupler x={x} y={topY} couplerPx={couplerPx} />
                <BasePlate x={x} y={baseY + 14} />
              </g>
            );
          })}
        </g>
      )}

      {config.kind === 'CUSTOM' && renderCustomStructure()}

      {hasSideView && config.kind === 'BACKDROP' && config.depthMember && (
        <g>
          <ViewLabel x={sideX + sideDepthPx / 2} y={86}>側視圖</ViewLabel>
          {drawMemberSegments(legs, sideX, sideBaseY, 'y', sideScale, 'side-leg')}
          {drawMemberSegments(config.depthMember, sideX, sideTopY + BAR / 2, 'x', sideScale, 'depth')}
          <Joint x={sideX} y={sideTopY + BAR / 2} />
          <Joint x={sideX + sideDepthPx} y={sideTopY + BAR / 2} />
          <BasePlate x={sideX} y={sideBaseY + 14} />
        </g>
      )}

      {hasSideView && config.kind === 'CUSTOM' && renderCustomSideView()}

      <text x={frontCenterX} y={690} textAnchor="middle" fontSize={16} fill="#444">
        W {dims.widthCm}cm × H {dims.heightCm}cm
      </text>
      {hasSideView && (
        <text x={sideX + sideDepthPx / 2} y={690} textAnchor="middle" fontSize={16} fill="#444">
          D {dims.depthCm}cm × H {dims.heightCm}cm
        </text>
      )}
    </svg>
  );
};

export const TRUSS_DIAGRAM_VIEWBOX = {
  width: VIEWBOX_WIDTH,
  height: VIEWBOX_HEIGHT,
};
