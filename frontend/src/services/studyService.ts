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
