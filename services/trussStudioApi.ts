import type { TrussStructureConfig } from '../types';
import { apiFetch } from './apiFetch';

const API_BASE = '/api/truss-studio';

export interface TrussStudioEntry {
  id: string;
  config: TrussStructureConfig;
  created_at: string;
  updated_at: string;
}

export interface TrussStudioEvent {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  structures: TrussStudioEntry[];
}

export interface TrussStudioPayload {
  events: TrussStudioEvent[];
}

export const trussStudioApi = {
  get: () => apiFetch<TrussStudioPayload>(API_BASE),

  createEvent: (name: string) =>
    apiFetch<TrussStudioEvent>(`${API_BASE}/events`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  renameEvent: (eventId: string, name: string) =>
    apiFetch<TrussStudioEvent>(`${API_BASE}/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  deleteEvent: (eventId: string) =>
    apiFetch<{ deleted: boolean }>(`${API_BASE}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    }),

  createStructure: (eventId: string, config: TrussStructureConfig, afterStructureId?: string) =>
    apiFetch<TrussStudioEntry>(`${API_BASE}/events/${encodeURIComponent(eventId)}/structures`, {
      method: 'POST',
      body: JSON.stringify({ config, afterStructureId }),
    }),

  updateStructure: (eventId: string, structureId: string, config: TrussStructureConfig) =>
    apiFetch<TrussStudioEntry>(
      `${API_BASE}/events/${encodeURIComponent(eventId)}/structures/${encodeURIComponent(structureId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ config }),
      },
    ),

  deleteStructure: (eventId: string, structureId: string) =>
    apiFetch<{ deleted: boolean }>(
      `${API_BASE}/events/${encodeURIComponent(eventId)}/structures/${encodeURIComponent(structureId)}`,
      {
        method: 'DELETE',
      },
    ),

};
