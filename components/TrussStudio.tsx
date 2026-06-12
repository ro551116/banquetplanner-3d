import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  Copy,
  Download,
  Edit3,
  FileDown,
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
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const stagger = (i: number) => ({ animationDelay: `${80 + i * 60}ms` });

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
  const [error, setError] = useState<string | null>(null);
  const [builder, setBuilder] = useState<BuilderState>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [renamingEventId, setRenamingEventId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const hasLoaded = useRef(false);
  const skipNextSave = useRef(false);
  const newEventInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const data = await trussStudioApi.get();
        if (!active) return;
        skipNextSave.current = true;
        setEvents(Array.isArray(data.events) ? data.events : []);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : '載入 Truss 工作台失敗');
      } finally {
        if (!active) return;
        hasLoaded.current = true;
        setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    setSaveState('pending');
    const timer = window.setTimeout(async () => {
      try {
        setSaveState('saving');
        await trussStudioApi.save(events);
        setSaveState('saved');
        setError(null);
      } catch (err) {
        setSaveState('error');
        setError(err instanceof Error ? err.message : '儲存 Truss 工作台失敗');
      }
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [events]);

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
  const structures = selectedEvent?.structures ?? [];

  const totalBom = useMemo(() => (
    mergeTrussBoms(structures.map(entry => calculateTrussBom(entry.config, entry.config.quantity)))
  ), [structures]);

  const editingEntry = builder?.mode === 'edit'
    ? structures.find(entry => entry.id === builder.id)
    : undefined;

  const saveText = {
    idle: '',
    pending: '待儲存',
    saving: '儲存中...',
    saved: '已儲存',
    error: '儲存失敗',
  }[saveState];

  const updateEvent = (
    eventId: string,
    updater: (event: TrussStudioEvent) => TrussStudioEvent,
  ) => {
    setEvents(prev => prev.map(event => (
      event.id === eventId ? updater(event) : event
    )));
  };

  const updateSelectedEventStructures = (
    updater: (structures: TrussStudioEntry[]) => TrussStudioEntry[],
  ) => {
    if (!selectedEventId) return;
    const now = new Date().toISOString();
    updateEvent(selectedEventId, event => ({
      ...event,
      updated_at: now,
      structures: updater(event.structures),
    }));
  };

  const handleCreateEvent = () => {
    const name = newEventName.trim();
    if (!name) return;

    const now = new Date().toISOString();
    const event: TrussStudioEvent = {
      id: crypto.randomUUID(),
      name,
      created_at: now,
      updated_at: now,
      structures: [],
    };

    setEvents(prev => [event, ...prev]);
    setSelectedEventId(event.id);
    setCreatingEvent(false);
    setNewEventName('');
  };

  const handleDeleteEvent = (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    if (!confirm('確定要刪除這個場次？場次內的 Truss 結構也會刪除。')) return;
    setEvents(prev => prev.filter(event => event.id !== eventId));
    if (selectedEventId === eventId) {
      setSelectedEventId(null);
      setBuilder(null);
    }
  };

  const startRenameEvent = (e: React.MouseEvent, event: TrussStudioEvent) => {
    e.stopPropagation();
    setRenamingEventId(event.id);
    setRenameValue(event.name);
  };

  const cancelRenameEvent = () => {
    setRenamingEventId(null);
    setRenameValue('');
  };

  const commitRenameEvent = (eventId: string) => {
    const name = renameValue.trim();
    const current = events.find(event => event.id === eventId);
    if (!current || !name || name === current.name) {
      cancelRenameEvent();
      return;
    }

    updateEvent(eventId, event => ({
      ...event,
      name,
      updated_at: new Date().toISOString(),
    }));
    cancelRenameEvent();
  };

  const handleSubmit = (config: TrussStructureConfig) => {
    const now = new Date().toISOString();
    const cleanConfig = sanitizeConfig(config);

    if (builder?.mode === 'edit') {
      updateSelectedEventStructures(prev => prev.map(entry => (
        entry.id === builder.id
          ? { ...entry, config: cleanConfig, updated_at: now }
          : entry
      )));
      return;
    }

    updateSelectedEventStructures(prev => ([
      ...prev,
      {
        id: crypto.randomUUID(),
        config: cleanConfig,
        created_at: now,
        updated_at: now,
      },
    ]));
  };

  const handleDuplicate = (entry: TrussStudioEntry) => {
    const now = new Date().toISOString();
    const copy: TrussStudioEntry = {
      id: crypto.randomUUID(),
      config: sanitizeConfig(entry.config),
      created_at: now,
      updated_at: now,
    };

    updateSelectedEventStructures(prev => {
      const index = prev.findIndex(item => item.id === entry.id);
      if (index === -1) return [...prev, copy];
      return [
        ...prev.slice(0, index + 1),
        copy,
        ...prev.slice(index + 1),
      ];
    });
  };

  const handleDelete = (entry: TrussStudioEntry) => {
    if (!confirm('確定要刪除這個 Truss 結構？')) return;
    updateSelectedEventStructures(prev => prev.filter(item => item.id !== entry.id));
  };

  const getDownloadFilename = (entry: TrussStudioEntry) => {
    const eventName = selectedEvent?.name.trim() || '未命名場次';
    const title = formatTrussTitle(entry.config, entry.config.quantity);
    return `${safeFilename(`${eventName}-${title}`)}.png`;
  };

  const handleDownloadOne = async (entry: TrussStudioEntry) => {
    const diagramKey = `studio-${entry.id}`;
    const svg = document.getElementById(`truss-diagram-${diagramKey}`) as unknown as SVGSVGElement | null;
    if (!svg) return;
    await downloadSvgAsPng(svg, getDownloadFilename(entry));
  };

  const handleDownloadAll = async () => {
    for (const entry of structures) {
      await handleDownloadOne(entry);
    }
  };

  const saveBadge = saveText && (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${saveState === 'error' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
      {saveText}
    </span>
  );

  const renderEventList = () => (
    <div className="scene-mgr relative z-10 max-w-5xl mx-auto px-6 py-8 md:py-12">
      <header className="card-animate mb-8" style={{ animationDelay: '0ms' }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center"
              title="返回首頁"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <FileDown className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold gradient-text tracking-tight">Truss 工作台</h1>
            </div>
          </div>
          {saveBadge}
        </div>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl card-animate">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card-animate" style={stagger(0)}>
          {creatingEvent ? (
            <div className="new-card p-5 flex flex-col gap-3" style={{ borderStyle: 'solid', borderColor: 'rgba(56,100,220,0.4)' }}>
              <p className="text-sm font-medium text-slate-600">新場次名稱</p>
              <input
                ref={newEventInputRef}
                value={newEventName}
                onChange={e => setNewEventName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateEvent();
                  if (e.key === 'Escape') {
                    setCreatingEvent(false);
                    setNewEventName('');
                  }
                }}
                placeholder="輸入名稱..."
                className="create-input px-4 py-2.5 text-sm w-full"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateEvent}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  建立
                </button>
                <button
                  onClick={() => {
                    setCreatingEvent(false);
                    setNewEventName('');
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-slate-600 text-sm transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreatingEvent(true)}
              className="new-card w-full h-full min-h-[180px] flex flex-col items-center justify-center gap-3 p-6"
            >
              <div className="plus-ring w-12 h-12 rounded-full border-2 border-blue-500/30 flex items-center justify-center">
                <Plus className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">新增場次</p>
                <p className="text-xs text-slate-400 mt-0.5">建立空白 Truss 場次</p>
              </div>
            </button>
          )}
        </div>

        {loading && (
          <>
            {[0, 1, 2].map(i => (
              <div key={i} className="card-animate" style={stagger(i + 1)}>
                <div className="scene-card p-0">
                  <div className="h-28 bg-slate-100 animate-pulse" />
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
          <div key={event.id} className="card-animate" style={stagger(i + 1)}>
            <div
              className="scene-card"
              onClick={() => setSelectedEventId(event.id)}
            >
              <div className="h-28 bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden relative">
                <div className="card-thumb w-full h-full flex items-center justify-center">
                  <div className="relative">
                    <div className="w-16 h-11 rounded border border-slate-200 bg-white flex items-center justify-center">
                      <CalendarDays className="w-5 h-5 text-slate-300" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 min-w-6 h-5 rounded bg-blue-100 border border-blue-300 px-1 flex items-center justify-center text-[10px] font-bold text-blue-600">
                      {event.structures.length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  {renamingEventId === event.id ? (
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => commitRenameEvent(event.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRenameEvent(event.id);
                        if (e.key === 'Escape') cancelRenameEvent();
                      }}
                      className="create-input w-full px-2.5 py-1.5 text-sm font-medium text-slate-700"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="text-sm font-medium text-slate-700 truncate">{event.name}</h3>
                      <button
                        onClick={(e) => startRenameEvent(e, event)}
                        className="shrink-0 p-1 rounded-md text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                        title="重新命名"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1">{event.structures.length} 座結構</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Clock className="w-3 h-3 text-slate-300" />
                    <span className="text-xs text-slate-400">{formatDate(event.updated_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={(e) => handleDeleteEvent(e, event.id)}
                    className="delete-btn p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="刪除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="card-arrow p-1.5 text-blue-400">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && events.length === 0 && (
          <div className="card-animate col-span-full sm:col-span-1 lg:col-span-2 flex items-center justify-center py-12" style={stagger(1)}>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                <FileDown className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">還沒有場次</p>
              <p className="text-xs text-slate-300 mt-1">點左側新增第一個 Truss 場次</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderEventDetail = (event: TrussStudioEvent) => (
    <div className="max-w-6xl mx-auto px-6 py-8 md:py-10">
      <header className="truss-no-print bg-white border border-slate-200 rounded-lg shadow-sm p-4 mb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                setSelectedEventId(null);
                setBuilder(null);
              }}
              className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center"
              title="返回場次列表"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <FileDown className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-800 truncate">{event.name}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {saveBadge}
            <button
              onClick={() => setBuilder({ mode: 'new' })}
              className="h-9 px-3 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              新增結構
            </button>
            <button
              onClick={handleDownloadAll}
              disabled={structures.length === 0}
              className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              全部 PNG
            </button>
            <button
              onClick={() => window.print()}
              disabled={structures.length === 0}
              className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              列印
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="truss-no-print mb-5 p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      {structures.length === 0 ? (
        <div className="truss-no-print bg-white border border-slate-200 rounded-lg shadow-sm p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
            <FileDown className="w-6 h-6 text-blue-500" />
          </div>
          <h2 className="text-sm font-bold text-slate-700">尚未建立 Truss 結構</h2>
          <p className="text-xs text-slate-400 mt-1 mb-5">新增第一個結構後，這裡會顯示 2D 結構圖與 BOM。</p>
          <button
            onClick={() => setBuilder({ mode: 'new' })}
            className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 inline-flex items-center gap-1.5"
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
                    onClick={() => setBuilder({ mode: 'edit', id: entry.id })}
                    className="h-8 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    編輯
                  </button>
                  <button
                    onClick={() => handleDuplicate(entry)}
                    className="h-8 px-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    複製
                  </button>
                  <button
                    onClick={() => handleDelete(entry)}
                    className="h-8 px-2.5 rounded-lg bg-white border border-red-100 text-red-500 text-xs font-semibold hover:bg-red-50 flex items-center gap-1.5"
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
    <div className="min-h-screen bg-[#f5f5f7] text-slate-800 overflow-auto">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,300&display=swap');
          .scene-mgr * { font-family: 'DM Sans', sans-serif; }
          .scene-mgr { position: relative; }
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .card-animate {
            opacity: 0;
            animation: fadeSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .scene-card {
            position: relative;
            background: #ffffff;
            border: 1px solid rgba(0,0,0,0.06);
            border-radius: 16px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .scene-card:hover {
            border-color: rgba(0,0,0,0.1);
            transform: translateY(-4px);
            box-shadow: 0 12px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);
          }
          .scene-card:hover .card-thumb {
            transform: scale(1.05);
          }
          .scene-card:hover .card-arrow {
            opacity: 1;
            transform: translateX(0);
          }
          .scene-card:hover .delete-btn {
            opacity: 1;
          }
          .card-thumb {
            transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .card-arrow {
            opacity: 0;
            transform: translateX(-8px);
            transition: all 0.3s ease;
          }
          .delete-btn {
            opacity: 0;
            transition: opacity 0.2s ease;
          }
          .new-card {
            background: #ffffff;
            border: 1px dashed rgba(56,100,220,0.35);
            border-radius: 16px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .new-card:hover {
            border-color: rgba(56,100,220,0.6);
            background: rgba(56,100,220,0.04);
            transform: translateY(-4px);
            box-shadow: 0 12px 32px -8px rgba(56,100,220,0.15);
          }
          .new-card:hover .plus-ring {
            transform: scale(1.1);
            border-color: rgba(56,100,220,0.8);
            background: rgba(56,100,220,0.1);
          }
          .plus-ring {
            transition: all 0.3s ease;
          }
          .create-input {
            background: #f8f9fb;
            border: 1px solid rgba(0,0,0,0.1);
            border-radius: 12px;
            color: #1e293b;
            outline: none;
            transition: border-color 0.2s ease;
          }
          .create-input:focus {
            border-color: rgba(56,100,220,0.6);
            box-shadow: 0 0 0 3px rgba(56,100,220,0.1);
          }
          .create-input::placeholder { color: rgba(0,0,0,0.3); }
          .gradient-text {
            background: linear-gradient(135deg, #1e293b 0%, #475569 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          @media print {
            body * { visibility: hidden; }
            .truss-studio-print-area, .truss-studio-print-area * { visibility: visible; }
            .truss-studio-print-area { position: absolute; inset: 0; background: white; overflow: visible !important; padding: 0 !important; }
            .truss-no-print { display: none !important; }
            .truss-print-card { break-after: page; page-break-after: always; box-shadow: none !important; border: 0 !important; }
          }
        `}
      </style>

      {selectedEvent ? renderEventDetail(selectedEvent) : renderEventList()}

      {builder && selectedEvent && (
        <TrussBuilderModal
          initialConfig={editingEntry?.config}
          onClose={() => setBuilder(null)}
          onSubmit={handleSubmit}
          submitLabel={builder.mode === 'new' ? '新增結構' : '儲存結構'}
        />
      )}
    </div>
  );
};
