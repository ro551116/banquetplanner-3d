import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Box, Clock, Sparkles, ArrowRight } from 'lucide-react';
import { scenesApi, SceneMeta } from '../services/scenesApi';

interface SceneManagerProps {
  onLoad: (sceneId: string) => void;
  onNew: (sceneId: string) => void;
}

/* Stagger delay helper */
const stagger = (i: number) => ({ animationDelay: `${80 + i * 60}ms` });

export const SceneManager: React.FC<SceneManagerProps> = ({ onLoad, onNew }) => {
  const [scenes, setScenes] = useState<SceneMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchScenes = async () => {
    try {
      setLoading(true);
      const list = await scenesApi.list();
      setScenes(list);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load scenes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchScenes(); }, []);
  useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const scene = await scenesApi.create(newName.trim());
      setCreating(false);
      setNewName('');
      onNew(scene.id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('確定要刪除這個場景？')) return;
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
    <div className="min-h-screen bg-[#f5f5f7] text-slate-800 overflow-auto">
      <style>{`
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
      `}</style>

      <div className="scene-mgr relative z-10 max-w-5xl mx-auto px-6 py-12 md:py-16">
        {/* Header */}
        <div className="card-animate mb-10" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Box className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold gradient-text tracking-tight">Banquet 3D</h1>
          </div>
          <p className="text-sm text-slate-400 ml-12">場景管理</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl card-animate">
            {error}
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* New Scene Card */}
          <div className="card-animate" style={stagger(0)}>
            {creating ? (
              <div className="new-card p-5 flex flex-col gap-3" style={{ borderStyle: 'solid', borderColor: 'rgba(56,100,220,0.4)' }}>
                <p className="text-sm font-medium text-slate-600">新場景名稱</p>
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                  }}
                  placeholder="輸入名稱..."
                  className="create-input px-4 py-2.5 text-sm w-full"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreate}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    建立
                  </button>
                  <button
                    onClick={() => { setCreating(false); setNewName(''); }}
                    className="px-4 py-2 text-slate-400 hover:text-slate-600 text-sm transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="new-card w-full h-full min-h-[180px] flex flex-col items-center justify-center gap-3 p-6"
              >
                <div className="plus-ring w-12 h-12 rounded-full border-2 border-blue-500/30 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">新增場景</p>
                  <p className="text-xs text-slate-400 mt-0.5">建立空白場景</p>
                </div>
              </button>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <>
              {[0, 1, 2].map(i => (
                <div key={i} className="card-animate" style={stagger(i + 1)}>
                  <div className="scene-card p-0">
                    <div className="h-28 bg-slate-100 animate-pulse" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                      <div className="h-3 w-16 bg-slate-50 rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Scene Cards */}
          {!loading && scenes.map((scene, i) => (
            <div key={scene.id} className="card-animate" style={stagger(i + 1)}>
              <div
                className="scene-card"
                onClick={() => onLoad(scene.id)}
              >
                {/* Thumbnail */}
                <div className="h-28 bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden relative">
                  {scene.thumbnail ? (
                    <img src={scene.thumbnail} alt="" className="card-thumb w-full h-full object-cover" />
                  ) : (
                    <div className="card-thumb w-full h-full flex items-center justify-center">
                      <div className="relative">
                        <div className="w-14 h-10 rounded border border-slate-200 bg-white flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-slate-300" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-sm bg-blue-100 border border-blue-300" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-slate-700 truncate">{scene.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Clock className="w-3 h-3 text-slate-300" />
                      <span className="text-xs text-slate-400">{formatDate(scene.updated_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={(e) => handleDelete(e, scene.id)}
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

          {/* Empty state */}
          {!loading && scenes.length === 0 && (
            <div className="card-animate col-span-full sm:col-span-1 lg:col-span-2 flex items-center justify-center py-12" style={stagger(1)}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <Box className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400">還沒有場景</p>
                <p className="text-xs text-slate-300 mt-1">點左側新增你的第一個場景</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
