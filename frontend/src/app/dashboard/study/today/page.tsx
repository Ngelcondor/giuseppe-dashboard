'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sun,
  Coffee,
  Clock,
  AlertTriangle,
  Timer,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { Surface, EmptyState } from '@/components/ui/Surface';
import {
  loadState,
  toggleTask,
  markTaskSkipped,
  getTodayDay,
  getDayProgress,
  getPendingPastTasks,
  getDayContext,
  rescheduleToToday,
  rescheduleSpread,
  markAllPendingSkipped,
  StudyPlanState,
  StudyDay,
  DayContext,
} from '@/lib/studyPlanState';
import { buildClaudeStudyPrompt } from '@/lib/studyClaudePrompt';
import { CopyPromptButton } from '@/components/ui/CopyPromptButton';

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const complete = pct === 1 && total > 0;
  const color = complete ? '#34d399' : '#fbbf24';

  return (
    <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} stroke="rgb(var(--color-border))" strokeWidth="5" fill="none" />
        <circle
          cx="40" cy="40" r={r}
          stroke={color} strokeWidth="5" fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="absolute text-[15px] font-semibold font-mono-display" style={{ color }}>
        {done}/{total}
      </span>
    </div>
  );
}

export default function TodayPage() {
  const [state, setState] = useState<StudyPlanState | null>(null);
  const [today, setToday] = useState<StudyDay | undefined>(undefined);
  const [ctx, setCtx] = useState<DayContext | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const s = loadState();
    setState(s);
    const t = getTodayDay(s);
    setToday(t);
    setCtx(t ? getDayContext(s, t.date) : null);
    setPendingCount(getPendingPastTasks(s).length);
  }, []);

  if (!state) {
    return (
      <PageShell title="Cosa fare oggi" icon={Sun} iconColor="text-amber-400" back="/dashboard/study">
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-border-default border-t-tertiary rounded-full animate-spin" />
        </div>
      </PageShell>
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

  const headerActions = (
    <Link
      href="/dashboard/study/pomodoro"
      className="chip chip-accent border-violet-500/40 bg-violet-500/10 text-violet-300"
    >
      <Timer size={12} />
      Pomodoro
    </Link>
  );

  return (
    <PageShell
      title="Cosa fare oggi"
      eyebrow="Studio CRTP"
      icon={Sun}
      iconColor="text-amber-400"
      back="/dashboard/study"
      width="md"
      actions={headerActions}
    >
      {/* Pending banner */}
      {pendingCount > 0 && (
        <Surface padding="md" className="mb-6 bg-rose-500/8 border-rose-500/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-rose-400" />
            <p className="text-sm font-semibold text-rose-300">
              {pendingCount} task in arretrato
            </p>
          </div>
          <p className="text-xs text-rose-200/80 mb-4">
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
        </Surface>
      )}

      {!today && (
        <Surface padding="lg">
          <EmptyState
            icon={CalendarIcon}
            title="Nessun giorno pianificato per oggi"
            description={`${dateLabel} · La roadmap CRTP va dal 28 Aprile 2026 al 22 Settembre 2026.`}
          />
        </Surface>
      )}

      {today && today.isRest && (
        <Surface variant="accent" padding="lg">
          <div className="text-center py-4">
            <Coffee size={32} className="text-blue-400 mx-auto mb-3" />
            <p className="text-base font-semibold text-heading">{today.label}</p>
            <p className="text-xs text-blue-300 mt-2 capitalize">{dateLabel}</p>
            <p className="text-xs text-tertiary mt-4 max-w-sm mx-auto leading-relaxed">
              Domenica sacra. Burnout = fallimento. Una giornata di rest a settimana è non negoziabile.
            </p>
          </div>
        </Surface>
      )}

      {today && !today.isRest && (
        <>
          {/* Today summary */}
          <Surface variant="accent" padding="md" className="mb-5 flex items-center gap-5">
            <ProgressRing done={progress.done} total={progress.total} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-heading leading-snug">{today.label}</p>
              <p className="text-xs text-tertiary mt-1 capitalize">{dateLabel}</p>
              {today.hours && (
                <p className="text-[11px] text-muted mt-2 flex items-center gap-1 font-mono-display">
                  <Clock size={11} />
                  {today.hours} stimati
                </p>
              )}
            </div>
          </Surface>

          {/* Tasks */}
          <Surface padding="none" className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border-default flex items-center justify-between">
              <p className="section-label">Task del giorno</p>
              <span className="text-[11px] font-mono-display text-tertiary">
                {progress.done}/{progress.total}
              </span>
            </div>
            <div className="divide-y divide-white/[0.04]">
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
                          : 'border-slate-600 hover:border-accent'
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
                        <span className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded font-mono-display">
                          ↻ da {task.rescheduledFrom}
                        </span>
                      )}
                      {task.skipped && (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          saltato
                        </span>
                      )}
                    </div>
                  </div>
                  {!task.completed && !task.skipped && ctx && (
                    <CopyPromptButton
                      prompt={buildClaudeStudyPrompt({ taskText: task.text, ctx })}
                      variant="chip"
                    />
                  )}
                  {!task.completed && !task.skipped && (
                    <button
                      onClick={() => handleSkip(task.id)}
                      className="shrink-0 text-[10px] text-muted hover:text-amber-400 transition-colors font-mono-display"
                    >
                      skip
                    </button>
                  )}
                </div>
              ))}
              {today.tasks.length === 0 && (
                <div className="px-5 py-8 text-center text-xs text-muted">
                  Nessun task per oggi 🎉
                </div>
              )}
            </div>
          </Surface>

          {progress.total > 0 && progress.done === progress.total && (
            <Surface padding="md" className="mt-5 bg-emerald-500/10 border-emerald-500/30 text-center">
              <p className="text-sm font-semibold text-emerald-300">🎉 Giornata completata</p>
              <p className="text-xs text-emerald-200/80 mt-1.5 font-mono-display">
                <span className="text-accent">$</span> echo &quot;reward time&quot;
              </p>
            </Surface>
          )}
        </>
      )}
    </PageShell>
  );
}
