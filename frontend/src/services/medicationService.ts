/**
 * Medication API Service
 * Gestisce tutte le chiamate API per i farmaci.
 */
import api from '@/lib/api';

// ─── Types allineati al backend ───────────────────────────────────────────────

export interface MedicationResponse {
  id: string;
  user_id: string;
  name: string;
  dosage: string;
  frequency: string;
  time_of_day: string;
  scheduled_time: string | null;
  is_prn: boolean;
  notes: string | null;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicationCreate {
  name: string;
  dosage: string;
  frequency: string;
  time_of_day: string;
  scheduled_time?: string | null;
  is_prn?: boolean;
  notes?: string | null;
  color?: string | null;
  icon?: string | null;
  is_active?: boolean;
}

export interface MedicationUpdate {
  name?: string;
  dosage?: string;
  frequency?: string;
  time_of_day?: string;
  scheduled_time?: string | null;
  is_prn?: boolean;
  notes?: string | null;
  color?: string | null;
  icon?: string | null;
  is_active?: boolean;
}

export interface MedicationLogResponse {
  id: string;
  medication_id: string;
  user_id: string;
  taken_at: string;
  skipped: boolean;
  notes: string | null;
  created_at: string;
}

export interface MedicationLogCreate {
  medication_id: string;
  taken_at: string;
  skipped?: boolean;
  notes?: string | null;
}

export interface MedicationScheduleItem {
  medication: MedicationResponse;
  taken_today: boolean;
  skipped_today: boolean;
  last_log: MedicationLogResponse | null;
}

export interface MedicationTodayResponse {
  scheduled: Record<string, MedicationScheduleItem[]>;
  prn: MedicationScheduleItem[];
}

// ─── Statistics Types ────────────────────────────────────────────────────────

export interface MedicationStatItem {
  medication_id: string;
  name: string;
  dosage: string;
  color: string | null;
  icon: string | null;
  scheduled_time: string | null;
  total_expected: number;
  total_taken: number;
  total_skipped: number;
  total_missed: number;
  adherence_pct: number;
}

export interface PRNStatItem {
  medication_id: string;
  name: string;
  dosage: string;
  color: string | null;
  icon: string | null;
  total_intakes: number;
  days_used: number;
  avg_per_day_used: number;
}

export interface MedicationStatsResponse {
  period_start: string;
  period_end: string;
  period_label: string;
  total_days: number;
  scheduled_stats: MedicationStatItem[];
  overall_adherence_pct: number;
  prn_stats: PRNStatItem[];
  total_prn_intakes: number;
}

// ─── API Methods ─────────────────────────────────────────────────────────────

const medicationService = {
  /** Lista tutti i farmaci */
  async list(): Promise<MedicationResponse[]> {
    const { data } = await api.get('/health/medications');
    return data;
  },

  /** Schedule di oggi con stato log */
  async getToday(): Promise<MedicationTodayResponse> {
    const { data } = await api.get('/health/medications/today');
    return data;
  },

  /** Crea un farmaco */
  async create(med: MedicationCreate): Promise<MedicationResponse> {
    const { data } = await api.post('/health/medications', med);
    return data;
  },

  /** Aggiorna un farmaco */
  async update(id: string, med: MedicationUpdate): Promise<MedicationResponse> {
    const { data } = await api.put(`/health/medications/${id}`, med);
    return data;
  },

  /** Elimina un farmaco */
  async delete(id: string): Promise<void> {
    await api.delete(`/health/medications/${id}`);
  },

  /** Registra assunzione o skip */
  async log(medicationId: string, logData: MedicationLogCreate): Promise<MedicationLogResponse> {
    const { data } = await api.post(`/health/medications/${medicationId}/log`, logData);
    return data;
  },

  /** Storico log di un farmaco */
  async getLogs(medicationId: string, days: number = 30): Promise<MedicationLogResponse[]> {
    const { data } = await api.get(`/health/medications/${medicationId}/logs`, {
      params: { days },
    });
    return data;
  },

  /** Statistiche mensili di aderenza */
  async getStats(year?: number, month?: number): Promise<MedicationStatsResponse> {
    const params: Record<string, number> = {};
    if (year) params.year = year;
    if (month) params.month = month;
    const { data } = await api.get('/health/medications/stats', { params });
    return data;
  },
};

export default medicationService;
