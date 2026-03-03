import React from 'react';
import {
  SunMedium, Moon, Image as ImageIcon,
  LayoutGrid, ArrowDownToLine, Tv, PanelLeft
} from 'lucide-react';
import { PRESET_VIEWS } from '../constants';

const PRESET_VIEW_ICONS = [
  <LayoutGrid className="w-4 h-4" />,
  <ArrowDownToLine className="w-4 h-4" />,
  <Tv className="w-4 h-4" />,
  <PanelLeft className="w-4 h-4" />,
];

interface ViewToolbarProps {
  viewIndex: number;
  setViewIndex: (idx: number) => void;
  viewEnvironment: 'day' | 'night';
  setViewEnvironment: React.Dispatch<React.SetStateAction<'day' | 'night'>>;
  takeScreenshot: () => void;
}

export const ViewToolbar: React.FC<ViewToolbarProps> = ({
  viewIndex, setViewIndex, viewEnvironment, setViewEnvironment, takeScreenshot
}) => {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 w-[95%] max-w-fit animate-in slide-in-from-bottom-10 duration-300">
      <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-4 overflow-x-auto">
        {/* Day/Night Toggle */}
        <button
          onClick={() => setViewEnvironment(prev => prev === 'day' ? 'night' : 'day')}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all min-w-[4rem]
            ${viewEnvironment === 'night' ? 'bg-indigo-900 text-yellow-300' : 'bg-blue-50 text-orange-500'}`}
        >
          {viewEnvironment === 'day' ? <SunMedium className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span className="text-[9px] font-bold">{viewEnvironment === 'day' ? 'Day' : 'Night'}</span>
        </button>
        <div className="w-px h-8 bg-slate-200 mx-1 flex-shrink-0"></div>

        {PRESET_VIEWS.map((v, idx) => (
          <button
            key={idx}
            onClick={() => setViewIndex(idx)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all min-w-[4rem]
              ${viewIndex === idx ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
          >
            {PRESET_VIEW_ICONS[idx]}
            <span className="text-[9px] font-bold whitespace-nowrap">{v.name.split(' ')[0]}</span>
          </button>
        ))}
        <div className="w-px h-8 bg-slate-200 mx-1 flex-shrink-0"></div>
        <button
          onClick={takeScreenshot}
          className="flex flex-col items-center gap-1 p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 min-w-[4rem] transition-colors"
        >
          <ImageIcon className="w-4 h-4" />
          <span className="text-[9px] font-bold">截圖</span>
        </button>
      </div>
    </div>
  );
};
