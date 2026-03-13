const API_BASE = '/api/scenes';

export interface SceneMeta {
  id: string;
  name: string;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
}

export interface SceneFull extends SceneMeta {
  data: {
    hall?: any;
    objects?: any[];
    drawings?: any[];
  };
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const scenesApi = {
  list: () => apiFetch<SceneMeta[]>(API_BASE),

  get: (id: string) => apiFetch<SceneFull>(`${API_BASE}/${id}`),

  create: (name: string, data?: any) =>
    apiFetch<SceneMeta>(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ name, data }),
    }),

  update: (id: string, payload: { name?: string; data?: any; thumbnail?: string }) =>
    apiFetch<SceneMeta>(`${API_BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  delete: (id: string) =>
    apiFetch<{ deleted: boolean }>(`${API_BASE}/${id}`, { method: 'DELETE' }),
};
