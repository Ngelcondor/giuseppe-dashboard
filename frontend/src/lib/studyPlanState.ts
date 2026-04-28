// CRTP Study Plan — gestione stato + rescheduling logic con localStorage

import { CRTP_PLAN, StudyPhaseSeed } from './studyPlanData';

export interface StudyTask {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
  rescheduledFrom?: string; // ISO date originale
  skipped?: boolean;
}

export interface StudyDay {
  id: string;
  date: string;
  label: string;
  tasks: StudyTask[];
  isRest: boolean;
  hours?: string;
  phaseId: string;
  weekId: string;
}

export interface StudyWeek {
  id: string;
  label: string;
  range: string;
  phaseId: string;
  days: StudyDay[];
}

export interface StudyPhase {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bg: string;
  weeks: StudyWeek[];
}

export interface StudyPlanState {
  phases: StudyPhase[];
  lastUpdated: string;
  pendingReschedule?: {
    fromDate: string;
    taskCount: number;
  } | null;
}

const STORAGE_KEY = 'crtp-study-plan-v1';

function generateTaskId(date: string, idx: number): string {
  return `${date}-${idx}`;
}

export function buildInitialState(): StudyPlanState {
  const phases: StudyPhase[] = CRTP_PLAN.map((p: StudyPhaseSeed) => ({
    id: p.id,
    label: p.label,
    shortLabel: p.shortLabel,
    description: p.description,
    color: p.color,
    bg: p.bg,
    weeks: p.weeks.map((w) => ({
      id: w.id,
      label: w.label,
      range: w.range,
      phaseId: p.id,
      days: w.days.map((d) => ({
        id: d.date,
        date: d.date,
        label: d.label,
        isRest: !!d.isRest,
        hours: d.hours,
        phaseId: p.id,
        weekId: w.id,
        tasks: d.tasks.map((text, idx) => ({
          id: generateTaskId(d.date, idx),
          text,
          completed: false,
        })),
      })),
    })),
  }));

  return {
    phases,
    lastUpdated: new Date().toISOString(),
    pendingReschedule: null,
  };
}

export function loadState(): StudyPlanState {
  if (typeof window === 'undefined') return buildInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildInitialState();
    const parsed = JSON.parse(raw) as StudyPlanState;
    if (!parsed.phases || !Array.isArray(parsed.phases)) return buildInitialState();
    return parsed;
  } catch {
    return buildInitialState();
  }
}

export function saveState(state: StudyPlanState): void {
  if (typeof window === 'undefined') return;
  state.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): StudyPlanState {
  const fresh = buildInitialState();
  saveState(fresh);
  return fresh;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getAllDays(state: StudyPlanState): StudyDay[] {
  return state.phases.flatMap((p) => p.weeks.flatMap((w) => w.days));
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getDayByDate(state: StudyPlanState, date: string): StudyDay | undefined {
  return getAllDays(state).find((d) => d.date === date);
}

export function getTodayDay(state: StudyPlanState): StudyDay | undefined {
  return getDayByDate(state, todayISO());
}

export function findUpcomingNonRestDays(state: StudyPlanState, fromDate: string, count: number): StudyDay[] {
  const all = getAllDays(state);
  return all.filter((d) => d.date >= fromDate && !d.isRest).slice(0, count);
}

// ── Mutations ───────────────────────────────────────────────────────────────

export function toggleTask(state: StudyPlanState, dayDate: string, taskId: string): StudyPlanState {
  const next: StudyPlanState = JSON.parse(JSON.stringify(state));
  for (const p of next.phases) {
    for (const w of p.weeks) {
      for (const d of w.days) {
        if (d.date !== dayDate) continue;
        for (const t of d.tasks) {
          if (t.id === taskId) {
            t.completed = !t.completed;
            t.completedAt = t.completed ? new Date().toISOString() : undefined;
            if (t.completed) t.skipped = false;
            saveState(next);
            return next;
          }
        }
      }
    }
  }
  return state;
}

export function markTaskSkipped(state: StudyPlanState, dayDate: string, taskId: string): StudyPlanState {
  const next: StudyPlanState = JSON.parse(JSON.stringify(state));
  for (const p of next.phases) {
    for (const w of p.weeks) {
      for (const d of w.days) {
        if (d.date !== dayDate) continue;
        for (const t of d.tasks) {
          if (t.id === taskId) {
            t.skipped = true;
            t.completed = false;
            saveState(next);
            return next;
          }
        }
      }
    }
  }
  return state;
}

// ── Rescheduling ────────────────────────────────────────────────────────────

export interface PendingTask {
  task: StudyTask;
  dayDate: string;
  dayLabel: string;
}

export function getPendingPastTasks(state: StudyPlanState, today: string = todayISO()): PendingTask[] {
  const pending: PendingTask[] = [];
  for (const p of state.phases) {
    for (const w of p.weeks) {
      for (const d of w.days) {
        if (d.date >= today) continue;
        if (d.isRest) continue;
        for (const t of d.tasks) {
          if (!t.completed && !t.skipped) {
            pending.push({ task: t, dayDate: d.date, dayLabel: d.label });
          }
        }
      }
    }
  }
  return pending;
}

// Sposta tutti i task in pending al giorno di oggi (o primo non-rest disponibile)
export function rescheduleToToday(state: StudyPlanState): StudyPlanState {
  const next: StudyPlanState = JSON.parse(JSON.stringify(state));
  const today = todayISO();
  const pending = getPendingPastTasks(next, today);
  if (pending.length === 0) return next;

  // Trova target day (oggi o prossimo non-rest)
  const targetDay = findUpcomingNonRestDays(next, today, 1)[0];
  if (!targetDay) return next;

  // Per ogni task pending: rimuovi dal giorno originale, aggiungi al target
  for (const p of next.phases) {
    for (const w of p.weeks) {
      for (const d of w.days) {
        if (d.date >= today) continue;
        if (d.isRest) continue;
        const remaining: StudyTask[] = [];
        const toMove: StudyTask[] = [];
        for (const t of d.tasks) {
          if (!t.completed && !t.skipped) {
            toMove.push({ ...t, rescheduledFrom: d.date });
          } else {
            remaining.push(t);
          }
        }
        d.tasks = remaining;
        // aggiungi al target
        const target = next.phases
          .flatMap((pp) => pp.weeks.flatMap((ww) => ww.days))
          .find((dd) => dd.date === targetDay.date);
        if (target) {
          target.tasks.push(...toMove);
        }
      }
    }
  }

  next.pendingReschedule = null;
  saveState(next);
  return next;
}

// Spalma i task pending nei prossimi N giorni non-rest
export function rescheduleSpread(state: StudyPlanState, daysCount: number = 3): StudyPlanState {
  const next: StudyPlanState = JSON.parse(JSON.stringify(state));
  const today = todayISO();
  const pending = getPendingPastTasks(next, today);
  if (pending.length === 0) return next;

  const targetDays = findUpcomingNonRestDays(next, today, daysCount);
  if (targetDays.length === 0) return next;

  // Raccogli i task da spostare
  const tasksToMove: StudyTask[] = [];
  for (const p of next.phases) {
    for (const w of p.weeks) {
      for (const d of w.days) {
        if (d.date >= today) continue;
        if (d.isRest) continue;
        const remaining: StudyTask[] = [];
        for (const t of d.tasks) {
          if (!t.completed && !t.skipped) {
            tasksToMove.push({ ...t, rescheduledFrom: d.date });
          } else {
            remaining.push(t);
          }
        }
        d.tasks = remaining;
      }
    }
  }

  // Distribuisci round-robin
  tasksToMove.forEach((t, idx) => {
    const target = targetDays[idx % targetDays.length];
    const realTarget = next.phases
      .flatMap((p) => p.weeks.flatMap((w) => w.days))
      .find((d) => d.date === target.date);
    if (realTarget) realTarget.tasks.push(t);
  });

  next.pendingReschedule = null;
  saveState(next);
  return next;
}

export function markAllPendingSkipped(state: StudyPlanState): StudyPlanState {
  const next: StudyPlanState = JSON.parse(JSON.stringify(state));
  const today = todayISO();
  for (const p of next.phases) {
    for (const w of p.weeks) {
      for (const d of w.days) {
        if (d.date >= today) continue;
        if (d.isRest) continue;
        for (const t of d.tasks) {
          if (!t.completed && !t.skipped) {
            t.skipped = true;
          }
        }
      }
    }
  }
  next.pendingReschedule = null;
  saveState(next);
  return next;
}

export function dismissReschedulePrompt(state: StudyPlanState): StudyPlanState {
  const next: StudyPlanState = JSON.parse(JSON.stringify(state));
  next.pendingReschedule = null;
  saveState(next);
  return next;
}

// ── Stats ───────────────────────────────────────────────────────────────────

export function getPhaseProgress(phase: StudyPhase): { done: number; total: number; pct: number } {
  let done = 0;
  let total = 0;
  for (const w of phase.weeks) {
    for (const d of w.days) {
      if (d.isRest) continue;
      for (const t of d.tasks) {
        total += 1;
        if (t.completed) done += 1;
      }
    }
  }
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export function getWeekProgress(week: StudyWeek): { done: number; total: number; pct: number } {
  let done = 0;
  let total = 0;
  for (const d of week.days) {
    if (d.isRest) continue;
    for (const t of d.tasks) {
      total += 1;
      if (t.completed) done += 1;
    }
  }
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export function getDayProgress(day: StudyDay): { done: number; total: number; pct: number } {
  const total = day.tasks.length;
  const done = day.tasks.filter((t) => t.completed).length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export function getOverallProgress(state: StudyPlanState): { done: number; total: number; pct: number } {
  let done = 0;
  let total = 0;
  for (const p of state.phases) {
    const pp = getPhaseProgress(p);
    done += pp.done;
    total += pp.total;
  }
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}
