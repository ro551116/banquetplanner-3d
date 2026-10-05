import React, { useEffect, useRef, useState } from 'react';
import { PenTool, Tag, Eraser, Undo2, Redo2, Moon, Sun, Image, LayoutGrid, ArrowDownToLine, Tv, PanelLeft, Plus, PanelRight, ChevronLeft, MoreHorizontal, AlertCircle } from 'lucide-react';
import { ToolControls, EditorControlsProps } from './EditorControls';
import { SaveStatus } from '../hooks/useSceneIO';

interface TopToolbarProps extends Pick<EditorControlsProps, 'tool' | 'setTool' | 'snapStep' | 'setSnapStep'> {
  sceneName: string;
  mode: 'EDIT' | 'VIEW'; setMode: (mode: 'EDIT' | 'VIEW') => void;
  isDrawMode: boolean; setIsDrawMode: (active: boolean) => void;
  drawingColor: string; setDrawingColor: (color: string) => void; clearDrawings: () => void;
  setSelectedIds: (ids: Set<string>) => void;
  handleImportClick: () => void; exportScene: () => void; setShowBatchModal: (active: boolean) => void;
  undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean;
  viewIndex: number; setViewIndex: (index: number) => void;
  viewEnvironment: 'day' | 'night'; setViewEnvironment: React.Dispatch<React.SetStateAction<'day' | 'night'>>;
  takeScreenshot: () => void; panelOpen: boolean; setPanelOpen: (open: boolean) => void;
  addPanelOpen: boolean; setAddPanelOpen: (open: boolean) => void; onBackToList?: () => void;
  hasTrussStructures: boolean; onOpenTrussSheets: () => void;
  showLabels: boolean; setShowLabels: (show: boolean) => void;
  saveStatus: SaveStatus; saveError: string | null; onRetrySave: () => void;
  onShortcutHelp: () => void; onMenuOpenChange: (open: boolean) => void;
}
const DARK_BUTTON = 'inline-flex shrink-0 items-center justify-center gap-1 h-8 min-w-8 coarse:h-10 coarse:min-w-10 rounded-lg px-1.5 text-sm text-slate-300 hover:bg-slate-800 aria-pressed:bg-slate-700 aria-pressed:text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500';
const DARK_SEGMENT = 'inline-flex items-center justify-center gap-1 rounded-lg h-8 coarse:h-10 min-w-8 coarse:min-w-10 px-1.5 text-sm text-slate-300 hover:bg-slate-700 aria-pressed:bg-slate-700 aria-pressed:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500';

export function ViewControls(props: Pick<TopToolbarProps, 'viewIndex' | 'setViewIndex' | 'viewEnvironment' | 'setViewEnvironment' | 'showLabels' | 'setShowLabels' | 'takeScreenshot'>) {
  return <div className="flex items-center gap-1">
    <div className="inline-flex rounded-lg bg-slate-800 p-0.5" aria-label="視角">
      {[{ label: '全景', Icon: LayoutGrid }, { label: '俯視', Icon: ArrowDownToLine }, { label: '舞台', Icon: Tv }, { label: '側面', Icon: PanelLeft }].map(({ label, Icon }, index) => <button key={label} className={DARK_SEGMENT} aria-label={label} title={label} aria-pressed={props.viewIndex === index} onClick={() => props.setViewIndex(index)}><Icon size={16} /><span className="hidden lg:inline">{label}</span></button>)}
    </div>
    <button className={DARK_BUTTON} aria-label="夜間" title="夜間" aria-pressed={props.viewEnvironment === 'night'} onClick={() => props.setViewEnvironment(value => value === 'day' ? 'night' : 'day')}><Moon size={16} /><span className="hidden lg:inline">夜間</span></button>
    <button className={DARK_BUTTON} aria-label="標籤" title="標籤" aria-pressed={props.showLabels} onClick={() => props.setShowLabels(!props.showLabels)}><Tag size={16} /><span className="hidden lg:inline">標籤</span></button>
    <button className={DARK_BUTTON} aria-label="截圖" title="截圖" onClick={props.takeScreenshot}><Image size={16} /><span className="hidden lg:inline">截圖</span></button>
  </div>;
}

export function DrawingControls({ drawingColor, setDrawingColor, clearDrawings, dark = false }: Pick<TopToolbarProps, 'drawingColor' | 'setDrawingColor' | 'clearDrawings'> & { dark?: boolean }) {
  return <div className="flex items-center gap-1" aria-label="手繪顏色">
    {['#3b82f6', '#ef4444', '#eab308', '#22c55e'].map((color, index) => <button key={color} aria-label={['藍色', '紅色', '黃色', '綠色'][index]} aria-pressed={color === drawingColor} onClick={() => setDrawingColor(color)} className={`h-8 w-8 coarse:h-10 coarse:w-10 flex items-center justify-center rounded-lg ${color === drawingColor ? (dark ? 'bg-slate-700' : 'bg-slate-200') : ''}`}><span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ backgroundColor: color }} /></button>)}
    <button className={dark ? DARK_BUTTON : 'ui-icon-btn'} onClick={clearDrawings} aria-label="清除標註" title="清除標註"><Eraser size={16} /></button>
  </div>;
}

export const TopToolbar: React.FC<TopToolbarProps> = props => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dark = props.mode === 'VIEW';
  const button = dark ? DARK_BUTTON : 'ui-icon-btn';
  useEffect(() => { props.onMenuOpenChange(menuOpen); }, [menuOpen, props.onMenuOpenChange]);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [menuOpen]);
  const toggleDrawing = () => { props.setIsDrawMode(!props.isDrawMode); props.setSelectedIds(new Set()); };
  const menuItem = (label: string, action: () => void, disabled = false, className = '') => <button role="menuitem" disabled={disabled} className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm coarse:min-h-10 disabled:opacity-40 ${dark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} ${className}`} onClick={() => { setMenuOpen(false); action(); }}>{label}</button>;
  const statusLabel = props.saveStatus === 'saving' ? '儲存中…' : props.saveStatus === 'dirty' ? '未儲存' : '已儲存';
  return <header className={`relative z-20 flex h-12 shrink-0 items-center gap-1 px-2 border-b ${dark ? 'bg-slate-900 text-slate-100 border-slate-800' : 'bg-white border-slate-200'}`}>
    <button className={button} aria-label="返回場景列表" title="返回場景列表" onClick={props.onBackToList}><ChevronLeft size={18} /></button>
    <span title={props.sceneName} className={`min-w-0 flex-1 lg:flex-initial truncate max-w-[10rem] lg:max-w-[16rem] text-sm font-semibold ${dark ? 'text-slate-100' : 'text-slate-900'}`}>{props.sceneName}</span>
    <div className={dark ? 'inline-flex shrink-0 rounded-lg bg-slate-800 p-0.5' : 'ui-segmented'} aria-label="模式">
      {(['EDIT', 'VIEW'] as const).map(mode => <button key={mode} className={dark ? DARK_SEGMENT : 'ui-segment coarse:h-10'} aria-pressed={mode === props.mode} onClick={() => props.setMode(mode)}>{mode === 'EDIT' ? '編輯' : '預覽'}</button>)}
    </div>
    <div className="hidden lg:flex items-center justify-center gap-2 flex-1 min-w-0">{dark ? <ViewControls {...props} /> : <ToolControls {...props} />}</div>
    <div className="hidden sm:flex items-center gap-1">
      {!dark && <button className={button} aria-label="手繪" title="手繪" aria-pressed={props.isDrawMode} onClick={toggleDrawing}><PenTool size={16} /></button>}
      {!dark && props.isDrawMode && <div className="hidden xl:block"><DrawingControls {...props} /></div>}
      <button className={button} aria-label="復原" title="復原" disabled={!props.canUndo} onClick={props.undo}><Undo2 size={16} /></button>
      <button className={button} aria-label="重做" title="重做" disabled={!props.canRedo} onClick={props.redo}><Redo2 size={16} /></button>
    </div>
    <div ref={menuRef} className="relative shrink-0">
      <button className={button} aria-label="更多" title="更多" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><MoreHorizontal size={18} /></button>
      {menuOpen && <div role="menu" aria-label="更多操作" className={`absolute right-0 top-full mt-2 w-48 rounded-xl p-1 shadow-lg ring-1 animate-fade-in ${dark ? 'bg-slate-800 text-slate-100 ring-slate-700' : 'bg-white text-slate-900 ring-slate-200'}`}>
        {!dark && menuItem('手繪', toggleDrawing, false, 'sm:hidden')}{menuItem('復原', props.undo, !props.canUndo, 'sm:hidden')}{menuItem('重做', props.redo, !props.canRedo, 'sm:hidden')}
        {menuItem('匯入場景', props.handleImportClick)}{menuItem('匯出 JSON', props.exportScene)}{menuItem('結構圖', props.onOpenTrussSheets, !props.hasTrussStructures)}
        {!dark && menuItem('批次新增', () => props.setShowBatchModal(true))}{menuItem('快捷鍵說明', props.onShortcutHelp)}
      </div>}
    </div>
    <div aria-live="polite" className="shrink-0">
      {props.saveStatus === 'conflict' ? <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${dark ? 'bg-amber-950 text-amber-300' : 'bg-amber-100 text-amber-800'}`}><AlertCircle size={14} />版本衝突</span> : props.saveStatus === 'error' ? <button className={`ui-btn-danger h-8 px-1 sm:px-2 ${dark ? 'text-red-400 hover:bg-slate-800 hover:text-red-300' : ''}`} title={`${props.saveError ?? '儲存失敗'}・將自動重試`} aria-label="儲存失敗・重試" onClick={props.onRetrySave}><AlertCircle size={16} /><span className="hidden sm:inline">儲存失敗・重試</span></button> : <span className={`flex items-center gap-1.5 px-1 text-xs ${dark ? 'text-slate-300' : 'text-slate-500'}`} aria-label={statusLabel} title={statusLabel}>{props.saveStatus === 'saving' ? <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <span className={`h-2 w-2 rounded-full ${props.saveStatus === 'dirty' ? 'bg-amber-500' : 'bg-emerald-500'}`} />}<span className="hidden sm:inline">{statusLabel}</span></span>}
    </div>
    {!dark && <><button className="ui-icon-btn sm:w-auto sm:px-2" aria-label="新增" title="新增" aria-pressed={props.addPanelOpen} onClick={() => props.setAddPanelOpen(!props.addPanelOpen)}><Plus size={16} /><span className="hidden sm:inline text-sm">新增</span></button><button className="ui-icon-btn sm:w-auto sm:px-2" aria-label="屬性" title="屬性" aria-pressed={props.panelOpen} onClick={() => props.setPanelOpen(!props.panelOpen)}><PanelRight size={16} /><span className="hidden sm:inline text-sm">屬性</span></button></>}
  </header>;
};
