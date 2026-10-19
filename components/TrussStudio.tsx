import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Box,
  CalendarDays,
  Clock,
  Copy,
  Download,
  Edit3,
  Construction,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import type { TrussStructureConfig } from '../types';
import {
  calculateTrussBom,
  cloneTrussConfig,
  formatTrussTitle,
  mergeTrussBoms,
} from '../trussConfig';
import { trussStudioApi, type TrussStudioEntry, type TrussStudioEvent } from '../services/trussStudioApi';
import { TrussBuilderModal } from './TrussBuilderModal';
import { captureTruss3DViews, Truss3DDialog } from './TrussPreview3D';
import { downloadBlob } from './FloorPlanModal';
import {
  downloadSvgAsPng,
  safeFilename,
  TrussBomSummary,
  TrussCard,
} from './TrussSheetContent';

interface TrussStudioProps {
  onBack: () => void;
}

type BuilderState = { mode: 'new' } | { mode: 'edit'; id: string } | null;
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const stagger = (i: number) => ({ animationDelay: `${80 + i * 60}ms` });

const EMPTY_STRUCTURES: TrussStudioEntry[] = [];

const sanitizeConfig = (config: TrussStructureConfig): TrussStructureConfig => {
  const next = cloneTrussConfig(config);
  delete next.groupId;
  next.quantity = Math.max(1, Math.round(next.quantity || 1));
  return next;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '剛剛';
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
};

export const TrussStudio: React.FC<TrussStudioProps> = ({ onBack }) => {
  const [events, setEvents] = useState<TrussStudioEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [builder, setBuilder] = useState<BuilderState>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [renamingEventId, setRenamingEventId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [navigatingBack, setNavigatingBack] = useState(false);
  const [viewing3dId, setViewing3dId] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);

  const inFlightCount = useRef(0);
  const opSeq = useRef(0);
  const pendingMutation = useRef<Promise<unknown>>(Promise.resolve());
  const isRenamingRef = useRef(false);
  const newEventInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newEventNameRef = useRef(newEventName);
  const renameValueRef = useRef(renameValue);
  newEventNameRef.current = newEventName;
  renameValueRef.current = renameValue;

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await trussStudioApi.get();
      setEvents(Array.isArray(data.events) ? data.events : []);
      setHasLoaded(true);
      setError(null);
      setRetryAction(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '載入 Truss 工作台失敗';
      setError(msg);
      setRetryAction(() => load);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (inFlightCount.current > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const runMutation = <T,>(
    label: string,
    fn: () => Promise<T>,
    retry?: () => void,
  ): Promise<T> => {
    if (!hasLoaded || inFlightCount.current > 0) {
      return Promise.reject(new Error(!hasLoaded ? '請先完成載入再編輯' : '請等候目前操作儲存完成'));
    }
    const opId = ++opSeq.current;
    inFlightCount.current += 1;
    setSaveState('saving');
    setError(null);
    setRetryAction(null);

    const task = async (): Promise<T> => {
      try {
        const result = await fn();
        if (opId === opSeq.current) {
          setSaveState('saved');
          setError(null);
          setRetryAction(null);
          setTimeout(() => {
            if (opSeq.current === opId) {
              setSaveState(prev => (prev === 'saved' ? 'idle' : prev));
            }
          }, 3000);
        }
        return result;
      } catch (err) {
        if (opId === opSeq.current) {
          setSaveState('error');
          const msg = err instanceof Error ? err.message : `${label}失敗`;
          setError(msg);
          if (retry) {
            setRetryAction(() => retry);
          }
        }
        throw err;
      } finally {
        inFlightCount.current = Math.max(0, inFlightCount.current - 1);
      }
    };

    const execution = task();
    pendingMutation.current = execution;
    return execution;
  };

  const handleBack = async () => {
    if (inFlightCount.current > 0) {
      setNavigatingBack(true);
      try {
        await pendingMutation.current;
      } catch {
        return;
      } finally {
        setNavigatingBack(false);
      }
    }
    else if ((creatingEvent && newEventName.trim()) || renamingEventId) {
      if (!confirm('尚有未儲存的場次名稱，確定放棄並返回首頁？')) return;
    }
    onBack();
  };

  const handleBackToEvents = async () => {
    if (inFlightCount.current > 0) {
      setNavigatingBack(true);
      try {
        await pendingMutation.current;
      } catch {
        return;
      } finally {
        setNavigatingBack(false);
      }
    }
    setSelectedEventId(null);
    setBuilder(null);
  };

  useEffect(() => {
    if (creatingEvent) newEventInputRef.current?.focus();
  }, [creatingEvent]);

  useEffect(() => {
    if (renamingEventId) renameInputRef.current?.focus();
  }, [renamingEventId]);

  useEffect(() => {
    if (selectedEventId && !events.some(event => event.id === selectedEventId)) {
      setSelectedEventId(null);
      setBuilder(null);
    }
  }, [events, selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find(event => event.id === selectedEventId),
    [events, selectedEventId],
  );
  const structures = selectedEvent?.structures ?? EMPTY_STRUCTURES;

  const totalBom = useMemo(() => (
    mergeTrussBoms(structures.map(entry => calculateTrussBom(entry.config, entry.config.quantity)))
  ), [structures]);

  const editingEntry = builder?.mode === 'edit'
    ? structures.find(entry => entry.id === builder.id)
    : undefined;
  const viewing3dEntry = viewing3dId ? structures.find(entry => entry.id === viewing3dId) : undefined;

  const saveText = {
    idle: '',
    saving: '儲存中...',
    saved: '已儲存',
    error: '儲存失敗',
  }[saveState];
  const busy = loading || saveState === 'saving' || navigatingBack;
  const mutationDisabled = busy || !hasLoaded;

  const handleCreateEvent = async () => {
    const name = newEventNameRef.current.trim();
    if (!name) return;

    try {
      const newEvent = await runMutation(
        '建立場次',
        () => trussStudioApi.createEvent(name),
        () => { handleCreateEvent(); },
      );
      setEvents(prev => [...prev, newEvent]);
      setSelectedEventId(newEvent.id);
      setCreatingEvent(false);
      setNewEventName('');
    } catch {
      // Retains newEventName and creatingEvent state for retry
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm(`確定要刪除場次「${events.find(event => event.id === eventId)?.name ?? '未命名場次'}」？場次內的 Truss 結構也會刪除。`)) return;

    try {
      await runMutation(
        '刪除場次',
        () => trussStudioApi.deleteEvent(eventId),
        () => {
          handleDeleteEvent(eventId);
        },
      );
      setEvents(prev => prev.filter(event => event.id !== eventId));
      if (selectedEventId === eventId) {
        setSelectedEventId(null);
        setBuilder(null);
      }
    } catch {
      // Handled in runMutation with retry action
    }
  };

  const startRenameEvent = (e: React.MouseEvent, event: TrussStudioEvent) => {
    e.stopPropagation();
    setRenamingEventId(event.id);
    setRenameValue(event.name);
  };

  const cancelRenameEvent = () => {
    isRenamingRef.current = false;
    setRenamingEventId(null);
    setRenameValue('');
  };

  const commitRenameEvent = async (eventId: string) => {
    if (isRenamingRef.current) return;
    const name = renameValueRef.current.trim();
    const current = events.find(event => event.id === eventId);
    if (!current || !name || name === current.name) {
      cancelRenameEvent();
      return;
    }

    isRenamingRef.current = true;
    try {
      const updated = await runMutation(
        '場次改名',
        () => trussStudioApi.renameEvent(eventId, name),
        () => { commitRenameEvent(eventId); },
      );
      setEvents(prev => prev.map(event => (event.id === eventId ? updated : event)));
      cancelRenameEvent();
    } catch {
      // Retains renamingEventId and renameValue for retry
    } finally {
      isRenamingRef.current = false;
    }
  };

  const handleSubmit = async (config: TrussStructureConfig): Promise<void> => {
    if (!selectedEventId) {
      const err = new Error('尚未選擇場次');
      setError(err.message);
      setSaveState('error');
      throw err;
    }

    const cleanConfig = sanitizeConfig(config);

    if (builder?.mode === 'edit') {
      const structureId = builder.id;
      const existing = structures.find(entry => entry.id === structureId);
      if (!existing) {
        const err = new Error('找不到欲編輯的 Truss 結構，該結構可能已被刪除');
        setError(err.message);
        setSaveState('error');
        throw err;
      }

      const updated = await runMutation(
        '儲存結構',
        () => trussStudioApi.updateStructure(selectedEventId, structureId, cleanConfig),
      );

      setEvents(prev => prev.map(ev => {
        if (ev.id !== selectedEventId) return ev;
        return {
          ...ev,
          updated_at: updated.updated_at,
          structures: ev.structures.map(entry => (entry.id === structureId ? updated : entry)),
        };
      }));
      return;
    }

    const created = await runMutation(
      '新增結構',
      () => trussStudioApi.createStructure(selectedEventId, cleanConfig),
    );

    setEvents(prev => prev.map(ev => {
      if (ev.id !== selectedEventId) return ev;
      return {
        ...ev,
        updated_at: created.updated_at,
        structures: [...ev.structures, created],
      };
    }));
  };

  const handleDuplicate = async (entry: TrussStudioEntry) => {
    if (!selectedEventId) return;

    const cleanConfig = sanitizeConfig(entry.config);

    try {
      const duplicated = await runMutation(
        '複製結構',
        () => trussStudioApi.createStructure(selectedEventId, cleanConfig, entry.id),
        () => { handleDuplicate(entry); },
      );

      setEvents(prev => prev.map(ev => {
        if (ev.id !== selectedEventId) return ev;
        const index = ev.structures.findIndex(s => s.id === entry.id);
        const nextStructures = index === -1
          ? [...ev.structures, duplicated]
          : [
              ...ev.structures.slice(0, index + 1),
              duplicated,
              ...ev.structures.slice(index + 1),
            ];
        return {
          ...ev,
          updated_at: duplicated.updated_at,
          structures: nextStructures,
        };
      }));
    } catch {
      // Handled in runMutation with retry action
    }
  };

  const handleDelete = async (entry: TrussStudioEntry) => {
    if (!selectedEventId) return;
    if (!confirm(`確定要刪除 Truss 結構「${formatTrussTitle(entry.config, entry.config.quantity)}」？`)) return;

    try {
      await runMutation(
        '刪除結構',
        () => trussStudioApi.deleteStructure(selectedEventId, entry.id),
        () => { handleDelete(entry); },
      );

      setEvents(prev => prev.map(ev => {
        if (ev.id !== selectedEventId) return ev;
        return {
          ...ev,
          updated_at: new Date().toISOString(),
          structures: ev.structures.filter(s => s.id !== entry.id),
        };
      }));
    } catch {
      // Handled in runMutation with retry action
    }
  };

  const getDownloadFilename = (entry: TrussStudioEntry, suffix = '') => {
    const eventName = selectedEvent?.name.trim() || '未命名場次';
    const title = formatTrussTitle(entry.config, entry.config.quantity);
    return `${safeFilename(`${eventName}-${title}`)}${suffix}.png`;
  };

  const handleDownloadOne = async (entry: TrussStudioEntry) => {
    const diagramKey = `studio-${entry.id}`;
    const svg = document.getElementById(`truss-diagram-${diagramKey}`) as unknown as SVGSVGElement | null;
    if (!svg) return;
    await downloadSvgAsPng(svg, getDownloadFilename(entry));
  };

  // Every structure's 2D sheet first (as before), then its default 3D view as `<same name>-3D.png`.
  const handleDownloadAll = async () => {
    const entries = structures;
    setExportingAll(true);
    try {
      for (const entry of entries) {
        await handleDownloadOne(entry);
      }
      await captureTruss3DViews(entries.map(entry => entry.config), (png, index) => {
        downloadBlob(png, getDownloadFilename(entries[index], '-3D'));
      });
    } catch (err) {
      console.error('Truss PNG export failed:', err);
      setError('PNG 輸出失敗，請再試一次。');
    } finally {
      setExportingAll(false);
    }
  };

  const saveBadge = saveText && (
    <span className={`text-xs font-medium px-2 py-1 rounded-lg ${saveState === 'error' ? 'bg-red-50 text-red-600' : saveState === 'saved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {saveText}
    </span>
  );

  const renderEventList = () => (
    <div className="page-shell">
      <header className="animate-slide-up mb-8" style={{ animationDelay: '0ms' }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBack}
              disabled={navigatingBack}
              className="ui-icon-btn"
              aria-label="返回首頁"
              title={navigatingBack ? '儲存中...' : '返回首頁'}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="page-title">Truss 工作台</h1>
            </div>
          </div>
          {saveBadge}
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl animate-slide-up flex items-center justify-between gap-3">
          <span>{error}</span>
          {retryAction && (
            <button
              disabled={busy}
              onClick={() => {
                const retry = retryAction;
                setRetryAction(null);
                setError(null);
                retry();
              }}
              className="ui-btn-secondary shrink-0"
            >
              重試
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="animate-slide-up" style={stagger(0)}>
          {creatingEvent ? (
            <div className="ui-card p-4 flex flex-col gap-3">
              <p className="text-sm font-medium text-slate-600">新場次名稱</p>
              <input
                ref={newEventInputRef}
                disabled={mutationDisabled}
                value={newEventName}
                onChange={e => setNewEventName(e.target.value)}
                onKeyDown={e => {
                  // Enter/Esc that confirm or dismiss an IME candidate must not submit a half-typed name.
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                  if (e.key === 'Enter') handleCreateEvent();
                  if (e.key === 'Escape') {
                    setCreatingEvent(false);
                    setNewEventName('');
                  }
                }}
                placeholder="輸入名稱..."
                className="ui-input"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateEvent}
                  disabled={mutationDisabled}
                  className="ui-btn-primary flex-1"
                >
                  建立
                </button>
                <button
                  disabled={mutationDisabled}
                  onClick={() => {
                    setCreatingEvent(false);
                    setNewEventName('');
                  }}
                  className="ui-btn-ghost"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreatingEvent(true)}
              disabled={mutationDisabled}
              className="new-entity-card w-full h-full min-h-[200px] flex flex-col items-center justify-center gap-3 p-6"
            >
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                <Plus className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">新增場次</p>
                <p className="text-xs text-slate-500 mt-0.5">建立空白 Truss 場次</p>
              </div>
            </button>
          )}
        </div>

        {loading && (
          <>
            {[0, 1, 2].map(i => (
              <div key={i} className="animate-slide-up" style={stagger(i + 1)}>
                <div className="entity-card p-0">
                  <div className="aspect-video bg-slate-100 animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-28 bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 w-20 bg-slate-50 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {!loading && events.map((event, i) => (
          <div key={event.id} className="animate-slide-up" style={stagger(i + 1)}>
            <div className="entity-card">
              <button
                className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                aria-label={`開啟場次 ${event.name}`}
                disabled={mutationDisabled || !!renamingEventId}
                onClick={() => {
                  if (!mutationDisabled && !renamingEventId) setSelectedEventId(event.id);
                }}
              />
              <div className="entity-card-thumb pointer-events-none relative">
                <div className="w-full h-full flex items-center justify-center">
                  <div className="relative">
                    <div className="w-16 h-11 rounded border border-slate-200 bg-white flex items-center justify-center">
                      <CalendarDays className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 min-w-6 h-6 rounded-full bg-blue-50 px-2 flex items-center justify-center text-xs font-medium text-blue-700">
                      {event.structures.length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pointer-events-none relative p-4 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  {renamingEventId === event.id ? (
                    <input
                      ref={renameInputRef}
                      disabled={mutationDisabled}
                      value={renameValue}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => commitRenameEvent(event.id)}
                      onKeyDown={e => {
                        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                        if (e.key === 'Enter') commitRenameEvent(event.id);
                        if (e.key === 'Escape') cancelRenameEvent();
                      }}
                      className="ui-input pointer-events-auto"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{event.name}</h3>
                      <button
                        disabled={mutationDisabled}
                        onClick={(e) => startRenameEvent(e, event)}
                        className="ui-icon-btn min-h-9 min-w-9 pointer-events-auto entity-card-actions shrink-0"
                        aria-label={`重新命名場次 ${event.name}`}
                        title="重新命名"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-1">{event.structures.length} 座結構</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-xs text-slate-500">更新於 {formatDate(event.updated_at)}</span>
                  </div>
                </div>
                <div className="entity-card-actions pointer-events-auto flex items-center gap-1 ml-2">
                  <button
                    disabled={mutationDisabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEvent(event.id);
                    }}
                    className="ui-icon-btn min-h-9 min-w-9 hover:bg-red-50 hover:text-red-600"
                    aria-label={`刪除場次 ${event.name}`}
                    title="刪除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="p-1.5 text-slate-400">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && hasLoaded && !error && events.length === 0 && (
          <div className="animate-slide-up col-span-full sm:col-span-1 lg:col-span-2 flex items-center justify-center py-12" style={stagger(1)}>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-slate-50 flex items-center justify-center">
                <Construction className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-600">還沒有場次</p>
              <p className="text-xs text-slate-500 mt-1">新增第一個 Truss 場次</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderEventDetail = (event: TrussStudioEvent) => (
    <div className="page-shell">
      <header className="truss-no-print ui-card p-4 mb-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBackToEvents}
              disabled={navigatingBack}
              className="ui-icon-btn"
              aria-label="返回場次列表"
              title={navigatingBack ? '儲存中...' : '返回場次列表'}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
              <Construction className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="page-title truncate">{event.name}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {saveBadge}
            <button
              onClick={() => setBuilder({ mode: 'new' })}
              disabled={mutationDisabled}
              className="ui-btn-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              新增結構
            </button>
            <button
              onClick={handleDownloadAll}
              disabled={structures.length === 0 || exportingAll}
              className="ui-btn-secondary"
              title="每個結構各輸出 2D 結構圖與 3D 圖"
            >
              <Download className="w-3.5 h-3.5" />
              {exportingAll ? '輸出中…' : '全部 PNG'}
            </button>
            <button
              onClick={() => window.print()}
              disabled={structures.length === 0}
              className="ui-btn-secondary"
            >
              <Printer className="w-3.5 h-3.5" />
              列印
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="truss-no-print mb-5 p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-center justify-between gap-3">
          <span>{error}</span>
          {retryAction && (
            <button
              disabled={busy}
              onClick={() => {
                const retry = retryAction;
                setRetryAction(null);
                setError(null);
                retry();
              }}
              className="ui-btn-secondary shrink-0"
            >
              重試
            </button>
          )}
        </div>
      )}

      {structures.length === 0 ? (
        <div className="truss-no-print ui-card p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Construction className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">尚未建立 Truss 結構</h2>
          <p className="text-xs text-slate-500 mt-1 mb-5">新增第一個結構後，這裡會顯示 2D 結構圖與 BOM。</p>
          <button
            onClick={() => setBuilder({ mode: 'new' })}
            disabled={mutationDisabled}
            className="ui-btn-secondary"
          >
            <Plus className="w-3.5 h-3.5" />
            新增結構
          </button>
        </div>
      ) : (
        <div className="truss-studio-print-area space-y-4">
          {structures.map(entry => (
            <TrussCard
              key={entry.id}
              diagramKey={`studio-${entry.id}`}
              config={entry.config}
              quantity={entry.config.quantity}
              subtitle={`座數 ${Math.max(1, Math.round(entry.config.quantity || 1))} 座`}
              downloadFilename={getDownloadFilename(entry)}
              actions={(
                <>
                  <button
                    onClick={() => setViewing3dId(entry.id)}
                    className="ui-btn-secondary"
                  >
                    <Box className="w-3.5 h-3.5" />
                    3D
                  </button>
                  <button
                    onClick={() => setBuilder({ mode: 'edit', id: entry.id })}
                    disabled={mutationDisabled}
                    className="ui-btn-secondary"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    編輯
                  </button>
                  <button
                    onClick={() => handleDuplicate(entry)}
                    disabled={mutationDisabled}
                    className="ui-btn-secondary"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    複製
                  </button>
                  <button
                    onClick={() => handleDelete(entry)}
                    disabled={mutationDisabled}
                    className="ui-btn-danger"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    刪除
                  </button>
                </>
              )}
            />
          ))}

          <TrussBomSummary bom={totalBom} printable />
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen bg-slate-100 text-slate-900 overflow-y-auto">

      {selectedEvent ? renderEventDetail(selectedEvent) : renderEventList()}

      {builder && selectedEvent && (
        <TrussBuilderModal
          // Remount per target so a draft opened for one structure can never be saved onto another.
          key={builder.mode === 'edit' ? builder.id : 'new'}
          initialConfig={editingEntry?.config}
          onClose={() => setBuilder(null)}
          onSubmit={handleSubmit}
          submitLabel={builder.mode === 'new' ? '新增結構' : '儲存結構'}
        />
      )}

      {viewing3dEntry && (
        <Truss3DDialog
          config={viewing3dEntry.config}
          quantity={viewing3dEntry.config.quantity}
          filename={getDownloadFilename(viewing3dEntry, '-3D')}
          onClose={() => setViewing3dId(null)}
        />
      )}
    </div>
  );
};
