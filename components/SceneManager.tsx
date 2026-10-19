import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, LayoutGrid, ArrowLeft } from 'lucide-react';
import { scenesApi, SceneMeta } from '../services/scenesApi';
import { hallPresetsApi, type HallPresetMeta } from '../services/hallPresetsApi';
import { INITIAL_HALL } from '../constants';
import { presetHallFor, withPresetStructures } from '../hallPresets';
import { HallPresetOptions } from './HallPresetPanel';

interface SceneManagerProps {
  onLoad: (sceneId: string) => void;
  onNew: (sceneId: string) => void;
  onBackHome: () => void;
}

/* Stagger delay helper */
const stagger = (i: number) => ({ animationDelay: `${80 + i * 60}ms` });

export const SceneManager: React.FC<SceneManagerProps> = ({ onLoad, onNew, onBackHome }) => {
  const [scenes, setScenes] = useState<SceneMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [hallPresets, setHallPresets] = useState<HallPresetMeta[]>([]);
  const [hallPresetId, setHallPresetId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchScenes = async () => {
    try {
      setLoading(true);
      const list = await scenesApi.list();
      setScenes(list);
      setError(null);
    } catch (err: any) {
      setError(err.message || '載入場景失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchScenes(); }, []);
  useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);
  // Without saved halls (or when the list fails to load) the form stays the plain name field.
  useEffect(() => {
    if (creating) hallPresetsApi.list().then(setHallPresets, () => setHallPresets([]));
  }, [creating]);
  const closeCreate = () => { setCreating(false); setNewName(''); setHallPresetId(''); };

  const [submitting, setSubmitting] = useState(false);
  // A ref, not state: two clicks in the same frame both see `submitting === false` before React re-renders.
  const submittingRef = useRef(false);
  const handleCreate = async () => {
    // One POST per click/Enter: a double click or held Enter used to create duplicate scenes.
    if (!newName.trim() || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      // A scene from a hall preset carries the venue's hall and structures, without the default stage and speakers.
      const preset = hallPresetId ? await hallPresetsApi.load(hallPresetId) : null;
      const scene = await scenesApi.create(newName.trim(), preset ? {
        hall: presetHallFor(INITIAL_HALL, preset.hall, preset.title),
        objects: withPresetStructures([], preset.objects, () => crypto.randomUUID()),
      } : undefined);
      closeCreate();
      onNew(scene.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '建立場景失敗，請稍後再試。');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(`確定要刪除場景「${scenes.find(scene => scene.id === id)?.name ?? '未命名場景'}」？`)) return;
    try {
      await scenesApi.delete(id);
      setScenes(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
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

  return (
    <div className="h-screen overflow-y-auto bg-slate-100">
      <main className="page-shell space-y-6">
        <header className="animate-slide-up flex items-start gap-3">
          <button onClick={onBackHome} className="ui-icon-btn" aria-label="返回首頁"><ArrowLeft className="h-4 w-4" /></button>
          <div><h1 className="page-title">場景</h1><p className="page-subtitle mt-2">{scenes.length} 個場景</p></div>
        </header>
        {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600"><span>{error}</span><button className="ui-btn-secondary" onClick={fetchScenes} disabled={loading}>重試</button></div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="animate-slide-up" style={stagger(0)}>
            {creating ? (
              <div className="ui-card flex flex-col gap-3 p-4">
                <label htmlFor="new-scene-name" className="ui-label">新場景名稱</label>
                <input id="new-scene-name" ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    // Enter/Esc that confirm or dismiss an IME candidate must not create a half-typed scene.
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') closeCreate();
                  }}
                  placeholder="輸入名稱…" className="ui-input" />
                {hallPresets.length > 0 && <>
                  <label htmlFor="new-scene-hall" className="ui-label">廳房</label>
                  <select id="new-scene-hall" value={hallPresetId} onChange={e => setHallPresetId(e.target.value)} className="ui-input">
                    <option value="">空白場地（預設舞台與喇叭）</option>
                    <HallPresetOptions presets={hallPresets} />
                  </select>
                  {hallPresetId && <p className="text-xs text-slate-500">帶入廳房的尺寸、外框、材質與門／柱子／隔間牆，不含預設舞台與喇叭。</p>}
                </>}
                <div className="flex gap-2"><button onClick={handleCreate} disabled={submitting} className="ui-btn-primary flex-1">{submitting ? '建立中…' : '建立'}</button><button onClick={closeCreate} className="ui-btn-ghost">取消</button></div>
              </div>
            ) : (
              <button onClick={() => setCreating(true)} className="new-entity-card flex h-full min-h-[120px] sm:min-h-[200px] w-full flex-col items-center justify-center gap-3 p-6">
                <Plus className="h-6 w-6 text-blue-600" /><span className="text-sm font-medium text-slate-900">新增場景</span><span className="text-xs text-slate-500">建立空白場景</span>
              </button>
            )}
          </div>
          {loading && [0, 1, 2].map(i => <div key={i} className="ui-card overflow-hidden" aria-label="載入中"><div className="aspect-video animate-pulse bg-slate-200" /><div className="p-4"><div className="h-4 w-24 animate-pulse rounded bg-slate-100" /></div></div>)}
          {!loading && scenes.map((scene, i) => (
            <div key={scene.id} className="entity-card animate-slide-up" style={stagger(i + 1)} role="button" tabIndex={0}
              aria-label={`開啟場景 ${scene.name}`} onClick={() => onLoad(scene.id)}
              onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onLoad(scene.id); } }}>
              <div className="entity-card-thumb">
                {scene.thumbnail ? <img src={scene.thumbnail} alt="" className="h-full w-full object-cover" /> : <LayoutGrid className="h-6 w-6 text-slate-400" />}
              </div>
              <div className="flex items-center justify-between gap-2 p-4">
                <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-slate-900">{scene.name}</h3><p className="mt-1 text-xs text-slate-500">更新於 {formatDate(scene.updated_at)}</p></div>
                <div className="entity-card-actions"><button onClick={e => handleDelete(e, scene.id)} className="ui-icon-btn min-h-9 min-w-9 hover:bg-red-50 hover:text-red-600" aria-label={`刪除場景 ${scene.name}`}><Trash2 className="h-4 w-4" /></button></div>
              </div>
            </div>
          ))}
          {!loading && !error && scenes.length === 0 && <div className="col-span-full flex flex-col items-center justify-center gap-2 py-12 sm:col-span-1 lg:col-span-2"><LayoutGrid className="mb-2 h-8 w-8 text-slate-400" /><p className="text-sm text-slate-600">還沒有場景</p><p className="text-xs text-slate-500">新增你的第一個場景</p></div>}
        </div>
      </main>
    </div>
  );
};
