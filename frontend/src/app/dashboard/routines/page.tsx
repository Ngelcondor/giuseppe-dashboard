'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Play, Pause, Check, CheckCircle2, Circle,
  Clock, Sun, Sunset, CloudMoon, Trash2, Edit3, X,
  ChevronDown, ChevronUp, BarChart3, Flame, Timer,
  GripVertical, RotateCcw, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import routineService, {
  type RoutineResponse,
  type RoutineStepResponse,
  type RoutineCreate,
  type RoutineStepCreate,
  type TimeOfDay,
} from '@/services/routineService';

// ─── Costanti ─────────────────────────────────────────────────────────────────

const TIME_OF_DAY_CONFIG: Record<TimeOfDay, { label: string; icon: React.ElementType; color: string; gradient: string }> = {
  morning:   { label: 'Mattina',     icon: Sun,       color: '#fbbf24', gradient: 'from-amber-500/10 to-transparent' },
  afternoon: { label: 'Pomeriggio',  icon: Sun,       color: '#fb923c', gradient: 'from-orange-500/10 to-transparent' },
  evening:   { label: 'Sera',        icon: Sunset,    color: '#a78bfa', gradient: 'from-violet-500/10 to-transparent' },
  night:     { label: 'Notte',       icon: CloudMoon, color: '#60a5fa', gradient: 'from-blue-500/10 to-transparent' },
};

const TIME_OPTIONS = [
  { value: 'morning',   label: 'Mattina' },
  { value: 'afternoon', label: 'Pomeriggio' },
  { value: 'evening',   label: 'Sera' },
  { value: 'night',     label: 'Notte' },
];

const EMOJI_OPTIONS = ['🏃', '🧘', '☕', '💊', '📖', '🧹', '🚿', '🍳', '📝', '🎯', '🧠', '💤', '🌅', '🎵', '🌿'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function totalDuration(steps: RoutineStepResponse[]): number {
  return steps.reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0);
}

// ─── Hook: Countdown Timer ────────────────────────────────────────────────────

function useCountdown(initialSeconds: number) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback((newSeconds?: number) => {
    setIsRunning(false);
    setSecondsLeft(newSeconds ?? initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (isRunning && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, secondsLeft]);

  return { secondsLeft, isRunning, isFinished: secondsLeft === 0, start, pause, reset };
}

// ─── Component: Step Timer ────────────────────────────────────────────────────

function StepTimer({ durationMinutes, onComplete }: { durationMinutes: number; onComplete: () => void }) {
  const { secondsLeft, isRunning, isFinished, start, pause, reset } = useCountdown(durationMinutes * 60);
  const progress = 1 - secondsLeft / (durationMinutes * 60);

  useEffect(() => {
    if (isFinished) onComplete();
  }, [isFinished, onComplete]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-10 h-10">
        <svg width="40" height="40" className="-rotate-90">
          <circle cx="20" cy="20" r="17" stroke="#1e293b" strokeWidth="3" fill="none" />
          <circle cx="20" cy="20" r="17" stroke={isFinished ? '#4ade80' : '#818cf8'}
            strokeWidth="3" fill="none"
            strokeDasharray={`${2 * Math.PI * 17 * progress} ${2 * Math.PI * 17}`}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-semibold text-body">
          {formatTime(secondsLeft)}
        </span>
      </div>
      <div className="flex gap-1">
        {!isRunning && !isFinished && (
          <button onClick={start} className="p-1 rounded-md hover:bg-white/[0.06] text-body hover:text-heading transition-colors">
            <Play size={14} />
          </button>
        )}
        {isRunning && (
          <button onClick={pause} className="p-1 rounded-md hover:bg-white/[0.06] text-body hover:text-heading transition-colors">
            <Pause size={14} />
          </button>
        )}
        {(isRunning || secondsLeft < durationMinutes * 60) && !isFinished && (
          <button onClick={() => reset()} className="p-1 rounded-md hover:bg-white/[0.06] text-body hover:text-heading transition-colors">
            <RotateCcw size={14} />
          </button>
        )}
        {isFinished && (
          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <Check size={12} /> Fatto
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Component: Step Form (inline, per il modale di creazione) ────────────────

function StepFormInline({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: RoutineStepCreate;
  index: number;
  onChange: (i: number, s: RoutineStepCreate) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-card border border-white/[0.04]">
      <div className="pt-2 text-muted cursor-grab">
        <GripVertical size={14} />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          {/* Emoji picker */}
          <select
            value={step.icon || '🎯'}
            onChange={e => onChange(index, { ...step, icon: e.target.value })}
            className="w-12 h-9 bg-card-inner border border-white/[0.06] rounded-lg text-center text-base cursor-pointer"
          >
            {EMOJI_OPTIONS.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <input
            value={step.title}
            onChange={e => onChange(index, { ...step, title: e.target.value })}
            placeholder={`Step ${index + 1}`}
            className="flex-1 px-3 py-1.5 text-sm bg-card-inner border border-white/[0.06] rounded-lg text-heading placeholder-slate-600 focus:border-white/20 focus:outline-none transition-colors"
          />
          <input
            type="number"
            min="1"
            max="120"
            value={step.duration_minutes ?? ''}
            onChange={e => onChange(index, { ...step, duration_minutes: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="min"
            className="w-16 px-2 py-1.5 text-sm text-center bg-card-inner border border-white/[0.06] rounded-lg text-heading placeholder-slate-600 focus:border-white/20 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-tertiary cursor-pointer">
            <input
              type="checkbox"
              checked={step.is_optional ?? false}
              onChange={e => onChange(index, { ...step, is_optional: e.target.checked })}
              className="w-3 h-3 rounded border-border-default bg-slate-700 text-blue-600"
            />
            Opzionale
          </label>
        </div>
      </div>
      <button onClick={() => onRemove(index)} className="pt-2 text-muted hover:text-red-400 transition-colors">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Component: Routine Card (per la vista oggi) ──────────────────────────────

function RoutineCard({
  routine,
  onEdit,
  onDelete,
}: {
  routine: RoutineResponse;
  onEdit: (r: RoutineResponse) => void;
  onDelete: (r: RoutineResponse) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const config = TIME_OF_DAY_CONFIG[routine.time_of_day];
  const sortedSteps = [...routine.steps].sort((a, b) => a.order - b.order);
  const completionPct = sortedSteps.length > 0
    ? Math.round((completedSteps.size / sortedSteps.length) * 100)
    : 0;
  const allDone = completedSteps.size === sortedSteps.length && sortedSteps.length > 0;

  const handleToggleStep = (stepId: string) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const handleStart = async () => {
    try {
      await routineService.start(routine.id);
    } catch {
      // API non disponibile: avvia comunque localmente
    }
    setIsStarted(true);
    setExpanded(true);
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await routineService.complete(routine.id, {
        completed_steps: Array.from(completedSteps),
      });
    } catch {
      // API non disponibile: completa comunque localmente
    }
    setShowCompleted(true);
    setIsCompleting(false);
  };

  if (showCompleted) {
    return (
      <div className="rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-300">{routine.name}</p>
            <p className="text-[11px] text-emerald-500/70">
              Completata — {completedSteps.size}/{sortedSteps.length} step
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl bg-card border border-border-default overflow-hidden transition-all duration-200 ${expanded ? 'ring-1 ring-white/[0.08]' : ''}`}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${config.color}15` }}
            >
              <config.icon size={18} style={{ color: config.color }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-heading">{routine.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted">{config.label}</span>
                <span className="text-[11px] text-muted">·</span>
                <span className="text-[11px] text-muted">{sortedSteps.length} step</span>
                {totalDuration(sortedSteps) > 0 && (
                  <>
                    <span className="text-[11px] text-muted">·</span>
                    <span className="text-[11px] text-muted flex items-center gap-0.5">
                      <Clock size={10} /> {totalDuration(sortedSteps)} min
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => onEdit(routine)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted hover:text-body transition-colors">
              <Edit3 size={14} />
            </button>
            <button onClick={() => onDelete(routine)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted hover:text-red-400 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {isStarted && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-tertiary">Progresso</span>
              <span className="text-[11px] font-medium" style={{ color: allDone ? '#4ade80' : config.color }}>
                {completionPct}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-card-inner overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%`, backgroundColor: allDone ? '#4ade80' : config.color }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          {!isStarted ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 hover:scale-[1.02]"
              style={{ backgroundColor: `${config.color}15`, color: config.color }}
            >
              <Play size={13} /> Avvia routine
            </button>
          ) : allDone ? (
            <button
              onClick={handleComplete}
              disabled={isCompleting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-xs font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50"
            >
              <CheckCircle2 size={13} /> {isCompleting ? 'Salvo...' : 'Completa routine'}
            </button>
          ) : (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card-inner text-body text-xs font-medium transition-colors hover:bg-card-inner"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded ? 'Nascondi step' : 'Mostra step'}
            </button>
          )}
        </div>
      </div>

      {/* Steps */}
      {expanded && isStarted && (
        <div className="border-t border-white/[0.04] px-5 py-4 space-y-1">
          {sortedSteps.map((step) => {
            const done = completedSteps.has(step.id);
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${done ? 'bg-emerald-500/[0.04]' : 'hover:bg-card'}`}
              >
                <button
                  onClick={() => handleToggleStep(step.id)}
                  className="shrink-0 transition-colors"
                >
                  {done ? (
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  ) : (
                    <Circle size={18} className="text-muted hover:text-body" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {step.icon && <span className="text-sm">{step.icon}</span>}
                    <span className={`text-sm ${done ? 'text-tertiary line-through' : 'text-heading'}`}>
                      {step.title}
                    </span>
                    {step.is_optional && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-card-inner text-muted">opz.</span>
                    )}
                  </div>
                  {step.description && (
                    <p className="text-[11px] text-muted mt-0.5">{step.description}</p>
                  )}
                </div>

                {/* Timer */}
                {step.duration_minutes && step.duration_minutes > 0 && !done && (
                  <StepTimer
                    durationMinutes={step.duration_minutes}
                    onComplete={() => handleToggleStep(step.id)}
                  />
                )}
                {step.duration_minutes && step.duration_minutes > 0 && done && (
                  <span className="text-[11px] text-muted flex items-center gap-1">
                    <Timer size={10} /> {step.duration_minutes}m
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Component: Stats Panel ───────────────────────────────────────────────────

function StatsPanel({ routines }: { routines: RoutineResponse[] }) {
  const activeRoutines = routines.filter(r => r.is_active).length;
  const totalSteps = routines.reduce((acc, r) => acc + r.steps.length, 0);
  const totalMinutes = routines.reduce((acc, r) => acc + totalDuration(r.steps), 0);

  const stats = [
    { label: 'Routine attive', value: activeRoutines.toString(), color: '#4ade80' },
    { label: 'Step totali',    value: totalSteps.toString(),     color: '#818cf8' },
    { label: 'Tempo totale',   value: `${totalMinutes}m`,       color: '#fbbf24' },
    { label: 'Fasce coperte',  value: new Set(routines.filter(r => r.is_active).map(r => r.time_of_day)).size.toString() + '/4', color: '#fb923c' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(s => (
        <div key={s.label} className="p-4 rounded-2xl bg-card border border-border-default">
          <p className="text-[11px] text-muted mb-1">{s.label}</p>
          <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Component: Create/Edit Modal ─────────────────────────────────────────────

function RoutineFormModal({
  isOpen,
  onClose,
  editingRoutine,
  onSave,
  isSaving,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingRoutine: RoutineResponse | null;
  onSave: (data: RoutineCreate) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');
  const [steps, setSteps] = useState<RoutineStepCreate[]>([]);

  useEffect(() => {
    if (editingRoutine) {
      setName(editingRoutine.name);
      setDescription(editingRoutine.description || '');
      setTimeOfDay(editingRoutine.time_of_day);
      setSteps(editingRoutine.steps.map(s => ({
        title: s.title,
        description: s.description ?? undefined,
        duration_minutes: s.duration_minutes ?? undefined,
        is_optional: s.is_optional,
        order: s.order,
        icon: s.icon ?? undefined,
      })));
    } else {
      setName('');
      setDescription('');
      setTimeOfDay('morning');
      setSteps([]);
    }
  }, [editingRoutine, isOpen]);

  const addStep = () => {
    setSteps(prev => [...prev, { title: '', order: prev.length, icon: '🎯' }]);
  };

  const updateStep = (index: number, step: RoutineStepCreate) => {
    setSteps(prev => prev.map((s, i) => i === index ? step : s));
  };

  const removeStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })));
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      time_of_day: timeOfDay,
      steps: steps.filter(s => s.title.trim()).map((s, i) => ({ ...s, order: i })),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingRoutine ? 'Modifica routine' : 'Nuova routine'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Annulla</Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSaving} disabled={!name.trim()}>
            {editingRoutine ? 'Salva modifiche' : 'Crea routine'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Nome */}
        <Input
          label="Nome routine"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="es. Routine mattutina, Wind-down serale..."
        />

        {/* Descrizione */}
        <Textarea
          label="Descrizione (opzionale)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Descrivi brevemente lo scopo di questa routine"
          className="min-h-[70px]"
        />

        {/* Fascia oraria */}
        <div>
          <label className="block text-sm font-medium text-body mb-2">Fascia oraria</label>
          <div className="grid grid-cols-4 gap-2">
            {TIME_OPTIONS.map(opt => {
              const c = TIME_OF_DAY_CONFIG[opt.value as TimeOfDay];
              const selected = timeOfDay === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTimeOfDay(opt.value as TimeOfDay)}
                  className={`p-2.5 rounded-xl border text-center text-xs font-medium transition-all duration-200 ${
                    selected
                      ? 'border-white/20 bg-white/[0.06]'
                      : 'border-white/[0.04] bg-card hover:bg-card-inner text-tertiary'
                  }`}
                  style={selected ? { color: c.color } : {}}
                >
                  <c.icon size={16} className="mx-auto mb-1" style={selected ? { color: c.color } : { color: '#475569' }} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-body">Step</label>
            <span className="text-[11px] text-muted">{steps.length} step</span>
          </div>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <StepFormInline
                key={i}
                step={step}
                index={i}
                onChange={updateStep}
                onRemove={removeStep}
              />
            ))}
          </div>
          <button
            onClick={addStep}
            className="mt-3 w-full py-2.5 rounded-xl border border-dashed border-border-hover text-xs text-tertiary hover:text-body hover:border-white/20 transition-all duration-200 flex items-center justify-center gap-1.5"
          >
            <Plus size={13} /> Aggiungi step
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Component: All Routines List (gestione) ──────────────────────────────────

function AllRoutinesList({
  routines,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  routines: RoutineResponse[];
  onEdit: (r: RoutineResponse) => void;
  onDelete: (r: RoutineResponse) => void;
  onToggleActive: (r: RoutineResponse) => void;
}) {
  const grouped = routines.reduce<Record<TimeOfDay, RoutineResponse[]>>((acc, r) => {
    if (!acc[r.time_of_day]) acc[r.time_of_day] = [];
    acc[r.time_of_day].push(r);
    return acc;
  }, {} as Record<TimeOfDay, RoutineResponse[]>);

  const orderedKeys: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];

  return (
    <div className="space-y-6">
      {orderedKeys.map(key => {
        const items = grouped[key];
        if (!items || items.length === 0) return null;
        const config = TIME_OF_DAY_CONFIG[key];
        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-3">
              <config.icon size={14} style={{ color: config.color }} />
              <span className="text-xs font-medium uppercase tracking-widest" style={{ color: config.color }}>
                {config.label}
              </span>
            </div>
            <div className="space-y-2">
              {items.sort((a, b) => a.order - b.order).map(r => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                    r.is_active
                      ? 'bg-card border-border-default'
                      : 'bg-white/[0.01] border-white/[0.03] opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onToggleActive(r)}
                      className="shrink-0"
                    >
                      {r.is_active ? (
                        <CheckCircle2 size={18} style={{ color: config.color }} />
                      ) : (
                        <Circle size={18} className="text-muted" />
                      )}
                    </button>
                    <div>
                      <p className="text-sm font-medium text-heading">{r.name}</p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {r.steps.length} step · {totalDuration(r.steps)}m
                        {!r.is_active && ' · disattivata'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEdit(r)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted hover:text-body transition-colors">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => onDelete(r)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Helper: genera UUID locale ───────────────────────────────────────────────

function localId(): string {
  return 'local-' + crypto.randomUUID();
}

// ─── Component: Error Banner ──────────────────────────────────────────────────

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-red-500/[0.08] border border-red-500/20">
      <AlertCircle size={16} className="text-red-400 shrink-0" />
      <p className="text-xs text-red-300 flex-1">{message}</p>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-300 transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewTab = 'today' | 'all' | 'stats';

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<RoutineResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('today');
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<RoutineResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Data fetching ────────────────────────────────────────────────────

  const fetchRoutines = useCallback(async () => {
    try {
      const data = await routineService.list();
      setRoutines(data);
      setIsOffline(false);
    } catch {
      // API non disponibile: passa a modalità locale
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoutines(); }, [fetchRoutines]);

  // ─── Handlers (con fallback locale) ───────────────────────────────────

  const handleSave = async (data: RoutineCreate) => {
    setIsSaving(true);
    setError(null);

    // Se l'API è disponibile, prova a salvare sul server
    if (!isOffline) {
      try {
        if (editingRoutine) {
          await routineService.update(editingRoutine.id, {
            name: data.name,
            description: data.description,
            time_of_day: data.time_of_day,
          });
        } else {
          await routineService.create(data);
        }
        await fetchRoutines();
        setShowForm(false);
        setEditingRoutine(null);
        setIsSaving(false);
        return;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Errore sconosciuto';
        console.error('Errore salvataggio routine:', err);
        // Se l'API fallisce, facciamo fallback locale
        setIsOffline(true);
        setError(`API non raggiungibile — salvato localmente. (${message})`);
      }
    }

    // Fallback: salva localmente nello state
    const now = new Date().toISOString();
    if (editingRoutine) {
      setRoutines(prev => prev.map(r =>
        r.id === editingRoutine.id
          ? { ...r, name: data.name, description: data.description ?? null, time_of_day: data.time_of_day, updated_at: now }
          : r
      ));
    } else {
      const newRoutine: RoutineResponse = {
        id: localId(),
        user_id: 'local',
        name: data.name,
        description: data.description ?? null,
        time_of_day: data.time_of_day,
        is_active: true,
        order: routines.length,
        steps: (data.steps ?? []).map((s, i) => ({
          id: localId(),
          routine_id: '',
          title: s.title,
          description: s.description ?? null,
          duration_minutes: s.duration_minutes ?? null,
          is_optional: s.is_optional ?? false,
          order: i,
          icon: s.icon ?? null,
          created_at: now,
        })),
        created_at: now,
        updated_at: now,
      };
      setRoutines(prev => [...prev, newRoutine]);
    }

    setShowForm(false);
    setEditingRoutine(null);
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setError(null);

    if (!isOffline) {
      try {
        await routineService.delete(deleteTarget.id);
        await fetchRoutines();
        setDeleteTarget(null);
        setIsDeleting(false);
        return;
      } catch {
        setIsOffline(true);
      }
    }

    // Fallback locale
    setRoutines(prev => prev.filter(r => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    setIsDeleting(false);
  };

  const handleToggleActive = async (routine: RoutineResponse) => {
    setError(null);

    if (!isOffline) {
      try {
        await routineService.update(routine.id, { is_active: !routine.is_active });
        await fetchRoutines();
        return;
      } catch {
        setIsOffline(true);
      }
    }

    // Fallback locale
    setRoutines(prev => prev.map(r =>
      r.id === routine.id ? { ...r, is_active: !r.is_active } : r
    ));
  };

  const handleEdit = (r: RoutineResponse) => {
    setEditingRoutine(r);
    setShowForm(true);
  };

  // ─── Derived data ─────────────────────────────────────────────────────

  const todayRoutines = routines.filter(r => r.is_active);
  const orderedTimes: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];

  const hour = new Date().getHours();
  const currentTimeOfDay: TimeOfDay =
    hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

  // ─── Render ───────────────────────────────────────────────────────────

  const tabs: { key: ViewTab; label: string; icon: React.ElementType }[] = [
    { key: 'today', label: 'Oggi',     icon: Sun },
    { key: 'all',   label: 'Tutte',    icon: BarChart3 },
    { key: 'stats', label: 'Stats',    icon: Flame },
  ];

  return (
    <div className="min-h-screen bg-page text-heading">
      {/* Header */}
      <header className="px-6 py-5 border-b border-border-default flex items-center justify-between sticky top-0 bg-page/90 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-tertiary hover:text-body transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-base font-semibold">Routine</h1>
        </div>
        <button
          onClick={() => { setEditingRoutine(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-body hover:bg-surface-hover transition-colors"
        >
          <Plus size={14} /> Nuova
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-card border border-border-default mb-8 w-fit">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-white/[0.07] text-heading'
                  : 'text-tertiary hover:text-body'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Offline banner */}
        {isOffline && !loading && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-amber-500/[0.08] border border-amber-500/20">
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300 flex-1">
              Modalità locale — il backend non è raggiungibile. Le routine create verranno salvate solo in questa sessione.
            </p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <div className="w-6 h-6 border-2 border-border-hover border-t-white/40 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted mt-3">Caricamento routine...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && routines.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-card-inner border border-border-default flex items-center justify-center mx-auto mb-5">
              <Clock size={24} className="text-tertiary" />
            </div>
            <p className="text-sm font-medium text-body mb-1">Nessuna routine</p>
            <p className="text-xs text-muted mb-5">Crea la tua prima routine per organizzare la giornata.</p>
            <button
              onClick={() => { setEditingRoutine(null); setShowForm(true); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} /> Crea routine
            </button>
          </div>
        )}

        {/* Tab: Oggi */}
        {!loading && routines.length > 0 && activeTab === 'today' && (
          <div className="space-y-8">
            {orderedTimes.map(time => {
              const items = todayRoutines.filter(r => r.time_of_day === time);
              if (items.length === 0) return null;
              const config = TIME_OF_DAY_CONFIG[time];
              const isCurrent = time === currentTimeOfDay;

              return (
                <div key={time}>
                  <div className="flex items-center gap-2 mb-4">
                    <config.icon size={14} style={{ color: config.color }} />
                    <span className="text-xs font-medium uppercase tracking-widest" style={{ color: config.color }}>
                      {config.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-body ml-1">
                        ora
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {items.sort((a, b) => a.order - b.order).map(routine => (
                      <RoutineCard
                        key={routine.id}
                        routine={routine}
                        onEdit={handleEdit}
                        onDelete={r => setDeleteTarget(r)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab: Tutte */}
        {!loading && routines.length > 0 && activeTab === 'all' && (
          <AllRoutinesList
            routines={routines}
            onEdit={handleEdit}
            onDelete={r => setDeleteTarget(r)}
            onToggleActive={handleToggleActive}
          />
        )}

        {/* Tab: Stats */}
        {!loading && routines.length > 0 && activeTab === 'stats' && (
          <div className="space-y-8">
            <StatsPanel routines={routines} />

            {/* Distribuzione per fascia */}
            <div className="rounded-2xl bg-card border border-border-default p-5">
              <h3 className="text-xs font-medium text-tertiary uppercase tracking-widest mb-4">
                Distribuzione per fascia oraria
              </h3>
              <div className="space-y-3">
                {orderedTimes.map(time => {
                  const config = TIME_OF_DAY_CONFIG[time];
                  const count = routines.filter(r => r.time_of_day === time).length;
                  const pct = routines.length > 0 ? (count / routines.length) * 100 : 0;
                  return (
                    <div key={time} className="flex items-center gap-3">
                      <config.icon size={14} style={{ color: config.color }} />
                      <span className="text-xs text-body w-24">{config.label}</span>
                      <div className="flex-1 h-2 rounded-full bg-card-inner overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: config.color }}
                        />
                      </div>
                      <span className="text-xs text-tertiary w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dettaglio step per routine */}
            <div className="rounded-2xl bg-card border border-border-default p-5">
              <h3 className="text-xs font-medium text-tertiary uppercase tracking-widest mb-4">
                Dettaglio routine
              </h3>
              <div className="space-y-3">
                {routines.map(r => {
                  const config = TIME_OF_DAY_CONFIG[r.time_of_day];
                  const dur = totalDuration(r.steps);
                  return (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-card">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                        <span className="text-sm text-body">{r.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-muted">
                        <span>{r.steps.length} step</span>
                        <span>{dur}m</span>
                        <span className={r.is_active ? 'text-emerald-500' : 'text-muted'}>
                          {r.is_active ? 'attiva' : 'off'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Form Modal */}
      <RoutineFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingRoutine(null); }}
        editingRoutine={editingRoutine}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Elimina routine"
        message={`Vuoi eliminare "${deleteTarget?.name}"? Questa azione non è reversibile.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isDanger
        isLoading={isDeleting}
      />
    </div>
  );
}
