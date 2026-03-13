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
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-auto">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,300&display=swap');
        .scene-mgr * { font-family: 'DM Sans', sans-serif; }
        .scene-mgr { position: relative; }
        .scene-mgr::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 50% -10%, rgba(56,100,220,0.15), transparent),
            radial-gradient(ellipse 50% 40% at 80% 80%, rgba(120,60,200,0.08), transparent);
          pointer-events: none;
          z-index: 0;
        }
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
          background: linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .scene-card:hover {
          border-color: rgba(255,255,255,0.15);
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08);
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
          background: linear-gradient(145deg, rgba(56,100,220,0.12), rgba(120,60,200,0.08));
          border: 1px dashed rgba(56,100,220,0.3);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .new-card:hover {
          border-color: rgba(56,100,220,0.6);
          background: linear-gradient(145deg, rgba(56,100,220,0.18), rgba(120,60,200,0.12));
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -12px rgba(56,100,220,0.2);
        }
        .new-card:hover .plus-ring {
          transform: scale(1.1);
          border-color: rgba(56,100,220,0.8);
          background: rgba(56,100,220,0.15);
        }
        .plus-ring {
          transition: all 0.3s ease;
        }
        .create-input {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          color: white;
          outline: none;
          transition: border-color 0.2s ease;
        }
        .create-input:focus {
          border-color: rgba(56,100,220,0.6);
          box-shadow: 0 0 0 3px rgba(56,100,220,0.15);
        }
        .create-input::placeholder { color: rgba(255,255,255,0.3); }
        .gradient-text {
          background: linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.6) 100%);
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
          <p className="text-sm text-white/40 ml-12">場景管理</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl card-animate">
            {error}
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* New Scene Card */}
          <div className="card-animate" style={stagger(0)}>
            {creating ? (
              <div className="new-card p-5 flex flex-col gap-3" style={{ borderStyle: 'solid', borderColor: 'rgba(56,100,220,0.4)' }}>
                <p className="text-sm font-medium text-white/70">新場景名稱</p>
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
                    className="px-4 py-2 text-white/40 hover:text-white/70 text-sm transition-colors"
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
                  <p className="text-sm font-medium text-white/70">新增場景</p>
                  <p className="text-xs text-white/30 mt-0.5">建立空白場景</p>
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
                    <div className="h-28 bg-white/[0.03] animate-pulse" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 w-24 bg-white/[0.06] rounded animate-pulse" />
                      <div className="h-3 w-16 bg-white/[0.04] rounded animate-pulse" />
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
                <div className="h-28 bg-gradient-to-br from-white/[0.04] to-white/[0.01] overflow-hidden relative">
                  {scene.thumbnail ? (
                    <img src={scene.thumbnail} alt="" className="card-thumb w-full h-full object-cover" />
                  ) : (
                    <div className="card-thumb w-full h-full flex items-center justify-center">
                      <div className="relative">
                        <div className="w-14 h-10 rounded border border-white/[0.08] bg-white/[0.03] flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-white/15" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-500/30" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-white/85 truncate">{scene.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Clock className="w-3 h-3 text-white/25" />
                      <span className="text-xs text-white/30">{formatDate(scene.updated_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={(e) => handleDelete(e, scene.id)}
                      className="delete-btn p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors"
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
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                  <Box className="w-6 h-6 text-white/15" />
                </div>
                <p className="text-sm text-white/30">還沒有場景</p>
                <p className="text-xs text-white/20 mt-1">點左側新增你的第一個場景</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
