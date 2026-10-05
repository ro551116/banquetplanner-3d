import React, { useEffect, useState } from 'react';
import { ArrowRight, Box, Construction, LayoutGrid } from 'lucide-react';
import { scenesApi, type SceneMeta } from '../services/scenesApi';
import { trussStudioApi } from '../services/trussStudioApi';

interface HomeMenuProps {
  onOpenScenes: () => void;
  onOpenTrussStudio: () => void;
  onOpenScene: (id: string) => void;
}

const entries = [
  { key: 'scenes', title: '宴會廳 3D 場景', subtitle: '3D 擺場規劃、燈光音響、截圖', icon: Box, badgeLabel: '場景' },
  { key: 'truss', title: 'Truss 工作台', subtitle: '結構配段、結構圖輸出、BOM、場次管理', icon: Construction, badgeLabel: '場次' },
] as const;

export const HomeMenu: React.FC<HomeMenuProps> = ({ onOpenScenes, onOpenTrussStudio, onOpenScene }) => {
  const [scenes, setScenes] = useState<SceneMeta[] | null>(null);
  const [eventCount, setEventCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    scenesApi.list().then(list => { if (active) setScenes(list); }).catch(() => {});
    trussStudioApi.get().then(data => {
      if (active) setEventCount(Array.isArray(data.events) ? data.events.length : null);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const recentScenes = [...(scenes ?? [])].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 3);

  return (
    <div className="h-screen overflow-y-auto bg-slate-100">
      <main className="page-shell space-y-8">
        <header className="animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white"><Box className="h-5 w-5" /></div>
            <h1 className="page-title">Banquet 3D</h1>
          </div>
          <p className="page-subtitle ml-12 mt-2">選擇工作區</p>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {entries.map((entry, index) => {
            const Icon = entry.icon;
            const count = entry.key === 'scenes' ? scenes?.length : eventCount;
            return (
              <button key={entry.key} onClick={entry.key === 'scenes' ? onOpenScenes : onOpenTrussStudio}
                className="entity-card animate-slide-up flex min-h-[220px] flex-col gap-6 p-6 text-left" style={{ animationDelay: `${80 + index * 60}ms` }}>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50"><Icon className="h-6 w-6 text-slate-600" /></div>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{count ?? '—'} {entry.badgeLabel}</span>
                </div>
                <div className="space-y-2"><h2 className="text-base font-semibold text-slate-900">{entry.title}</h2><p className="text-sm text-slate-600">{entry.subtitle}</p></div>
                <ArrowRight className="ml-auto h-5 w-5 text-slate-400" />
              </button>
            );
          })}
        </div>
        {recentScenes.length > 0 && (
          <section className="space-y-4">
            <h2 className="ui-section-title">最近編輯</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {recentScenes.map((scene, index) => (
                <button key={scene.id} onClick={() => onOpenScene(scene.id)} className="entity-card animate-slide-up text-left" style={{ animationDelay: `${200 + index * 60}ms` }}>
                  <div className="entity-card-thumb">
                    {scene.thumbnail ? <img src={scene.thumbnail} alt="" className="h-full w-full object-cover" /> : <LayoutGrid className="h-6 w-6 text-slate-400" />}
                  </div>
                  <div className="space-y-1 p-4"><h3 className="truncate text-sm font-medium text-slate-900">{scene.name}</h3><p className="text-xs text-slate-500">更新於 {new Date(scene.updated_at).getMonth() + 1}月{new Date(scene.updated_at).getDate()}日</p></div>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
