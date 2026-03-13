import React, { useMemo } from 'react';
import {
  MousePointer2,
  Pencil,
  Eye,
  Grid3X3,
  Speaker,
  Lightbulb,
  Theater,
} from 'lucide-react';
import { BanquetObject, ObjectType } from '../types';

interface StatusBarProps {
  mode: 'EDIT' | 'VIEW';
  isDrawMode: boolean;
  selectedIds: Set<string>;
  objects: BanquetObject[];
}

const TABLE_TYPES = new Set<ObjectType>([ObjectType.ROUND_TABLE, ObjectType.RECT_TABLE]);
const STAGE_TYPES = new Set<ObjectType>([ObjectType.STAGE, ObjectType.RED_CARPET]);
const AUDIO_TYPES = new Set<ObjectType>([
  ObjectType.SPEAKER_15,
  ObjectType.SPEAKER_SUB,
  ObjectType.SPEAKER_MONITOR,
  ObjectType.SPEAKER_COLUMN,
  ObjectType.SPEAKER,
]);
const LIGHT_TYPES = new Set<ObjectType>([
  ObjectType.LIGHT_PAR,
  ObjectType.LIGHT_MOVING,
  ObjectType.LIGHT_STAND,
  ObjectType.LIGHT,
]);

function getObjectDisplayName(obj: BanquetObject): string {
  if (obj.label) return obj.label;
  const names: Record<string, string> = {
    ROUND_TABLE: 'Round Table',
    RECT_TABLE: 'Rect Table',
    STAGE: 'Stage',
    RED_CARPET: 'Red Carpet',
    SPEAKER_15: 'Speaker 15"',
    SPEAKER_SUB: 'Subwoofer',
    SPEAKER_MONITOR: 'Monitor',
    SPEAKER_COLUMN: 'Column Array',
    LIGHT_PAR: 'LED Par',
    LIGHT_MOVING: 'Moving Head',
    LIGHT_STAND: 'Light Stand',
    SPEAKER: 'Speaker',
    LIGHT: 'Light',
    DECOR: 'Decor',
  };
  return names[obj.type] || obj.type;
}

export default function StatusBar({ mode, isDrawMode, selectedIds, objects }: StatusBarProps) {
  const counts = useMemo(() => {
    let tables = 0, stages = 0, audio = 0, lights = 0;
    for (const obj of objects) {
      if (TABLE_TYPES.has(obj.type)) tables++;
      else if (STAGE_TYPES.has(obj.type)) stages++;
      else if (AUDIO_TYPES.has(obj.type)) audio++;
      else if (LIGHT_TYPES.has(obj.type)) lights++;
    }
    return { tables, stages, audio, lights };
  }, [objects]);

  const selectedObjects = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return objects.filter((o) => selectedIds.has(o.id));
  }, [selectedIds, objects]);

  // Left: tool hint
  let toolText: React.ReactNode;
  let ToolIcon: React.ElementType;
  if (mode === 'VIEW') {
    toolText = 'View mode';
    ToolIcon = Eye;
  } else if (isDrawMode) {
    toolText = 'Draw mode: click and drag to annotate';
    ToolIcon = Pencil;
  } else {
    toolText = (
      <>
        Select an object{' '}
        <span className="text-gray-400 ml-1">(Shift+Click for multiple)</span>
      </>
    );
    ToolIcon = MousePointer2;
  }

  // Center: selection info
  let selectionText: React.ReactNode = null;
  if (selectedObjects.length === 1) {
    const obj = selectedObjects[0];
    selectionText = getObjectDisplayName(obj);
  } else if (selectedObjects.length > 1) {
    selectionText = `${selectedObjects.length} objects selected`;
  }

  return (
    <div
      className="flex items-center justify-between px-3 text-xs text-gray-600 select-none border-t border-gray-300 bg-[#f5f5f5] shrink-0"
      style={{ height: 28 }}
    >
      {/* Left — Tool / Mode */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <ToolIcon size={12} className="shrink-0 text-gray-500" />
        <span className="truncate">{toolText}</span>
      </div>

      {/* Center — Selection */}
      <div className="flex items-center justify-center gap-1.5 px-4 min-w-0 flex-1">
        {selectionText && (
          <>
            <MousePointer2 size={11} className="shrink-0 text-blue-500" />
            <span className="truncate font-medium text-gray-700">{selectionText}</span>
          </>
        )}
      </div>

      {/* Right — Object counts */}
      <div className="flex items-center gap-3 flex-none text-gray-500">
        {counts.tables > 0 && (
          <span className="flex items-center gap-1">
            <Grid3X3 size={12} />
            {counts.tables}
          </span>
        )}
        {counts.stages > 0 && (
          <span className="flex items-center gap-1">
            <Theater size={12} />
            {counts.stages}
          </span>
        )}
        {counts.audio > 0 && (
          <span className="flex items-center gap-1">
            <Speaker size={12} />
            {counts.audio}
          </span>
        )}
        {counts.lights > 0 && (
          <span className="flex items-center gap-1">
            <Lightbulb size={12} />
            {counts.lights}
          </span>
        )}
        <span className="text-gray-400 border-l border-gray-300 pl-3">
          {objects.length} total
        </span>
      </div>
    </div>
  );
}
