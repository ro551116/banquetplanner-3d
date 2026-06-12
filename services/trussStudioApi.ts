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

  save: (events: TrussStudioEvent[]) =>
    apiFetch<TrussStudioPayload>(API_BASE, {
      method: 'PUT',
      body: JSON.stringify({ events }),
    }),
};
