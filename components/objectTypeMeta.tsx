import type { LucideIcon } from 'lucide-react';
import {
  Disc, Maximize, Box, ScrollText, Wine, Mic, SquareDashedBottom, Contact, Projector, Tv2, Flower2,
  Music, Speaker, MonitorPlay, MoveVertical, Rows,
  Lightbulb, Zap, LampFloor, Scan, RectangleHorizontal, SunDim,
  Construction, GripHorizontal, Sliders, Wind,
  Armchair, DoorOpen, Columns, GlassWater, Presentation, Printer,
  Fuel, Power, Plug, Cable, Footprints,
  UtensilsCrossed, ShoppingCart, Martini,
  BoxSelect, MoveRight, Ruler, RectangleVertical, MapPin, Hash,
} from 'lucide-react';
import { BanquetObject, ObjectType } from '../types';

export type ObjectGroup = 'venue' | 'decor' | 'audio' | 'lighting' | 'power' | 'catering' | 'plan' | 'other';

export interface ObjectTypeMeta {
  label: string;
  Icon: LucideIcon;
  group: ObjectGroup;
  /** Shown in the add-object palette. Legacy/decor types stay renderable but are not offered. */
  palette: boolean;
  /** Seated tables: the count planners quote first (status bar "桌"). */
  table?: true;
}

/** Single source for object names, icons and grouping. Record keeps tsc complaining when a type is added. */
export const OBJECT_TYPE_META: Record<ObjectType, ObjectTypeMeta> = {
  [ObjectType.ROUND_TABLE]: { label: '圓桌', Icon: Disc, group: 'venue', palette: true, table: true },
  [ObjectType.RECT_TABLE]: { label: '長桌', Icon: Maximize, group: 'venue', palette: true, table: true },
  [ObjectType.STAGE]: { label: '舞台', Icon: Box, group: 'venue', palette: true },
  [ObjectType.RED_CARPET]: { label: '紅地毯', Icon: ScrollText, group: 'venue', palette: true },
  [ObjectType.COCKTAIL_TABLE]: { label: '雞尾酒桌', Icon: Wine, group: 'venue', palette: true },
  [ObjectType.PODIUM]: { label: '講台', Icon: Mic, group: 'venue', palette: true },
  [ObjectType.DANCE_FLOOR]: { label: '舞池', Icon: SquareDashedBottom, group: 'venue', palette: true },
  [ObjectType.RECEPTION_DESK]: { label: '報到桌', Icon: Contact, group: 'venue', palette: true },
  [ObjectType.PROJECTION_SCREEN]: { label: '投影幕', Icon: Projector, group: 'venue', palette: true },
  [ObjectType.LED_WALL]: { label: 'LED 牆', Icon: Tv2, group: 'venue', palette: true },
  [ObjectType.DECOR]: { label: '裝飾', Icon: Flower2, group: 'venue', palette: false },
  [ObjectType.CHAIR]: { label: '單椅', Icon: Armchair, group: 'venue', palette: true },
  [ObjectType.DOOR]: { label: '門', Icon: DoorOpen, group: 'venue', palette: true },
  [ObjectType.COLUMN]: { label: '柱子', Icon: Columns, group: 'venue', palette: true },
  [ObjectType.WALL]: { label: '隔間牆', Icon: RectangleVertical, group: 'venue', palette: true },

  [ObjectType.CHAMPAGNE_TOWER]: { label: '香檳塔', Icon: GlassWater, group: 'decor', palette: true },
  [ObjectType.EASEL]: { label: '畫架', Icon: Presentation, group: 'decor', palette: true },
  [ObjectType.KIOSK]: { label: '設備機台', Icon: Printer, group: 'decor', palette: true },
  [ObjectType.TABLE_NUMBER]: { label: '桌號牌', Icon: Hash, group: 'decor', palette: true },

  [ObjectType.SPEAKER_15]: { label: '15 吋喇叭', Icon: Music, group: 'audio', palette: true },
  [ObjectType.SPEAKER_SUB]: { label: '超低音', Icon: Speaker, group: 'audio', palette: true },
  [ObjectType.SPEAKER_MONITOR]: { label: '監聽喇叭', Icon: MonitorPlay, group: 'audio', palette: true },
  [ObjectType.SPEAKER_COLUMN]: { label: '音柱喇叭', Icon: MoveVertical, group: 'audio', palette: true },
  [ObjectType.SPEAKER_LINE_ARRAY]: { label: '線陣列', Icon: Rows, group: 'audio', palette: true },
  [ObjectType.SPEAKER]: { label: '喇叭', Icon: Speaker, group: 'audio', palette: false },

  [ObjectType.LIGHT_PAR]: { label: 'LED 帕燈', Icon: Lightbulb, group: 'lighting', palette: true },
  [ObjectType.LIGHT_MOVING]: { label: '電腦燈', Icon: Zap, group: 'lighting', palette: true },
  [ObjectType.LIGHT_STAND]: { label: 'T 型燈桿', Icon: LampFloor, group: 'lighting', palette: true },
  [ObjectType.LIGHT_FOLLOWSPOT]: { label: '追蹤燈', Icon: Scan, group: 'lighting', palette: true },
  [ObjectType.LIGHT_WASH]: { label: '染色燈', Icon: RectangleHorizontal, group: 'lighting', palette: true },
  [ObjectType.LIGHT_STROBE]: { label: '頻閃燈', Icon: SunDim, group: 'lighting', palette: true },
  [ObjectType.LIGHT]: { label: '燈具', Icon: Lightbulb, group: 'lighting', palette: false },

  [ObjectType.TRUSS_STRUCTURE]: { label: 'Truss 結構', Icon: Construction, group: 'other', palette: true },
  [ObjectType.TRUSS_STRAIGHT]: { label: '直桁架', Icon: GripHorizontal, group: 'other', palette: true },
  [ObjectType.EQUIPMENT_MIXER]: { label: '混音台', Icon: Sliders, group: 'other', palette: true },
  [ObjectType.EFFECTS_FOG]: { label: '煙霧機', Icon: Wind, group: 'other', palette: true },

  [ObjectType.GENERATOR]: { label: '發電機', Icon: Fuel, group: 'power', palette: true },
  [ObjectType.POWER_DISTRO]: { label: '配電箱', Icon: Power, group: 'power', palette: true },
  [ObjectType.POWER_OUTLET]: { label: '電源點', Icon: Plug, group: 'power', palette: true },
  [ObjectType.CABLE_RUN]: { label: '電源線路', Icon: Cable, group: 'power', palette: true },
  [ObjectType.CABLE_RAMP]: { label: '過線橋', Icon: Footprints, group: 'power', palette: true },

  [ObjectType.SERVICE_STATION]: { label: '備餐台', Icon: UtensilsCrossed, group: 'catering', palette: true },
  [ObjectType.BEVERAGE_CART]: { label: '酒水車', Icon: ShoppingCart, group: 'catering', palette: true },
  [ObjectType.BAR_COUNTER]: { label: '吧台', Icon: Martini, group: 'catering', palette: true },

  [ObjectType.ZONE]: { label: '區域標記', Icon: BoxSelect, group: 'plan', palette: true },
  [ObjectType.FLOW_ARROW]: { label: '動線箭頭', Icon: MoveRight, group: 'plan', palette: true },
  [ObjectType.DIMENSION]: { label: '尺寸標註', Icon: Ruler, group: 'plan', palette: true },
  [ObjectType.DEVICE_POINT]: { label: '設備點位', Icon: MapPin, group: 'plan', palette: true },
};

export const OBJECT_GROUPS: { id: ObjectGroup; label: string }[] = [
  { id: 'venue', label: '場地' },
  { id: 'decor', label: '佈置' },
  { id: 'audio', label: '音響' },
  { id: 'lighting', label: '燈光' },
  { id: 'power', label: '電力' },
  { id: 'catering', label: '餐飲' },
  { id: 'plan', label: '圖面' },
  { id: 'other', label: '其他' },
];

export function getObjectLabel(type: ObjectType): string {
  return OBJECT_TYPE_META[type]?.label ?? String(type);
}

/** User label first, then the type name. */
export function getObjectDisplayName(object: BanquetObject): string {
  return object.label?.trim() || getObjectLabel(object.type);
}
