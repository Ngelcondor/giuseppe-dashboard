/**
 * Health Metrics API Service
 * Gestisce le chiamate API per metriche sanitarie (battito, passi, peso, calorie, ecc.).
 */
import api from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MetricType =
  | 'heart_rate'
  | 'weight'
  | 'calories'
  | 'steps'
  | 'blood_pressure'
  | 'oxygen'
  | 'temperature';

export interface HealthMetric {
  id: string;
  user_id: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  recorded_at: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface HealthMetricCreate {
  metric_type: MetricType;
  value: number;
  unit: string;
  recorded_at: string;
  source?: string;
}

export interface HealthSummary {
  period: string;
  start_date: string;
  end_date: string;
  metrics: Record<string, HealthMetric[]>;
}

// ─── Metric Config ──────────────────────────────────────────────────────────

export const METRIC_CONFIG: Record<
  MetricType,
  { label: string; unit: string; icon: string; color: string; min: number; max: number; step: number }
> = {
  heart_rate: { label: 'Battito cardiaco', unit: 'bpm', icon: 'Heart', color: '#EF4444', min: 30, max: 220, step: 1 },
  steps: { label: 'Passi', unit: 'passi', icon: 'Footprints', color: '#10B981', min: 0, max: 100000, step: 100 },
  weight: { label: 'Peso', unit: 'kg', icon: 'Scale', color: '#8B5CF6', min: 20, max: 300, step: 0.1 },
  calories: { label: 'Calorie', unit: 'kcal', icon: 'Flame', color: '#F59E0B', min: 0, max: 10000, step: 10 },
  blood_pressure: { label: 'Pressione', unit: 'mmHg', icon: 'Activity', color: '#3B82F6', min: 40, max: 250, step: 1 },
  oxygen: { label: 'Ossigeno', unit: '%', icon: 'Wind', color: '#06B6D4', min: 70, max: 100, step: 1 },
  temperature: { label: 'Temperatura', unit: '°C', icon: 'Thermometer', color: '#F97316', min: 34, max: 42, step: 0.1 },
};

// ─── API Methods ─────────────────────────────────────────────────────────────

const metricsService = {
  async list(metricType?: MetricType, days: number = 30): Promise<HealthMetric[]> {
    const params: Record<string, string | number> = { days };
    if (metricType) params.metric_type = metricType;
    const { data } = await api.get('/health/metrics', { params });
    return data;
  },

  async create(metric: HealthMetricCreate): Promise<HealthMetric> {
    const { data } = await api.post('/health/metrics', metric);
    return data;
  },

  async update(id: string, updates: Partial<HealthMetricCreate>): Promise<HealthMetric> {
    const { data } = await api.put(`/health/metrics/${id}`, updates);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/health/metrics/${id}`);
  },

  async getSummary(period: string = 'weekly'): Promise<HealthSummary> {
    const { data } = await api.get('/health/summary', { params: { period } });
    return data;
  },
};

export default metricsService;
