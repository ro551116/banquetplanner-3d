import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ title, onClose, children }) => {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
    };
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = closeRef.current?.closest('section')?.querySelectorAll<HTMLElement>('button, input, select');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', trapFocus, true);
    window.addEventListener('keydown', handleKey, true);
    return () => {
      window.removeEventListener('keydown', trapFocus, true);
      window.removeEventListener('keydown', handleKey, true);
      previousFocus?.focus();
    };
  }, []);
  return (
    <div>
      <div className="fixed inset-0 z-30 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-x-0 bottom-0 z-40 flex max-h-[70dvh] flex-col rounded-t-2xl bg-white shadow-xl animate-sheet-up">
        <div className="ui-sheet-handle" />
        <header className="flex shrink-0 items-center justify-between px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold">{title}</h2>
          <button ref={closeRef} type="button" className="ui-icon-btn" aria-label="關閉" onClick={onClose}><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
      </section>
    </div>
  );
};
