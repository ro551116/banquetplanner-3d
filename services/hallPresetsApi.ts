import { apiFetch } from './apiFetch';
import { normalizeSceneData } from './sceneData';
import { hallPresetTitle, type HallPresetContent } from '../hallPresets';
import type { BanquetObject, HallConfig } from '../types';

const API_BASE = '/api/hall-presets';

export interface HallPresetMeta {
  id: string;
  name: string;
  venue: string | null;
  width: number;
  length: number;
  height: number;
  /** Doors, columns and partition walls stored with the preset. */
  structures: number;
  created_at: string;
  updated_at: string;
}

export interface HallPresetPayload {
  name: string;
  venue: string | null;
  hall: HallConfig;
  objects: BanquetObject[];
}

export interface LoadedHallPreset extends HallPresetContent {
  title: string;
}

export const hallPresetsApi = {
  list: () => apiFetch<HallPresetMeta[]>(API_BASE),

  /** The stored hall and structures, normalized like scene data. */
  load: async (id: string): Promise<LoadedHallPreset> => {
    const preset = await apiFetch<{ name: string; venue?: string; hall: unknown; objects: unknown }>(`${API_BASE}/${id}`);
    const { hall, objects } = normalizeSceneData({ hall: preset.hall, objects: preset.objects });
    return { title: hallPresetTitle(preset), hall, objects };
  },

  create: (payload: HallPresetPayload) =>
    apiFetch<HallPresetMeta>(API_BASE, { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: HallPresetPayload) =>
    apiFetch<HallPresetMeta>(`${API_BASE}/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  delete: (id: string) =>
    apiFetch<{ deleted: boolean }>(`${API_BASE}/${id}`, { method: 'DELETE' }),
};
