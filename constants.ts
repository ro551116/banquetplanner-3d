import * as THREE from 'three';
import { BanquetObject, ObjectType, HallConfig, TableCloth } from './types';

export const INITIAL_HALL: HallConfig = {
  width: 15,
  length: 20,
  height: 5,
  wallColor: '#e8e8e8',
  floorColor: '#d4d4d4',
  wallRoughness: 0.85,
  wallMetalness: 0,
  floorRoughness: 0.6,
  floorMetalness: 0.05,
  baseboard: '#bbb',
};

export const THEMES = [
  {
    id: 'default', name: '現代簡約',
    wall: '#e8e8e8', floor: '#d4d4d4',
    wallRoughness: 0.85, wallMetalness: 0,
    floorRoughness: 0.6, floorMetalness: 0.05,
    baseboard: '#bbb',
  },
  {
    id: 'luxury', name: '暖色奢華',
    wall: '#f5edd6', floor: '#5c3a1e',
    wallRoughness: 0.7, wallMetalness: 0,
    floorRoughness: 0.35, floorMetalness: 0.1,
    baseboard: '#3d2510',
  },
  {
    id: 'royal', name: '尊爵深藍',
    wall: '#d0dae8', floor: '#1a2f5a',
    wallRoughness: 0.75, wallMetalness: 0,
    floorRoughness: 0.9, floorMetalness: 0,
    baseboard: '#14234a',
  },
  {
    id: 'romantic', name: '浪漫粉色',
    wall: '#f8e8ea', floor: '#e8c4cc',
    wallRoughness: 0.8, wallMetalness: 0,
    floorRoughness: 0.7, floorMetalness: 0,
    baseboard: '#c9a0a8',
  },
];

export type Theme = typeof THEMES[number];

export const INITIAL_OBJECTS: BanquetObject[] = [
  {
    id: '1',
    type: ObjectType.STAGE,
    position: { x: 0, y: 0, z: -8 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    color: '#ffffff',
    label: '舞台',
    customWidth: 8,
    customDepth: 4,
    customHeight: 0.6,
    hasBackdrop: false,
    stairs: [
      { id: 's1', side: 'front', offset: -3, width: 1.5 },
      { id: 's2', side: 'front', offset: 3, width: 1.5 }
    ]
  },
  {
    id: '2',
    type: ObjectType.SPEAKER_15,
    position: { x: -3, y: 0, z: -7 },
    rotation: { x: 0, y: 0.5, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    color: '#52525b',
    label: '左喇叭',
    standType: 'TRIPOD'
  },
  {
    id: '3',
    type: ObjectType.SPEAKER_15,
    position: { x: 3, y: 0, z: -7 },
    rotation: { x: 0, y: -0.5, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    color: '#52525b',
    label: '右喇叭',
    standType: 'TRIPOD'
  }
];

// Table cloth material properties lookup (uses meshPhysicalMaterial)
export const TABLE_CLOTH_MATERIALS: Record<TableCloth, {
  roughness: number; metalness: number; label: string;
  clearcoat?: number; clearcoatRoughness?: number;
  sheen?: number; sheenRoughness?: number; sheenColorFactor?: number;
}> = {
  linen:  { roughness: 0.9, metalness: 0, label: '亞麻' },
  satin:  { roughness: 0.15, metalness: 0.05, label: '緞面', clearcoat: 0.9, clearcoatRoughness: 0.05 },
  velvet: { roughness: 0.8, metalness: 0, label: '絨布', sheen: 1.0, sheenRoughness: 0.25, sheenColorFactor: 0.4 },
};

// Predefined table color+material presets
export const TABLE_PRESETS = [
  { id: 'classic-white',  name: '經典白',  color: '#f5f0e8', cloth: 'linen'  as TableCloth },
  { id: 'ivory-satin',    name: '象牙緞',  color: '#f0e6c8', cloth: 'satin'  as TableCloth },
  { id: 'champagne',      name: '香檳金',  color: '#d4b896', cloth: 'satin'  as TableCloth },
  { id: 'rose-pink',      name: '玫瑰粉',  color: '#d4a0a8', cloth: 'satin'  as TableCloth },
  { id: 'lavender',       name: '薰衣紫',  color: '#b8a0c8', cloth: 'linen'  as TableCloth },
  { id: 'royal-blue',     name: '皇家藍',  color: '#1e3a5f', cloth: 'satin'  as TableCloth },
  { id: 'forest-green',   name: '森林綠',  color: '#2d5a3d', cloth: 'velvet' as TableCloth },
  { id: 'burgundy',       name: '酒紅絨',  color: '#722f37', cloth: 'velvet' as TableCloth },
];

export const PRESET_VIEWS = [
  { name: '全景 (Overview)', pos: new THREE.Vector3(12, 12, 12), target: new THREE.Vector3(0, 0, 0) },
  { name: '俯視 (Top)', pos: new THREE.Vector3(0, 22, 0), target: new THREE.Vector3(0, 0, 0) },
  { name: '舞台 (Stage)', pos: new THREE.Vector3(0, 2, 5), target: new THREE.Vector3(0, 1, -8) },
  { name: '側面 (Side)', pos: new THREE.Vector3(7, 3, -2), target: new THREE.Vector3(-5, 1, -2) },
];

export const createObjectConfig = (
  type: ObjectType,
  position: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }
): BanquetObject => {
  const isLight = type.includes('LIGHT');
  const isSpeaker = type.includes('SPEAKER');

  const isTable = type === ObjectType.ROUND_TABLE || type === ObjectType.RECT_TABLE;

  let defaultColor = '#f5f0e8';
  if (isLight) defaultColor = '#fbbf24';
  else if (type === ObjectType.STAGE) defaultColor = '#ffffff';
  else if (type === ObjectType.RED_CARPET) defaultColor = '#b91c1c';
  else if (isSpeaker) defaultColor = '#888890';
  else if (isTable) defaultColor = '#f5f0e8';

  return {
    id: crypto.randomUUID(),
    type,
    position,
    rotation: { x: type === ObjectType.LIGHT_PAR ? Math.PI / 6 : 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    color: defaultColor,
    label: '',
    tableCloth: isTable ? 'linen' : undefined,
    customSize: type === ObjectType.ROUND_TABLE ? 6 : undefined,
    customWidth: type === ObjectType.STAGE ? 6 : (type === ObjectType.RED_CARPET ? 1.5 : undefined),
    customDepth: type === ObjectType.STAGE ? 4 : (type === ObjectType.RED_CARPET ? 10 : undefined),
    customHeight: type === ObjectType.STAGE ? 0.5 : undefined,
    hasBackdrop: type === ObjectType.STAGE ? false : undefined,
    intensity: isLight ? 1.5 : undefined,
    standType: 'TRIPOD',
    stairs: type === ObjectType.STAGE ? [{ id: crypto.randomUUID(), side: 'front', offset: 0, width: 2 }] : undefined
  };
};
