const _rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const API_BASE_URL = _rawApiUrl.includes('/api/v1')
  ? _rawApiUrl
  : `${_rawApiUrl.replace(/\/$/, '')}/api/v1`;

export const WIDGET_SIZES = {
  MIN_WIDTH: 1,
  MIN_HEIGHT: 1,
  ROW_HEIGHT: 60,
  COMPACT_TYPE: 'vertical',
  PREVENT_COLLISION: false,
  VERTICAL_COMPACT: true,
  COLS: {
    lg: 6,
    md: 4,
    sm: 1,
  },
};

export const BREAKPOINTS = {
  lg: 1200,
  md: 768,
  sm: 480,
};

export const COLORS = {
  primary: '#3B82F6',
  secondary: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#06B6D4',
  success: '#10B981',
  muted: '#6B7280',
  text: {
    primary: '#F1F5F9',
    secondary: '#CBD5E1',
    tertiary: '#94A3B8',
  },
  bg: {
    primary: '#0F172A',
    secondary: '#1E293B',
    tertiary: '#334155',
  },
};

export const STIMULATION_REDUCED_COLORS = {
  primary: '#8E7C6F',
  secondary: '#A89A8F',
  danger: '#7A6B5F',
  warning: '#8E7C6F',
  info: '#8E7C6F',
  success: '#A89A8F',
  muted: '#8E7C6F',
};

export const POMODORO = {
  WORK_DURATION: 25 * 60,
  SHORT_BREAK: 5 * 60,
  LONG_BREAK: 15 * 60,
  SESSIONS_BEFORE_LONG_BREAK: 4,
};

export const NOTIFICATION_TYPES = {
  MEDICATION: 'medication',
  DEADLINE: 'deadline',
  ROUTINE: 'routine',
  HABIT: 'habit',
  MEETING: 'meeting',
  REMINDER: 'reminder',
} as const;

export const HABIT_CATEGORIES = [
  { id: 'health', label: 'Salute', icon: 'Heart' },
  { id: 'fitness', label: 'Fitness', icon: 'Activity' },
  { id: 'learning', label: 'Apprendimento', icon: 'BookOpen' },
  { id: 'productivity', label: 'Produttività', icon: 'Zap' },
  { id: 'mindfulness', label: 'Consapevolezza', icon: 'Smile' },
  { id: 'social', label: 'Sociale', icon: 'Users' },
  { id: 'creativity', label: 'Creatività', icon: 'Palette' },
] as const;

export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard', 'insane'] as const;

export const WORKOUT_TYPES = [
  { id: 'running', label: 'Corsa', icon: 'LogoForward' },
  { id: 'walking', label: 'Camminata', icon: 'Footprints' },
  { id: 'cycling', label: 'Ciclismo', icon: 'Bike' },
  { id: 'swimming', label: 'Nuoto', icon: 'Droplet' },
  { id: 'strength', label: 'Forza', icon: 'Dumbbell' },
  { id: 'yoga', label: 'Yoga', icon: 'Wind' },
  { id: 'sports', label: 'Sport', icon: 'Trophy' },
] as const;

export const MEAL_TYPES = [
  { id: 'breakfast', label: 'Colazione', icon: 'Coffee' },
  { id: 'lunch', label: 'Pranzo', icon: 'UtensilsCrossed' },
  { id: 'dinner', label: 'Cena', icon: 'UtensilsCrossed' },
  { id: 'snack', label: 'Spuntino', icon: 'Apple' },
] as const;

export const MOOD_RANGE = [
  { value: 1, label: 'Molto male', emoji: '😭' },
  { value: 2, label: 'Male', emoji: '😞' },
  { value: 3, label: 'Neutrale', emoji: '😐' },
  { value: 4, label: 'Bene', emoji: '🙂' },
  { value: 5, label: 'Molto bene', emoji: '😄' },
] as const;

export const ENERGY_RANGE = [
  { value: 1, label: 'Esausto', emoji: '😴' },
  { value: 2, label: 'Stanco', emoji: '😩' },
  { value: 3, label: 'Normale', emoji: '😊' },
  { value: 4, label: 'Energico', emoji: '⚡' },
  { value: 5, label: 'Iperattivo', emoji: '🚀' },
] as const;

export const ANXIETY_RANGE = [
  { value: 1, label: 'Calmo', emoji: '😌' },
  { value: 2, label: 'Leggermente ansioso', emoji: '😟' },
  { value: 3, label: 'Moderatamente ansioso', emoji: '😰' },
  { value: 4, label: 'Molto ansioso', emoji: '😨' },
  { value: 5, label: 'Panico', emoji: '😱' },
] as const;

export const SENSORY_TRIGGERS = [
  { id: 'loud-noise', label: 'Rumore forte' },
  { id: 'bright-light', label: 'Luce intensa' },
  { id: 'crowded', label: 'Luogo affollato' },
  { id: 'strong-smell', label: 'Odore forte' },
  { id: 'texture', label: 'Texture sgradevole' },
  { id: 'temperature', label: 'Temperatura estrema' },
  { id: 'social-stress', label: 'Stress sociale' },
  { id: 'sensory-blend', label: 'Combinazione di stimoli' },
] as const;

export const CALMMING_STRATEGIES = [
  { id: 'deep-breathing', label: 'Respirazione profonda' },
  { id: 'grounding', label: 'Tecnica di radicamento' },
  { id: 'quiet-space', label: 'Spazio tranquillo' },
  { id: 'music', label: 'Musica calmante' },
  { id: 'movement', label: 'Movimento' },
  { id: 'water', label: 'Acqua' },
  { id: 'fidget', label: 'Oggetto da manipolare' },
  { id: 'distraction', label: 'Distrazione consapevole' },
] as const;

export const BUDGET_CATEGORIES = [
  { id: 'food', label: 'Cibo', icon: 'ShoppingCart', color: '#FF6B6B' },
  { id: 'transport', label: 'Trasporto', icon: 'Car', color: '#4ECDC4' },
  { id: 'utilities', label: 'Utenze', icon: 'Zap', color: '#FFE66D' },
  { id: 'entertainment', label: 'Intrattenimento', icon: 'Music', color: '#95E1D3' },
  { id: 'healthcare', label: 'Salute', icon: 'Heart', color: '#FF8B94' },
  { id: 'education', label: 'Educazione', icon: 'BookOpen', color: '#A8E6CF' },
  { id: 'shopping', label: 'Shopping', icon: 'ShoppingBag', color: '#FFD3B6' },
  { id: 'other', label: 'Altro', icon: 'DollarSign', color: '#FFAAA5' },
] as const;

export const CTF_PLATFORMS = [
  { id: 'thm', label: 'TryHackMe', url: 'https://tryhackme.com' },
  { id: 'htb', label: 'HackTheBox', url: 'https://hackthebox.com' },
  { id: 'picoctf', label: 'PicoCTF', url: 'https://picoctf.org' },
  { id: 'ctftime', label: 'CTFTime', url: 'https://ctftime.org' },
  { id: 'ow', label: 'OverTheWire', url: 'https://overthewire.org' },
  { id: 'custom', label: 'Personalizzato' },
] as const;

export const CTF_CATEGORIES = [
  { id: 'web', label: 'Web' },
  { id: 'crypto', label: 'Crittografia' },
  { id: 'forensics', label: 'Forensica' },
  { id: 'pwn', label: 'Pwn' },
  { id: 'reverse-eng', label: 'Reverse Engineering' },
  { id: 'osint', label: 'OSINT' },
  { id: 'steganography', label: 'Steganografia' },
  { id: 'misc', label: 'Vario' },
] as const;

export const KEYBOARD_SHORTCUTS = {
  FOCUS_MODE: 'Ctrl+Shift+P',
  QUICK_ADD: 'Ctrl+K',
  SETTINGS: 'Ctrl+,',
  THEME_TOGGLE: 'Ctrl+Shift+L',
} as const;

export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  LOGOUT: '/auth/logout',
  VERIFY_2FA: '/auth/verify-2fa',
  REFRESH_TOKEN: '/auth/refresh-token',

  // User
  USER_PROFILE: '/users/profile',
  USER_UPDATE: '/users/profile',
  USER_SETTINGS: '/users/settings',

  // Health
  HEALTH_METRICS: '/health/metrics',
  SLEEP_DATA: '/health/sleep',
  WORKOUTS: '/health/workouts',
  MEDICATIONS: '/health/medications',

  // Calendar
  EVENTS: '/calendar/events',
  CALENDAR_CONNECTIONS: '/calendar/connections',
  CALENDAR_SYNC: '/calendar/connections',

  // Deadlines
  DEADLINES: '/deadlines',

  // Routines
  ROUTINES: '/routines',
  ROUTINE_LOGS: '/routine-logs',

  // Focus
  FOCUS_SESSIONS: '/focus/sessions',
  FOCUS_METRICS: '/focus/metrics',

  // Habits
  HABITS: '/habits',
  HABIT_LOGS: '/habit-logs',

  // Mood
  MOOD_ENTRIES: '/mood',
  SENSORY_LOGS: '/sensory-logs',

  // Budget
  TRANSACTIONS: '/transactions',
  BUDGET_CATEGORIES: '/budget/categories',

  // CTF
  CTF_CHALLENGES: '/ctf/challenges',
  CTF_STATS: '/ctf/stats',

  // Meals
  MEALS: '/meals',
  DAILY_NUTRITION: '/meals/daily',

  // Dashboard
  DASHBOARD_LAYOUT: '/dashboard/layout',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
} as const;

export const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;
