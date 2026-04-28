'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  RotateCcw,
  Clock,
  AlertTriangle,
  Coffee,
  X,
} from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { Surface } from '@/components/ui/Surface';
import {
  loadState,
  resetState,
  toggleTask,
  markTaskSkipped,
  getPhaseProgress,
  getWeekProgress,
  getDayProgress,
  getPendingPastTasks,
  rescheduleToToday,
  rescheduleSpread,
  markAllPendingSkipped,
  dismissReschedulePrompt,
  todayISO,
  StudyPlanState,
  StudyPhase,
  StudyWeek,
  StudyDay,
} from '@/lib/studyPlanState';

function formatItalianDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

const PHASE_BAR_COLORS: Record<string, string> = {
  'text-slate-300': '#cbd5e1',
  'text-emerald-400': '#34d399',
  'text-amber-400': '#fbbf24',
  'text-orange-400': '#fb923c',
  'text-rose-400': '#fb7185',
};

export default function TimelinePage() {
  const [state, setState] = useState<StudyPlanState | null>(null);
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({});
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    const s = loadState();
    setState(s);

    const today = todayISO();
    const initialOpenPhases: Record<string, boolean> = {};
    const initialOpenWeeks: Record<string, boolean> = {};
    for (const p of s.phases) {
      for (const w of p.weeks) {
        const inRange = w.days.some((d) => d.date === today);
        if (inRange) {
          initialOpenPhases[p.id] = true;
          initialOpenWeeks[w.id] = true;
        }
      }
    }
    setOpenPhases(initialOpenPhases);
    setOpenWeeks(initialOpenWeeks);

    const pending = getPendingPastTasks(s);
    if (pending.length > 0) setShowRescheduleModal(true);
  }, []);

  const pendingTasks = useMemo(() => (state ? getPendingPastTasks(state) : []), [state]);

  if (!state) {
    return (
      <PageShell title="Timeline" icon={Calendar} iconColor="text-accent" back="/dashboard/study" width="lg">
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-border-default border-t-tertiary rounded-full animate-spin" />
        </div>
      </PageShell>
    );
  }

  const handleToggle = (date: string, taskId: string) => setState(toggleTask(state, date, taskId));
  const handleSkip = (date: string, taskId: string) => setState(markTaskSkipped(state, date, taskId));
  const handleRescheduleToToday = () => { setState(rescheduleToToday(state)); setShowRescheduleModal(false); };
  const handleSpread = () => { setState(rescheduleSpread(state, 3)); setShowRescheduleModal(false); };
  const handleSkipAll = () => { setState(markAllPendingSkipped(state)); setShowRescheduleModal(false); };
  const handleDismiss = () => { setState(dismissReschedulePrompt(state)); setShowRescheduleModal(false); };
  const handleReset = () => { setState(resetState()); setShowResetConfirm(false); };

  const headerActions = (
    <>
      {pendingTasks.length > 0 && (
        <button
          onClick={() => setShowRescheduleModal(true)}
          className="chip border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
        >
          <AlertTriangle size={12} />
          {pendingTasks.length} arretrati
        </button>
      )}
      <button
        onClick={() => setShowResetConfirm(true)}
        className="p-2 text-tertiary hover:text-rose-400 transition-colors rounded-lg hover:bg-card-inner"
        title="Reset progress"
      >
        <RotateCcw size={14} />
      </button>
    </>
  );

  return (
    <PageShell
      title="Timeline CRTP"
      eyebrow="Roadmap completa"
      icon={Calendar}
      iconColor="text-accent"
      back="/dashboard/study"
      width="lg"
      actions={headerActions}
    >
      <div className="space-y-4">
        {state.phases.map((phase) => (
          <PhaseBlock
            key={phase.id}
            phase={phase}
            isOpen={!!openPhases[phase.id]}
            onToggle={() => setOpenPhases((prev) => ({ ...prev, [phase.id]: !prev[phase.id] }))}
            openWeeks={openWeeks}
            setOpenWeeks={setOpenWeeks}
            onTaskToggle={handleToggle}
            onTaskSkip={handleSkip}
          />
        ))}
      </div>

      {/* Reschedule modal */}
      {showRescheduleModal && pendingTasks.length > 0 && (
        <div className="modal-backdrop z-50 flex items-center justify-center p-4">
          <Surface variant="accent" padding="lg" className="w-full max-w-md">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400" />
                <p className="text-sm font-semibold">Task in arretrato</p>
              </div>
              <button onClick={handleDismiss} className="text-tertiary hover:text-body">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-body mb-4">
              Hai <span className="font-semibold text-heading font-mono-display">{pendingTasks.length} task</span> non completati di giorni passati.
            </p>
            <div className="space-y-2">
              <button onClick={handleRescheduleToToday} className="w-full text-left p-3 rounded-xl bg-card-inner border border-border-default hover:bg-surface-hover transition-colors">
                <p className="text-sm font-medium text-heading">📍 Sposta tutto a oggi</p>
                <p className="text-[11px] text-tertiary mt-0.5">I task vengono aggiunti al giorno corrente</p>
              </button>
              <button onClick={handleSpread} className="w-full text-left p-3 rounded-xl bg-card-inner border border-border-default hover:bg-surface-hover transition-colors">
                <p className="text-sm font-medium text-heading">📊 Spalma nei prossimi 3 giorni</p>
                <p className="text-[11px] text-tertiary mt-0.5">Distribuzione round-robin, esclusi i rest day</p>
              </button>
              <button onClick={handleSkipAll} className="w-full text-left p-3 rounded-xl bg-card-inner border border-border-default hover:bg-surface-hover transition-colors">
                <p className="text-sm font-medium text-heading">⏭️ Segna come saltati</p>
                <p className="text-[11px] text-tertiary mt-0.5">Restano nei giorni originali ma marcati come skip</p>
              </button>
              <button onClick={handleDismiss} className="w-full text-left p-3 rounded-xl bg-transparent border border-border-default hover:bg-card-inner transition-colors">
                <p className="text-[11px] text-tertiary">Decidi più tardi</p>
              </button>
            </div>
          </Surface>
        </div>
      )}

      {/* Reset confirm */}
      {showResetConfirm && (
        <div className="modal-backdrop z-50 flex items-center justify-center p-4">
          <Surface variant="accent" padding="lg" className="w-full max-w-sm">
            <p className="text-sm font-semibold mb-2">Reset progress?</p>
            <p className="text-xs text-tertiary mb-5">
              Tutti i checkmark e le riprogrammazioni verranno cancellate. Operazione non reversibile.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-border-default text-tertiary text-sm hover:bg-card-inner transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-sm font-medium hover:bg-rose-500/30 transition-colors"
              >
                Reset
              </button>
            </div>
          </Surface>
        </div>
      )}
    </PageShell>
  );
}

/* ─── Phase block ────────────────────────────────────────────────────────── */

function PhaseBlock({
  phase, isOpen, onToggle, openWeeks, setOpenWeeks, onTaskToggle, onTaskSkip,
}: {
  phase: StudyPhase;
  isOpen: boolean;
  onToggle: () => void;
  openWeeks: Record<string, boolean>;
  setOpenWeeks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onTaskToggle: (date: string, taskId: string) => void;
  onTaskSkip: (date: string, taskId: string) => void;
}) {
  const progress = getPhaseProgress(phase);
  const accentColor = PHASE_BAR_COLORS[phase.color] || '#94a3b8';

  return (
    <div className="rounded-2xl bg-card-solid border border-border-default overflow-hidden">
      <button onClick={onToggle} className="w-full px-5 py-4 flex items-center gap-4 hover:bg-surface-hover transition-colors">
        <span
          className="text-[10px] font-semibold tracking-uppercase font-mono-display"
          style={{ color: accentColor }}
        >
          {phase.shortLabel}
        </span>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-heading truncate">{phase.label}</p>
          <p className="text-[11px] text-tertiary mt-0.5 truncate">{phase.description}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-mono-display text-body">{progress.pct}%</p>
          <p className="text-[10px] text-muted font-mono-display">{progress.done}/{progress.total}</p>
        </div>
        {isOpen ? <ChevronUp size={15} className="text-tertiary shrink-0" /> : <ChevronDown size={15} className="text-tertiary shrink-0" />}
      </button>

      <div className="h-[2px] bg-card-inner">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progress.pct}%`, backgroundColor: accentColor }}
        />
      </div>

      {isOpen && (
        <div className="px-3 pb-3 pt-3 space-y-2 bg-page/40">
          {phase.weeks.map((week) => (
            <WeekBlock
              key={week.id}
              week={week}
              isOpen={!!openWeeks[week.id]}
              onToggle={() => setOpenWeeks((prev) => ({ ...prev, [week.id]: !prev[week.id] }))}
              onTaskToggle={onTaskToggle}
              onTaskSkip={onTaskSkip}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Week block ─────────────────────────────────────────────────────────── */

function WeekBlock({
  week, isOpen, onToggle, onTaskToggle, onTaskSkip,
}: {
  week: StudyWeek;
  isOpen: boolean;
  onToggle: () => void;
  onTaskToggle: (date: string, taskId: string) => void;
  onTaskSkip: (date: string, taskId: string) => void;
}) {
  const progress = getWeekProgress(week);

  return (
    <div className="rounded-xl bg-card-solid border border-border-default overflow-hidden">
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-hover transition-colors">
        {isOpen ? <ChevronDown size={13} className="text-tertiary shrink-0" /> : <ChevronRight size={13} className="text-tertiary shrink-0" />}
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-heading">{week.label}</p>
          <p className="text-[11px] text-tertiary mt-0.5">{week.range}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-mono-display text-body">{progress.pct}%</p>
          <p className="text-[10px] text-muted font-mono-display">{progress.done}/{progress.total}</p>
        </div>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-2 space-y-2 border-t border-border-default">
          {week.days.map((day) => (
            <DayBlock key={day.id} day={day} onTaskToggle={onTaskToggle} onTaskSkip={onTaskSkip} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Day block ──────────────────────────────────────────────────────────── */

function DayBlock({
  day, onTaskToggle, onTaskSkip,
}: {
  day: StudyDay;
  onTaskToggle: (date: string, taskId: string) => void;
  onTaskSkip: (date: string, taskId: string) => void;
}) {
  const today = todayISO();
  const isToday = day.date === today;
  const isPast = day.date < today;
  const isFuture = day.date > today;
  const progress = getDayProgress(day);

  if (day.isRest) {
    return (
      <div className={`px-3 py-2.5 rounded-lg bg-card-inner border border-border-default flex items-center gap-2 ${isToday ? 'ring-1 ring-amber-400/50' : ''}`}>
        <Coffee size={12} className="text-blue-400 shrink-0" />
        <p className="text-xs text-tertiary flex-1 truncate">{day.label}</p>
        <span className="text-[10px] text-muted shrink-0 font-mono-display">{formatItalianDate(day.date)}</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg bg-card-inner border ${
        isToday ? 'border-amber-400/50 ring-1 ring-amber-400/30' : 'border-border-default'
      } ${isFuture ? 'opacity-80' : ''}`}
    >
      <div className="px-3 py-2.5 border-b border-border-default flex items-center gap-2">
        {isToday && (
          <span className="text-[10px] font-semibold text-amber-400 tracking-uppercase">Oggi</span>
        )}
        <p className="text-xs font-medium text-heading flex-1 truncate">{day.label}</p>
        {day.hours && (
          <span className="flex items-center gap-1 text-[10px] text-muted shrink-0 font-mono-display">
            <Clock size={10} />
            {day.hours}
          </span>
        )}
        <span className="text-[10px] text-muted shrink-0 font-mono-display">{progress.done}/{progress.total}</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {day.tasks.map((task) => (
          <div key={task.id} className="px-3 py-2 flex items-start gap-2.5">
            <button onClick={() => onTaskToggle(day.date, task.id)} className="shrink-0 mt-0.5 transition-all duration-150 active:scale-90">
              <div
                className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-all ${
                  task.completed
                    ? 'bg-emerald-500 border-emerald-500'
                    : task.skipped
                    ? 'bg-amber-500/30 border-amber-500/60'
                    : 'border-slate-600 hover:border-accent'
                }`}
              >
                {task.completed && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {task.skipped && !task.completed && <span className="text-[10px] text-amber-300 leading-none">↷</span>}
              </div>
            </button>
            <div className="flex-1 min-w-0">
              <p
                className={`text-xs leading-relaxed ${
                  task.completed ? 'text-muted line-through' : task.skipped ? 'text-amber-300/70 italic' : 'text-body'
                }`}
              >
                {task.text}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {task.rescheduledFrom && (
                  <span className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded font-mono-display">
                    ↻ da {formatItalianDate(task.rescheduledFrom)}
                  </span>
                )}
                {task.skipped && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    saltato
                  </span>
                )}
              </div>
            </div>
            {!task.completed && !task.skipped && isPast && (
              <button
                onClick={() => onTaskSkip(day.date, task.id)}
                className="shrink-0 text-[10px] text-muted hover:text-amber-400 transition-colors font-mono-display"
                title="Marca come saltato"
              >
                skip
              </button>
            )}
          </div>
        ))}
        {day.tasks.length === 0 && (
          <div className="px-3 py-2 text-[11px] text-muted italic">Nessun task</div>
        )}
      </div>
    </div>
  );
}
