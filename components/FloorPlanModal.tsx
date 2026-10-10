import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Download, FileDown, FileSpreadsheet, Printer, X } from 'lucide-react';
import { BanquetObject, DeviceSystem, DrawingPath, HallConfig, ObjectType, PlanInfo } from '../types';
import { buildDevicePointCsv, buildFloorPlanSvg, countDevicePoints } from '../floorPlan';
import { DEVICE_SYSTEMS, DEVICE_SYSTEM_ORDER } from '../planning';
import { TextField } from './ui/NumberField';
import { safeFilename } from './TrussSheetContent';

export interface FloorPlanModalProps {
  hall: HallConfig;
  objects: BanquetObject[];
  drawings: DrawingPath[];
  sceneName: string;
  onChangePlanInfo: (info: PlanInfo) => void;
  onClose: () => void;
}

/** Longest canvas edge for PNG export; browsers refuse bigger canvases. */
const MAX_PNG_EDGE = 8192;

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const svgSize = (svg: string) => {
  const match = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : { width: 1200, height: 800 };
};

const svgToPng = async (svg: string): Promise<Blob> => {
  const { width, height } = svgSize(svg);
  const scale = Math.min(2, MAX_PNG_EDGE / Math.max(width, height));
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('SVG 轉圖片失敗'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 無法使用');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('PNG 輸出失敗'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange }) => (
  <label className="flex min-h-9 coarse:min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700">
    <input
      type="checkbox"
      checked={checked}
      onChange={event => onChange(event.target.checked)}
      className="h-4 w-4 coarse:h-5 coarse:w-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
    />
    {label}
  </label>
);

interface NotesFieldProps {
  value: string;
  onCommit: (next: string) => void;
}

/** Multi-line draft field: commits on blur only, so Enter keeps adding lines and IME input is never cut. */
const NotesField: React.FC<NotesFieldProps> = ({ value, onCommit }) => {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="ui-label">備註（每行一則）</label>
      <textarea
        id={id}
        rows={5}
        value={focused ? draft : value}
        onFocus={() => { setFocused(true); setDraft(value); }}
        onChange={event => setDraft(event.target.value)}
        onBlur={() => {
          setFocused(false);
          if (draft !== value) onCommit(draft);
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
        className="ui-input h-auto min-h-24 resize-y py-2 text-sm leading-relaxed coarse:text-base"
      />
    </div>
  );
};

export const FloorPlanModal: React.FC<FloorPlanModalProps> = ({
  hall, objects, drawings, sceneName, onChangePlanInfo, onClose,
}) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiddenSystems, setHiddenSystems] = useState<DeviceSystem[]>([]);

  const planInfo: PlanInfo = hall.planInfo ?? {};
  const deviceCounts = useMemo(() => countDevicePoints(objects), [objects]);
  const presentSystems = useMemo(() => DEVICE_SYSTEM_ORDER.filter(system => deviceCounts[system]), [deviceCounts]);
  const hasDevices = presentSystems.length > 0;
  const selectedSystems = useMemo(() => presentSystems.filter(system => !hiddenSystems.includes(system)), [presentSystems, hiddenSystems]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Text fields use Escape to discard their draft; the next Escape closes the dialog.
      const target = event.target;
      if (target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === 'text')) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('keydown', handleEscape, true);
      previousFocus?.focus();
    };
  }, [onClose]);

  const svg = useMemo(
    () => buildFloorPlanSvg({ hall, objects, drawings }, { showLegend, showGrid, title: sceneName, deviceSystems: hasDevices ? selectedSystems : undefined }),
    [hall, objects, drawings, showLegend, showGrid, sceneName, hasDevices, selectedSystems],
  );
  const previewSrc = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, [svg]);

  const documentTitle = planInfo.title?.trim() || sceneName.trim() || '宴會平面圖';
  const titleSlug = safeFilename(documentTitle).replace(/^-+|-+$/g, '') || 'banquet';
  const baseName = `floor-plan-${titleSlug}${selectedSystems.length === 1 ? `-${safeFilename(DEVICE_SYSTEMS[selectedSystems[0]].label)}` : ''}`;

  const patchInfo = (patch: Partial<PlanInfo>) => onChangePlanInfo({ ...planInfo, ...patch });

  const handleDownloadSvg = () => {
    setError(null);
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${baseName}.svg`);
  };

  const handleDownloadPng = async () => {
    setError(null);
    setBusy(true);
    try {
      downloadBlob(await svgToPng(svg), `${baseName}.png`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PNG 輸出失敗');
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = () => {
    setError(null);
    const win = window.open('', '_blank');
    if (!win) {
      setError('瀏覽器封鎖了列印視窗，請允許此網站的彈出視窗後再試。');
      return;
    }
    const { width, height } = svgSize(svg);
    const orientation = width >= height ? 'landscape' : 'portrait';
    win.document.open();
    win.document.write(
      `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><style>`
      + `@page{size:${orientation};margin:8mm}`
      + `html,body{margin:0;padding:0;width:100%;height:100%;background:#fff}`
      + `svg{display:block;width:100%;height:100%}`
      + `</style></head><body>${svg}</body></html>`,
    );
    win.document.close();
    win.document.title = documentTitle;
    win.focus();
    // Let the document lay out before the print dialog opens.
    setTimeout(() => {
      win.print();
    }, 250);
  };

  const handleDownloadCsv = () => {
    setError(null);
    const csv = buildDevicePointCsv(objects.filter(object => object.type !== ObjectType.DEVICE_POINT || selectedSystems.includes(object.system ?? 'other')));
    // The BOM makes Excel read the file as UTF-8.
    downloadBlob(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }), `device-points-${titleSlug}.csv`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/35 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-white outline-none animate-scale-in sm:h-auto sm:max-h-[92vh] sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 id={titleId} className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <FileDown className="h-4 w-4 text-blue-600" />
            平面圖
          </h3>
          <button onClick={onClose} className="ui-icon-btn" aria-label="關閉">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <div className="bg-slate-100 p-3 lg:min-h-0 lg:flex-1 lg:overflow-auto">
            <img
              src={previewSrc}
              alt={`${documentTitle} 平面圖預覽`}
              className="block h-auto w-full rounded-lg border border-slate-200 bg-white shadow-sm"
              draggable={false}
            />
          </div>

          <div className="space-y-6 border-t border-slate-100 p-4 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <section className="space-y-3">
              <h4 className="ui-section-title">標題欄</h4>
              <TextField label="標題" value={planInfo.title ?? ''} placeholder={sceneName} onChange={title => patchInfo({ title })} />
              <TextField label="場地" value={planInfo.venue ?? ''} onChange={venue => patchInfo({ venue })} />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="日期" value={planInfo.date ?? ''} placeholder="2026/10/10" onChange={date => patchInfo({ date })} />
                <TextField label="版本" value={planInfo.version ?? ''} placeholder="第一版" onChange={version => patchInfo({ version })} />
              </div>
              <NotesField value={planInfo.notes ?? ''} onCommit={notes => patchInfo({ notes })} />
            </section>

            <section className="space-y-1">
              <h4 className="ui-section-title">顯示</h4>
              <Toggle label="圖例" checked={showLegend} onChange={setShowLegend} />
              <Toggle label="格線（1 m）" checked={showGrid} onChange={setShowGrid} />
            </section>

            {hasDevices && (
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="ui-section-title">點位系統</h4>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setHiddenSystems([])} className="ui-btn-ghost">全選</button>
                    <button type="button" onClick={() => setHiddenSystems(presentSystems)} className="ui-btn-ghost">全不選</button>
                  </div>
                </div>
                <div className="space-y-0.5">
                  {presentSystems.map(system => (
                    <label key={system} className="flex min-h-9 coarse:min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={!hiddenSystems.includes(system)}
                        onChange={event => setHiddenSystems(prev => (event.target.checked ? prev.filter(item => item !== system) : [...prev, system]))}
                        className="h-4 w-4 coarse:h-5 coarse:w-5 rounded border-slate-300 focus:ring-2 focus:ring-blue-500/20"
                        style={{ accentColor: DEVICE_SYSTEMS[system].color }}
                      />
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: DEVICE_SYSTEMS[system].color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{DEVICE_SYSTEMS[system].label}</span>
                      <span className="text-xs tabular-nums text-slate-400">{deviceCounts[system]}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500">只勾選一個系統即可輸出該系統單頁平面圖。</p>
              </section>
            )}

            <section className="space-y-2">
              <h4 className="ui-section-title">輸出</h4>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleDownloadSvg} className="ui-btn-primary">
                  <Download className="h-3.5 w-3.5" />
                  下載 SVG
                </button>
                <button onClick={handleDownloadPng} disabled={busy} className="ui-btn-primary">
                  <Download className="h-3.5 w-3.5" />
                  {busy ? '輸出中…' : '下載 PNG'}
                </button>
              </div>
              <button onClick={handlePrint} className="ui-btn-secondary w-full">
                <Printer className="h-3.5 w-3.5" />
                列印／PDF
              </button>
              {hasDevices && (
                <button onClick={handleDownloadCsv} disabled={selectedSystems.length === 0} className="ui-btn-secondary w-full">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  下載點位清單 CSV
                </button>
              )}
              {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
