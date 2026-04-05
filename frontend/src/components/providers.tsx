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

export function Providers({ children }: { children: ReactNode }) {
  const theme = useThemeStore((state) => state.theme);
  const lowStim = useThemeStore((state) => state.lowStim);

  useEffect(() => {
    const html = document.documentElement;

    // Remove old classes
    html.classList.remove('dark', 'light', 'low-stim');

    // Apply theme
    if (theme === 'dark') {
      html.classList.add('dark');
    } else if (theme === 'light') {
      html.classList.add('light');
    }

    // Apply low-stim if enabled
    if (lowStim) {
      html.classList.add('low-stim');
    }

    html.setAttribute('data-theme', lowStim ? 'low-stim' : theme);
  }, [theme, lowStim]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
