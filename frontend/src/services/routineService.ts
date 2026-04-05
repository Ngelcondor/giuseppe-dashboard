/**
 * Routine API Service
 * Gestisce tutte le chiamate API per le routine.
 */
import api from '@/lib/api';

// ─── Types allineati al backend ───────────────────────────────────────────────

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface RoutineStepResponse {
  id: string;
  routine_id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  is_optional: boolean;
  order: number;
  icon: string | null;
  created_at: string;
}

export interface RoutineResponse {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  time_of_day: TimeOfDay;
  is_active: boolean;
  order: number;
  steps: RoutineStepResponse[];
  created_at: string;
  updated_at: string;
}

export interface RoutineLogResponse {
  id: string;
  routine_id: string;
  user_id: string;
  completed_steps: string[];
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface RoutineTodayResponse {
  morning: RoutineResponse | null;
  afternoon: RoutineResponse | null;
  evening: RoutineResponse | null;
  night: RoutineResponse | null;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface RoutineStepCreate {
  title: string;
  description?: string;
  duration_minutes?: number;
  is_optional?: boolean;
  order?: number;
  icon?: string;
}

export interface RoutineCreate {
  name: string;
  description?: string;
  time_of_day: TimeOfDay;
  is_active?: boolean;
  order?: number;
  steps?: RoutineStepCreate[];
}

export interface RoutineUpdate {
  name?: string;
  description?: string;
  time_of_day?: TimeOfDay;
  is_active?: boolean;
  order?: number;
}

export interface RoutineCompleteRequest {
  completed_steps: string[];
  notes?: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

const routineService = {
  /** Lista tutte le routine dell'utente */
  async list(): Promise<RoutineResponse[]> {
    const { data } = await api.get<RoutineResponse[]>('/routines');
    return data;
  },

  /** Routine di oggi raggruppate per fascia oraria */
  async getToday(): Promise<RoutineTodayResponse> {
    const { data } = await api.get<RoutineTodayResponse>('/routines/today/all');
    return data;
  },

  /** Dettaglio singola routine */
  async get(id: string): Promise<RoutineResponse> {
    const { data } = await api.get<RoutineResponse>(`/routines/${id}`);
    return data;
  },

  /** Crea una nuova routine con step */
  async create(payload: RoutineCreate): Promise<RoutineResponse> {
    const { data } = await api.post<RoutineResponse>('/routines', payload);
    return data;
  },

  /** Aggiorna una routine */
  async update(id: string, payload: RoutineUpdate): Promise<RoutineResponse> {
    const { data } = await api.put<RoutineResponse>(`/routines/${id}`, payload);
    return data;
  },

  /** Elimina una routine */
  async delete(id: string): Promise<void> {
    await api.delete(`/routines/${id}`);
  },

  /** Aggiungi uno step a una routine */
  async addStep(routineId: string, step: RoutineStepCreate): Promise<RoutineStepResponse> {
    const { data } = await api.post<RoutineStepResponse>(`/routines/${routineId}/steps`, step);
    return data;
  },

  /** Avvia una routine (crea log entry) */
  async start(routineId: string): Promise<RoutineLogResponse> {
    const { data } = await api.post<RoutineLogResponse>(`/routines/${routineId}/start`);
    return data;
  },

  /** Completa una routine */
  async complete(routineId: string, payload: RoutineCompleteRequest): Promise<RoutineLogResponse> {
    const { data } = await api.post<RoutineLogResponse>(`/routines/${routineId}/complete`, payload);
    return data;
  },
};

export default routineService;
