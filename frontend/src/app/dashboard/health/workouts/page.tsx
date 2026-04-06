'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Dumbbell,
  Plus,
  Clock,
  Flame,
  MapPin,
  Heart,
  AlertTriangle,
  X,
  Trash2,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import workoutService, {
  WorkoutResponse,
  WorkoutCreate,
  WorkoutWeekSummary,
  WorkoutType,
  WorkoutIntensity,
  WORKOUT_TYPE_CONFIG,
  INTENSITY_CONFIG,
} from '@/services/workoutService';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Week Summary Card ──────────────────────────────────────────────────────

function WeekSummaryCard({ summary }: { summary: WorkoutWeekSummary }) {
  if (summary.total_workouts === 0) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-violet-950/50 to-slate-900 border border-violet-500/10 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp size={18} className="text-violet-400" />
        <h3 className="text-sm font-semibold text-slate-200">Riepilogo settimanale</h3>
      </div>

      <div className="grid grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-xl font-bold text-slate-200">{summary.total_workouts}</p>
          <p className="text-[10px] text-slate-500">Allenamenti</p>
        </div>
        <div>
          <p className="text-xl font-bold text-slate-200">{formatDuration(summary.total_duration_minutes)}</p>
          <p className="text-[10px] text-slate-500">Durata tot.</p>
        </div>
        <div>
          <p className="text-xl font-bold text-amber-400">{summary.total_calories.toLocaleString('it-IT')}</p>
          <p className="text-[10px] text-slate-500">Calorie</p>
        </div>
        <div>
          <p className="text-xl font-bold text-emerald-400">{summary.total_distance_km > 0 ? `${summary.total_distance_km}km` : '—'}</p>
          <p className="text-[10px] text-slate-500">Distanza</p>
        </div>
      </div>

      {/* Type breakdown */}
      {Object.keys(summary.by_type).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(summary.by_type).map(([type, count]) => {
            const cfg = WORKOUT_TYPE_CONFIG[type as WorkoutType];
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                style={{ backgroundColor: `${cfg?.color || '#64748b'}20`, color: cfg?.color || '#94a3b8' }}
              >
                {cfg?.emoji} {cfg?.label || type} ×{count}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Workout Card ───────────────────────────────────────────────────────────

function WorkoutCard({
  workout,
  onDelete,
}: {
  workout: WorkoutResponse;
  onDelete: () => void;
}) {
  const typeCfg = WORKOUT_TYPE_CONFIG[workout.workout_type] || WORKOUT_TYPE_CONFIG.other;
  const intensityCfg = INTENSITY_CONFIG[workout.intensity] || INTENSITY_CONFIG.moderate;
  const dateStr = new Date(workout.started_at).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeStr = new Date(workout.started_at).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 p-4 transition-all group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{typeCfg.emoji}</span>
          <div>
            <p className="text-sm font-medium text-slate-200">{typeCfg.label}</p>
            <p className="text-[10px] text-slate-500">{dateStr} · {timeStr}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: `${intensityCfg.color}20`, color: intensityCfg.color }}
          >
            {intensityCfg.label}
          </span>
          <button
            onClick={onDelete}
            className="p-1 rounded-lg opacity-0 group-hover:opacity-100 bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-all"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Clock size={12} /> {formatDuration(workout.duration_minutes)}
        </span>
        {workout.calories_burned && (
          <span className="flex items-center gap-1">
            <Flame size={12} className="text-amber-400" /> {workout.calories_burned} kcal
          </span>
        )}
        {workout.distance_km && (
          <span className="flex items-center gap-1">
            <MapPin size={12} className="text-emerald-400" /> {workout.distance_km} km
          </span>
        )}
        {workout.avg_heart_rate && (
          <span className="flex items-center gap-1">
            <Heart size={12} className="text-red-400" /> {workout.avg_heart_rate} bpm
          </span>
        )}
      </div>

      {workout.notes && (
        <p className="text-[11px] text-slate-500 mt-2 italic">{workout.notes}</p>
      )}
    </div>
  );
}

// ─── Add Workout Modal ──────────────────────────────────────────────────────

function AddWorkoutModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: WorkoutCreate) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({
    workout_type: 'strength' as WorkoutType,
    intensity: 'moderate' as WorkoutIntensity,
    duration_minutes: 45,
    calories_burned: '',
    distance_km: '',
    avg_heart_rate: '',
    max_heart_rate: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
  });

  const handleSubmit = () => {
    const startedAt = new Date(`${form.date}T${form.time}:00`);
    onSubmit({
      workout_type: form.workout_type,
      intensity: form.intensity,
      duration_minutes: form.duration_minutes,
      calories_burned: form.calories_burned ? Number(form.calories_burned) : undefined,
      distance_km: form.distance_km ? Number(form.distance_km) : undefined,
      avg_heart_rate: form.avg_heart_rate ? Number(form.avg_heart_rate) : undefined,
      max_heart_rate: form.max_heart_rate ? Number(form.max_heart_rate) : undefined,
      notes: form.notes || undefined,
      started_at: startedAt.toISOString(),
    });
  };

  const workoutTypes: WorkoutType[] = ['running', 'walking', 'cycling', 'swimming', 'strength', 'hiit', 'yoga', 'stretching', 'martial_arts', 'other'];
  const intensities: WorkoutIntensity[] = ['low', 'moderate', 'high', 'extreme'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuovo allenamento" size="md" footer={
      <>
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>Annulla</Button>
        <Button variant="primary" onClick={handleSubmit} isLoading={isLoading}>Salva</Button>
      </>
    }>
      <div className="space-y-4">
        {/* Workout Type Grid */}
        <div>
          <label className="block text-xs text-slate-400 mb-2">Tipo</label>
          <div className="grid grid-cols-5 gap-1.5">
            {workoutTypes.map((type) => {
              const cfg = WORKOUT_TYPE_CONFIG[type];
              return (
                <button
                  key={type}
                  onClick={() => setForm({ ...form, workout_type: type })}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-center transition-all ${
                    form.workout_type === type
                      ? 'border-2 scale-105'
                      : 'bg-white/[0.03] border border-white/5'
                  }`}
                  style={form.workout_type === type ? { borderColor: cfg.color, backgroundColor: `${cfg.color}15` } : {}}
                >
                  <span className="text-lg">{cfg.emoji}</span>
                  <span className="text-[9px] text-slate-400">{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Intensity */}
        <div>
          <label className="block text-xs text-slate-400 mb-2">Intensità</label>
          <div className="flex gap-2">
            {intensities.map((i) => {
              const cfg = INTENSITY_CONFIG[i];
              return (
                <button
                  key={i}
                  onClick={() => setForm({ ...form, intensity: i })}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    form.intensity === i ? 'text-white' : 'bg-white/[0.03] text-slate-500'
                  }`}
                  style={form.intensity === i ? { backgroundColor: cfg.color } : {}}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date, Time, Duration */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Data</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Ora</label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Durata (min)</label>
            <input
              type="number"
              min={1}
              max={600}
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none text-center"
            />
          </div>
        </div>

        {/* Optional fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Calorie (kcal)</label>
            <input
              type="number"
              min={0}
              value={form.calories_burned}
              onChange={(e) => setForm({ ...form, calories_burned: e.target.value })}
              placeholder="—"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Distanza (km)</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={form.distance_km}
              onChange={(e) => setForm({ ...form, distance_km: e.target.value })}
              placeholder="—"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">FC media (bpm)</label>
            <input
              type="number"
              min={30}
              max={220}
              value={form.avg_heart_rate}
              onChange={(e) => setForm({ ...form, avg_heart_rate: e.target.value })}
              placeholder="—"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">FC max (bpm)</label>
            <input
              type="number"
              min={30}
              max={220}
              value={form.max_heart_rate}
              onChange={(e) => setForm({ ...form, max_heart_rate: e.target.value })}
              placeholder="—"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Note</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none resize-none"
            rows={2}
            placeholder="Come è andato l'allenamento..."
          />
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<WorkoutResponse[]>([]);
  const [weekSummary, setWeekSummary] = useState<WorkoutWeekSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteWorkout, setDeleteWorkout] = useState<WorkoutResponse | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [w, ws] = await Promise.all([
        workoutService.list(30),
        workoutService.getWeekSummary(),
      ]);
      setWorkouts(w);
      setWeekSummary(ws);
    } catch (err: any) {
      console.error('Failed to fetch workouts:', err);
      setError(err?.response?.data?.detail || 'Errore nel caricamento degli allenamenti');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: WorkoutCreate) => {
    try {
      setActionLoading(true);
      await workoutService.create(data);
      setShowForm(false);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Errore nella creazione');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteWorkout) return;
    try {
      setActionLoading(true);
      await workoutService.delete(deleteWorkout.id);
      setDeleteWorkout(null);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Errore nell'eliminazione");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] text-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100">
      <header className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
        <Link href="/dashboard/health" className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Dumbbell size={18} className="text-violet-400" />
        <h1 className="text-base font-semibold flex-1">Allenamenti</h1>
        <button
          onClick={() => setShowForm(true)}
          className="p-2 rounded-lg bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 transition-colors"
          title="Nuovo allenamento"
        >
          <Plus size={18} />
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200"><X size={16} /></button>
          </div>
        )}

        {/* Week Summary */}
        {weekSummary && <WeekSummaryCard summary={weekSummary} />}

        {/* Workout List */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
            Ultimi allenamenti
          </h3>
          {workouts.length === 0 ? (
            <div className="text-center py-10">
              <Dumbbell size={28} className="text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Nessun allenamento registrato</p>
              <Button variant="primary" className="mt-4" onClick={() => setShowForm(true)}>
                <Plus size={16} className="mr-1" /> Nuovo allenamento
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {workouts.map((w) => (
                <WorkoutCard key={w.id} workout={w} onDelete={() => setDeleteWorkout(w)} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <AddWorkoutModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreate}
        isLoading={actionLoading}
      />

      <ConfirmModal
        isOpen={!!deleteWorkout}
        title="Elimina allenamento"
        message="Sei sicuro di voler eliminare questo allenamento?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteWorkout(null)}
        isDanger
        isLoading={actionLoading}
      />
    </div>
  );
}
