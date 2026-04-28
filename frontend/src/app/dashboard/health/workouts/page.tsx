'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { EditorialPage } from '@/components/ui/EditorialPage';
import {
  ArrowLeft,
  Dumbbell,
  Check,
  Clock,
  Timer,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trophy,
  Info,
  Play,
  Pause,
  History,
  Flame,
  X,
} from 'lucide-react';

// ─── Training Program Data ─────────────────────────────────────────────────

interface ExerciseSet {
  reps: number | string; // string for ranges like "15-20" or special notes
  weight?: number;
  completed: boolean;
  restSeconds?: number; // specific rest for this set
  note?: string; // e.g. "aumentare peso"
}

interface Exercise {
  name: string;
  sets: ExerciseSet[];
  muscleGroup: string;
  emoji: string;
}

interface TrainingDay {
  id: number;
  name: string;
  label: string;
  color: string;
  colorDim: string;
  warmup?: string;
  exercises: Exercise[];
}

const createTrainingProgram = (): TrainingDay[] => [
  {
    id: 1,
    name: 'GIORNO 1',
    label: 'UPPER',
    color: '#8B5CF6',
    colorDim: 'rgba(139, 92, 246, 0.12)',
    exercises: [
      {
        name: 'Lat Machine',
        sets: [
          { reps: 8, completed: false },
          { reps: 8, completed: false },
          { reps: 8, completed: false },
        ],
        muscleGroup: 'Dorsali',
        emoji: '🔽',
      },
      {
        name: 'Low Row',
        sets: [
          { reps: 10, completed: false },
          { reps: 10, completed: false },
          { reps: 10, completed: false },
        ],
        muscleGroup: 'Dorsali',
        emoji: '🚣',
      },
      {
        name: 'Shoulder Press',
        sets: [
          { reps: 12, completed: false },
          { reps: 12, completed: false },
          { reps: 12, completed: false },
        ],
        muscleGroup: 'Spalle',
        emoji: '🙌',
      },
      {
        name: 'Chest Press',
        sets: [
          { reps: 10, completed: false },
          { reps: 10, completed: false },
          { reps: 10, completed: false },
        ],
        muscleGroup: 'Pettorali',
        emoji: '💪',
      },
      {
        name: 'Push Down Tricipiti (Fune)',
        sets: [
          { reps: 10, completed: false },
          { reps: 10, completed: false },
          { reps: 10, completed: false },
        ],
        muscleGroup: 'Tricipiti',
        emoji: '🔻',
      },
      {
        name: 'Curl Manubri',
        sets: [
          { reps: 10, completed: false },
          { reps: 10, completed: false },
          { reps: 10, completed: false },
        ],
        muscleGroup: 'Bicipiti',
        emoji: '💪',
      },
    ],
  },
  {
    id: 2,
    name: 'GIORNO 2',
    label: 'LOWER',
    color: '#10B981',
    colorDim: 'rgba(16, 185, 129, 0.12)',
    warmup: '5 minuti di camminata leggera e/o stretching',
    exercises: [
      {
        name: 'Abductor Machine (Apertura)',
        sets: [
          { reps: 20, completed: false, note: 'Peso leggero' },
          { reps: 12, completed: false, restSeconds: 120, note: 'Aumentare peso' },
          { reps: 12, completed: false, note: 'Peso aumentato' },
        ],
        muscleGroup: 'Glutei',
        emoji: '🍑',
      },
      {
        name: 'Leg Press (Piedi altezza 1)',
        sets: [
          { reps: 10, completed: false },
          { reps: 10, completed: false },
          { reps: 10, completed: false },
        ],
        muscleGroup: 'Quadricipiti / Glutei',
        emoji: '🦵',
      },
      {
        name: 'Leg Extension',
        sets: [
          { reps: 12, completed: false },
          { reps: 12, completed: false },
          { reps: 12, completed: false },
        ],
        muscleGroup: 'Quadricipiti',
        emoji: '🦿',
      },
      {
        name: 'Crunch Addome (Macchinario)',
        sets: [
          { reps: '15-20', completed: false },
          { reps: '15-20', completed: false },
          { reps: '15-20', completed: false },
        ],
        muscleGroup: 'Addominali',
        emoji: '🎯',
      },
    ],
  },
  {
    id: 3,
    name: 'GIORNO 3',
    label: 'UPPER',
    color: '#F59E0B',
    colorDim: 'rgba(245, 158, 11, 0.12)',
    exercises: [
      {
        name: 'Rematore Singolo Manubrio',
        sets: [
          { reps: 10, completed: false },
          { reps: 10, completed: false },
          { reps: 10, completed: false },
        ],
        muscleGroup: 'Dorsali',
        emoji: '🚣',
      },
      {
        name: 'Rear Delts Machine',
        sets: [
          { reps: 15, completed: false },
          { reps: 12, completed: false, restSeconds: 90 },
          { reps: 10, completed: false, restSeconds: 90 },
        ],
        muscleGroup: 'Deltoidi posteriori',
        emoji: '🔙',
      },
      {
        name: 'Pectoral Fly Machine',
        sets: [
          { reps: '10-12', completed: false },
          { reps: '10-12', completed: false },
          { reps: '10-12', completed: false },
        ],
        muscleGroup: 'Pettorali',
        emoji: '🦋',
      },
      {
        name: 'Alzate Laterali',
        sets: [
          { reps: '10-12', completed: false },
          { reps: '10-12', completed: false },
          { reps: '10-12', completed: false },
        ],
        muscleGroup: 'Spalle',
        emoji: '🙌',
      },
      {
        name: 'French Press Manubri',
        sets: [
          { reps: 10, completed: false },
          { reps: 10, completed: false },
          { reps: 10, completed: false },
        ],
        muscleGroup: 'Tricipiti',
        emoji: '🔻',
      },
    ],
  },
];

// ─── Storage Keys ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'giuseppe-workout-tracker';
const HISTORY_KEY = 'giuseppe-workout-history';

interface SessionData {
  dayId: number;
  date: string;
  exercises: Exercise[];
  startedAt: string;
  completedAt?: string;
}

interface HistoryEntry {
  dayId: number;
  dayName: string;
  dayLabel: string;
  date: string;
  completedAt: string;
  exercises: {
    name: string;
    sets: { reps: number | string; weight?: number; completed: boolean }[];
  }[];
  totalSetsCompleted: number;
  totalSets: number;
}

function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(data: SessionData | null) {
  if (data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

// ─── Rest Timer Component ──────────────────────────────────────────────────

function RestTimer() {
  const [seconds, setSeconds] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [initialSeconds, setInitialSeconds] = useState(60);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => s - 1);
      }, 1000);
    } else if (seconds === 0) {
      setIsRunning(false);
      // Vibrate if available
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, seconds]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const progress = initialSeconds > 0 ? ((initialSeconds - seconds) / initialSeconds) * 100 : 0;

  const presets = [45, 60, 90, 120];

  return (
    <div className="rounded-2xl bg-card-solid border border-border-default p-4">
      <div className="flex items-center gap-2 mb-3">
        <Timer size={16} className="text-blue-400" />
        <span className="text-xs font-semibold text-heading">Recupero</span>
      </div>

      {/* Timer display */}
      <div className="text-center mb-3">
        <span
          className={`text-3xl font-mono font-bold tabular-nums ${
            seconds === 0 ? 'text-green-400 animate-pulse' : isRunning ? 'text-blue-400' : 'text-heading'
          }`}
        >
          {formatTime(seconds)}
        </span>
        {seconds === 0 && (
          <p className="text-xs text-green-400 mt-1">Via! Serie successiva</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-card rounded-full mb-3 overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 mb-3">
        {!isRunning ? (
          <button
            onClick={() => {
              if (seconds === 0) setSeconds(initialSeconds);
              setIsRunning(true);
            }}
            className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
          >
            <Play size={18} />
          </button>
        ) : (
          <button
            onClick={() => setIsRunning(false)}
            className="p-2.5 rounded-xl bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 transition-colors"
          >
            <Pause size={18} />
          </button>
        )}
        <button
          onClick={() => {
            setIsRunning(false);
            setSeconds(initialSeconds);
          }}
          className="p-2.5 rounded-xl bg-card-inner text-body hover:bg-surface-hover transition-colors"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {/* Presets */}
      <div className="flex gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => {
              setIsRunning(false);
              setInitialSeconds(p);
              setSeconds(p);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
              initialSeconds === p
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'bg-card text-tertiary hover:text-body'
            }`}
          >
            {p}s
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Exercise Row Component ────────────────────────────────────────────────

function ExerciseRow({
  exercise,
  exerciseIndex,
  dayColor,
  onToggleSet,
  onWeightChange,
}: {
  exercise: Exercise;
  exerciseIndex: number;
  dayColor: string;
  onToggleSet: (exIdx: number, setIdx: number) => void;
  onWeightChange: (exIdx: number, setIdx: number, weight: number | undefined) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const completedSets = exercise.sets.filter((s) => s.completed).length;
  const allDone = completedSets === exercise.sets.length;

  return (
    <div
      className={`rounded-xl border transition-all ${
        allDone
          ? 'bg-card border-emerald-500/20'
          : 'bg-card border-border-default hover:border-border-hover'
      }`}
    >
      {/* Exercise Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4"
      >
        <span className="text-xl">{exercise.emoji}</span>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${allDone ? 'text-emerald-400' : 'text-heading'}`}>
              {exercise.name}
            </p>
            {allDone && <Check size={14} className="text-emerald-400" />}
          </div>
          <p className="text-[10px] text-tertiary">
            {exercise.muscleGroup} · {completedSets}/{exercise.sets.length} serie
          </p>
        </div>
        {/* Mini progress dots */}
        <div className="flex gap-1 mr-2">
          {exercise.sets.map((s, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                s.completed ? 'bg-emerald-400' : 'bg-input'
              }`}
            />
          ))}
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-tertiary" />
        ) : (
          <ChevronDown size={16} className="text-tertiary" />
        )}
      </button>

      {/* Sets */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {exercise.sets.map((set, setIdx) => (
            <div key={setIdx} className="flex items-center gap-3">
              {/* Checkbox */}
              <button
                onClick={() => onToggleSet(exerciseIndex, setIdx)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${
                  set.completed
                    ? 'bg-emerald-600/30 border border-emerald-500/40'
                    : 'bg-card border border-border-hover hover:border-border-hover'
                }`}
              >
                {set.completed && <Check size={14} className="text-emerald-400" />}
              </button>

              {/* Set info */}
              <div className="flex-1 flex items-center gap-3">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ backgroundColor: `${dayColor}15`, color: dayColor }}
                >
                  Set {setIdx + 1}
                </span>
                <span className={`text-sm ${set.completed ? 'text-tertiary line-through' : 'text-heading'}`}>
                  {set.reps} rep
                </span>
                {set.note && (
                  <span className="text-[10px] text-amber-400/80 italic">{set.note}</span>
                )}
              </div>

              {/* Weight input */}
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={set.weight ?? ''}
                  onChange={(e) =>
                    onWeightChange(
                      exerciseIndex,
                      setIdx,
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                  placeholder="—"
                  className="w-16 px-2 py-1.5 rounded-lg bg-input border border-border-default text-heading text-sm text-center focus:border-blue-500 focus:outline-none"
                />
                <span className="text-[10px] text-muted">kg</span>
              </div>
            </div>
          ))}

          {/* Rest info if specific */}
          {exercise.sets.some((s) => s.restSeconds) && (
            <div className="flex items-center gap-1.5 pt-1 pl-11">
              <Clock size={10} className="text-muted" />
              <span className="text-[10px] text-muted">
                Recupero specifico: {exercise.sets.find((s) => s.restSeconds)?.restSeconds}s tra le serie
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── History Modal ─────────────────────────────────────────────────────────

function HistoryPanel({
  isOpen,
  onClose,
  history,
  onClear,
}: {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onClear: () => void;
}) {
  if (!isOpen) return null;

  const dayColors: Record<number, string> = { 1: '#8B5CF6', 2: '#10B981', 3: '#F59E0B' };

  return (
    <>
      <div className="fixed inset-0 bg-card-inner backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-card-solid border border-border-default rounded-xl max-h-[85vh] overflow-y-auto w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-default sticky top-0 bg-card-solid z-10">
            <div className="flex items-center gap-2">
              <History size={18} className="text-violet-400" />
              <h2 className="text-base font-semibold text-heading">Storico allenamenti</h2>
            </div>
            <button
              onClick={onClose}
              className="text-body hover:text-heading transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="px-5 py-4">
            {history.length === 0 ? (
              <div className="text-center py-8">
                <Dumbbell size={28} className="text-muted mx-auto mb-3" />
                <p className="text-sm text-tertiary">Nessun allenamento completato</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((entry, i) => {
                  const date = new Date(entry.date);
                  const dayStr = date.toLocaleDateString('it-IT', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  });
                  const color = dayColors[entry.dayId] || '#64748b';

                  return (
                    <div key={i} className="rounded-xl bg-card border border-border-default p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded"
                            style={{ backgroundColor: `${color}20`, color }}
                          >
                            {entry.dayName} {entry.dayLabel}
                          </span>
                          <span className="text-xs text-body">{dayStr}</span>
                        </div>
                        <span className="text-[10px] text-emerald-400">
                          {entry.totalSetsCompleted}/{entry.totalSets} serie
                        </span>
                      </div>

                      <div className="space-y-1">
                        {entry.exercises.map((ex, j) => {
                          const weights = ex.sets
                            .filter((s) => s.completed && s.weight)
                            .map((s) => s.weight);
                          const maxWeight = weights.length > 0 ? Math.max(...(weights as number[])) : null;

                          return (
                            <div key={j} className="flex items-center justify-between text-xs">
                              <span className="text-body">{ex.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-tertiary">
                                  {ex.sets.filter((s) => s.completed).length}/{ex.sets.length}
                                </span>
                                {maxWeight && (
                                  <span className="text-heading font-medium">{maxWeight}kg</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {history.length > 0 && (
              <button
                onClick={onClear}
                className="mt-4 w-full py-2 rounded-lg bg-red-600/10 text-red-400 text-xs hover:bg-red-600/20 transition-colors"
              >
                Cancella storico
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function WorkoutsPage() {
  const [program] = useState<TrainingDay[]>(createTrainingProgram);
  const [activeDay, setActiveDay] = useState(0);
  const [exercises, setExercises] = useState<Exercise[]>(program[0].exercises);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionStart, setSessionStart] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showRules, setShowRules] = useState(false);

  // Load saved session or history on mount
  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setActiveDay(saved.dayId - 1);
      setExercises(saved.exercises);
      setSessionActive(true);
      setSessionStart(saved.startedAt);
    }
    setHistory(loadHistory());
  }, []);

  // When switching day tabs (only if no active session)
  const switchDay = (dayIdx: number) => {
    if (sessionActive) return;
    setActiveDay(dayIdx);
    setExercises(JSON.parse(JSON.stringify(program[dayIdx].exercises)));
  };

  // Start session
  const startSession = () => {
    const fresh = JSON.parse(JSON.stringify(program[activeDay].exercises));
    setExercises(fresh);
    setSessionActive(true);
    const now = new Date().toISOString();
    setSessionStart(now);
    saveSession({
      dayId: program[activeDay].id,
      date: new Date().toISOString().split('T')[0],
      exercises: fresh,
      startedAt: now,
    });
  };

  // Toggle set completion
  const toggleSet = (exIdx: number, setIdx: number) => {
    if (!sessionActive) return;
    setExercises((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[exIdx].sets[setIdx].completed = !next[exIdx].sets[setIdx].completed;
      // Auto-save
      saveSession({
        dayId: program[activeDay].id,
        date: new Date().toISOString().split('T')[0],
        exercises: next,
        startedAt: sessionStart || new Date().toISOString(),
      });
      return next;
    });
  };

  // Update weight
  const updateWeight = (exIdx: number, setIdx: number, weight: number | undefined) => {
    setExercises((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[exIdx].sets[setIdx].weight = weight;
      saveSession({
        dayId: program[activeDay].id,
        date: new Date().toISOString().split('T')[0],
        exercises: next,
        startedAt: sessionStart || new Date().toISOString(),
      });
      return next;
    });
  };

  // Complete session
  const completeSession = () => {
    const day = program[activeDay];
    const totalSets = exercises.reduce((a, e) => a + e.sets.length, 0);
    const completedSets = exercises.reduce(
      (a, e) => a + e.sets.filter((s) => s.completed).length,
      0
    );

    const entry: HistoryEntry = {
      dayId: day.id,
      dayName: day.name,
      dayLabel: day.label,
      date: new Date().toISOString().split('T')[0],
      completedAt: new Date().toISOString(),
      exercises: exercises.map((e) => ({
        name: e.name,
        sets: e.sets.map((s) => ({
          reps: s.reps,
          weight: s.weight,
          completed: s.completed,
        })),
      })),
      totalSetsCompleted: completedSets,
      totalSets,
    };

    const updated = [entry, ...history].slice(0, 100); // keep last 100
    setHistory(updated);
    saveHistory(updated);
    saveSession(null);
    setSessionActive(false);
    setSessionStart(null);
    // Reset exercises
    setExercises(JSON.parse(JSON.stringify(program[activeDay].exercises)));
  };

  // Discard session
  const discardSession = () => {
    saveSession(null);
    setSessionActive(false);
    setSessionStart(null);
    setExercises(JSON.parse(JSON.stringify(program[activeDay].exercises)));
  };

  // Weekly stats
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
  startOfWeek.setHours(0, 0, 0, 0);

  const sessionsThisWeek = history.filter((h) => new Date(h.date) >= startOfWeek).length;

  const currentDay = program[activeDay];
  const totalSets = exercises.reduce((a, e) => a + e.sets.length, 0);
  const completedSets = exercises.reduce(
    (a, e) => a + e.sets.filter((s) => s.completed).length,
    0
  );
  const sessionProgress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  const headerActions = (
    <button
      onClick={() => setShowHistory(true)}
      className="p-2 rounded-lg text-tertiary hover:text-heading hover:bg-card-inner transition-colors"
      title="Storico"
    >
      <History size={14} />
    </button>
  );

  return (
    <EditorialPage
      eyebrow="Training"
      title="I tuoi"
      titleAccent="allenamenti"
      description="Upper / Lower split, set, reps, intensità."
      back="/dashboard/health"
      width="md"
      actions={headerActions}
    >
      <div className="space-y-5">
        {/* Weekly Progress */}
        <div className="rounded-2xl bg-gradient-to-br from-violet-950/40 to-slate-900 border border-violet-500/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" />
              <span className="text-xs font-semibold text-heading">Questa settimana</span>
            </div>
            <span className="text-xs text-tertiary">Split: Upper / Lower / Upper</span>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`flex-1 h-2.5 rounded-full transition-colors ${
                  n <= sessionsThisWeek ? 'bg-emerald-500' : 'bg-input/50'
                }`}
              />
            ))}
          </div>
          <p className="text-[11px] text-tertiary mt-2">
            {sessionsThisWeek}/3 sessioni completate
            {sessionsThisWeek >= 3 && ' — Settimana completata! 🎉'}
          </p>
        </div>

        {/* Day Tabs */}
        <div className="flex gap-2">
          {program.map((day, idx) => (
            <button
              key={day.id}
              onClick={() => switchDay(idx)}
              disabled={sessionActive && idx !== activeDay}
              className={`flex-1 py-3 rounded-xl text-center transition-all ${
                idx === activeDay
                  ? 'border-2'
                  : sessionActive
                  ? 'bg-card border border-border-default opacity-40 cursor-not-allowed'
                  : 'bg-card border border-border-default hover:border-border-hover'
              }`}
              style={
                idx === activeDay
                  ? { borderColor: day.color, backgroundColor: day.colorDim }
                  : undefined
              }
            >
              <p
                className="text-[10px] font-bold tracking-wider"
                style={{ color: idx === activeDay ? day.color : '#94a3b8' }}
              >
                {day.name}
              </p>
              <p className="text-xs text-body mt-0.5">{day.label}</p>
              {day.id === 2 && (
                <p className="text-[9px] text-muted mt-0.5">Focus glutei</p>
              )}
            </button>
          ))}
        </div>

        {/* Session Controls */}
        {!sessionActive ? (
          <button
            onClick={startSession}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
            style={{ backgroundColor: `${currentDay.color}20`, color: currentDay.color }}
          >
            <Play size={18} />
            Inizia {currentDay.name} — {currentDay.label}
          </button>
        ) : (
          <div className="space-y-3">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-tertiary">Progresso sessione</span>
                <span
                  className="text-xs font-bold"
                  style={{ color: currentDay.color }}
                >
                  {completedSets}/{totalSets} serie
                </span>
              </div>
              <div className="h-2 bg-card-solid rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${sessionProgress}%`,
                    backgroundColor: currentDay.color,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Warmup */}
        {currentDay.warmup && (
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 px-4 py-3 flex items-center gap-3">
            <Flame size={16} className="text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-300/80">{currentDay.warmup}</p>
          </div>
        )}

        {/* Rest Timer (only during session) */}
        {sessionActive && <RestTimer />}

        {/* Exercises */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-body uppercase tracking-wider px-1">
            Esercizi — {currentDay.label}
          </h3>
          {exercises.map((ex, i) => (
            <ExerciseRow
              key={`${activeDay}-${i}`}
              exercise={ex}
              exerciseIndex={i}
              dayColor={currentDay.color}
              onToggleSet={toggleSet}
              onWeightChange={updateWeight}
            />
          ))}
        </div>

        {/* Complete / Discard session */}
        {sessionActive && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={discardSession}
              className="flex-1 py-3 rounded-xl bg-card border border-border-default text-body text-sm hover:text-heading transition-colors"
            >
              Annulla sessione
            </button>
            <button
              onClick={completeSession}
              className="flex-1 py-3 rounded-xl bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 text-sm font-semibold hover:bg-emerald-600/30 transition-colors flex items-center justify-center gap-2"
            >
              <Check size={16} />
              Completa
            </button>
          </div>
        )}

        {/* Rules / Info */}
        <div className="rounded-2xl bg-card border border-border-default overflow-hidden">
          <button
            onClick={() => setShowRules(!showRules)}
            className="w-full flex items-center gap-3 px-5 py-4"
          >
            <Info size={16} className="text-blue-400" />
            <span className="text-xs font-semibold text-heading flex-1 text-left">
              Regolamento & Consigli
            </span>
            {showRules ? (
              <ChevronUp size={16} className="text-tertiary" />
            ) : (
              <ChevronDown size={16} className="text-tertiary" />
            )}
          </button>

          {showRules && (
            <div className="px-5 pb-5 space-y-4 text-xs text-body leading-relaxed">
              <div>
                <p className="text-heading font-semibold mb-1">Recuperi</p>
                <p>
                  Autogestito: min <span className="text-amber-400">45 secondi</span>, max{' '}
                  <span className="text-amber-400">2 minuti</span>. Usa il timer qui sopra.
                </p>
              </div>
              <div>
                <p className="text-heading font-semibold mb-1">Carico</p>
                <p>
                  Autogestito. Nei primi allenamenti evita carichi troppo faticosi. Carico basso e
                  dai tempo al muscolo di adattarsi.
                </p>
              </div>
              <div>
                <p className="text-heading font-semibold mb-1">Stretching & Riscaldamento</p>
                <p>Riscaldamento pre allenamento. Stretching pre o post e nei giorni liberi.</p>
              </div>
              <div>
                <p className="text-heading font-semibold mb-1">Corsi consigliati</p>
                <p>
                  <span className="text-violet-400">Postural</span> — allungare e rafforzare muscoli
                  legati alla respirazione, addio mal di schiena.
                </p>
                <p>
                  <span className="text-violet-400">Flexibility</span> — migliorare flessibilità e
                  postura.
                </p>
                <p className="text-tertiary mt-1">
                  Video &quot;Mobility&quot; (30 min stretching) disponibile in app nei giorni liberi.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Program info footer */}
        <div className="text-center text-[10px] text-muted pb-6 space-y-0.5">
          <p>Scheda: Upper / Lower / Upper — 4 settimane</p>
          <p>Obiettivo: reclutamento fibre, adattamento muscolare, gesto motorio</p>
        </div>
      </div>

      {/* History Modal */}
      <HistoryPanel
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        history={history}
        onClear={() => {
          setHistory([]);
          saveHistory([]);
        }}
      />
    </EditorialPage>
  );
}
