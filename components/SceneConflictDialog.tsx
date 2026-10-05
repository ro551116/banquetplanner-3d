import React, { useEffect, useRef, useState } from 'react';

interface SceneConflictDialogProps {
  onExport: () => void;
  onReload: () => Promise<void>;
  onOverwrite: () => Promise<void>;
  onError: (message: string, error?: boolean) => void;
}

export function SceneConflictDialog({ onExport, onReload, onOverwrite, onError }: SceneConflictDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  const resolve = async (reload: boolean) => {
    if (reload && !window.confirm('本機尚未儲存的變更會被捨棄，確定？')) return;
    setBusy(true);
    try { await (reload ? onReload() : onOverwrite()); }
    catch (error) { onError(error instanceof Error ? error.message : '無法處理版本衝突，請稍後再試', true); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="scene-conflict-title" tabIndex={-1}
      className="ui-card w-full max-w-lg space-y-4 p-6 shadow-xl outline-none"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
        if (event.key === 'Tab') {
          const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
          const first = buttons?.[0];
          const last = buttons?.[buttons.length - 1];
          if (!first || !last) { event.preventDefault(); return; }
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
      <h2 id="scene-conflict-title" className="text-base font-semibold text-slate-900">場景已在其他地方更新</h2>
      <p className="text-sm text-slate-600">另一個分頁、裝置或 Agent 已修改此場景。為避免覆蓋對方的變更，自動儲存已暫停。</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button className="ui-btn-secondary" disabled={busy} onClick={onExport}>匯出我的版本</button>
        <button className="ui-btn-secondary" disabled={busy} onClick={() => { void resolve(true); }}>載入最新版本</button>
        <button className="ui-btn-primary bg-red-600 hover:bg-red-700" disabled={busy} onClick={() => { void resolve(false); }}>以我的版本覆蓋</button>
      </div>
    </div>
  </div>;
}
