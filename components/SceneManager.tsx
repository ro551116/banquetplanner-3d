import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FolderOpen, Clock } from 'lucide-react';
import { scenesApi, SceneMeta } from '../services/scenesApi';

interface SceneManagerProps {
  onLoad: (sceneId: string) => void;
  onNew: (sceneId: string) => void;
}

export const SceneManager: React.FC<SceneManagerProps> = ({ onLoad, onNew }) => {
  const [scenes, setScenes] = useState<SceneMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

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
    return d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-800">Banquet 3D</h1>
          <p className="text-sm text-slate-500 mt-1">選擇場景或建立新場景</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* New Scene */}
        <div className="p-6 pb-3">
          {creating ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="場景名稱..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                建立
              </button>
              <button
                onClick={() => { setCreating(false); setNewName(''); }}
                className="px-3 py-2 text-slate-500 text-sm hover:text-slate-700"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新增場景
            </button>
          )}
        </div>

        {/* Scene List */}
        <div className="px-6 pb-6">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">載入中...</div>
          ) : scenes.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">還沒有任何場景</div>
          ) : (
            <div className="space-y-2">
              {scenes.map(scene => (
                <button
                  key={scene.id}
                  onClick={() => onLoad(scene.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors text-left group"
                >
                  {/* Thumbnail placeholder */}
                  <div className="w-16 h-12 bg-slate-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {scene.thumbnail ? (
                      <img src={scene.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FolderOpen className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">{scene.name}</div>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {formatDate(scene.updated_at)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, scene.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="刪除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
