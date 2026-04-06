/**
 * Sleep API Service
 * Gestisce le chiamate API per il tracciamento del sonno.
 */
import api from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SleepPhaseEntry {
  id: string;
  session_id: string;
  phase: 'awake' | 'light' | 'deep' | 'rem';
  start_time: string;
  end_time: string;
  duration_minutes: number;
  created_at: string;
}

export interface SleepSession {
  id: string;
  user_id: string;
  sleep_start: string;
  sleep_end: string;
  duration_minutes: number;
  quality_score: number | null;
  time_in_bed_minutes: number | null;
  sleep_efficiency: number | null;
  awake_minutes: number;
  light_minutes: number;
  deep_minutes: number;
  rem_minutes: number;
  source: string;
  external_id: string | null;
  // Sleep Cycle specific
  sc_quality_score: number | null;
  snoring_minutes: number | null;
  snoring_pct: number | null;
  regularity_score: number | null;
  sleep_aid_used: string | null;
  alarm_mode: string | null;
  wake_up_mood: string | null;
  heart_rate_lowest: number | null;
  steps_to_sleep: number | null;
  // Common
  mood_on_wake: string | null;
  notes: string | null;
  phases: SleepPhaseEntry[];
  created_at: string;
  updated_at: string;
}

export interface SleepCycleStatus {
  connected: boolean;
  total_sessions: number;
  last_sync: string | null;
}

export interface SleepSessionCreate {
  sleep_start: string;
  sleep_end: string;
  duration_minutes: number;
  quality_score?: number | null;
  time_in_bed_minutes?: number | null;
  sleep_efficiency?: number | null;
  awake_minutes?: number;
  light_minutes?: number;
  deep_minutes?: number;
  rem_minutes?: number;
  source?: string;
  // Sleep Cycle specific (populated via webhook, not manual form)
  sc_quality_score?: number | null;
  snoring_minutes?: number | null;
  snoring_pct?: number | null;
  regularity_score?: number | null;
  sleep_aid_used?: string | null;
  alarm_mode?: string | null;
  wake_up_mood?: string | null;
  heart_rate_lowest?: number | null;
  steps_to_sleep?: number | null;
  // Common
  mood_on_wake?: string | null;
  notes?: string | null;
}

export interface SleepMorningReport {
  session: SleepSession | null;
  quality_label: string;
  total_hours: number;
  deep_pct: number;
  rem_pct: number;
  efficiency_pct: number;
  tip: string;
  streak_days: number;
}

export interface SleepWeekSummary {
  sessions: SleepSession[];
  avg_duration_minutes: number;
  avg_quality: number;
  avg_deep_pct: number;
  avg_rem_pct: number;
  best_night: SleepSession | null;
  worst_night: SleepSession | null;
}

// ─── API Methods ─────────────────────────────────────────────────────────────

const sleepService = {
  async list(days: number = 30): Promise<SleepSession[]> {
    const { data } = await api.get('/health/sleep', { params: { days } });
    return data;
  },

  async getLastNight(): Promise<SleepSession> {
    const { data } = await api.get('/health/sleep/last-night');
    return data;
  },

  async getMorningReport(): Promise<SleepMorningReport> {
    const { data } = await api.get('/health/sleep/morning-report');
    return data;
  },

  async getWeekSummary(): Promise<SleepWeekSummary> {
    const { data } = await api.get('/health/sleep/week-summary');
    return data;
  },

  async create(session: SleepSessionCreate): Promise<SleepSession> {
    const { data } = await api.post('/health/sleep', session);
    return data;
  },

  async update(id: string, updates: { quality_score?: number; mood_on_wake?: string; notes?: string }): Promise<SleepSession> {
    const { data } = await api.put(`/health/sleep/${id}`, updates);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/health/sleep/${id}`);
  },

  // Sleep Cycle sync status
  async getSleepCycleStatus(): Promise<SleepCycleStatus> {
    const { data } = await api.get('/health/sleep/sync/sleep-cycle/status');
    return data;
  },
};

export default sleepService;
