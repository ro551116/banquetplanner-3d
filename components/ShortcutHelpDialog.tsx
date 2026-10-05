import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function ShortcutHelpDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onClose]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="shortcut-help-title" className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-xl bg-white p-4 shadow-xl animate-scale-in" onClick={event => event.stopPropagation()}>
      <div className="flex items-center justify-between mb-4"><h2 id="shortcut-help-title" className="text-base font-semibold">快捷鍵說明</h2><button ref={closeRef} className="ui-icon-btn" aria-label="關閉" onClick={onClose}><X size={18} /></button></div>
      <dl className="space-y-3 text-sm text-slate-600">
        {[
          ['G / R / H', '切換移動／旋轉／高度'], ['方向鍵', '微調（Shift ×10）'], ['Delete / Backspace', '刪除'], ['Ctrl / ⌘ + D', '再製'], ['Ctrl / ⌘ + Z', '復原'], ['Ctrl / ⌘ + Shift + Z 或 Ctrl / ⌘ + Y', '重做'], ['Esc', '取消放置／手勢／繪圖'], ['滑鼠', '空白處左鍵拖曳旋轉視角、右鍵拖曳平移、滾輪縮放'], ['觸控', '單指拖曳物件、雙指平移／縮放'],
        ].map(([key, description]) => <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3"><dt className="font-medium text-slate-900">{key}</dt><dd>{description}</dd></div>)}
      </dl>
    </section>
  </div>;
}
