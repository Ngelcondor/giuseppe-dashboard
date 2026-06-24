import api from '@/lib/api';
import {
  applyBackendRows,
  getTodayDay,
  getOverallProgress,
  type StudyPlanState,
} from '@/lib/studyPlanState';

// Backend row shape returned by GET /study/state.
// The study endpoint stores ONLY per-task user flags (completed/skipped/
// moved_to_date) keyed by a deterministic task_id ("YYYY-MM-DD-{idx}").
// The plan structure itself lives client-side in studyPlanData.ts and is
// rebuilt + overlaid by studyPlanState.applyBackendRows().
export interface StudyStateRow {
  task_id: string;
  completed: boolean;
  completed_at: string | null;
  skipped: boolean;
  moved_to_date: string | null;
}

// A single study task surfaced to the overview page.
export interface StudyTodayTask {
  id: string;
  text: string;
  completed: boolean;
}

// Presentational summary derived from the authenticated study plan state.
export interface StudyOverview {
  today: {
    label: string;
    isRest: boolean;
    tasks: StudyTodayTask[];
    done: number;
    total: number;
  } | null;
  overall: { done: number; total: number; pct: number };
}

// Fetch per-task state through the authenticated axios client (Bearer token
// auto-attached), then overlay it onto the freshly-rebuilt local plan.
export async function getStudyPlanState(): Promise<StudyPlanState> {
  const { data } = await api.get<StudyStateRow[]>('/study/state');
  return applyBackendRows(data);
}

// Build the overview the Studio page needs from the plan state.
export function buildStudyOverview(state: StudyPlanState): StudyOverview {
  const todayDay = getTodayDay(state);
  const overall = getOverallProgress(state);

  return {
    today: todayDay
      ? {
          label: todayDay.label,
          isRest: todayDay.isRest,
          tasks: todayDay.tasks.map((t) => ({
            id: t.id,
            text: t.text,
            completed: t.completed,
          })),
          done: todayDay.tasks.filter((t) => t.completed).length,
          total: todayDay.tasks.length,
        }
      : null,
    overall,
  };
}

export async function getStudyOverview(): Promise<StudyOverview> {
  const state = await getStudyPlanState();
  return buildStudyOverview(state);
}

// ── CPTS plan (server-persisted modules) ─────────────────────────────────────
// The Studio page drives the real, resettable CPTS curriculum from these. The
// plan + modules live server-side (one per user); progress starts at zero on
// reset and Obsidian links are empty until the user pastes them.

export interface StudyModuleSection {
  id: string;
  order_index: number;
  title: string;
  completed: boolean;
  completed_at: string | null;
  obsidian_link: string | null;
}

export interface StudyModule {
  id: string;
  order_index: number;
  title: string;
  brief: string | null;
  htb_url: string | null;
  completed: boolean;
  completed_at: string | null;
  obsidian_link: string | null;
  sections: StudyModuleSection[];
  sections_done: number;
  sections_total: number;
}

export interface StudyPlan {
  start_date: string; // ISO date
  current_week: number;
  total_weeks: number;
  modules: StudyModule[];
  completed_count: number;
  total_count: number;
  sections_done: number;
  sections_total: number;
}

// Real HTB profile/stats, or an honest not-connected payload. Never fabricated.
export interface HTBProfile {
  connected: boolean;
  name?: string | null;
  rank?: string | null;
  points?: number | null;
  user_owns?: number | null;
  system_owns?: number | null;
  ranking?: number | null;
  user_bloods?: number | null;
  system_bloods?: number | null;
  avatar?: string | null;
  country?: string | null;
  detail?: string | null;
}

export async function getStudyPlan(): Promise<StudyPlan> {
  const { data } = await api.get<StudyPlan>('/study/plan');
  return data;
}

// Reinitialise the plan to the canonical CPTS module list (editor-only).
export async function resetStudyPlan(startDate: string): Promise<StudyPlan> {
  const { data } = await api.post<StudyPlan>('/study/reset', { start_date: startDate });
  return data;
}

// Update a module's completion, Obsidian link and/or HTB URL (editor-only).
// completed cascades to all sections. Pass '' to clear a link field.
export async function updateStudyModule(
  id: string,
  body: { completed?: boolean; obsidian_link?: string; htb_url?: string },
): Promise<StudyModule> {
  const { data } = await api.put<StudyModule>(`/study/modules/${id}`, body);
  return data;
}

// Update a single subchapter; returns the refreshed parent module (editor-only).
export async function updateStudySection(
  id: string,
  body: { completed?: boolean; obsidian_link?: string },
): Promise<StudyModule> {
  const { data } = await api.put<StudyModule>(`/study/sections/${id}`, body);
  return data;
}

export async function getHTBProfile(): Promise<HTBProfile> {
  const { data } = await api.get<HTBProfile>('/study/htb/profile');
  return data;
}

// Lightweight role probe for hiding mutation controls. Treats a missing/unknown
// role as editor (default role is 'admin'); only an explicit 'guest' is read-only.
export async function getIsEditor(): Promise<boolean> {
  try {
    const { data } = await api.get<{ role?: string }>('/auth/me');
    return (data?.role ?? 'admin') !== 'guest';
  } catch {
    return false;
  }
}
