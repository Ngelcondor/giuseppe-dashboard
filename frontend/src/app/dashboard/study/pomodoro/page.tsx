'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Settings,
  X,
  Timer as TimerIcon,
  CheckCircle2,
} from 'lucide-react';
import { loadState, getTodayDay, StudyDay } from '@/lib/studyPlanState';

type Mode = 'work' | 'short' | 'long';

interface Session {
  id: number;
  type: Mode;
  completedAt: string;
  duration: number;
  task?: string;
}

interface Config {
  work: number;
  short: number;
  long: number;
  longAfter: number;
}

const MODE_LABELS: Record<Mode, string> = {
  work: 'Studio',
  short: 'Pausa breve',
  long: 'Pausa lunga',
};

const MODE_COLORS: Record<Mode, string> = {
  work: '#2dd4bf',  // teal-400 (study theme)
  short: '#34d399',
  long: '#60a5fa',
};

// ADHD-friendly defaults: 45/15 invece di 25/5
const DEFAULT_CONFIG: Config = { work: 45, short: 15, long: 30, longAfter: 4 };
const STORAGE_CONFIG = 'study-pomodoro-config';
const STORAGE_SESSIONS = 'study-pomodoro-sessions';

export default function StudyPomodoroPage() {
  const [config, setConfig] = useState<Config>(() => {
    if (typeof window === 'undefined') return DEFAULT_CONFIG;
    const s = localStorage.getItem(STORAGE_CONFIG);
    return s ? JSON.parse(s) : DEFAULT_CONFIG;
  });

  const [mode, setMode] = useState<Mode>('work');
  const [seconds, setSeconds] = useState(DEFAULT_CONFIG.work * 60);
  const [running, setRunning] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [sessions, setSessions] = useState<Session[]>(() => {
    if (typeof window === 'undefined') return [];
    const s = localStorage.getItem(STORAGE_SESSIONS);
    return s ? JSON.parse(s) : [];
  });
  const [showConfig, setShowConfig] = useState(false);
  const [draftConfig, setDraftConfig] = useState(config);
  const [taskLabel, setTaskLabel] = useState('');
  const [today, setToday] = useState<StudyDay | undefined>(undefined);
  const [showTaskPicker, setShowTaskPicker] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const s = loadState();
    setToday(getTodayDay(s));
  }, []);

  const totalSeconds = config[mode] * 60;
  const progress = (totalSeconds - seconds) / totalSeconds;
  const R = 110;
  const C = 2 * Math.PI * R;

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  const playBeep = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(); osc.stop(ctx.currentTime + 0.8);
    } catch (_) {}
  }, []);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setSeconds(config[next] * 60);
    setRunning(false);
  }, [config]);

  const completeSession = useCallback(() => {
    setRunning(false);
    playBeep();
    const newSession: Session = {
      id: Date.now(),
      type: mode,
      completedAt: new Date().toISOString(),
      duration: config[mode],
      task: mode === 'work' ? taskLabel || undefined : undefined,
    };
    setSessions(prev => {
      const updated = [newSession, ...prev].slice(0, 50);
      localStorage.setItem(STORAGE_SESSIONS, JSON.stringify(updated));
      return updated;
    });
    if (mode === 'work') {
      const nc = pomodoroCount + 1;
      setPomodoroCount(nc);
      switchMode(nc % config.longAfter === 0 ? 'long' : 'short');
    } else {
      switchMode('work');
    }
  }, [mode, pomodoroCount, config, playBeep, switchMode, taskLabel]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => { if (s <= 1) { completeSession(); return 0; } return s - 1; });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, completeSession]);

  useEffect(() => {
    document.title = running ? `${mm}:${ss} — ${MODE_LABELS[mode]}` : 'Studio Pomodoro';
    return () => { document.title = 'Dashboard'; };
  }, [mm, ss, running, mode]);

  useEffect(() => { if (!running) setSeconds(config[mode] * 60); }, [config, mode]);

  const saveConfig = () => {
    setConfig(draftConfig);
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(draftConfig));
    setSeconds(draftConfig[mode] * 60);
    setShowConfig(false);
  };

  const todaySessions = sessions.filter(s => new Date(s.completedAt).toDateString() === new Date().toDateString());
  const todayPomodoros = todaySessions.filter(s => s.type === 'work').length;
  const todayMinutes = todaySessions.filter(s => s.type === 'work').reduce((a, s) => a + s.duration, 0);
  const color = MODE_COLORS[mode];

  const todayTasks = today?.tasks.filter(t => !t.completed && !t.skipped) || [];

  return (
    <div className="min-h-screen bg-page text-heading">
      <header className="px-6 py-5 border-b border-border-default flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/study" className="text-tertiary hover:text-body transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <TimerIcon size={18} className="text-violet-400" />
          <h1 className="text-base font-semibold">Pomodoro Studio</h1>
        </div>
        <button
          onClick={() => { setDraftConfig(config); setShowConfig(true); }}
          className="text-muted hover:text-body transition-colors"
        >
          <Settings size={16} />
        </button>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        {/* Mode selector */}
        <div className="flex justify-center mb-8">
          <div className="flex gap-1 p-1 rounded-xl bg-card border border-border-default">
            {(['work', 'short', 'long'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  mode === m ? 'bg-surface-hover text-heading' : 'text-tertiary hover:text-body'
                }`}
              >
                {m === 'work' ? 'Studio' : m === 'short' ? 'Pausa' : 'Lunga'}
              </button>
            ))}
          </div>
        </div>

        {/* Timer */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-64 h-64 mb-6">
            <svg width="256" height="256" className="-rotate-90">
              <circle cx="128" cy="128" r={R} stroke="#1a1f2e" strokeWidth="8" fill="none" />
              <circle
                cx="128" cy="128" r={R}
                stroke={color} strokeWidth="8" fill="none"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
                style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-mono font-semibold tracking-tight" style={{ color }}>
                {mm}:{ss}
              </span>
              <span className="text-xs text-muted mt-2 uppercase tracking-widest">{MODE_LABELS[mode]}</span>
            </div>
          </div>

          {/* Task selector */}
          <div className="w-full mb-6">
            <button
              onClick={() => setShowTaskPicker(v => !v)}
              className="w-full text-left px-3 py-2 rounded-xl bg-card border border-border-default text-xs text-tertiary hover:bg-surface-hover transition-colors flex items-center justify-between"
            >
              <span className="truncate">
                {taskLabel || 'Su cosa stai studiando?'}
              </span>
              <span className="text-muted">{showTaskPicker ? '▲' : '▼'}</span>
            </button>
            {showTaskPicker && (
              <div className="mt-2 rounded-xl bg-card border border-border-default overflow-hidden">
                <input
                  type="text"
                  value={taskLabel}
                  onChange={e => setTaskLabel(e.target.value)}
                  placeholder="Inserisci manualmente..."
                  className="w-full bg-transparent border-b border-border-default px-3 py-2 text-xs text-body placeholder-muted focus:outline-none"
                />
                {todayTasks.length > 0 && (
                  <>
                    <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-muted">
                      Task di oggi
                    </p>
                    <div className="max-h-40 overflow-y-auto divide-y divide-white/5">
                      {todayTasks.map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setTaskLabel(t.text); setShowTaskPicker(false); }}
                          className="w-full text-left px-3 py-2 text-xs text-body hover:bg-surface-hover transition-colors"
                        >
                          {t.text}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-5">
            <button
              onClick={() => { setRunning(false); setSeconds(config[mode] * 60); }}
              className="p-3 rounded-xl bg-card-inner border border-border-default text-tertiary hover:text-body transition-all"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={() => setRunning(r => !r)}
              className="w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{ borderColor: color + '60', backgroundColor: color + '15' }}
            >
              {running
                ? <Pause size={22} style={{ color }} />
                : <Play size={22} style={{ color }} className="ml-0.5" />}
            </button>
            <button
              onClick={() => completeSession()}
              className="p-3 rounded-xl bg-card-inner border border-border-default text-tertiary hover:text-body transition-all"
            >
              <SkipForward size={18} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Pomodori oggi', value: String(todayPomodoros) },
            { label: 'Minuti studio', value: String(todayMinutes) },
            { label: 'Al lungo', value: `${pomodoroCount % config.longAfter}/${config.longAfter}` },
          ].map(s => (
            <div key={s.label} className="p-3 rounded-xl bg-card border border-border-default text-center">
              <p className="text-xl font-semibold text-heading">{s.value}</p>
              <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ADHD note */}
        <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/20 mb-6">
          <p className="text-[11px] text-violet-300/80 leading-relaxed">
            💡 Default 45/15 ADHD-friendly. Se senti hyperfocus, continua oltre il timer — non spezzare il flow.
          </p>
        </div>

        {/* History */}
        {sessions.length > 0 && (
          <div className="rounded-2xl bg-card border border-border-default overflow-hidden">
            <div className="px-5 py-4 border-b border-border-default">
              <p className="text-xs font-medium text-tertiary uppercase tracking-widest">Sessioni recenti</p>
            </div>
            <div className="divide-y divide-white/5 max-h-52 overflow-y-auto">
              {sessions.slice(0, 15).map(s => (
                <div key={s.id} className="flex items-start gap-2.5 px-5 py-3">
                  <span className="text-sm shrink-0">{s.type === 'work' ? '🍅' : s.type === 'short' ? '☕' : '🌙'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-body">{MODE_LABELS[s.type]}</span>
                      <span className="text-[11px] text-muted">{s.duration} min</span>
                    </div>
                    {s.task && (
                      <p className="text-[11px] text-tertiary truncate mt-0.5">{s.task}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted shrink-0">
                    {new Date(s.completedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Config modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card-solid rounded-2xl border border-border-hover p-6 w-full max-w-xs">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm font-semibold">Configura timer</p>
              <button onClick={() => setShowConfig(false)} className="text-tertiary hover:text-body">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              {([
                ['work', 'Studio (minuti)'],
                ['short', 'Pausa breve (minuti)'],
                ['long', 'Pausa lunga (minuti)'],
                ['longAfter', 'Pausa lunga ogni N pomodori'],
              ] as [keyof Config, string][]).map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs text-tertiary mb-1.5 block">{label}</label>
                  <input
                    type="number" min={1} max={120}
                    value={draftConfig[key]}
                    onChange={e => setDraftConfig(d => ({ ...d, [key]: Number(e.target.value) }))}
                    className="w-full bg-card-inner border border-border-hover rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-white/20 transition-colors"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowConfig(false)}
                className="flex-1 py-2 rounded-xl border border-border-hover text-tertiary text-sm hover:bg-card-inner transition-colors">
                Annulla
              </button>
              <button onClick={saveConfig}
                className="flex-1 py-2 rounded-xl bg-surface-hover text-heading text-sm font-medium hover:bg-white/15 transition-colors">
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
