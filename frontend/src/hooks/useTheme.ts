import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export const useTheme = () => {
  const { theme, setTheme, lowStim, setLowStim, toggleLowStim } = useThemeStore();

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

    // Check system preference if system theme
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        html.classList.add('dark');
      } else {
        html.classList.add('light');
      }
    }

    // Apply low-stim if enabled
    if (lowStim) {
      html.classList.add('low-stim');
    }

    html.setAttribute('data-theme', lowStim ? 'low-stim' : theme);
  }, [theme, lowStim]);

  return {
    theme,
    setTheme,
    lowStim,
    setLowStim,
    toggleLowStim,
  };
};
