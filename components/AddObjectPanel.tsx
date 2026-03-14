import React, { useState } from 'react';
import {
  Disc, Maximize, Box, ScrollText,
  Music, MonitorPlay, MoveVertical,
  Lightbulb, Zap, GripHorizontal,
  Rows, Scan, RectangleHorizontal, Wind, Sliders, SunDim,
  Wine, Mic, SquareDashedBottom, Projector, Tv2, Contact,
  Plus, ChevronDown, ChevronRight, X,
} from 'lucide-react';
import { ObjectType } from '../types';

interface AddObjectPanelProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  addObject: (type: ObjectType) => void;
  setDraggedType: (type: ObjectType | null) => void;
  setIsDrawMode: (v: boolean) => void;
}

interface ObjectItem {
  type: ObjectType;
  label: string;
  icon: React.ReactNode;
}

interface Category {
  name: string;
  items: ObjectItem[];
}

const ICON_CLS = "w-4 h-4";

const CATEGORIES: Category[] = [
  {
    name: '場地佈置',
    items: [
      { type: ObjectType.ROUND_TABLE, label: '圓桌', icon: <Disc className={ICON_CLS} /> },
      { type: ObjectType.RECT_TABLE, label: '長桌', icon: <Maximize className={ICON_CLS} /> },
      { type: ObjectType.STAGE, label: '舞台', icon: <Box className={ICON_CLS} /> },
      { type: ObjectType.RED_CARPET, label: '紅地毯', icon: <ScrollText className={ICON_CLS} /> },
      { type: ObjectType.COCKTAIL_TABLE, label: '雞尾酒桌', icon: <Wine className={ICON_CLS} /> },
      { type: ObjectType.PODIUM, label: '講台', icon: <Mic className={ICON_CLS} /> },
      { type: ObjectType.DANCE_FLOOR, label: '舞池', icon: <SquareDashedBottom className={ICON_CLS} /> },
      { type: ObjectType.RECEPTION_DESK, label: '報到桌', icon: <Contact className={ICON_CLS} /> },
      { type: ObjectType.PROJECTION_SCREEN, label: '投影幕', icon: <Projector className={ICON_CLS} /> },
      { type: ObjectType.LED_WALL, label: 'LED牆', icon: <Tv2 className={ICON_CLS} /> },
    ],
  },
  {
    name: '音響設備',
    items: [
      { type: ObjectType.SPEAKER_15, label: '15吋喇叭', icon: <Music className={ICON_CLS} /> },
      { type: ObjectType.SPEAKER_SUB, label: '超低音', icon: <Box className={ICON_CLS} /> },
      { type: ObjectType.SPEAKER_MONITOR, label: '監聽喇叭', icon: <MonitorPlay className={ICON_CLS} /> },
      { type: ObjectType.SPEAKER_COLUMN, label: '音柱喇叭', icon: <MoveVertical className={ICON_CLS} /> },
      { type: ObjectType.SPEAKER_LINE_ARRAY, label: '線陣列', icon: <Rows className={ICON_CLS} /> },
    ],
  },
  {
    name: '燈光設備',
    items: [
      { type: ObjectType.LIGHT_PAR, label: 'LED帕燈', icon: <Lightbulb className={ICON_CLS} /> },
      { type: ObjectType.LIGHT_MOVING, label: '電腦燈', icon: <Zap className={ICON_CLS} /> },
      { type: ObjectType.LIGHT_STAND, label: 'T型燈桿', icon: <GripHorizontal className={ICON_CLS} /> },
      { type: ObjectType.LIGHT_FOLLOWSPOT, label: '追蹤燈', icon: <Scan className={ICON_CLS} /> },
      { type: ObjectType.LIGHT_WASH, label: '染色燈', icon: <RectangleHorizontal className={ICON_CLS} /> },
      { type: ObjectType.LIGHT_STROBE, label: '頻閃燈', icon: <SunDim className={ICON_CLS} /> },
    ],
  },
  {
    name: '其他設備',
    items: [
      { type: ObjectType.TRUSS_STRAIGHT, label: '桁架', icon: <GripHorizontal className={ICON_CLS} /> },
      { type: ObjectType.EQUIPMENT_MIXER, label: '混音台', icon: <Sliders className={ICON_CLS} /> },
      { type: ObjectType.EFFECTS_FOG, label: '煙霧機', icon: <Wind className={ICON_CLS} /> },
    ],
  },
];

export const AddObjectPanel: React.FC<AddObjectPanelProps> = ({
  isOpen, setIsOpen, addObject, setDraggedType, setIsDrawMode,
}) => {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(
    new Set([CATEGORIES[0].name])
  );

  const toggleCat = (name: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleAdd = (type: ObjectType) => {
    addObject(type);
    setIsDrawMode(false);
  };

  return (
    <>
      {/* Collapsed: just a "+" button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="hidden md:flex w-10 flex-shrink-0 bg-white border-r border-slate-200 items-center justify-center hover:bg-slate-50 transition-colors"
          title="展開物件面板"
        >
          <Plus className="w-5 h-5 text-slate-500" />
        </button>
      )}

      {/* Expanded panel — desktop */}
      <div
        className={`hidden md:flex flex-col bg-white border-r border-slate-200 flex-shrink-0 overflow-hidden transition-all duration-200 ${
          isOpen ? 'w-48' : 'w-0 border-r-0'
        }`}
        style={{ zIndex: 10 }}
      >
        {isOpen && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100">
              <span className="text-[10px] font-semibold text-slate-700">新增物件</span>
              <button
                onClick={() => setIsOpen(false)}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto py-0.5">
              {CATEGORIES.map(cat => {
                const expanded = expandedCats.has(cat.name);
                return (
                  <div key={cat.name}>
                    {/* Category header */}
                    <button
                      onClick={() => toggleCat(cat.name)}
                      className="w-full flex items-center gap-1.5 px-3 py-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      {expanded
                        ? <ChevronDown className="w-3 h-3" />
                        : <ChevronRight className="w-3 h-3" />
                      }
                      {cat.name}
                    </button>

                    {/* Items */}
                    {expanded && (
                      <div className="pb-0.5">
                        {cat.items.map(item => (
                          <button
                            key={item.type}
                            draggable
                            onDragStart={(e) => {
                              setDraggedType(item.type);
                              e.dataTransfer.setData('application/banquet-type', item.type);
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            onClick={() => handleAdd(item.type)}
                            className="w-full flex items-center gap-2 px-4 py-1 text-xs text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-grab active:cursor-grabbing"
                          >
                            {item.icon}
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Mobile: fixed overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsOpen(false)} />

          {/* Panel */}
          <div className="relative w-64 bg-white shadow-xl flex flex-col animate-slide-in-left">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-700">新增物件</span>
              <button
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto py-1">
              {CATEGORIES.map(cat => {
                const expanded = expandedCats.has(cat.name);
                return (
                  <div key={cat.name}>
                    <button
                      onClick={() => toggleCat(cat.name)}
                      className="w-full flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      {expanded
                        ? <ChevronDown className="w-3 h-3" />
                        : <ChevronRight className="w-3 h-3" />
                      }
                      {cat.name}
                    </button>

                    {expanded && (
                      <div className="pb-1">
                        {cat.items.map(item => (
                          <button
                            key={item.type}
                            onClick={() => handleAdd(item.type)}
                            className="w-full flex items-center gap-2 px-5 py-2 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          >
                            {item.icon}
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
