'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity, Heart, Flame, Brain, Clock, Shield, TrendingUp,
  AlertTriangle, LayoutDashboard, Calendar, Utensils, Wallet, Rss,
  Settings, Zap, Menu, X, ChevronRight, CheckCircle2, Circle, Sun, Sunset, CloudMoon, Play
} from 'lucide-react';
import routineService, { type RoutineResponse, type TimeOfDay } from '@/services/routineService';
import SleepWidget from '@/components/widgets/SleepWidget';
import api from '@/lib/api';

const navSections = [
  { label: 'Dashboard',      href: '/dashboard',           icon: LayoutDashboard },
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
  { label: 'Meal Planner',   href: '/dashboard/meals',     icon: Utensils },
  { label: 'Sensoriale',     href: '/dashboard/sensory',   icon: Zap },
  { label: 'Impostazioni',   href: '/dashboard/settings',  icon: Settings },
];

function Widget({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group block p-7 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.055] hover:border-white/10 transition-all duration-200"
    >
      {children}
    </Link>
  );
}

function WidgetHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-slate-500" />
        <span className="text-sm font-medium text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
      <ChevronRight size={16} className="text-slate-700 group-hover:text-slate-500 transition-colors" />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-600 mb-1">{label}</p>
      <p className="text-xl font-semibold" style={{ color: color || '#e2e8f0' }}>{value}</p>
    </div>
  );
}

// ─── Health Widget (con dati reali) ───────────────────────────────────────────

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

  // Estrai ultimo valore per tipo
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
      <WidgetHeader icon={Heart} label="Salute" />
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-white/10 border-t-red-400/60 rounded-full animate-spin" />
        </div>
      ) : hasData ? (
        <>
          <div className="grid grid-cols-2 gap-5">
            <Stat label="Battito" value={hr ? `${Math.round(hr.value)} bpm` : '—'} color="#f87171" />
            <Stat label="Passi" value={steps ? `${Math.round(steps.value).toLocaleString('it-IT')}` : '—'} color="#4ade80" />
            <Stat label="Calorie" value={cal ? `${Math.round(cal.value)} kcal` : '—'} color="#fb923c" />
          </div>
          {hr?.source && (
            <p className="text-xs text-slate-700 mt-5 capitalize">Fonte: {hr.source.replace(/_/g, ' ')}</p>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5">
            <Stat label="Battito" value="— bpm" color="#f87171" />
            <Stat label="Passi" value="—" color="#4ade80" />
            <Stat label="Calorie" value="— kcal" color="#fb923c" />
          </div>
          <p className="text-xs text-slate-700 mt-5">Collega Apple Health per i dati reali</p>
        </>
      )}
    </Widget>
  );
}

// ─── Deadlines Widget (con dati reali) ────────────────────────────────────────

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
      <WidgetHeader icon={AlertTriangle} label="Scadenze" />
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-white/10 border-t-amber-400/60 rounded-full animate-spin" />
        </div>
      ) : hasItems ? (
        <div className="space-y-3">
          {/* Overdue banner */}
          {overdueCount > 0 && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle size={15} className="text-red-400 shrink-0" />
              <span className="text-sm text-red-300 font-medium">
                {overdueCount} scadenz{overdueCount === 1 ? 'a' : 'e'} scadut{overdueCount === 1 ? 'a' : 'e'}
              </span>
            </div>
          )}
          {/* Upcoming list */}
          {upcomingItems.map(item => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[item.priority] || '#6b7280' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate">
                  {CATEGORY_EMOJI[item.category] || '📋'} {item.title}
                </p>
                <p className="text-xs text-slate-600">{formatDate(item.due_date)}</p>
              </div>
            </div>
          ))}
          {(data?.upcoming?.length ?? 0) > 4 && (
            <p className="text-xs text-slate-600 pl-5">+{(data?.upcoming?.length ?? 0) - 4} altre →</p>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-600">Nessuna scadenza imminente</p>
          <p className="text-xs text-slate-700 mt-1.5">Vai alla sezione per aggiungere scadenze</p>
        </>
      )}
    </Widget>
  );
}

// ─── Routine Widget (con dati reali) ──────────────────────────────────────────

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

  // Determina la fascia oraria corrente
  const hour = new Date().getHours();
  const currentTime: TimeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

  useEffect(() => {
    routineService.getToday()
      .then(data => {
        // Mostra la routine della fascia corrente, o la prossima disponibile
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

  // Fallback: nessuna routine
  if (!loading && !routine) {
    return (
      <Widget href="/dashboard/routines">
        <WidgetHeader icon={Activity} label="Routine" />
        <p className="text-sm text-slate-600">Nessuna routine attiva.</p>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Play size={12} /> Crea la tua prima routine
        </div>
      </Widget>
    );
  }

  if (loading || !routine) {
    return (
      <Widget href="/dashboard/routines">
        <WidgetHeader icon={Activity} label="Routine" />
        <div className="py-6 flex justify-center">
          <div className="w-6 h-6 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
        </div>
      </Widget>
    );
  }

  const sortedSteps = [...routine.steps].sort((a, b) => a.order - b.order);
  const pct = sortedSteps.length > 0 ? Math.round((completedSteps.size / sortedSteps.length) * 100) : 0;
  const TimeIcon = TIME_ICONS[routine.time_of_day];
  const color = TIME_COLORS[routine.time_of_day];

  return (
    <div className="group block p-7 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.055] hover:border-white/10 transition-all duration-200">
      <Link href="/dashboard/routines">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <TimeIcon size={18} style={{ color }} />
            <span className="text-sm font-medium uppercase tracking-widest" style={{ color }}>
              Routine {TIME_LABELS[routine.time_of_day]}
            </span>
          </div>
          <ChevronRight size={16} className="text-slate-700 group-hover:text-slate-500 transition-colors" />
        </div>
      </Link>

      {/* Progress */}
      {completedSteps.size > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-600">{completedSteps.size}/{sortedSteps.length}</span>
            <span className="text-xs font-medium" style={{ color }}>{pct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
        </div>
      )}

      {/* Steps (max 5 visibili) */}
      <div className="space-y-3">
        {sortedSteps.slice(0, 5).map(step => {
          const done = completedSteps.has(step.id);
          return (
            <button
              key={step.id}
              onClick={() => toggleStep(step.id)}
              className="flex items-center gap-3.5 w-full text-left group/step"
            >
              {done ? (
                <CheckCircle2 size={17} className="text-emerald-400 shrink-0" />
              ) : (
                <Circle size={17} className="text-slate-600 group-hover/step:text-slate-400 shrink-0 transition-colors" />
              )}
              <span className={`text-sm ${done ? 'text-slate-500 line-through' : 'text-slate-400'}`}>
                {step.icon && <span className="mr-1.5">{step.icon}</span>}
                {step.title}
              </span>
            </button>
          );
        })}
        {sortedSteps.length > 5 && (
          <Link href="/dashboard/routines" className="text-xs text-slate-600 hover:text-slate-400 transition-colors pl-8">
            +{sortedSteps.length - 5} altri step →
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hour = currentTime.getHours();
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100 flex">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-56 bg-[#0a0c10] border-r border-white/[0.04] z-40
        flex flex-col transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold text-slate-300">
              G
            </div>
            <span className="text-sm font-semibold text-slate-200">Dashboard</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-500 hover:text-slate-300">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {navSections.map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                  active
                    ? 'bg-white/[0.07] text-slate-100'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={15} className={active ? 'text-slate-300' : 'text-slate-600'} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-5 py-4 border-t border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-slate-300">G</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-slate-300">Giuseppe</p>
              <p className="text-[11px] text-slate-600 truncate">Cybersec Student</p>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="px-8 py-5 border-b border-white/[0.04] flex items-center justify-between sticky top-0 bg-[#0f1117]/90 backdrop-blur-sm z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 hover:text-slate-300">
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-slate-200">
                {greeting}, Giuseppe
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {currentTime.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                <span className="mx-2 opacity-40">·</span>
                {currentTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
          <Link href="/dashboard/settings" className="text-slate-600 hover:text-slate-400 transition-colors">
            <Settings size={18} />
          </Link>
        </header>

        {/* Content */}
        <main className="flex-1 px-8 py-10 overflow-y-auto">

          {/* Quick actions row */}
          <div className="flex items-center gap-3 mb-10 overflow-x-auto pb-1">
            {[
              { label: 'Log umore', emoji: '😊', href: '/dashboard/mood' },
              { label: 'Farmaco', emoji: '💊', href: '/dashboard/habits' },
              { label: 'Pomodoro', emoji: '🍅', href: '/dashboard/focus' },
              { label: 'Spesa', emoji: '💸', href: '/dashboard/budget' },
              { label: 'Log sensoriale', emoji: '🧠', href: '/dashboard/sensory' },
            ].map(a => (
              <Link key={a.label} href={a.href}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] text-sm text-slate-400 hover:bg-white/[0.07] hover:text-slate-200 transition-all whitespace-nowrap">
                <span>{a.emoji}</span>
                <span>{a.label}</span>
              </Link>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

            {/* Sleep (stile Sleep Cycle) */}
            <SleepWidget />

            {/* Health (dati reali) */}
            <HealthWidget />

            {/* Focus score */}
            <Widget href="/dashboard/focus">
              <WidgetHeader icon={Brain} label="Focus Score" />
              <div className="flex items-center justify-center py-4">
                <div className="relative w-24 h-24">
                  <svg width="96" height="96" className="-rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="#1e293b" strokeWidth="6" fill="none" />
                    <circle cx="48" cy="48" r="40" stroke="#a78bfa" strokeWidth="6" fill="none"
                      strokeDasharray={`${2 * Math.PI * 40 * 0.75} ${2 * Math.PI * 40}`}
                      strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-violet-400">75</span>
                </div>
              </div>
              <p className="text-center text-sm text-slate-600 mt-2">Buona giornata per il deep work</p>
            </Widget>

            {/* Pomodoro */}
            <Widget href="/dashboard/focus">
              <WidgetHeader icon={Clock} label="Pomodoro" />
              <div className="text-center py-4">
                <p className="text-5xl font-mono font-semibold text-slate-200 tracking-tight">25:00</p>
                <p className="text-sm text-slate-600 mt-3">Pronto per iniziare</p>
              </div>
              <div className="mt-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center text-sm text-slate-400">
                Avvia sessione →
              </div>
            </Widget>

            {/* Routine */}
            <RoutineWidget />

            {/* Scadenze (dati reali) */}
            <DeadlinesWidget />

            {/* Calendario */}
            <Widget href="/dashboard/calendar">
              <WidgetHeader icon={Calendar} label="Calendario" />
              <div className="space-y-3">
                <p className="text-sm text-slate-500">I tuoi prossimi eventi</p>
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-10 rounded-full bg-blue-500" />
                  <div>
                    <p className="text-sm text-slate-300">Nessun evento imminente</p>
                    <p className="text-xs text-slate-600">Collega Apple Calendar per sincronizzare</p>
                  </div>
                </div>
              </div>
            </Widget>

            {/* CTF */}
            <Widget href="/dashboard/ctf">
              <WidgetHeader icon={Shield} label="CTF Progress" />
              <div className="grid grid-cols-2 gap-5">
                <Stat label="Challenge" value="0" color="#4ade80" />
                <Stat label="Punti" value="0" color="#4ade80" />
              </div>
              <p className="text-xs text-slate-700 mt-5">Collega HackTheBox o TryHackMe</p>
            </Widget>

            {/* Mood */}
            <Widget href="/dashboard/mood">
              <WidgetHeader icon={TrendingUp} label="Umore" />
              <p className="text-sm text-slate-500 mb-5">Come ti senti oggi?</p>
              <div className="flex justify-between items-center">
                {['😫', '😕', '😐', '🙂', '😄'].map((e, i) => (
                  <span key={i} className="text-3xl opacity-50 hover:opacity-100 cursor-pointer transition-opacity">{e}</span>
                ))}
              </div>
            </Widget>

            {/* Habits */}
            <Widget href="/dashboard/habits">
              <WidgetHeader icon={Flame} label="Abitudini" />
              <div className="space-y-3.5">
                {['Farmaci mattina', 'Idratazione', 'Routine mattino', 'Studio cybersecurity'].map((h, i) => (
                  <div key={i} className="flex items-center gap-3.5">
                    <div className="w-4 h-4 rounded-full border border-white/10 shrink-0" />
                    <span className="text-sm text-slate-400">{h}</span>
                  </div>
                ))}
              </div>
            </Widget>

            {/* Budget */}
            <Widget href="/dashboard/budget">
              <WidgetHeader icon={Wallet} label="Budget" />
              <div className="grid grid-cols-2 gap-5">
                <Stat label="Entrate" value="—" color="#4ade80" />
                <Stat label="Uscite" value="—" color="#f87171" />
              </div>
              <p className="text-xs text-slate-700 mt-5">Collega le scadenze per il saldo</p>
            </Widget>

          </div>
        </main>
      </div>
    </div>
  );
}
