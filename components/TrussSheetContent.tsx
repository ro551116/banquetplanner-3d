import React from 'react';
import { Download } from 'lucide-react';
import { TrussStructureConfig } from '../types';
import {
  calculateTrussBom,
  formatTrussTitle,
  TRUSS_SEGMENT_COLORS,
  TRUSS_SEGMENT_LENGTHS,
  TrussBom,
} from '../trussConfig';
import { TrussDiagram, TRUSS_DIAGRAM_VIEWBOX } from './TrussDiagram';

export const downloadSvgAsPng = async (svg: SVGSVGElement, filename: string) => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', `${TRUSS_DIAGRAM_VIEWBOX.width}`);
  clone.setAttribute('height', `${TRUSS_DIAGRAM_VIEWBOX.height}`);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const svgText = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = TRUSS_DIAGRAM_VIEWBOX.width;
        canvas.height = TRUSS_DIAGRAM_VIEWBOX.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
        canvas.toBlob(pngBlob => {
          if (!pngBlob) {
            reject(new Error('PNG export failed'));
            return;
          }
          const pngUrl = URL.createObjectURL(pngBlob);
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(pngUrl);
          resolve();
        }, 'image/png');
      };
      image.onerror = () => reject(new Error('SVG render failed'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const safeFilename = (name: string) => name
  .replace(/[\\/:*?"<>|]/g, '-')
  .replace(/\s+/g, '-')
  .slice(0, 80);

interface TrussCardProps {
  diagramKey: string;
  config: TrussStructureConfig;
  quantity?: number;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  downloadFilename?: string;
  className?: string;
}

export const TrussCard: React.FC<TrussCardProps> = ({
  diagramKey,
  config,
  quantity,
  subtitle,
  actions,
  downloadFilename,
  className = '',
}) => {
  const effectiveQuantity = quantity ?? config.quantity;
  const title = formatTrussTitle(config, effectiveQuantity);
  const bom = calculateTrussBom(config, effectiveQuantity);
  const svgId = `truss-diagram-${diagramKey}`;

  const handleDownload = async () => {
    const svg = document.getElementById(svgId) as unknown as SVGSVGElement | null;
    if (!svg) return;
    await downloadSvgAsPng(svg, downloadFilename ?? `${safeFilename(title)}.png`);
  };

  return (
    <section className={`truss-print-card bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      <div className="truss-no-print flex flex-col gap-3 px-4 py-3 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800 truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-slate-500">{subtitle}</div>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          <button
            onClick={handleDownload}
            className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            PNG
          </button>
        </div>
      </div>
      <div className="aspect-[16/9] bg-white">
        <TrussDiagram
          svgId={svgId}
          config={config}
          quantityOverride={effectiveQuantity}
        />
      </div>
      <div className="truss-no-print grid grid-cols-8 gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50">
        {TRUSS_SEGMENT_LENGTHS.map(length => (
          <div key={length} className="text-[11px] text-slate-600">
            <span className="inline-block w-3 h-2 mr-1 border border-slate-300" style={{ backgroundColor: TRUSS_SEGMENT_COLORS[length] }} />
            {length}: <b>{bom.segments[length]}</b>
          </div>
        ))}
        <div className="text-[11px] text-slate-600">對接頭: <b>{bom.couplers}</b></div>
        <div className="text-[11px] text-slate-600">鐵板: <b>{bom.basePlates}</b></div>
      </div>
    </section>
  );
};

interface TrussBomSummaryProps {
  bom: TrussBom;
  title?: string;
  className?: string;
  printable?: boolean;
}

export const TrussBomSummary: React.FC<TrussBomSummaryProps> = ({
  bom,
  title = 'BOM 總表',
  className = '',
  printable = false,
}) => (
  <section className={`${printable ? '' : 'truss-no-print'} bg-white rounded-lg border border-slate-200 shadow-sm p-4 ${className}`}>
    <h4 className="text-xs font-bold text-slate-700 mb-3">{title}</h4>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {TRUSS_SEGMENT_LENGTHS.map(length => (
        <div key={length} className="flex items-center justify-between border border-slate-100 rounded-md px-3 py-2 text-xs">
          <span className="flex items-center gap-2">
            <span className="w-6 h-3 border border-slate-300" style={{ backgroundColor: TRUSS_SEGMENT_COLORS[length] }} />
            {length}cm
          </span>
          <b>{bom.segments[length]}</b>
        </div>
      ))}
      <div className="flex items-center justify-between border border-slate-100 rounded-md px-3 py-2 text-xs">
        <span>對接頭</span>
        <b>{bom.couplers}</b>
      </div>
      <div className="flex items-center justify-between border border-slate-100 rounded-md px-3 py-2 text-xs">
        <span>鐵板</span>
        <b>{bom.basePlates}</b>
      </div>
    </div>
  </section>
);
