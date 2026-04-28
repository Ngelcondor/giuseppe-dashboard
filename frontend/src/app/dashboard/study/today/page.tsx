'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sun,
  Coffee,
  Clock,
  AlertTriangle,
  Timer,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  loadState,
  toggleTask,
  markTaskSkipped,
  getTodayDay,
  getDayProgress,
  getPendingPastTasks,
  rescheduleToToday,
  rescheduleSpread,
  markAllPendingSkipped,
  StudyPlanState,
  StudyDay,
} from '@/lib/studyPlanState';

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const complete = pct === 1 && total > 0;
  const color = complete ? '#34d399' : '#fbbf24';

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} stroke="#1e293b" strokeWidth="5" fill="none" />
        <circle
          cx="40" cy="40" r={r}
          stroke={color} strokeWidth="5" fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="absolute text-base font-semibold" style={{ color }}>
        {done}/{total}
      </span>
    </div>
  );
}

export default function TodayPage() {
  const [state, setState] = useState<StudyPlanState | null>(null);
  const [today, setToday] = useState<StudyDay | undefined>(undefined);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const s = loadState();
    setState(s);
    setToday(getTodayDay(s));
    setPendingCount(getPendingPastTasks(s).length);
  }, []);

  if (!state) {
    return (
      <div className="min-h-screen bg-page text-heading flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-border-default border-t-slate-400 rounded-full animate-spin" />
      </div>
    );
  }

  const handleToggle = (taskId: string) => {
    if (!today) return;
    const next = toggleTask(state, today.date, taskId);
    setState(next);
    setToday(getTodayDay(next));
  };

  const handleSkip = (taskId: string) => {
    if (!today) return;
    const next = markTaskSkipped(state, today.date, taskId);
    setState(next);
    setToday(getTodayDay(next));
  };

  const handleRescheduleToToday = () => {
    const next = rescheduleToToday(state);
    setState(next);
    setToday(getTodayDay(next));
    setPendingCount(getPendingPastTasks(next).length);
  };

  const handleSpread = () => {
    const next = rescheduleSpread(state, 3);
    setState(next);
    setToday(getTodayDay(next));
    setPendingCount(getPendingPastTasks(next).length);
  };

  const handleSkipAll = () => {
    const next = markAllPendingSkipped(state);
    setState(next);
    setToday(getTodayDay(next));
    setPendingCount(getPendingPastTasks(next).length);
  };

  const progress = today ? getDayProgress(today) : { done: 0, total: 0, pct: 0 };
  const dateLabel = new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-page text-heading">
      <header className="px-6 py-5 border-b border-border-default">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/study" className="text-tertiary hover:text-body transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <Sun size={18} className="text-amber-400" />
            <h1 className="text-base font-semibold">Cosa fare oggi</h1>
          </div>
          <Link
            href="/dashboard/study/pomodoro"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20 transition-colors"
          >
            <Timer size={13} />
            Pomodoro
          </Link>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8 space-y-6">
        {/* Pending banner */}
        {pendingCount > 0 && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-400" />
              <p className="text-sm font-semibold text-rose-300">
                {pendingCount} task in arretrato dai giorni passati
              </p>
            </div>
            <p className="text-xs text-rose-200/80">
              Cosa vuoi farne? La timeline si aggiornerà di conseguenza.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={handleRescheduleToToday}
                className="px-3 py-2 text-xs rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 border border-rose-500/40 transition-colors"
              >
                Sposta a oggi
              </button>
              <button
                onClick={handleSpread}
                className="px-3 py-2 text-xs rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 border border-rose-500/40 transition-colors"
              >
                Spalma in 3 giorni
              </button>
              <button
                onClick={handleSkipAll}
                className="px-3 py-2 text-xs rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-100 border border-amber-500/30 transition-colors"
              >
                Saltali
              </button>
            </div>
          </div>
        )}

        {!today && (
          <div className="p-6 rounded-2xl bg-card border border-border-default text-center">
            <CalendarIcon size={28} className="text-muted mx-auto mb-3" />
            <p className="text-sm text-body">Nessun giorno pianificato per oggi</p>
            <p className="text-xs text-tertiary mt-1">
              {dateLabel}
            </p>
            <p className="text-[11px] text-muted mt-3">
              La roadmap CRTP va dal 28 Aprile 2026 al 22 Settembre 2026.
            </p>
          </div>
        )}

        {today && today.isRest && (
          <div className="p-6 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-center">
            <Coffee size={28} className="text-blue-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-heading">{today.label}</p>
            <p className="text-xs text-blue-300 mt-1.5 capitalize">{dateLabel}</p>
            <p className="text-xs text-tertiary mt-3 max-w-sm mx-auto">
              Domenica sacra. Burnout = fallimento. Una giornata di rest a settimana è non negoziabile.
            </p>
          </div>
        )}

        {today && !today.isRest && (
          <>
            {/* Today summary */}
            <div className="flex items-center gap-5 p-5 rounded-2xl bg-card border border-border-default">
              <ProgressRing done={progress.done} total={progress.total} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-heading">{today.label}</p>
                <p className="text-xs text-tertiary mt-0.5 capitalize">{dateLabel}</p>
                {today.hours && (
                  <p className="text-[11px] text-muted mt-1.5 flex items-center gap-1">
                    <Clock size={11} />
                    {today.hours} stimati
                  </p>
                )}
              </div>
            </div>

            {/* Tasks */}
            <div className="rounded-2xl bg-card border border-border-default overflow-hidden">
              <div className="px-5 py-3 border-b border-border-default">
                <p className="text-xs font-medium text-tertiary uppercase tracking-widest">Task del giorno</p>
              </div>
              <div className="divide-y divide-white/5">
                {today.tasks.map((task) => (
                  <div key={task.id} className="px-5 py-3 flex items-start gap-3">
                    <button
                      onClick={() => handleToggle(task.id)}
                      className="shrink-0 mt-0.5 transition-all duration-150 active:scale-90"
                    >
                      <div
                        className={`w-[20px] h-[20px] rounded-md border-2 flex items-center justify-center transition-all ${
                          task.completed
                            ? 'bg-emerald-500 border-emerald-500'
                            : task.skipped
                            ? 'bg-amber-500/30 border-amber-500/60'
                            : 'border-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {task.completed && (
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {task.skipped && !task.completed && (
                          <span className="text-[10px] text-amber-300 leading-none">↷</span>
                        )}
                      </div>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-relaxed ${
                          task.completed ? 'text-muted line-through' : task.skipped ? 'text-amber-300/70 italic' : 'text-body'
                        }`}
                      >
                        {task.text}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {task.rescheduledFrom && (
                          <span className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
                            ↻ riprogrammato da {task.rescheduledFrom}
                          </span>
                        )}
                        {task.skipped && (
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            saltato
                          </span>
                        )}
                      </div>
                    </div>
                    {!task.completed && !task.skipped && (
                      <button
                        onClick={() => handleSkip(task.id)}
                        className="shrink-0 text-[10px] text-muted hover:text-amber-400 transition-colors"
                      >
                        skip
                      </button>
                    )}
                  </div>
                ))}
                {today.tasks.length === 0 && (
                  <div className="px-5 py-6 text-center text-xs text-muted">
                    Nessun task per oggi 🎉
                  </div>
                )}
              </div>
            </div>

            {progress.total > 0 && progress.done === progress.total && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <p className="text-sm font-semibold text-emerald-300">🎉 Giornata completata!</p>
                <p className="text-xs text-emerald-200/80 mt-1">
                  Reward time. Domani si riparte.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
