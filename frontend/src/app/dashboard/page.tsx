'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity, Heart, Flame, Brain, Clock, Shield, TrendingUp,
  AlertTriangle, LayoutDashboard, Calendar, Utensils, Wallet, Rss,
  Settings, Zap, Menu, X, ChevronRight, CheckCircle2, Circle,
  Sun, Sunset, CloudMoon, Play, BookOpen, Coffee, Terminal,
} from 'lucide-react';
import routineService, { type RoutineResponse, type TimeOfDay } from '@/services/routineService';
import SleepWidget from '@/components/widgets/SleepWidget';
import api from '@/lib/api';
import {
  loadState,
  toggleTask,
  getTodayDay,
  getDayProgress,
  getPendingPastTasks,
  getOverallProgress,
  type StudyDay,
} from '@/lib/studyPlanState';

const navSections = [
  { label: 'Overview',       href: '/dashboard',           icon: LayoutDashboard },
  { label: 'Studio',         href: '/dashboard/study',     icon: BookOpen },
  { label: 'Salute',         href: '/dashboard/health',    icon: Heart },
  { label: 'Focus',          href: '/dashboard/focus',     icon: Brain },
  { label: 'Routine',        href: '/dashboard/routines',  icon: Activity },
  { label: 'Abitudini',      href: '/dashboard/habits',    icon: Flame },
  { label: 'Umore',          href: '/dashboard/mood',      icon: TrendingUp },
  { label: 'Scadenze',       href: '/dashboard/deadlines', icon: AlertTriangle },
  { label: 'Calendario',     href: '/dashboard/calendar',  icon: Calendar },
  { label: 'CTF Tracker',    href: '/dashboard/ctf',       icon: Shield },
  { label: 'Cyber Feed',     href: '/dashboard/feed',      icon: Rss },
  { label: 'Budget',         href: '/dashboard/budget',    icon: Wallet },
  { label: 'Pasti',          href: '/dashboard/meals',     icon: Utensils },
  { label: 'Sensoriale',     href: '/dashboard/sensory',   icon: Zap },
];

/* ─── Widget primitives ──────────────────────────────────────────────────── */

function Widget({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`group block p-6 card-glass hover:border-border-hover transition-all duration-200 ${className}`}
    >
      {children}
    </Link>
  );
}

function WidgetHeader({
  icon: Icon,
  label,
  iconColor = 'text-tertiary',
}: {
  icon: React.ElementType;
  label: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <Icon size={15} className={iconColor} />
        <span className="section-label">{label}</span>
      </div>
      <ChevronRight size={14} className="text-muted group-hover:text-tertiary group-hover:translate-x-0.5 transition-all" />
    </div>
  );
}

function Stat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted mb-1.5 tracking-uppercase">{label}</p>
      <p className="text-xl font-semibold font-mono-display leading-none" style={{ color: color || 'rgb(var(--color-heading))' }}>
        {value}
        {unit && <span className="text-sm text-tertiary font-normal ml-1">{unit}</span>}
      </p>
    </div>
  );
}

/* ─── Health Widget ──────────────────────────────────────────────────────── */

interface HealthMetricData {
  metric_type: string;
  value: number;
  unit: string;
  recorded_at: string;
  source: string;
}

interface HealthSummaryData {
  period: string;
  metrics: Record<string, HealthMetricData[]>;
}

function HealthWidget() {
  const [summary, setSummary] = useState<HealthSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/health/summary?period=daily')
      .then(res => setSummary(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const latest = (type: string): HealthMetricData | null => {
    if (!summary?.metrics?.[type]?.length) return null;
    const arr = summary.metrics[type];
    return arr[arr.length - 1];
  };

  const hr = latest('heart_rate');
  const steps = latest('steps');
  const cal = latest('calories');
  const hasData = hr || steps || cal;

  return (
    <Widget href="/dashboard/health">
      <WidgetHeader icon={Heart} label="Salute" iconColor="text-rose-400" />
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-white/10 border-t-rose-400/60 rounded-full animate-spin" />
        </div>
      ) : hasData ? (
        <>
          <div className="grid grid-cols-2 gap-5">
            <Stat label="Battito" value={hr ? `${Math.round(hr.value)}` : '—'} unit="bpm" color="#fb7185" />
            <Stat label="Passi" value={steps ? Math.round(steps.value).toLocaleString('it-IT') : '—'} color="#34d399" />
            <Stat label="Calorie" value={cal ? `${Math.round(cal.value)}` : '—'} unit="kcal" color="#fb923c" />
          </div>
          {hr?.source && (
            <p className="text-[11px] text-muted mt-5 capitalize">via {hr.source.replace(/_/g, ' ')}</p>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5">
            <Stat label="Battito" value="—" unit="bpm" color="#fb7185" />
            <Stat label="Passi" value="—" color="#34d399" />
            <Stat label="Calorie" value="—" unit="kcal" color="#fb923c" />
          </div>
          <p className="text-[11px] text-muted mt-5">Collega Apple Health</p>
        </>
      )}
    </Widget>
  );
}

/* ─── Deadlines Widget ───────────────────────────────────────────────────── */

interface DeadlineData {
  id: string;
  title: string;
  due_date: string;
  category: string;
  priority: string;
  is_completed: boolean;
}

interface DeadlineUpcoming {
  upcoming: DeadlineData[];
  overdue: DeadlineData[];
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#6b7280',
};

const CATEGORY_EMOJI: Record<string, string> = {
  university: '🎓',
  work: '💼',
  personal: '📌',
  certification: '📜',
  ctf: '🏴',
  other: '📋',
};

function DeadlinesWidget() {
  const [data, setData] = useState<DeadlineUpcoming | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/deadlines/upcoming/list')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d: string) => {
    const date = new Date(d);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return 'Oggi';
    if (date.toDateString() === tomorrow.toDateString()) return 'Domani';
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };

  const overdueCount = data?.overdue?.length ?? 0;
  const upcomingItems = data?.upcoming?.slice(0, 4) ?? [];
  const hasItems = overdueCount > 0 || upcomingItems.length > 0;

  return (
    <Widget href="/dashboard/deadlines">
      <WidgetHeader icon={AlertTriangle} label="Scadenze" iconColor="text-amber-400" />
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-white/10 border-t-amber-400/60 rounded-full animate-spin" />
        </div>
      ) : hasItems ? (
        <div className="space-y-3">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle size={13} className="text-red-400 shrink-0" />
              <span className="text-xs text-red-300 font-medium">
                {overdueCount} scadut{overdueCount === 1 ? 'a' : 'e'}
              </span>
            </div>
          )}
          {upcomingItems.map(item => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="w-1 h-7 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[item.priority] || '#6b7280' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-body truncate">
                  <span className="mr-1.5">{CATEGORY_EMOJI[item.category] || '📋'}</span>
                  {item.title}
                </p>
                <p className="text-[11px] text-muted">{formatDate(item.due_date)}</p>
              </div>
            </div>
          ))}
          {(data?.upcoming?.length ?? 0) > 4 && (
            <p className="text-[11px] text-muted pl-4">+{(data?.upcoming?.length ?? 0) - 4} altre</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">Nessuna scadenza imminente</p>
      )}
    </Widget>
  );
}

/* ─── Study Widget ───────────────────────────────────────────────────────── */

function StudyWidget() {
  const [today, setToday] = useState<StudyDay | undefined>(undefined);
  const [pendingCount, setPendingCount] = useState(0);
  const [overallPct, setOverallPct] = useState(0);
  const [, force] = useState(0);

  useEffect(() => {
    const s = loadState();
    setToday(getTodayDay(s));
    setPendingCount(getPendingPastTasks(s).length);
    setOverallPct(getOverallProgress(s).pct);
  }, []);

  const handleToggle = (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!today) return;
    const s = loadState();
    const next = toggleTask(s, today.date, taskId);
    setToday(getTodayDay(next));
    setOverallPct(getOverallProgress(next).pct);
    force(n => n + 1);
  };

  if (!today) {
    return (
      <Widget href="/dashboard/study">
        <WidgetHeader icon={BookOpen} label="Studio CRTP" iconColor="text-accent" />
        <p className="text-sm text-muted">Nessun giorno pianificato.</p>
        <p className="text-[11px] text-muted mt-1.5">Piano: 28 Apr → 22 Set 2026</p>
      </Widget>
    );
  }

  if (today.isRest) {
    return (
      <Widget href="/dashboard/study">
        <WidgetHeader icon={BookOpen} label="Studio CRTP" iconColor="text-accent" />
        <div className="flex flex-col items-center text-center py-3">
          <Coffee size={28} className="text-blue-400 mb-2.5" />
          <p className="text-sm font-medium text-heading">{today.label}</p>
          <p className="text-[11px] text-tertiary mt-1.5">Domenica sacra. Riposa.</p>
        </div>
      </Widget>
    );
  }

  const progress = getDayProgress(today);
  const visibleTasks = today.tasks.slice(0, 3);

  return (
    <div className="group block p-6 card-glass hover:border-border-hover transition-all duration-200">
      <Link href="/dashboard/study">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <BookOpen size={15} className="text-accent" />
            <span className="section-label">Studio CRTP</span>
          </div>
          <ChevronRight size={14} className="text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
        </div>
      </Link>

      {/* Overall progress */}
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-[11px] text-muted tracking-uppercase">Roadmap</p>
        <p className="text-sm font-mono-display text-accent">{overallPct}%</p>
      </div>

      {pendingCount > 0 && (
        <Link
          href="/dashboard/study/today"
          className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 hover:bg-rose-500/20 transition-colors"
        >
          <AlertTriangle size={12} />
          {pendingCount} arretrati — riprogramma
        </Link>
      )}

      {progress.total > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-tertiary truncate pr-2">{today.label}</span>
            <span className="text-[11px] font-mono-display text-accent shrink-0">{progress.done}/{progress.total}</span>
          </div>
          <div className="w-full h-1 rounded-full bg-card-inner overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress.pct}%`,
                backgroundColor: progress.pct === 100 ? '#34d399' : 'rgb(var(--accent-primary))',
              }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {visibleTasks.map(task => (
          <button
            key={task.id}
            onClick={(e) => handleToggle(e, task.id)}
            className="flex items-start gap-3 w-full text-left group/step"
          >
            {task.completed ? (
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : task.skipped ? (
              <Circle size={15} className="text-amber-400/60 shrink-0 mt-0.5" />
            ) : (
              <Circle size={15} className="text-muted group-hover/step:text-body shrink-0 mt-0.5 transition-colors" />
            )}
            <span
              className={`text-xs leading-relaxed ${
                task.completed ? 'text-muted line-through' : task.skipped ? 'text-amber-300/70 italic' : 'text-body'
              }`}
            >
              {task.text}
            </span>
          </button>
        ))}
        {today.tasks.length > 3 && (
          <Link href="/dashboard/study/today" className="text-[11px] text-muted hover:text-body transition-colors pl-6">
            +{today.tasks.length - 3} altri
          </Link>
        )}
        {today.tasks.length === 0 && (
          <p className="text-xs text-muted">Nessun task per oggi 🎉</p>
        )}
      </div>
    </div>
  );
}

/* ─── Routine Widget ─────────────────────────────────────────────────────── */

const TIME_ICONS: Record<TimeOfDay, React.ElementType> = {
  morning: Sun,
  afternoon: Sun,
  evening: Sunset,
  night: CloudMoon,
};

const TIME_COLORS: Record<TimeOfDay, string> = {
  morning: '#fbbf24',
  afternoon: '#fb923c',
  evening: '#a78bfa',
  night: '#60a5fa',
};

const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: 'Mattina',
  afternoon: 'Pomeriggio',
  evening: 'Sera',
  night: 'Notte',
};

function RoutineWidget() {
  const [routine, setRoutine] = useState<RoutineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const hour = new Date().getHours();
  const currentTime: TimeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

  useEffect(() => {
    routineService.getToday()
      .then(data => {
        const order: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];
        const idx = order.indexOf(currentTime);
        for (let i = 0; i < order.length; i++) {
          const key = order[(idx + i) % order.length];
          if (data[key]) {
            setRoutine(data[key]);
            break;
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleStep = (id: string) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!loading && !routine) {
    return (
      <Widget href="/dashboard/routines">
        <WidgetHeader icon={Activity} label="Routine" iconColor="text-emerald-400" />
        <p className="text-sm text-muted">Nessuna routine attiva.</p>
        <div className="mt-3 flex items-center gap-2 text-xs text-tertiary">
          <Play size={11} /> Crea la tua prima routine
        </div>
      </Widget>
    );
  }

  if (loading || !routine) {
    return (
      <Widget href="/dashboard/routines">
        <WidgetHeader icon={Activity} label="Routine" iconColor="text-emerald-400" />
        <div className="py-6 flex justify-center">
          <div className="w-5 h-5 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
        </div>
      </Widget>
    );
  }

  const sortedSteps = [...routine.steps].sort((a, b) => a.order - b.order);
  const pct = sortedSteps.length > 0 ? Math.round((completedSteps.size / sortedSteps.length) * 100) : 0;
  const TimeIcon = TIME_ICONS[routine.time_of_day];
  const color = TIME_COLORS[routine.time_of_day];

  return (
    <div className="group block p-6 card-glass hover:border-border-hover transition-all duration-200">
      <Link href="/dashboard/routines">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <TimeIcon size={15} style={{ color }} />
            <span className="section-label" style={{ color }}>
              Routine · {TIME_LABELS[routine.time_of_day]}
            </span>
          </div>
          <ChevronRight size={14} className="text-muted group-hover:text-tertiary transition-colors" />
        </div>
      </Link>

      {completedSteps.size > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono-display text-muted">{completedSteps.size}/{sortedSteps.length}</span>
            <span className="text-[11px] font-mono-display" style={{ color }}>{pct}%</span>
          </div>
          <div className="w-full h-1 rounded-full bg-card-inner overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {sortedSteps.slice(0, 5).map(step => {
          const done = completedSteps.has(step.id);
          return (
            <button
              key={step.id}
              onClick={() => toggleStep(step.id)}
              className="flex items-center gap-3 w-full text-left group/step"
            >
              {done ? (
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              ) : (
                <Circle size={15} className="text-muted group-hover/step:text-body shrink-0 transition-colors" />
              )}
              <span className={`text-sm ${done ? 'text-tertiary line-through' : 'text-body'}`}>
                {step.icon && <span className="mr-1.5">{step.icon}</span>}
                {step.title}
              </span>
            </button>
          );
        })}
        {sortedSteps.length > 5 && (
          <Link href="/dashboard/routines" className="text-[11px] text-muted hover:text-body transition-colors pl-7">
            +{sortedSteps.length - 5} altri step
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─── Greeting hero ─────────────────────────────────────────────────────── */

function GreetingHero({ now }: { now: Date }) {
  const hour = now.getHours();
  const greeting = hour < 5 ? 'Notte fonda' : hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const dateStr = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 mb-3">
        <span className="status-dot" />
        <span className="section-label">Sistema operativo</span>
        <span className="text-[11px] text-muted font-mono-display">· uptime {timeStr}</span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-semibold text-heading tracking-tight">
        {greeting}, <span className="text-accent">Giuseppe</span>
      </h1>
      <p className="text-sm text-tertiary mt-2 capitalize">
        {dateStr}
        <span className="mx-2 text-muted">·</span>
        <span className="font-mono-display text-tertiary">root@dashboard:~$</span>
      </p>
    </div>
  );
}

/* ─── Sidebar (refined) ──────────────────────────────────────────────────── */

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/70 z-30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`
          fixed top-0 left-0 h-full w-60 z-40
          flex flex-col transform transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
          bg-card-solid border-r border-border-default
        `}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-border-default flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-accent-soft border border-accent-soft flex items-center justify-center text-accent">
              <Terminal size={15} />
            </div>
            <div className="leading-none">
              <p className="text-[13px] font-semibold text-heading">giuseppe.dashboard</p>
              <p className="text-[10px] text-muted font-mono-display mt-1">v1.0 · stable</p>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden text-tertiary hover:text-body">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {navSections.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group relative ${
                  active
                    ? 'bg-surface-hover text-heading'
                    : 'text-tertiary hover:text-body hover:bg-surface-hover'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r-full" />
                )}
                <Icon size={15} className={active ? 'text-accent' : 'text-muted group-hover:text-tertiary'} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer / user */}
        <div className="px-4 py-4 border-t border-border-default">
          <Link href="/dashboard/settings" className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors group">
            <div className="w-7 h-7 rounded-full bg-accent-soft flex items-center justify-center text-xs font-semibold text-accent">
              G
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium truncate text-body">Giuseppe</p>
              <p className="text-[10px] text-muted truncate font-mono-display">cybersec_student</p>
            </div>
            <Settings size={13} className="text-muted group-hover:text-body transition-colors" />
          </Link>
        </div>
      </aside>
    </>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-page text-heading flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile only — desktop hero is enough) */}
        <header className="lg:hidden px-6 py-4 border-b border-border-default flex items-center justify-between sticky top-0 bg-page/85 backdrop-blur-md z-20">
          <button onClick={() => setSidebarOpen(true)} className="text-tertiary hover:text-body">
            <Menu size={20} />
          </button>
          <Link href="/dashboard/settings" className="text-muted hover:text-tertiary transition-colors">
            <Settings size={18} />
          </Link>
        </header>

        <main className="flex-1 px-6 sm:px-10 py-8 sm:py-12 overflow-y-auto">

          <GreetingHero now={currentTime} />

          {/* Quick action chips */}
          <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-1 -mx-1 px-1">
            {[
              { label: 'Studio CRTP', emoji: '📚', href: '/dashboard/study/today' },
              { label: 'Pomodoro', emoji: '🍅', href: '/dashboard/study/pomodoro' },
              { label: 'Log umore', emoji: '😊', href: '/dashboard/mood' },
              { label: 'Farmaco', emoji: '💊', href: '/dashboard/habits' },
              { label: 'Spesa', emoji: '💸', href: '/dashboard/budget' },
              { label: 'Sensoriale', emoji: '🧠', href: '/dashboard/sensory' },
            ].map(a => (
              <Link
                key={a.label}
                href={a.href}
                className="chip hover:border-border-hover hover:bg-surface-hover transition-all whitespace-nowrap"
              >
                <span className="text-[13px]">{a.emoji}</span>
                <span>{a.label}</span>
              </Link>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

            <SleepWidget />
            <StudyWidget />
            <HealthWidget />

            {/* Focus score */}
            <Widget href="/dashboard/focus">
              <WidgetHeader icon={Brain} label="Focus Score" iconColor="text-violet-400" />
              <div className="flex items-center justify-center py-3">
                <div className="relative w-24 h-24">
                  <svg width="96" height="96" className="-rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="rgb(var(--color-border))" strokeWidth="6" fill="none" />
                    <circle cx="48" cy="48" r="40" stroke="#a78bfa" strokeWidth="6" fill="none"
                      strokeDasharray={`${2 * Math.PI * 40 * 0.75} ${2 * Math.PI * 40}`}
                      strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold font-mono-display text-violet-400">75</span>
                </div>
              </div>
              <p className="text-center text-xs text-muted mt-2">Buona giornata per il deep work</p>
            </Widget>

            {/* Pomodoro */}
            <Widget href="/dashboard/study/pomodoro">
              <WidgetHeader icon={Clock} label="Pomodoro" iconColor="text-rose-400" />
              <div className="text-center py-3">
                <p className="text-5xl font-mono-display font-semibold text-heading tracking-tight">45:00</p>
                <p className="text-xs text-muted mt-2">Pronto per Studio CRTP</p>
              </div>
              <div className="mt-4 py-2 rounded-lg bg-card-inner border border-border-default text-center text-xs text-body">
                Avvia sessione →
              </div>
            </Widget>

            <RoutineWidget />
            <DeadlinesWidget />

            {/* CTF */}
            <Widget href="/dashboard/ctf">
              <WidgetHeader icon={Shield} label="CTF Progress" iconColor="text-rose-400" />
              <div className="grid grid-cols-2 gap-5">
                <Stat label="Challenge" value="0" color="#34d399" />
                <Stat label="Punti" value="0" color="#34d399" />
              </div>
              <p className="text-[11px] text-muted mt-5">Collega HackTheBox o TryHackMe</p>
            </Widget>

            {/* Mood */}
            <Widget href="/dashboard/mood">
              <WidgetHeader icon={TrendingUp} label="Umore" iconColor="text-pink-400" />
              <p className="text-xs text-tertiary mb-4">Come ti senti oggi?</p>
              <div className="flex justify-between items-center">
                {['😫', '😕', '😐', '🙂', '😄'].map((e, i) => (
                  <span key={i} className="text-2xl opacity-50 hover:opacity-100 cursor-pointer transition-opacity">{e}</span>
                ))}
              </div>
            </Widget>

            {/* Budget */}
            <Widget href="/dashboard/budget">
              <WidgetHeader icon={Wallet} label="Budget" iconColor="text-emerald-400" />
              <div className="grid grid-cols-2 gap-5">
                <Stat label="Entrate" value="—" color="#34d399" />
                <Stat label="Uscite" value="—" color="#fb7185" />
              </div>
              <p className="text-[11px] text-muted mt-5">Collega le scadenze</p>
            </Widget>

          </div>

          {/* Footer "shell prompt" */}
          <p className="mt-12 text-[11px] text-muted font-mono-display text-center opacity-60">
            <span className="text-accent">[</span>
            {' '}giuseppe.dashboard{' '}
            <span className="text-accent">]</span>
            <span className="mx-2">·</span>
            crafted for ADHD-friendly cybersecurity life
          </p>
        </main>
      </div>
    </div>
  );
}
