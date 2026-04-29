'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Settings,
  X,
  Timer as TimerIcon,
} from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { Surface, Tabs } from '@/components/ui/Surface';
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
  short: 'Pausa',
  long: 'Pausa lunga',
};

const MODE_COLORS: Record<Mode, string> = {
  work: '#10b981',     // emerald accent
  short: '#06b6d4',    // cyan
  long: '#a78bfa',     // violet
};

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
    let cancelled = false;
    loadState().then((s) => {
      if (cancelled) return;
      setToday(getTodayDay(s));
    });
    return () => { cancelled = true; };
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

  const headerActions = (
    <button
      onClick={() => { setDraftConfig(config); setShowConfig(true); }}
      className="p-2 text-tertiary hover:text-body transition-colors rounded-lg hover:bg-card-inner"
      title="Configura timer"
    >
      <Settings size={14} />
    </button>
  );

  return (
    <PageShell
      title="Pomodoro · Studio"
      eyebrow="ADHD-friendly 45/15"
      icon={TimerIcon}
      iconColor="text-violet-400"
      back="/dashboard/study"
      width="md"
      actions={headerActions}
    >
      {/* Mode tabs */}
      <div className="flex justify-center mb-8">
        <Tabs<Mode>
          options={[
            { value: 'work', label: 'Studio' },
            { value: 'short', label: 'Pausa' },
            { value: 'long', label: 'Lunga' },
          ]}
          value={mode}
          onChange={switchMode}
        />
      </div>

      {/* Timer */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative w-64 h-64 mb-6">
          <svg width="256" height="256" className="-rotate-90">
            <circle cx="128" cy="128" r={R} stroke="rgb(var(--color-border))" strokeWidth="8" fill="none" />
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
            <span className="text-[60px] font-mono-display font-semibold tracking-tight leading-none" style={{ color }}>
              {mm}:{ss}
            </span>
            <span className="text-[11px] text-muted mt-3 tracking-uppercase">{MODE_LABELS[mode]}</span>
          </div>
        </div>

        {/* Task selector */}
        <div className="w-full mb-6">
          <button
            onClick={() => setShowTaskPicker(v => !v)}
            className="w-full text-left px-3.5 py-2.5 rounded-xl bg-card-inner border border-border-default text-xs text-tertiary hover:bg-surface-hover transition-colors flex items-center justify-between"
          >
            <span className="truncate">{taskLabel || 'Su cosa stai studiando?'}</span>
            <span className="text-muted text-[10px]">{showTaskPicker ? '▲' : '▼'}</span>
          </button>
          {showTaskPicker && (
            <div className="mt-2 rounded-xl bg-card-solid border border-border-default overflow-hidden">
              <input
                type="text"
                value={taskLabel}
                onChange={e => setTaskLabel(e.target.value)}
                placeholder="Inserisci manualmente..."
                className="w-full bg-transparent border-none px-3.5 py-2.5 text-xs text-body placeholder-muted focus:outline-none focus:ring-0"
              />
              {todayTasks.length > 0 && (
                <>
                  <p className="px-3.5 pt-2 pb-1 text-[10px] tracking-uppercase text-muted border-t border-border-default">
                    Task di oggi
                  </p>
                  <div className="max-h-40 overflow-y-auto divide-y divide-white/[0.04]">
                    {todayTasks.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { setTaskLabel(t.text); setShowTaskPicker(false); }}
                        className="w-full text-left px-3.5 py-2 text-xs text-body hover:bg-surface-hover transition-colors"
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
            title="Reset"
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
            title="Skip"
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Pomodori', value: String(todayPomodoros) },
          { label: 'Minuti', value: String(todayMinutes) },
          { label: 'Al lungo', value: `${pomodoroCount % config.longAfter}/${config.longAfter}` },
        ].map(s => (
          <Surface key={s.label} padding="sm" className="text-center">
            <p className="text-xl font-semibold font-mono-display text-heading">{s.value}</p>
            <p className="text-[10px] text-muted mt-1 tracking-uppercase">{s.label}</p>
          </Surface>
        ))}
      </div>

      {/* ADHD note */}
      <Surface padding="sm" className="mb-6 bg-violet-500/5 border-violet-500/20">
        <p className="text-[11px] text-violet-300/80 leading-relaxed">
          <span className="font-mono-display text-violet-400">// </span>
          Default 45/15 ADHD-friendly. Se senti hyperfocus, continua oltre il timer — non spezzare il flow.
        </p>
      </Surface>

      {/* History */}
      {sessions.length > 0 && (
        <Surface padding="none" className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border-default">
            <p className="section-label">Sessioni recenti</p>
          </div>
          <div className="divide-y divide-white/[0.04] max-h-52 overflow-y-auto">
            {sessions.slice(0, 15).map(s => (
              <div key={s.id} className="flex items-start gap-3 px-5 py-3">
                <span className="text-base shrink-0">{s.type === 'work' ? '🍅' : s.type === 'short' ? '☕' : '🌙'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-body">{MODE_LABELS[s.type]}</span>
                    <span className="text-[11px] text-muted font-mono-display">{s.duration}m</span>
                  </div>
                  {s.task && <p className="text-[11px] text-tertiary truncate mt-0.5">{s.task}</p>}
                </div>
                <span className="text-[11px] text-muted shrink-0 font-mono-display">
                  {new Date(s.completedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </Surface>
      )}

      {/* Config modal */}
      {showConfig && (
        <div className="modal-backdrop z-50 flex items-center justify-center p-4">
          <Surface variant="accent" padding="lg" className="w-full max-w-xs">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold">Configura timer</p>
              <button onClick={() => setShowConfig(false)} className="text-tertiary hover:text-body">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3.5">
              {([
                ['work', 'Studio (minuti)'],
                ['short', 'Pausa breve (minuti)'],
                ['long', 'Pausa lunga (minuti)'],
                ['longAfter', 'Pausa lunga ogni N pomodori'],
              ] as [keyof Config, string][]).map(([key, label]) => (
                <div key={key}>
                  <label className="text-[11px] text-tertiary mb-1.5 block tracking-uppercase">{label}</label>
                  <input
                    type="number" min={1} max={120}
                    value={draftConfig[key]}
                    onChange={e => setDraftConfig(d => ({ ...d, [key]: Number(e.target.value) }))}
                    className="w-full bg-card-inner border border-border-default rounded-lg px-3.5 py-2 text-sm font-mono-display focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowConfig(false)}
                className="flex-1 py-2 rounded-lg border border-border-default text-tertiary text-sm hover:bg-card-inner transition-colors">
                Annulla
              </button>
              <button onClick={saveConfig}
                className="flex-1 py-2 rounded-lg bg-accent-soft border border-accent-soft text-accent text-sm font-medium hover:bg-accent transition-colors">
                Salva
              </button>
            </div>
          </Surface>
        </div>
      )}
    </PageShell>
  );
}
