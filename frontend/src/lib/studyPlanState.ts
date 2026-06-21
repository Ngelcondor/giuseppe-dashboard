// CPTS Study Plan — state synced via backend API (cross-device).
// Static plan lives in studyPlanData.ts; this module rebuilds it
// fresh and overlays the user's per-task state from the backend.

import { CPTS_PLAN, StudyPhaseSeed } from './studyPlanData';
import { API_BASE_URL } from './constants';

export interface StudyTask {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
  rescheduledFrom?: string;
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
  pendingReschedule?: { fromDate: string; taskCount: number } | null;
}

interface BackendRow {
  task_id: string;
  completed: boolean;
  completed_at: string | null;
  skipped: boolean;
  moved_to_date: string | null;
}

function generateTaskId(date: string, idx: number): string {
  return `${date}-${idx}`;
}

function freshPlan(): StudyPhase[] {
  return CPTS_PLAN.map((p: StudyPhaseSeed) => ({
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
}

export function applyBackendRows(rows: BackendRow[]): StudyPlanState {
  const phases = freshPlan();
  const byId = new Map<string, BackendRow>(rows.map((r) => [r.task_id, r]));

  // 1) Apply completed/skipped flags
  for (const p of phases) {
    for (const w of p.weeks) {
      for (const d of w.days) {
        for (const t of d.tasks) {
          const r = byId.get(t.id);
          if (!r) continue;
          t.completed = r.completed;
          t.skipped = r.skipped;
          if (r.completed_at) t.completedAt = r.completed_at;
        }
      }
    }
  }

  // 2) Apply moves (rescheduling): pull tasks from their original day, push to moved_to_date
  const dayByDate = new Map<string, StudyDay>();
  for (const p of phases) for (const w of p.weeks) for (const d of w.days) dayByDate.set(d.date, d);

  for (const r of rows) {
    if (!r.moved_to_date) continue;
    const fromDate = r.task_id.substring(0, 10);
    if (fromDate === r.moved_to_date) continue;
    const fromDay = dayByDate.get(fromDate);
    const toDay = dayByDate.get(r.moved_to_date);
    if (!fromDay || !toDay) continue;
    const idx = fromDay.tasks.findIndex((t) => t.id === r.task_id);
    if (idx < 0) continue;
    const [task] = fromDay.tasks.splice(idx, 1);
    task.rescheduledFrom = fromDate;
    toDay.tasks.push(task);
  }

  return {
    phases,
    lastUpdated: new Date().toISOString(),
    pendingReschedule: null,
  };
}

// ── API calls ───────────────────────────────────────────────────────────────

async function fetchState(): Promise<BackendRow[]> {
  const res = await fetch(`${API_BASE_URL}/study/state`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

interface UpsertBody {
  completed?: boolean;
  skipped?: boolean;
  moved_to_date?: string; // empty string clears
}

function pushUpdate(taskId: string, body: UpsertBody): void {
  fetch(`${API_BASE_URL}/study/task/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((e) => console.warn(`[study] sync failed for ${taskId}`, e));
}

interface BatchEntry extends UpsertBody { task_id: string; }

function pushBatch(entries: BatchEntry[]): void {
  if (entries.length === 0) return;
  fetch(`${API_BASE_URL}/study/state/batch`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entries),
  }).catch((e) => console.warn('[study] batch sync failed', e));
}

function pushReset(): void {
  fetch(`${API_BASE_URL}/study/state`, { method: 'DELETE' })
    .catch((e) => console.warn('[study] reset sync failed', e));
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function loadState(): Promise<StudyPlanState> {
  try {
    const rows = await fetchState();
    return applyBackendRows(rows);
  } catch (e) {
    console.warn('[study] fetch state failed, returning empty plan', e);
    return applyBackendRows([]);
  }
}

export function resetState(): StudyPlanState {
  pushReset();
  return applyBackendRows([]);
}

// ── Helpers (pure, sync) ────────────────────────────────────────────────────

export function getAllDays(state: StudyPlanState): StudyDay[] {
  return state.phases.flatMap((p) => p.weeks.flatMap((w) => w.days));
}

export interface DayContext {
  day: StudyDay;
  week: StudyWeek;
  phase: StudyPhase;
}

export function getDayContext(state: StudyPlanState, date: string): DayContext | null {
  for (const phase of state.phases) {
    for (const week of phase.weeks) {
      const day = week.days.find((d) => d.date === date);
      if (day) return { day, week, phase };
    }
  }
  return null;
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

// ── Mutations (optimistic local update + fire-and-forget API push) ──────────

export function toggleTask(state: StudyPlanState, dayDate: string, taskId: string): StudyPlanState {
  const next: StudyPlanState = JSON.parse(JSON.stringify(state));
  let newCompleted = false;
  for (const p of next.phases) {
    for (const w of p.weeks) {
      for (const d of w.days) {
        if (d.date !== dayDate) continue;
        for (const t of d.tasks) {
          if (t.id !== taskId) continue;
          t.completed = !t.completed;
          t.completedAt = t.completed ? new Date().toISOString() : undefined;
          if (t.completed) t.skipped = false;
          newCompleted = t.completed;
        }
      }
    }
  }
  pushUpdate(taskId, { completed: newCompleted, skipped: false });
  return next;
}

export function markTaskSkipped(state: StudyPlanState, dayDate: string, taskId: string): StudyPlanState {
  const next: StudyPlanState = JSON.parse(JSON.stringify(state));
  for (const p of next.phases) {
    for (const w of p.weeks) {
      for (const d of w.days) {
        if (d.date !== dayDate) continue;
        for (const t of d.tasks) {
          if (t.id !== taskId) continue;
          t.skipped = true;
          t.completed = false;
          t.completedAt = undefined;
        }
      }
    }
  }
  pushUpdate(taskId, { skipped: true, completed: false });
  return next;
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

/** Move all pending past tasks onto today (or first non-rest upcoming day). */
export function rescheduleToToday(state: StudyPlanState): StudyPlanState {
  const next: StudyPlanState = JSON.parse(JSON.stringify(state));
  const today = todayISO();
  const pending = getPendingPastTasks(next, today);
  if (pending.length === 0) return next;

  const target = findUpcomingNonRestDays(next, today, 1)[0];
  if (!target) return next;

  const batch: BatchEntry[] = [];
  for (const p of next.phases) {
    for (const w of p.weeks) {
      for (const d of w.days) {
        if (d.date >= today) continue;
        if (d.isRest) continue;
        const remaining: StudyTask[] = [];
        const toMove: StudyTask[] = [];
        for (const t of d.tasks) {
          if (!t.completed && !t.skipped) toMove.push({ ...t, rescheduledFrom: d.date });
          else remaining.push(t);
        }
        d.tasks = remaining;
        const targetDay = next.phases.flatMap((pp) => pp.weeks.flatMap((ww) => ww.days)).find((dd) => dd.date === target.date);
        if (targetDay) targetDay.tasks.push(...toMove);
        for (const moved of toMove) {
          batch.push({ task_id: moved.id, moved_to_date: target.date });
        }
      }
    }
  }

  next.pendingReschedule = null;
  pushBatch(batch);
  return next;
}

/** Spread pending past tasks across the next N non-rest days (round-robin). */
export function rescheduleSpread(state: StudyPlanState, daysCount: number = 3): StudyPlanState {
  const next: StudyPlanState = JSON.parse(JSON.stringify(state));
  const today = todayISO();
  const pending = getPendingPastTasks(next, today);
  if (pending.length === 0) return next;

  const targetDays = findUpcomingNonRestDays(next, today, daysCount);
  if (targetDays.length === 0) return next;

  const tasksToMove: StudyTask[] = [];
  for (const p of next.phases) {
    for (const w of p.weeks) {
      for (const d of w.days) {
        if (d.date >= today) continue;
        if (d.isRest) continue;
        const remaining: StudyTask[] = [];
        for (const t of d.tasks) {
          if (!t.completed && !t.skipped) tasksToMove.push({ ...t, rescheduledFrom: d.date });
          else remaining.push(t);
        }
        d.tasks = remaining;
      }
    }
  }

  const batch: BatchEntry[] = [];
  tasksToMove.forEach((t, idx) => {
    const target = targetDays[idx % targetDays.length];
    const realTarget = next.phases.flatMap((p) => p.weeks.flatMap((w) => w.days)).find((d) => d.date === target.date);
    if (realTarget) realTarget.tasks.push(t);
    batch.push({ task_id: t.id, moved_to_date: target.date });
  });

  next.pendingReschedule = null;
  pushBatch(batch);
  return next;
}

export function markAllPendingSkipped(state: StudyPlanState): StudyPlanState {
  const next: StudyPlanState = JSON.parse(JSON.stringify(state));
  const today = todayISO();
  const batch: BatchEntry[] = [];
  for (const p of next.phases) {
    for (const w of p.weeks) {
      for (const d of w.days) {
        if (d.date >= today) continue;
        if (d.isRest) continue;
        for (const t of d.tasks) {
          if (!t.completed && !t.skipped) {
            t.skipped = true;
            batch.push({ task_id: t.id, skipped: true });
          }
        }
      }
    }
  }
  next.pendingReschedule = null;
  pushBatch(batch);
  return next;
}

export function dismissReschedulePrompt(state: StudyPlanState): StudyPlanState {
  // Local-only — the prompt is a UI hint, not persisted.
  return { ...state, pendingReschedule: null };
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
