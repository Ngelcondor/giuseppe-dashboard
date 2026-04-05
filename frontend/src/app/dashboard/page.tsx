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
      className="group block p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.055] hover:border-white/10 transition-all duration-200"
    >
      {children}
    </Link>
  );
}

function WidgetHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <Icon size={15} className="text-slate-500" />
        <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
      <ChevronRight size={14} className="text-slate-700 group-hover:text-slate-500 transition-colors" />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-600 mb-0.5">{label}</p>
      <p className="text-lg font-semibold" style={{ color: color || '#e2e8f0' }}>{value}</p>
    </div>
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
        <p className="text-xs text-slate-600">Nessuna routine attiva.</p>
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Play size={10} /> Crea la tua prima routine
        </div>
      </Widget>
    );
  }

  if (loading || !routine) {
    return (
      <Widget href="/dashboard/routines">
        <WidgetHeader icon={Activity} label="Routine" />
        <div className="py-4 flex justify-center">
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
    <div className="group block p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.055] hover:border-white/10 transition-all duration-200">
      <Link href="/dashboard/routines">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <TimeIcon size={15} style={{ color }} />
            <span className="text-xs font-medium uppercase tracking-widest" style={{ color }}>
              Routine {TIME_LABELS[routine.time_of_day]}
            </span>
          </div>
          <ChevronRight size={14} className="text-slate-700 group-hover:text-slate-500 transition-colors" />
        </div>
      </Link>

      {/* Progress */}
      {completedSteps.size > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-600">{completedSteps.size}/{sortedSteps.length}</span>
            <span className="text-[11px] font-medium" style={{ color }}>{pct}%</span>
          </div>
          <div className="w-full h-1 rounded-full bg-white/[0.04] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
        </div>
      )}

      {/* Steps (max 5 visibili) */}
      <div className="space-y-2">
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
                <Circle size={15} className="text-slate-600 group-hover/step:text-slate-400 shrink-0 transition-colors" />
              )}
              <span className={`text-xs ${done ? 'text-slate-500 line-through' : 'text-slate-400'}`}>
                {step.icon && <span className="mr-1.5">{step.icon}</span>}
                {step.title}
              </span>
            </button>
          );
        })}
        {sortedSteps.length > 5 && (
          <Link href="/dashboard/routines" className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors pl-7">
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
        <header className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between sticky top-0 bg-[#0f1117]/90 backdrop-blur-sm z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 hover:text-slate-300">
              <Menu size={18} />
            </button>
            <div>
              <h1 className="text-base font-semibold text-slate-200">
                {greeting}, Giuseppe
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                {currentTime.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                <span className="mx-1.5 opacity-40">·</span>
                {currentTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
          <Link href="/dashboard/settings" className="text-slate-600 hover:text-slate-400 transition-colors">
            <Settings size={16} />
          </Link>
        </header>

        {/* Content */}
        <main className="flex-1 px-6 py-8 overflow-y-auto">

          {/* Quick actions row */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
            {[
              { label: 'Log umore', emoji: '😊', href: '/dashboard/mood' },
              { label: 'Farmaco', emoji: '💊', href: '/dashboard/habits' },
              { label: 'Pomodoro', emoji: '🍅', href: '/dashboard/focus' },
              { label: 'Spesa', emoji: '💸', href: '/dashboard/budget' },
              { label: 'Log sensoriale', emoji: '🧠', href: '/dashboard/sensory' },
            ].map(a => (
              <Link key={a.label} href={a.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs text-slate-400 hover:bg-white/[0.07] hover:text-slate-200 transition-all whitespace-nowrap">
                <span>{a.emoji}</span>
                <span>{a.label}</span>
              </Link>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

            {/* Health */}
            <Widget href="/dashboard/health">
              <WidgetHeader icon={Heart} label="Salute" />
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Battito" value="— bpm" color="#f87171" />
                <Stat label="Sonno" value="— ore" color="#818cf8" />
                <Stat label="Passi" value="—" color="#4ade80" />
                <Stat label="Calorie" value="— kcal" color="#fb923c" />
              </div>
              <p className="text-[11px] text-slate-700 mt-4">Collega Apple Health per i dati reali</p>
            </Widget>

            {/* Focus score */}
            <Widget href="/dashboard/focus">
              <WidgetHeader icon={Brain} label="Focus Score" />
              <div className="flex items-center justify-center py-3">
                <div className="relative w-20 h-20">
                  <svg width="80" height="80" className="-rotate-90">
                    <circle cx="40" cy="40" r="34" stroke="#1e293b" strokeWidth="5" fill="none" />
                    <circle cx="40" cy="40" r="34" stroke="#a78bfa" strokeWidth="5" fill="none"
                      strokeDasharray={`${2 * Math.PI * 34 * 0.75} ${2 * Math.PI * 34}`}
                      strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-violet-400">75</span>
                </div>
              </div>
              <p className="text-center text-xs text-slate-600 mt-1">Buona giornata per il deep work</p>
            </Widget>

            {/* Pomodoro */}
            <Widget href="/dashboard/focus">
              <WidgetHeader icon={Clock} label="Pomodoro" />
              <div className="text-center py-3">
                <p className="text-4xl font-mono font-semibold text-slate-200 tracking-tight">25:00</p>
                <p className="text-xs text-slate-600 mt-2">Pronto per iniziare</p>
              </div>
              <div className="mt-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center text-xs text-slate-400">
                Avvia sessione →
              </div>
            </Widget>

            {/* Routine */}
            <RoutineWidget />

            {/* Scadenze */}
            <Widget href="/dashboard/deadlines">
              <WidgetHeader icon={AlertTriangle} label="Scadenze" />
              <p className="text-xs text-slate-600">Nessuna scadenza imminente</p>
              <p className="text-[11px] text-slate-700 mt-1">Vai alla sezione per visualizzare tutte le voci</p>
            </Widget>

            {/* Calendario */}
            <Widget href="/dashboard/calendar">
              <WidgetHeader icon={Calendar} label="Calendario" />
              <div className="space-y-2.5">
                <p className="text-xs text-slate-500">I tuoi prossimi eventi</p>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-8 rounded-full bg-blue-500" />
                  <div>
                    <p className="text-xs text-slate-300">Nessun evento imminente</p>
                    <p className="text-[11px] text-slate-600">Collega Apple Calendar per sincronizzare</p>
                  </div>
                </div>
              </div>
            </Widget>

            {/* CTF */}
            <Widget href="/dashboard/ctf">
              <WidgetHeader icon={Shield} label="CTF Progress" />
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Challenge" value="0" color="#4ade80" />
                <Stat label="Punti" value="0" color="#4ade80" />
              </div>
              <p className="text-[11px] text-slate-700 mt-4">Collega HackTheBox o TryHackMe</p>
            </Widget>

            {/* Mood */}
            <Widget href="/dashboard/mood">
              <WidgetHeader icon={TrendingUp} label="Umore" />
              <p className="text-xs text-slate-500 mb-4">Come ti senti oggi?</p>
              <div className="flex justify-between items-center">
                {['😫', '😕', '😐', '🙂', '😄'].map((e, i) => (
                  <span key={i} className="text-2xl opacity-50 hover:opacity-100 cursor-pointer transition-opacity">{e}</span>
                ))}
              </div>
            </Widget>

            {/* Habits */}
            <Widget href="/dashboard/habits">
              <WidgetHeader icon={Flame} label="Abitudini" />
              <div className="space-y-2.5">
                {['Farmaci mattina', 'Idratazione', 'Routine mattino', 'Studio cybersecurity'].map((h, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 rounded-full border border-white/10 shrink-0" />
                    <span className="text-xs text-slate-400">{h}</span>
                  </div>
                ))}
              </div>
            </Widget>

            {/* Budget */}
            <Widget href="/dashboard/budget">
              <WidgetHeader icon={Wallet} label="Budget" />
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Entrate" value="—" color="#4ade80" />
                <Stat label="Uscite" value="—" color="#f87171" />
              </div>
              <p className="text-[11px] text-slate-700 mt-4">Collega le scadenze per il saldo</p>
            </Widget>

          </div>
        </main>
      </div>
    </div>
  );
}
