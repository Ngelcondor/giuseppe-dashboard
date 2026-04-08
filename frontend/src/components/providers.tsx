'use client';

import { ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useThemeStore } from '@/stores/themeStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
    },
  },
});

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function Providers({ children }: { children: ReactNode }) {
  const theme = useThemeStore((state) => state.theme);
  const lowStim = useThemeStore((state) => state.lowStim);

  useEffect(() => {
    const html = document.documentElement;

    // Remove old classes
    html.classList.remove('dark', 'light', 'low-stim');

    // Resolve effective theme
    const effective = theme === 'system' ? getSystemTheme() : theme;

    // Apply theme class
    html.classList.add(effective);

    // Apply low-stim if enabled
    if (lowStim) {
      html.classList.add('low-stim');
    }

    // Set data-theme for CSS variable switching
    html.setAttribute('data-theme', lowStim ? 'low-stim' : effective);

    // Listen for system theme changes when set to 'system'
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        html.classList.remove('dark', 'light');
        html.classList.add(e.matches ? 'dark' : 'light');
        if (!lowStim) {
          html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme, lowStim]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
