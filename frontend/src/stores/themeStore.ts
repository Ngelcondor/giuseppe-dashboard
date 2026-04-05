import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light' | 'system';

interface ThemeStore {
  theme: Theme;
  lowStim: boolean;
  setTheme: (theme: Theme) => void;
  setLowStim: (lowStim: boolean) => void;
  toggleLowStim: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      lowStim: false,
      setTheme: (theme) => set({ theme }),
      setLowStim: (lowStim) => set({ lowStim }),
      toggleLowStim: () => set((state) => ({ lowStim: !state.lowStim })),
    }),
    {
      name: 'theme-storage',
    }
  )
);
