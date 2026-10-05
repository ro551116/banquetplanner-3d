import { apiFetch } from './apiFetch';

const API_BASE = '/api/scenes';

export interface SceneMeta {
  id: string;
  name: string;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
}

export interface SceneFull extends SceneMeta {
  data: unknown;
}

export const scenesApi = {
  list: () => apiFetch<SceneMeta[]>(API_BASE),

  get: (id: string) => apiFetch<SceneFull>(`${API_BASE}/${id}`),

  create: (name: string, data?: unknown) =>
    apiFetch<SceneMeta>(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ name, data }),
    }),

  update: (id: string, payload: { name?: string; data?: unknown; thumbnail?: string; baseUpdatedAt?: string }) =>
    apiFetch<SceneMeta>(`${API_BASE}/${id}`, {
      method: 'PUT',
      timeoutMs: payload.data === undefined ? undefined : 20_000,
      body: JSON.stringify(payload),
    }),

  delete: (id: string) =>
    apiFetch<{ deleted: boolean }>(`${API_BASE}/${id}`, { method: 'DELETE' }),
};
