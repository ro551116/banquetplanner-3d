import React from 'react';
import { TrussMember, TrussSegmentLength, TrussStructureConfig } from '../types';
import {
  formatTrussTitle,
  getTrussDimensions,
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
const BAR = 28;
const COUPLER = 20;
const BASE_PLATE_W = 92;
const BASE_PLATE_H = 12;

const drawMemberSegments = (
  member: TrussMember,
  startX: number,
  startY: number,
  axis: 'x' | 'y',
  scale: number,
  keyPrefix: string,
) => {
  let offset = 0;
  const elements: React.ReactNode[] = [];

  member.segments.forEach((segment, index) => {
    const segmentPx = segment * scale;
    const x = axis === 'x' ? startX + offset : startX - BAR / 2;
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

    if (index < member.segments.length - 1) {
      const cx = axis === 'x' ? startX + offset + segmentPx : startX;
      const cy = axis === 'x' ? startY : startY - offset - segmentPx;
      elements.push(
        <rect
          key={`${keyPrefix}-coupler-${index}`}
          x={cx - COUPLER / 2}
          y={cy - COUPLER / 2}
          width={COUPLER}
          height={COUPLER}
          fill="#111"
        />
      );
    }

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

const Legend = () => (
  <g transform="translate(38 112)">
    <text x={0} y={0} fontSize={22} fontWeight={800} fill="#111">圖例</text>
    <g transform="translate(0 34)">
      <rect x={0} y={-12} width={18} height={18} fill="#111" />
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
  const hasSideView = config.kind === 'BACKDROP' && config.depthMember;
  const contentLeft = 260;
  const contentTop = 92;
  const contentBottom = 636;
  const contentHeight = contentBottom - contentTop;
  const frontWidth = hasSideView ? 560 : 900;
  const sideWidth = hasSideView ? 280 : 0;
  // 正視圖與側視圖共用同一比例尺，等高的結構在兩張圖中必須等高
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
  const baseY = contentBottom - 18;
  const topY = baseY - dims.heightCm * frontScale;
  const sideX = contentLeft + frontWidth + 112;
  const sideDepthPx = (dims.depthCm || 0) * sideScale;
  const sideBaseY = contentBottom - 18;
  const sideTopY = sideBaseY - dims.heightCm * sideScale;

  const displayedConfig = {
    ...config,
    quantity: quantityOverride ?? config.quantity,
  };

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
      {config.kind === 'TOWER' ? (
        <g>
          {drawMemberSegments(config.legs, frontCenterX, baseY, 'y', frontScale, 'tower-leg')}
          <BasePlate x={frontCenterX} y={baseY + 14} />
        </g>
      ) : (
        <g>
          {drawMemberSegments(config.legs, leftX, baseY, 'y', frontScale, 'left-leg')}
          {drawMemberSegments(config.legs, rightX, baseY, 'y', frontScale, 'right-leg')}
          {config.beam && drawMemberSegments(config.beam, leftX, topY, 'x', frontScale, 'beam')}
          <Joint x={leftX} y={topY} />
          <Joint x={rightX} y={topY} />
          <BasePlate x={leftX} y={baseY + 14} />
          <BasePlate x={rightX} y={baseY + 14} />
        </g>
      )}

      {hasSideView && config.depthMember && (
        <g>
          <ViewLabel x={sideX + sideDepthPx / 2} y={86}>側視圖</ViewLabel>
          {drawMemberSegments(config.legs, sideX, sideBaseY, 'y', sideScale, 'side-leg')}
          {drawMemberSegments(config.depthMember, sideX, sideTopY, 'x', sideScale, 'depth')}
          <Joint x={sideX} y={sideTopY} />
          <Joint x={sideX + sideDepthPx} y={sideTopY} />
          <BasePlate x={sideX} y={sideBaseY + 14} />
        </g>
      )}

      <text x={frontCenterX} y={690} textAnchor="middle" fontSize={16} fill="#444">
        W {config.kind === 'TOWER' ? 30 : dims.widthCm}cm × H {dims.heightCm}cm
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
