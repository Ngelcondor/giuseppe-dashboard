// Authentication
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  passwordConfirm: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  twoFARequired?: boolean;
}

export interface TwoFAVerifyRequest {
  code: string;
  email: string;
}

// User
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  timezone: string;
  language: string;
  theme: 'dark' | 'light' | 'system';
  lowStimMode: boolean;
}

// Health
export interface HealthMetrics {
  id: string;
  userId: string;
  date: string;
  heartRate: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  temperature: number;
  steps: number;
  calories: number;
  sleepHours: number;
  sleepQuality: 'poor' | 'fair' | 'good' | 'excellent';
  createdAt: string;
}

export interface SleepData {
  date: string;
  totalHours: number;
  lightSleep: number;
  deepSleep: number;
  remSleep: number;
  awakenings: number;
}

export interface Workout {
  id: string;
  userId: string;
  type: string;
  duration: number;
  calories: number;
  distance?: number;
  intensity: 'low' | 'moderate' | 'high';
  date: string;
  notes?: string;
  createdAt: string;
}

export interface Medication {
  id: string;
  userId: string;
  name: string;
  dosage: string;
  frequency: string;
  nextDoseTime: string;
  times: string[];
  instructions?: string;
  createdAt: string;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  userId: string;
  takenAt: string;
  notes?: string;
}

// Calendar
export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  color: string;
  calendar: string;
  reminders: {
    type: 'email' | 'notification' | 'sms';
    minutesBefore: number;
  }[];
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    endDate?: string;
    daysOfWeek?: number[];
  };
  createdAt: string;
}

// Deadlines
export interface Deadline {
  id: string;
  userId: string;
  title: string;
  description?: string;
  dueDate: string;
  dueTime?: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  completed: boolean;
  completedAt?: string;
  reminders: {
    type: 'email' | 'notification';
    minutesBefore: number;
  }[];
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

// Routines
export interface RoutineStep {
  id: string;
  order: number;
  title: string;
  description?: string;
  duration: number;
  completed: boolean;
  timeStarted?: string;
}

export interface Routine {
  id: string;
  userId: string;
  name: string;
  description?: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  startTime: string;
  steps: RoutineStep[];
  active: boolean;
  createdAt: string;
}

export interface RoutineLog {
  id: string;
  routineId: string;
  userId: string;
  date: string;
  completedSteps: number;
  totalSteps: number;
  completionTime: number;
  notes?: string;
}

// Focus
export interface FocusSession {
  id: string;
  userId: string;
  taskName: string;
  duration: number;
  completedPomodoros: number;
  totalPomodoros: number;
  startedAt: string;
  completedAt?: string;
  breaksTaken: number;
}

export interface FocusMetrics {
  date: string;
  focusHours: number;
  sessionsCompleted: number;
  averageSessionLength: number;
  distractions: number;
  focusScore: number;
}

// Habits
export interface Habit {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: string;
  frequency: 'daily' | 'weekly';
  goalDays?: number;
  color: string;
  active: boolean;
  createdAt: string;
  streak?: number;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  date: string;
  completed: boolean;
  notes?: string;
}

// Mood & Sensory
export interface MoodEntry {
  id: string;
  userId: string;
  mood: number;
  energy: number;
  anxiety: number;
  timestamp: string;
  notes?: string;
  tags: string[];
  correlations?: {
    sleep?: number;
    exercise?: boolean;
    stressLevel?: number;
  };
}

export interface SensoryLog {
  id: string;
  userId: string;
  intensity: number;
  trigger: string;
  description?: string;
  timestamp: string;
  calmingStrategy?: string;
}

// Budget
export interface Transaction {
  id: string;
  userId: string;
  title: string;
  category: string;
  amount: number;
  currency: string;
  type: 'expense' | 'income';
  date: string;
  notes?: string;
  recurring?: boolean;
  createdAt: string;
}

export interface BudgetCategory {
  id: string;
  userId: string;
  name: string;
  limit: number;
  spent: number;
  period: 'monthly' | 'weekly';
  color: string;
}

// CTF
export interface CTFChallenge {
  id: string;
  userId: string;
  platform: string;
  title: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'insane';
  points: number;
  completed: boolean;
  completedAt?: string;
  solutionNotes?: string;
  tools: string[];
  timeSpent?: number;
}

export interface CTFStats {
  totalChallenges: number;
  completedChallenges: number;
  currentStreak: number;
  totalPoints: number;
  skillsRadar: Record<string, number>;
}

// Meals
export interface MealEntry {
  id: string;
  userId: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  timestamp: string;
  notes?: string;
}

export interface DailyNutrition {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meals: MealEntry[];
}

// Notifications
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedId?: string;
  relatedType?: string;
}

// Widget Layout
export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  i: string;
}

export interface DashboardLayout {
  lg: WidgetLayout[];
  md: WidgetLayout[];
  sm: WidgetLayout[];
}

// API Response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Error
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
