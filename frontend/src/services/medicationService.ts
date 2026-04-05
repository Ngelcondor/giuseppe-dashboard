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

  /** Seed dei farmaci di Giuseppe */
  async seed(): Promise<MedicationResponse[]> {
    const { data } = await api.post('/health/medications/seed');
    return data;
  },
};

export default medicationService;
