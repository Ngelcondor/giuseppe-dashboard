import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  i: string;
}

export interface WidgetPreferences {
  visible: boolean;
  collapsed: boolean;
}

interface DashboardStore {
  layouts: {
    lg: WidgetLayout[];
    md: WidgetLayout[];
    sm: WidgetLayout[];
  };
  widgetPreferences: Record<string, WidgetPreferences>;
  setLayouts: (layouts: DashboardStore['layouts']) => void;
  setLayout: (breakpoint: 'lg' | 'md' | 'sm', layout: WidgetLayout[]) => void;
  setWidgetPreference: (widgetId: string, preference: WidgetPreferences) => void;
  toggleWidgetVisibility: (widgetId: string) => void;
  toggleWidgetCollapse: (widgetId: string) => void;
  resetLayout: () => void;
}

const defaultLayouts = {
  lg: [
    { x: 0, y: 0, w: 2, h: 3, i: 'next-task' },
    { x: 2, y: 0, w: 2, h: 3, i: 'quick-actions' },
    { x: 4, y: 0, w: 2, h: 3, i: 'weather' },
    { x: 0, y: 3, w: 2, h: 3, i: 'health-overview' },
    { x: 2, y: 3, w: 2, h: 3, i: 'heart-rate' },
    { x: 4, y: 3, w: 2, h: 3, i: 'mood-tracker' },
    { x: 0, y: 6, w: 2, h: 2, i: 'routine' },
    { x: 2, y: 6, w: 2, h: 2, i: 'pomodoro' },
    { x: 4, y: 6, w: 2, h: 2, i: 'energy' },
    { x: 0, y: 8, w: 3, h: 2, i: 'deadlines' },
    { x: 3, y: 8, w: 3, h: 2, i: 'calendar' },
    { x: 0, y: 10, w: 2, h: 2, i: 'habits' },
    { x: 2, y: 10, w: 2, h: 2, i: 'budget' },
    { x: 4, y: 10, w: 2, h: 2, i: 'meals' },
    { x: 0, y: 12, w: 3, h: 2, i: 'cyber-feed' },
    { x: 3, y: 12, w: 3, h: 2, i: 'ctf' },
  ],
  md: [
    { x: 0, y: 0, w: 2, h: 3, i: 'next-task' },
    { x: 2, y: 0, w: 2, h: 3, i: 'quick-actions' },
    { x: 0, y: 3, w: 2, h: 3, i: 'weather' },
    { x: 2, y: 3, w: 2, h: 3, i: 'health-overview' },
    { x: 0, y: 6, w: 2, h: 2, i: 'routine' },
    { x: 2, y: 6, w: 2, h: 2, i: 'pomodoro' },
    { x: 0, y: 8, w: 2, h: 2, i: 'mood-tracker' },
    { x: 2, y: 8, w: 2, h: 2, i: 'energy' },
    { x: 0, y: 10, w: 4, h: 2, i: 'deadlines' },
    { x: 0, y: 12, w: 4, h: 2, i: 'calendar' },
    { x: 0, y: 14, w: 2, h: 2, i: 'habits' },
    { x: 2, y: 14, w: 2, h: 2, i: 'budget' },
  ],
  sm: [
    { x: 0, y: 0, w: 1, h: 3, i: 'next-task' },
    { x: 0, y: 3, w: 1, h: 2, i: 'quick-actions' },
    { x: 0, y: 5, w: 1, h: 2, i: 'weather' },
    { x: 0, y: 7, w: 1, h: 2, i: 'health-overview' },
    { x: 0, y: 9, w: 1, h: 2, i: 'routine' },
    { x: 0, y: 11, w: 1, h: 2, i: 'pomodoro' },
    { x: 0, y: 13, w: 1, h: 2, i: 'mood-tracker' },
    { x: 0, y: 15, w: 1, h: 2, i: 'deadlines' },
    { x: 0, y: 17, w: 1, h: 2, i: 'calendar' },
    { x: 0, y: 19, w: 1, h: 2, i: 'habits' },
  ],
};

const defaultWidgetPreferences: Record<string, WidgetPreferences> = {
  'next-task': { visible: true, collapsed: false },
  'quick-actions': { visible: true, collapsed: false },
  'weather': { visible: true, collapsed: false },
  'health-overview': { visible: true, collapsed: false },
  'heart-rate': { visible: true, collapsed: false },
  'mood-tracker': { visible: true, collapsed: false },
  'routine': { visible: true, collapsed: false },
  'pomodoro': { visible: true, collapsed: false },
  'energy': { visible: true, collapsed: false },
  'deadlines': { visible: true, collapsed: false },
  'calendar': { visible: true, collapsed: false },
  'habits': { visible: true, collapsed: false },
  'budget': { visible: true, collapsed: false },
  'meals': { visible: true, collapsed: false },
  'cyber-feed': { visible: true, collapsed: false },
  'ctf': { visible: true, collapsed: false },
};

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      layouts: defaultLayouts,
      widgetPreferences: defaultWidgetPreferences,
      setLayouts: (layouts) => set({ layouts }),
      setLayout: (breakpoint, layout) =>
        set((state) => ({
          layouts: {
            ...state.layouts,
            [breakpoint]: layout,
          },
        })),
      setWidgetPreference: (widgetId, preference) =>
        set((state) => ({
          widgetPreferences: {
            ...state.widgetPreferences,
            [widgetId]: preference,
          },
        })),
      toggleWidgetVisibility: (widgetId) =>
        set((state) => ({
          widgetPreferences: {
            ...state.widgetPreferences,
            [widgetId]: {
              ...state.widgetPreferences[widgetId],
              visible: !state.widgetPreferences[widgetId]?.visible,
            },
          },
        })),
      toggleWidgetCollapse: (widgetId) =>
        set((state) => ({
          widgetPreferences: {
            ...state.widgetPreferences,
            [widgetId]: {
              ...state.widgetPreferences[widgetId],
              collapsed: !state.widgetPreferences[widgetId]?.collapsed,
            },
          },
        })),
      resetLayout: () =>
        set({
          layouts: defaultLayouts,
          widgetPreferences: defaultWidgetPreferences,
        }),
    }),
    {
      name: 'dashboard-storage',
    }
  )
);
