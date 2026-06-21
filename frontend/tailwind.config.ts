import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        'stim-bg': {
          light: '#fafaf8',
          dark: '#0f0e0c',
        },
        'stim-text': {
          light: '#3a3a38',
          dark: '#e8e8e6',
        },
        'stim-muted': {
          50: '#f5f4f2',
          100: '#ebe8e5',
          200: '#d6d0ca',
          300: '#c2b7af',
          400: '#a89a8f',
          500: '#8e7c6f',
          600: '#7a6b5f',
          700: '#665a4f',
          800: '#524840',
          900: '#3d3430',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'widget-xs': '128px',
        'widget-sm': '256px',
        'widget-md': '384px',
        'widget-lg': '512px',
      },
      gridAutoRows: {
        'widget': '60px',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
    },
  },
  plugins: [
    function ({ addVariant }: any) {
      addVariant('prefers-reduced-motion', '@media (prefers-reduced-motion: reduce)');
    },
  ],
};

export default config;
