'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Play, Pause, Check, CheckCircle2, Circle,
  Clock, Sun, Sunset, Moon, Trash2, Edit3, X,
  ChevronDown, ChevronUp, Flame, Timer, Star,
  GripVertical, RotateCcw, AlertCircle, Trophy, Zap,
  Sparkles, TrendingUp, Coffee,
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

// ═══════════════════════════════════════════════════════════════════════════════
// COSTANTI & CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const TIME_OF_DAY_CONFIG: Record<TimeOfDay, {
  label: string;
  icon: React.ElementType;
  color: string;
  bgLight: string;
  bgGradient: string;
  emoji: string;
  greeting: string;
}> = {
  morning: {
    label: 'Mattina',
    icon: Sun,
    color: '#f59e0b',
    bgLight: 'rgba(245, 158, 11, 0.08)',
    bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.02) 100%)',
    emoji: '🌅',
    greeting: 'Buongiorno',
  },
  afternoon: {
    label: 'Pomeriggio',
    icon: Coffee,
    color: '#f97316',
    bgLight: 'rgba(249, 115, 22, 0.08)',
    bgGradient: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(249, 115, 22, 0.02) 100%)',
    emoji: '☀️',
    greeting: 'Buon pomeriggio',
  },
  evening: {
    label: 'Sera',
    icon: Sunset,
    color: '#a78bfa',
    bgLight: 'rgba(167, 139, 250, 0.08)',
    bgGradient: 'linear-gradient(135deg, rgba(167, 139, 250, 0.12) 0%, rgba(167, 139, 250, 0.02) 100%)',
    emoji: '🌆',
    greeting: 'Buonasera',
  },
  night: {
    label: 'Notte',
    icon: Moon,
    color: '#60a5fa',
    bgLight: 'rgba(96, 165, 250, 0.08)',
    bgGradient: 'linear-gradient(135deg, rgba(96, 165, 250, 0.12) 0%, rgba(96, 165, 250, 0.02) 100%)',
    emoji: '🌙',
    greeting: 'Buonanotte',
  },
};

const EMOJI_OPTIONS = [
  '🏃', '🧘', '☕', '💊', '📖', '🧹', '🚿', '🍳', '📝', '🎯',
  '🧠', '💤', '🌅', '🎵', '🌿', '💻', '🔒', '🛡️', '🎮', '🐱',
  '💧', '🦷', '👕', '🧴', '📱', '🍽️', '🚶', '🧘‍♂️', '✍️', '🎧',
];

const MOOD_OPTIONS = [
  { value: 1, emoji: '😫', label: 'Esausto',   color: '#ef4444' },
  { value: 2, emoji: '😕', label: 'Faticoso',  color: '#f97316' },
  { value: 3, emoji: '😐', label: 'Neutro',    color: '#eab308' },
  { value: 4, emoji: '🙂', label: 'Bene',      color: '#22c55e' },
  { value: 5, emoji: '😊', label: 'Benissimo', color: '#10b981' },
];

// Colori pastello per le card routine (stile Me+)
const ROUTINE_COLORS = [
  { bg: 'rgba(251, 191, 36, 0.10)', border: 'rgba(251, 191, 36, 0.20)', accent: '#fbbf24' },
  { bg: 'rgba(167, 139, 250, 0.10)', border: 'rgba(167, 139, 250, 0.20)', accent: '#a78bfa' },
  { bg: 'rgba(52, 211, 153, 0.10)',  border: 'rgba(52, 211, 153, 0.20)',  accent: '#34d399' },
  { bg: 'rgba(96, 165, 250, 0.10)',  border: 'rgba(96, 165, 250, 0.20)',  accent: '#60a5fa' },
  { bg: 'rgba(251, 146, 60, 0.10)',  border: 'rgba(251, 146, 60, 0.20)',  accent: '#fb923c' },
  { bg: 'rgba(244, 114, 182, 0.10)', border: 'rgba(244, 114, 182, 0.20)', accent: '#f472b6' },
  { bg: 'rgba(45, 212, 191, 0.10)',  border: 'rgba(45, 212, 191, 0.20)',  accent: '#2dd4bf' },
  { bg: 'rgba(168, 162, 158, 0.10)', border: 'rgba(168, 162, 158, 0.20)', accent: '#a8a29e' },
];

// XP e livelli
const XP_PER_STEP = 10;
const XP_PER_ROUTINE = 50;
// const XP_STREAK_BONUS = 25; // TODO: usare quando il backend supporta gli streak

function getLevel(xp: number): { level: number; current: number; needed: number } {
  // Ogni livello richiede 100 * level XP
  let level = 1;
  let remaining = xp;
  while (remaining >= level * 100) {
    remaining -= level * 100;
    level++;
  }
  return { level, current: remaining, needed: level * 100 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function totalDuration(steps: RoutineStepResponse[]): number {
  return steps.reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0);
}

function localId(): string {
  return 'local-' + crypto.randomUUID();
}

function getRoutineColor(index: number) {
  return ROUTINE_COLORS[index % ROUTINE_COLORS.length];
}

function getCurrentTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK: Countdown Timer
// ═══════════════════════════════════════════════════════════════════════════════

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
          if (prev <= 1) { setIsRunning(false); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, secondsLeft]);

  return { secondsLeft, isRunning, isFinished: secondsLeft === 0, start, pause, reset };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: XP Bar & Level
// ═══════════════════════════════════════════════════════════════════════════════

function XPBar({ xp }: { xp: number }) {
  const { level, current, needed } = getLevel(xp);
  const pct = (current / needed) * 100;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
          <Star size={14} className="text-amber-400" />
        </div>
        <div>
          <p className="text-[10px] text-muted leading-none">Livello</p>
          <p className="text-sm font-bold text-amber-400">{level}</p>
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted">{current} / {needed} XP</span>
        </div>
        <div className="w-full h-2 rounded-full bg-card-inner overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #f59e0b, #f97316)',
            }}
          />
        </div>
      </div>
      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10">
        <Zap size={12} className="text-amber-400" />
        <span className="text-xs font-semibold text-amber-400">{xp}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: Streak Counter
// ═══════════════════════════════════════════════════════════════════════════════

function StreakCounter({ streak, bestStreak }: { streak: number; bestStreak: number }) {
  return (
    <div className="flex items-center gap-4">
      {/* Streak attuale */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.15)' }}>
        <Flame size={18} className="text-orange-400" />
        <div>
          <p className="text-lg font-bold text-orange-400 leading-none">{streak}</p>
          <p className="text-[10px] text-muted">giorni</p>
        </div>
      </div>
      {/* Best streak */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(234, 179, 8, 0.06)', border: '1px solid rgba(234, 179, 8, 0.12)' }}>
        <Trophy size={16} className="text-yellow-500/70" />
        <div>
          <p className="text-sm font-semibold text-yellow-500/70 leading-none">{bestStreak}</p>
          <p className="text-[10px] text-muted">record</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: Gamification Header
// ═══════════════════════════════════════════════════════════════════════════════

function GamificationHeader({
  xp, streak, bestStreak, todayCompleted, todayTotal,
}: {
  xp: number;
  streak: number;
  bestStreak: number;
  todayCompleted: number;
  todayTotal: number;
}) {
  const currentTime = getCurrentTimeOfDay();
  const config = TIME_OF_DAY_CONFIG[currentTime];
  const todayPct = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.emoji}</span>
          <div>
            <h2 className="text-lg font-semibold text-heading">{config.greeting}!</h2>
            <p className="text-xs text-muted">
              {todayCompleted === 0 && todayTotal > 0 && 'Inizia la tua giornata con calma'}
              {todayCompleted > 0 && todayCompleted < todayTotal && `Stai andando alla grande — ${todayCompleted}/${todayTotal} completate`}
              {todayCompleted === todayTotal && todayTotal > 0 && 'Tutte le routine completate! Fantastico'}
              {todayTotal === 0 && 'Nessuna routine per oggi'}
            </p>
          </div>
        </div>
        <StreakCounter streak={streak} bestStreak={bestStreak} />
      </div>

      {/* XP Bar */}
      <XPBar xp={xp} />

      {/* Progresso giornata */}
      {todayTotal > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted flex items-center gap-1.5">
              <TrendingUp size={12} /> Progresso di oggi
            </span>
            <span className="text-xs font-semibold" style={{ color: todayPct === 100 ? '#4ade80' : config.color }}>
              {todayPct}%
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-card-inner overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${todayPct}%`,
                background: todayPct === 100
                  ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                  : `linear-gradient(90deg, ${config.color}, ${config.color}cc)`,
              }}
            />
          </div>
          {/* Mini dots per routine */}
          <div className="flex items-center gap-1.5 mt-2.5">
            {Array.from({ length: todayTotal }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: i < todayCompleted ? '#4ade80' : 'rgba(255,255,255,0.08)',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: Step Timer (migliorato)
// ═══════════════════════════════════════════════════════════════════════════════

function StepTimer({ durationMinutes, accentColor, onComplete }: {
  durationMinutes: number;
  accentColor: string;
  onComplete: () => void;
}) {
  const { secondsLeft, isRunning, isFinished, start, pause, reset } = useCountdown(durationMinutes * 60);
  const progress = 1 - secondsLeft / (durationMinutes * 60);

  useEffect(() => {
    if (isFinished) onComplete();
  }, [isFinished, onComplete]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-10 h-10">
        <svg width="40" height="40" className="-rotate-90">
          <circle cx="20" cy="20" r="17" stroke="rgba(255,255,255,0.05)" strokeWidth="3" fill="none" />
          <circle
            cx="20" cy="20" r="17"
            stroke={isFinished ? '#4ade80' : accentColor}
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
          <button onClick={start} className="p-1.5 rounded-lg hover:bg-surface-hover text-body transition-colors" aria-label="Avvia timer">
            <Play size={13} />
          </button>
        )}
        {isRunning && (
          <button onClick={pause} className="p-1.5 rounded-lg hover:bg-surface-hover text-body transition-colors" aria-label="Pausa timer">
            <Pause size={13} />
          </button>
        )}
        {(isRunning || secondsLeft < durationMinutes * 60) && !isFinished && (
          <button onClick={() => reset()} className="p-1.5 rounded-lg hover:bg-surface-hover text-body transition-colors" aria-label="Reset timer">
            <RotateCcw size={13} />
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

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: Mood Check (post-routine)
// ═══════════════════════════════════════════════════════════════════════════════

function MoodCheck({
  routineName,
  onSubmit,
  onSkip,
}: {
  routineName: string;
  onSubmit: (mood: number) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (selected === null) return;
    setIsSubmitting(true);
    setTimeout(() => {
      onSubmit(selected);
    }, 300);
  };

  return (
    <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
        <Sparkles size={20} className="text-emerald-400" />
      </div>
      <h3 className="text-sm font-semibold text-heading mb-1">Routine completata!</h3>
      <p className="text-xs text-muted mb-5">Come ti senti dopo "{routineName}"?</p>

      {/* Mood selector — grandi aree cliccabili per autismo/motor planning */}
      <div className="flex items-center justify-center gap-3 mb-5">
        {MOOD_OPTIONS.map((mood) => (
          <button
            key={mood.value}
            onClick={() => setSelected(mood.value)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all duration-200 min-w-[60px]"
            style={{
              background: selected === mood.value ? `${mood.color}15` : 'transparent',
              border: `2px solid ${selected === mood.value ? mood.color : 'transparent'}`,
              transform: selected === mood.value ? 'scale(1.08)' : 'scale(1)',
            }}
            aria-label={mood.label}
            aria-pressed={selected === mood.value}
          >
            <span className="text-2xl" role="img" aria-hidden="true">{mood.emoji}</span>
            <span className="text-[10px] text-muted">{mood.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onSkip}
          className="px-4 py-2 rounded-xl text-xs text-muted hover:text-body transition-colors"
        >
          Salta
        </button>
        <button
          onClick={handleSubmit}
          disabled={selected === null || isSubmitting}
          className="px-5 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-xs font-medium transition-all duration-200 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Salva
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: Routine Card (stile Me+ — grande, colorata, invitante)
// ═══════════════════════════════════════════════════════════════════════════════

function RoutineCard({
  routine,
  colorIndex,
  onEdit,
  onDelete,
  onXPGain,
}: {
  routine: RoutineResponse;
  colorIndex: number;
  onEdit: (r: RoutineResponse) => void;
  onDelete: (r: RoutineResponse) => void;
  onXPGain: (amount: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isStarted, setIsStarted] = useState(false);
  const [showMoodCheck, setShowMoodCheck] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [moodRating, setMoodRating] = useState<number | null>(null);

  const routineColor = getRoutineColor(colorIndex);
  const timeConfig = TIME_OF_DAY_CONFIG[routine.time_of_day];
  const sortedSteps = useMemo(
    () => [...routine.steps].sort((a, b) => a.order - b.order),
    [routine.steps]
  );
  const completionPct = sortedSteps.length > 0
    ? Math.round((completedSteps.size / sortedSteps.length) * 100)
    : 0;
  const allDone = completedSteps.size === sortedSteps.length && sortedSteps.length > 0;
  const dur = totalDuration(sortedSteps);

  // Trova il prossimo step non completato (per evidenziarlo)
  const nextStepId = sortedSteps.find(s => !completedSteps.has(s.id))?.id ?? null;

  const handleToggleStep = (stepId: string) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
        // XP per step completato
        onXPGain(XP_PER_STEP);
      }
      return next;
    });
  };

  const handleStart = async () => {
    try { await routineService.start(routine.id); } catch { /* offline */ }
    setIsStarted(true);
    setExpanded(true);
  };

  const handleComplete = async () => {
    try {
      await routineService.complete(routine.id, { completed_steps: Array.from(completedSteps) });
    } catch { /* offline */ }
    // XP bonus per routine completata
    onXPGain(XP_PER_ROUTINE);
    setShowMoodCheck(true);
  };

  const handleMoodSubmit = (mood: number) => {
    setMoodRating(mood);
    setShowMoodCheck(false);
    setIsCompleted(true);
  };

  const handleMoodSkip = () => {
    setShowMoodCheck(false);
    setIsCompleted(true);
  };

  // ─── Stato: Mood check ───
  if (showMoodCheck) {
    return <MoodCheck routineName={routine.name} onSubmit={handleMoodSubmit} onSkip={handleMoodSkip} />;
  }

  // ─── Stato: Completata ───
  if (isCompleted) {
    return (
      <div
        className="rounded-2xl p-5 transition-all duration-300"
        style={{ background: 'rgba(52, 211, 153, 0.06)', border: '1px solid rgba(52, 211, 153, 0.15)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 size={22} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-300">{routine.name}</p>
            <p className="text-[11px] text-emerald-500/60 flex items-center gap-2">
              {completedSteps.size}/{sortedSteps.length} step completati
              {moodRating && (
                <>
                  <span>·</span>
                  <span>{MOOD_OPTIONS.find(m => m.value === moodRating)?.emoji}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10">
            <Zap size={12} className="text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">
              +{XP_PER_ROUTINE + completedSteps.size * XP_PER_STEP}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Stato: Card principale ───
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: routineColor.bg,
        border: `1px solid ${routineColor.border}`,
        boxShadow: isStarted ? `0 0 20px ${routineColor.accent}08` : 'none',
      }}
    >
      {/* Header della card */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Icona grande colorata — area touch ampia */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `${routineColor.accent}20` }}
            >
              <timeConfig.icon size={22} style={{ color: routineColor.accent }} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-heading">{routine.name}</h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${timeConfig.color}12`, color: timeConfig.color }}>
                  {timeConfig.emoji} {timeConfig.label}
                </span>
                <span className="text-[11px] text-muted flex items-center gap-1">
                  {sortedSteps.length} step
                </span>
                {dur > 0 && (
                  <span className="text-[11px] text-muted flex items-center gap-1">
                    <Clock size={10} /> {dur} min
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Menu azioni */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(routine)}
              className="p-2 rounded-xl hover:bg-surface-hover text-muted hover:text-body transition-colors"
              aria-label="Modifica routine"
            >
              <Edit3 size={15} />
            </button>
            <button
              onClick={() => onDelete(routine)}
              className="p-2 rounded-xl hover:bg-surface-hover text-muted hover:text-red-400 transition-colors"
              aria-label="Elimina routine"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Descrizione */}
        {routine.description && !isStarted && (
          <p className="text-xs text-muted mb-3 leading-relaxed">{routine.description}</p>
        )}

        {/* Progress bar (quando avviata) */}
        {isStarted && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-muted">Progresso</span>
              <span className="text-[11px] font-semibold" style={{ color: allDone ? '#4ade80' : routineColor.accent }}>
                {completionPct}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-card-inner overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${completionPct}%`,
                  background: allDone
                    ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                    : `linear-gradient(90deg, ${routineColor.accent}, ${routineColor.accent}aa)`,
                }}
              />
            </div>
          </div>
        )}

        {/* Pulsante azione principale — grande e chiaro */}
        <div className="flex items-center gap-2">
          {!isStarted ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: `${routineColor.accent}18`, color: routineColor.accent }}
            >
              <Play size={16} fill="currentColor" /> Avvia routine
            </button>
          ) : allDone ? (
            <button
              onClick={handleComplete}
              className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <CheckCircle2 size={16} /> Completa
            </button>
          ) : (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all text-muted hover:text-body"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? 'Nascondi' : 'Mostra step'}
            </button>
          )}

          {/* Indicatore step completati */}
          {isStarted && !allDone && (
            <span className="text-[11px] text-muted ml-auto">
              {completedSteps.size}/{sortedSteps.length}
            </span>
          )}
        </div>
      </div>

      {/* Lista step espandibile */}
      {expanded && isStarted && (
        <div className="border-t px-4 py-3 space-y-1" style={{ borderColor: routineColor.border }}>
          {sortedSteps.map((step) => {
            const done = completedSteps.has(step.id);
            const isNext = step.id === nextStepId;

            return (
              <div
                key={step.id}
                className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200"
                style={{
                  background: done
                    ? 'rgba(52, 211, 153, 0.05)'
                    : isNext
                    ? `${routineColor.accent}08`
                    : 'transparent',
                  // Bordo sottile sul prossimo step per guidare l'attenzione
                  border: isNext ? `1px solid ${routineColor.accent}25` : '1px solid transparent',
                }}
              >
                {/* Checkbox — area touch grande (44px min per accessibilità) */}
                <button
                  onClick={() => handleToggleStep(step.id)}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                  style={done ? { background: 'rgba(52, 211, 153, 0.15)' } : { background: 'rgba(255,255,255,0.04)' }}
                  aria-label={done ? `${step.title} completato` : `Completa ${step.title}`}
                  aria-checked={done}
                  role="checkbox"
                >
                  {done ? (
                    <Check size={16} className="text-emerald-400" />
                  ) : (
                    <Circle size={16} className="text-muted" />
                  )}
                </button>

                {/* Info step */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {step.icon && <span className="text-base">{step.icon}</span>}
                    <span className={`text-sm ${done ? 'text-muted line-through' : isNext ? 'text-heading font-medium' : 'text-body'}`}>
                      {step.title}
                    </span>
                    {step.is_optional && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-card-inner text-muted">opz.</span>
                    )}
                    {isNext && !done && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: `${routineColor.accent}15`, color: routineColor.accent }}
                      >
                        prossimo
                      </span>
                    )}
                  </div>
                  {step.description && (
                    <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{step.description}</p>
                  )}
                </div>

                {/* Timer */}
                {step.duration_minutes && step.duration_minutes > 0 && !done && (
                  <StepTimer
                    durationMinutes={step.duration_minutes}
                    accentColor={routineColor.accent}
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

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: Step Form Inline (per la creazione/modifica)
// ═══════════════════════════════════════════════════════════════════════════════

function StepFormInline({
  step, index, onChange, onRemove,
}: {
  step: RoutineStepCreate;
  index: number;
  onChange: (i: number, s: RoutineStepCreate) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border-default">
      <div className="pt-2 text-muted cursor-grab">
        <GripVertical size={14} />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          {/* Emoji picker — select grande per facilità */}
          <select
            value={step.icon || '🎯'}
            onChange={e => onChange(index, { ...step, icon: e.target.value })}
            className="w-12 h-10 bg-card-inner border border-border-default rounded-xl text-center text-lg cursor-pointer"
            aria-label={`Icona per step ${index + 1}`}
          >
            {EMOJI_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <input
            value={step.title}
            onChange={e => onChange(index, { ...step, title: e.target.value })}
            placeholder={`Step ${index + 1}`}
            className="flex-1 px-3 py-2 text-sm bg-card-inner border border-border-default rounded-xl text-heading placeholder-muted focus:border-border-hover focus:outline-none transition-colors"
          />
          <input
            type="number"
            min="1"
            max="120"
            value={step.duration_minutes ?? ''}
            onChange={e => onChange(index, { ...step, duration_minutes: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="min"
            className="w-16 px-2 py-2 text-sm text-center bg-card-inner border border-border-default rounded-xl text-heading placeholder-muted focus:border-border-hover focus:outline-none transition-colors"
            aria-label={`Durata in minuti per step ${index + 1}`}
          />
        </div>
        <label className="flex items-center gap-2 text-[11px] text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={step.is_optional ?? false}
            onChange={e => onChange(index, { ...step, is_optional: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-border-default"
          />
          Opzionale
        </label>
      </div>
      <button onClick={() => onRemove(index)} className="pt-2 text-muted hover:text-red-400 transition-colors" aria-label={`Rimuovi step ${index + 1}`}>
        <X size={14} />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: Routine Form Modal
// ═══════════════════════════════════════════════════════════════════════════════

function RoutineFormModal({
  isOpen, onClose, editingRoutine, onSave, isSaving,
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
            {editingRoutine ? 'Salva' : 'Crea'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Input
          label="Nome routine"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="es. Routine mattutina, Wind-down serale..."
        />
        <Textarea
          label="Descrizione (opzionale)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Descrivi brevemente lo scopo"
          className="min-h-[60px]"
        />

        {/* Fascia oraria — card grandi con colori */}
        <div>
          <label className="block text-sm font-medium text-body mb-2">Fascia oraria</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['morning', 'afternoon', 'evening', 'night'] as TimeOfDay[]).map(tod => {
              const c = TIME_OF_DAY_CONFIG[tod];
              const selected = timeOfDay === tod;
              return (
                <button
                  key={tod}
                  onClick={() => setTimeOfDay(tod)}
                  className="p-3 rounded-xl text-center text-xs font-medium transition-all duration-200"
                  style={{
                    background: selected ? c.bgLight : 'rgba(255,255,255,0.02)',
                    border: selected ? `2px solid ${c.color}40` : '2px solid rgba(255,255,255,0.05)',
                    color: selected ? c.color : undefined,
                  }}
                  aria-pressed={selected}
                >
                  <span className="text-lg block mb-1">{c.emoji}</span>
                  {c.label}
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
              <StepFormInline key={i} step={step} index={i} onChange={updateStep} onRemove={removeStep} />
            ))}
          </div>
          <button
            onClick={addStep}
            className="mt-3 w-full py-3 rounded-xl border border-dashed border-border-hover text-xs text-muted hover:text-body hover:border-border-hover transition-all flex items-center justify-center gap-1.5"
          >
            <Plus size={14} /> Aggiungi step
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: All Routines List (gestione)
// ═══════════════════════════════════════════════════════════════════════════════

function AllRoutinesList({
  routines, onEdit, onDelete, onToggleActive,
}: {
  routines: RoutineResponse[];
  onEdit: (r: RoutineResponse) => void;
  onDelete: (r: RoutineResponse) => void;
  onToggleActive: (r: RoutineResponse) => void;
}) {
  const orderedKeys: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];

  const grouped = routines.reduce<Record<TimeOfDay, RoutineResponse[]>>((acc, r) => {
    if (!acc[r.time_of_day]) acc[r.time_of_day] = [];
    acc[r.time_of_day].push(r);
    return acc;
  }, {} as Record<TimeOfDay, RoutineResponse[]>);

  return (
    <div className="space-y-6">
      {orderedKeys.map(key => {
        const items = grouped[key];
        if (!items || items.length === 0) return null;
        const config = TIME_OF_DAY_CONFIG[key];

        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">{config.emoji}</span>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: config.color }}>
                {config.label}
              </span>
            </div>
            <div className="space-y-2">
              {items.sort((a, b) => a.order - b.order).map((r, idx) => {
                const color = getRoutineColor(idx);
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-4 rounded-xl transition-all duration-200"
                    style={{
                      background: r.is_active ? color.bg : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${r.is_active ? color.border : 'rgba(255,255,255,0.04)'}`,
                      opacity: r.is_active ? 1 : 0.5,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <button onClick={() => onToggleActive(r)} className="shrink-0" aria-label={r.is_active ? 'Disattiva' : 'Attiva'}>
                        {r.is_active ? (
                          <CheckCircle2 size={20} style={{ color: color.accent }} />
                        ) : (
                          <Circle size={20} className="text-muted" />
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
                      <button onClick={() => onEdit(r)} className="p-2 rounded-xl hover:bg-surface-hover text-muted hover:text-body transition-colors" aria-label="Modifica">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => onDelete(r)} className="p-2 rounded-xl hover:bg-surface-hover text-muted hover:text-red-400 transition-colors" aria-label="Elimina">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE: Error Banner
// ═══════════════════════════════════════════════════════════════════════════════

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mb-6 flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
      <AlertCircle size={16} className="text-red-400 shrink-0" />
      <p className="text-xs text-red-300 flex-1">{message}</p>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-300 transition-colors shrink-0" aria-label="Chiudi errore">
        <X size={14} />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGINA PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

type ViewTab = 'today' | 'all';

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<RoutineResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('today');
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gamification state (persiste nella sessione — TODO: backend)
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [todayCompleted] = useState(0);

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
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoutines(); }, [fetchRoutines]);

  // Carica gamification da localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('routine_gamification');
      if (saved) {
        const data = JSON.parse(saved);
        setXp(data.xp ?? 0);
        setStreak(data.streak ?? 0);
        setBestStreak(data.bestStreak ?? 0);

        // Controlla se lo streak è ancora valido (stesso giorno o ieri)
        const lastDate = data.lastCompletionDate;
        if (lastDate) {
          const last = new Date(lastDate);
          const today = new Date();
          const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 1) {
            setStreak(0); // Streak interrotto
          }
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Salva gamification
  const saveGamification = useCallback((newXp: number, newStreak: number, newBest: number) => {
    try {
      localStorage.setItem('routine_gamification', JSON.stringify({
        xp: newXp,
        streak: newStreak,
        bestStreak: newBest,
        lastCompletionDate: new Date().toISOString(),
      }));
    } catch { /* ignore */ }
  }, []);

  const handleXPGain = useCallback((amount: number) => {
    setXp(prev => {
      const newXp = prev + amount;
      saveGamification(newXp, streak, bestStreak);
      return newXp;
    });
  }, [streak, bestStreak, saveGamification]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleSave = async (data: RoutineCreate) => {
    setIsSaving(true);
    setError(null);

    if (!isOffline) {
      try {
        if (editingRoutine) {
          await routineService.update(editingRoutine.id, {
            name: data.name, description: data.description, time_of_day: data.time_of_day,
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
        setIsOffline(true);
        setError(`API non raggiungibile — salvato localmente. (${message})`);
      }
    }

    // Fallback locale
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
    setRoutines(prev => prev.map(r => r.id === routine.id ? { ...r, is_active: !r.is_active } : r));
  };

  const handleEdit = (r: RoutineResponse) => {
    setEditingRoutine(r);
    setShowForm(true);
  };

  // ─── Derived data ─────────────────────────────────────────────────────

  const todayRoutines = routines.filter(r => r.is_active);
  const orderedTimes: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];
  const currentTimeOfDay = getCurrentTimeOfDay();

  // ─── Tabs ─────────────────────────────────────────────────────────────

  const tabs: { key: ViewTab; label: string; icon: React.ElementType }[] = [
    { key: 'today', label: 'Oggi', icon: Sparkles },
    { key: 'all',   label: 'Gestisci', icon: Edit3 },
  ];

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-page text-heading">
      {/* Header */}
      <header className="sticky top-0 z-30 px-6 py-4 border-b border-border-default bg-page/85 backdrop-blur-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center justify-center w-8 h-8 rounded-lg border border-border-default text-tertiary hover:text-heading hover:border-border-hover transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div>
              <p className="section-label leading-none mb-0.5">Daily structure</p>
              <h1 className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
                Routine
                {streak > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-orange-400 font-mono-display">
                    <Flame size={12} /> {streak}
                  </span>
                )}
              </h1>
            </div>
          </div>
          <button
            onClick={() => { setEditingRoutine(null); setShowForm(true); }}
            className="chip border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
          >
            <Plus size={12} /> Nuova
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Gamification Header */}
        {!loading && todayRoutines.length > 0 && activeTab === 'today' && (
          <div className="mb-6">
            <GamificationHeader
              xp={xp}
              streak={streak}
              bestStreak={bestStreak}
              todayCompleted={todayCompleted}
              todayTotal={todayRoutines.length}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200"
              style={{
                background: activeTab === tab.key ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: activeTab === tab.key ? undefined : undefined,
              }}
              aria-selected={activeTab === tab.key}
              role="tab"
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Offline banner */}
        {isOffline && !loading && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300 flex-1">
              Modalita locale — il backend non e raggiungibile. Le modifiche verranno salvate solo in questa sessione.
            </p>
          </div>
        )}

        {/* Error */}
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {/* Loading */}
        {loading && (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-border-hover border-t-blue-400 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted mt-4">Caricamento routine...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && routines.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(96, 165, 250, 0.08)', border: '1px solid rgba(96, 165, 250, 0.15)' }}>
              <Sparkles size={28} className="text-blue-400" />
            </div>
            <p className="text-base font-semibold text-heading mb-2">Crea la tua prima routine</p>
            <p className="text-sm text-muted mb-6 max-w-xs mx-auto leading-relaxed">
              Organizza la giornata in step chiari e prevedibili. Un passo alla volta.
            </p>
            <button
              onClick={() => { setEditingRoutine(null); setShowForm(true); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
              style={{ background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.25)' }}
            >
              <Plus size={16} /> Crea routine
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: OGGI — Layout ibrido: timeline su mobile, griglia su desktop */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {!loading && routines.length > 0 && activeTab === 'today' && (
          <>
            {/* Desktop: griglia 2 colonne per le 4 fasce */}
            <div className="hidden md:grid md:grid-cols-2 gap-6">
              {orderedTimes.map(time => {
                const items = todayRoutines.filter(r => r.time_of_day === time);
                const config = TIME_OF_DAY_CONFIG[time];
                const isCurrent = time === currentTimeOfDay;

                return (
                  <div key={time} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{config.emoji}</span>
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: config.color }}>
                        {config.label}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${config.color}15`, color: config.color }}>
                          ora
                        </span>
                      )}
                    </div>
                    {items.length > 0 ? (
                      <div className="space-y-3">
                        {items.sort((a, b) => a.order - b.order).map((routine, idx) => (
                          <RoutineCard
                            key={routine.id}
                            routine={routine}
                            colorIndex={orderedTimes.indexOf(time) * 2 + idx}
                            onEdit={handleEdit}
                            onDelete={r => setDeleteTarget(r)}
                            onXPGain={handleXPGain}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,255,255,0.06)' }}>
                        <p className="text-xs text-muted">Nessuna routine</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mobile: timeline verticale */}
            <div className="md:hidden space-y-6">
              {orderedTimes.map(time => {
                const items = todayRoutines.filter(r => r.time_of_day === time);
                if (items.length === 0) return null;
                const config = TIME_OF_DAY_CONFIG[time];
                const isCurrent = time === currentTimeOfDay;

                return (
                  <div key={time} className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-8 bottom-0 w-0.5" style={{ background: `${config.color}20` }} />

                    {/* Timeline dot + label */}
                    <div className="flex items-center gap-3 mb-3 relative z-10">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: `${config.color}15`, border: `2px solid ${config.color}30` }}
                      >
                        <span className="text-sm">{config.emoji}</span>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: config.color }}>
                        {config.label}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${config.color}15`, color: config.color }}>
                          ora
                        </span>
                      )}
                    </div>

                    {/* Cards */}
                    <div className="ml-10 space-y-3">
                      {items.sort((a, b) => a.order - b.order).map((routine, idx) => (
                        <RoutineCard
                          key={routine.id}
                          routine={routine}
                          colorIndex={orderedTimes.indexOf(time) * 2 + idx}
                          onEdit={handleEdit}
                          onDelete={r => setDeleteTarget(r)}
                          onXPGain={handleXPGain}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: GESTISCI */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {!loading && routines.length > 0 && activeTab === 'all' && (
          <AllRoutinesList
            routines={routines}
            onEdit={handleEdit}
            onDelete={r => setDeleteTarget(r)}
            onToggleActive={handleToggleActive}
          />
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
        message={`Vuoi eliminare "${deleteTarget?.name}"? Questa azione non e reversibile.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isDanger
        isLoading={isDeleting}
      />
    </div>
  );
}
