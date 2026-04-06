/**
 * Workout API Service
 * Gestisce le chiamate API per il tracciamento allenamenti.
 */
import api from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type WorkoutType =
  | 'running'
  | 'walking'
  | 'cycling'
  | 'swimming'
  | 'strength'
  | 'hiit'
  | 'yoga'
  | 'stretching'
  | 'martial_arts'
  | 'other';

export type WorkoutIntensity = 'low' | 'moderate' | 'high' | 'extreme';

export interface WorkoutResponse {
  id: string;
  user_id: string;
  workout_type: WorkoutType;
  intensity: WorkoutIntensity;
  duration_minutes: number;
  calories_burned: number | null;
  distance_km: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  notes: string | null;
  source: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutCreate {
  workout_type: WorkoutType;
  intensity?: WorkoutIntensity;
  duration_minutes: number;
  calories_burned?: number | null;
  distance_km?: number | null;
  avg_heart_rate?: number | null;
  max_heart_rate?: number | null;
  notes?: string | null;
  source?: string;
  started_at: string;
  ended_at?: string | null;
}

export interface WorkoutWeekSummary {
  workouts: WorkoutResponse[];
  total_workouts: number;
  total_duration_minutes: number;
  total_calories: number;
  total_distance_km: number;
  avg_duration_minutes: number;
  by_type: Record<string, number>;
}

// ─── Workout Config ─────────────────────────────────────────────────────────

export const WORKOUT_TYPE_CONFIG: Record<WorkoutType, { label: string; emoji: string; color: string }> = {
  running: { label: 'Corsa', emoji: '🏃', color: '#EF4444' },
  walking: { label: 'Camminata', emoji: '🚶', color: '#10B981' },
  cycling: { label: 'Ciclismo', emoji: '🚴', color: '#3B82F6' },
  swimming: { label: 'Nuoto', emoji: '🏊', color: '#06B6D4' },
  strength: { label: 'Pesi', emoji: '🏋️', color: '#8B5CF6' },
  hiit: { label: 'HIIT', emoji: '⚡', color: '#F59E0B' },
  yoga: { label: 'Yoga', emoji: '🧘', color: '#EC4899' },
  stretching: { label: 'Stretching', emoji: '🤸', color: '#A78BFA' },
  martial_arts: { label: 'Arti marziali', emoji: '🥋', color: '#F97316' },
  other: { label: 'Altro', emoji: '💪', color: '#64748B' },
};

export const INTENSITY_CONFIG: Record<WorkoutIntensity, { label: string; color: string }> = {
  low: { label: 'Bassa', color: '#10B981' },
  moderate: { label: 'Moderata', color: '#F59E0B' },
  high: { label: 'Alta', color: '#F97316' },
  extreme: { label: 'Estrema', color: '#EF4444' },
};

// ─── API Methods ─────────────────────────────────────────────────────────────

const workoutService = {
  async list(days: number = 30, workoutType?: WorkoutType): Promise<WorkoutResponse[]> {
    const params: Record<string, string | number> = { days };
    if (workoutType) params.workout_type = workoutType;
    const { data } = await api.get('/health/workouts', { params });
    return data;
  },

  async getWeekSummary(): Promise<WorkoutWeekSummary> {
    const { data } = await api.get('/health/workouts/week-summary');
    return data;
  },

  async create(workout: WorkoutCreate): Promise<WorkoutResponse> {
    const { data } = await api.post('/health/workouts', workout);
    return data;
  },

  async update(id: string, updates: Partial<WorkoutCreate>): Promise<WorkoutResponse> {
    const { data } = await api.put(`/health/workouts/${id}`, updates);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/health/workouts/${id}`);
  },
};

export default workoutService;
