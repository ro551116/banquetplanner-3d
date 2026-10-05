import React, { useEffect, useRef } from 'react';
import { Download, FileDown, Printer, X } from 'lucide-react';
import { BanquetObject } from '../types';
import {
  formatTrussTitle,
  getTrussGroups,
  summarizeTrussBom,
} from '../trussConfig';
import {
  downloadSvgAsPng,
  safeFilename,
  TrussBomSummary,
  TrussCard,
} from './TrussSheetContent';

interface TrussSheetModalProps {
  objects: BanquetObject[];
  onClose: () => void;
}

export const TrussSheetModal: React.FC<TrussSheetModalProps> = ({ objects, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('keydown', handleEscape, true);
      previousFocus?.focus();
    };
  }, [onClose]);
  const groups = getTrussGroups(objects);
  const totalBom = summarizeTrussBom(objects);

  const handleDownloadOne = async (key: string, title: string) => {
    const svg = document.getElementById(`truss-diagram-${key}`) as unknown as SVGSVGElement | null;
    if (!svg) return;
    await downloadSvgAsPng(svg, `${safeFilename(title)}.png`);
  };

  const handleDownloadAll = async () => {
    for (const group of groups) {
      await handleDownloadOne(group.key, formatTrussTitle(group.config, group.quantity));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm flex items-center justify-center p-4">
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            .truss-print-area, .truss-print-area * { visibility: visible; }
            .truss-print-area { position: absolute; inset: 0; background: white; overflow: visible !important; }
            .truss-no-print { display: none !important; }
            .truss-print-card { break-after: page; page-break-after: always; box-shadow: none !important; border: 0 !important; }
          }
        `}
      </style>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="truss-sheet-title" tabIndex={-1} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden outline-none">
        <div className="truss-no-print flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 id="truss-sheet-title" className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <FileDown className="w-4 h-4 text-blue-600" />
            Truss 結構圖
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAll}
              disabled={groups.length === 0}
              className="ui-btn-primary"
            >
              <Download className="w-3.5 h-3.5" />
              全部 PNG
            </button>
            <button
              onClick={() => window.print()}
              disabled={groups.length === 0}
              className="ui-btn-secondary"
            >
              <Printer className="w-3.5 h-3.5" />
              列印
            </button>
            <button onClick={onClose} className="ui-icon-btn" aria-label="關閉">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="truss-print-area flex-1 overflow-y-auto bg-slate-100 p-4 space-y-4">
          {groups.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-sm text-slate-500">
              場景中尚無 Truss 結構。
            </div>
          ) : (
            groups.map(group => (
              <TrussCard
                key={group.key}
                diagramKey={group.key}
                config={group.config}
                quantity={group.quantity}
                subtitle={`場景物件 ${group.objects.length} 座`}
              />
            ))
          )}

          {groups.length > 0 && (
            <TrussBomSummary bom={totalBom} />
          )}
        </div>
      </div>
    </div>
  );
};
