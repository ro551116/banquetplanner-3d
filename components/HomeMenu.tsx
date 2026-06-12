import React, { useEffect, useState } from 'react';
import { ArrowRight, Box, FileDown } from 'lucide-react';
import { scenesApi } from '../services/scenesApi';
import { trussStudioApi } from '../services/trussStudioApi';

interface HomeMenuProps {
  onOpenScenes: () => void;
  onOpenTrussStudio: () => void;
}

type CountState = {
  scenes: number | null;
  events: number | null;
};

const entries = [
  {
    key: 'scenes',
    title: '🏛 宴會廳 3D 場景',
    subtitle: '3D 擺場規劃、燈光音響、截圖',
    icon: Box,
    badgeLabel: '場景',
  },
  {
    key: 'truss',
    title: '🛠 Truss 工作台',
    subtitle: '結構配段、結構圖輸出、BOM、場次管理',
    icon: FileDown,
    badgeLabel: '場次',
  },
] as const;

export const HomeMenu: React.FC<HomeMenuProps> = ({
  onOpenScenes,
  onOpenTrussStudio,
}) => {
  const [counts, setCounts] = useState<CountState>({ scenes: null, events: null });

  useEffect(() => {
    let active = true;

    scenesApi.list()
      .then(list => {
        if (active) setCounts(prev => ({ ...prev, scenes: list.length }));
      })
      .catch(() => {
        if (active) setCounts(prev => ({ ...prev, scenes: null }));
      });

    trussStudioApi.get()
      .then(data => {
        if (active) setCounts(prev => ({ ...prev, events: Array.isArray(data.events) ? data.events.length : null }));
      })
      .catch(() => {
        if (active) setCounts(prev => ({ ...prev, events: null }));
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-slate-800 overflow-auto">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,300&display=swap');
        .home-menu * { font-family: 'DM Sans', sans-serif; }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .home-card-animate {
          opacity: 0;
          animation: fadeSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .home-entry-card {
          position: relative;
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .home-entry-card:hover {
          border-color: rgba(0,0,0,0.1);
          transform: translateY(-4px);
          box-shadow: 0 12px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);
        }
        .home-entry-card:hover .home-card-arrow {
          opacity: 1;
          transform: translateX(0);
        }
        .home-card-arrow {
          opacity: 0;
          transform: translateX(-8px);
          transition: all 0.3s ease;
        }
        .gradient-text {
          background: linear-gradient(135deg, #1e293b 0%, #475569 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      <div className="home-menu relative z-10 max-w-5xl mx-auto px-6 py-12 md:py-16">
        <header className="home-card-animate mb-10" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Box className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold gradient-text tracking-tight">Banquet 3D</h1>
          </div>
          <p className="text-sm text-slate-400 ml-12">選擇工作區</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {entries.map((entry, index) => {
            const Icon = entry.icon;
            const count = entry.key === 'scenes' ? counts.scenes : counts.events;
            const onClick = entry.key === 'scenes' ? onOpenScenes : onOpenTrussStudio;

            return (
              <button
                key={entry.key}
                onClick={onClick}
                className="home-entry-card home-card-animate min-h-[260px] p-7 text-left flex flex-col justify-between"
                style={{ animationDelay: `${80 + index * 70}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-blue-500" />
                  </div>
                  {count !== null && (
                    <span className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-bold text-blue-600">
                      {count} {entry.badgeLabel}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-800">{entry.title}</h2>
                  <p className="text-sm leading-6 text-slate-500">{entry.subtitle}</p>
                </div>

                <div className="flex items-center justify-between pt-5">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Open</span>
                  <ArrowRight className="home-card-arrow w-5 h-5 text-blue-400" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
