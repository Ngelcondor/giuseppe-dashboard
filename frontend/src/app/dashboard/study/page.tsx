'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookOpen, Calendar, Sun, Timer, ChevronRight, AlertTriangle } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { Surface, Progress } from '@/components/ui/Surface';
import {
  loadState,
  getOverallProgress,
  getTodayDay,
  getDayProgress,
  getPendingPastTasks,
  todayISO,
} from '@/lib/studyPlanState';

const sections = [
  {
    id: 'today',
    label: 'Cosa fare oggi',
    description: 'I task del giorno + eventuali task riprogrammati',
    icon: Sun,
    href: '/dashboard/study/today',
    accent: 'text-amber-400',
    bg: 'bg-amber-500/8 border-amber-500/20',
  },
  {
    id: 'timeline',
    label: 'Timeline CRTP',
    description: 'Roadmap completa con checklist e progress per fase',
    icon: Calendar,
    href: '/dashboard/study/timeline',
    accent: 'text-accent',
    bg: 'bg-emerald-500/8 border-emerald-500/20',
  },
  {
    id: 'pomodoro',
    label: 'Pomodoro',
    description: 'Timer 45/15 ADHD-friendly per le sessioni di studio',
    icon: Timer,
    href: '/dashboard/study/pomodoro',
    accent: 'text-violet-400',
    bg: 'bg-violet-500/8 border-violet-500/20',
  },
];

export default function StudyHubPage() {
  const [overall, setOverall] = useState({ done: 0, total: 0, pct: 0 });
  const [todayDone, setTodayDone] = useState({ done: 0, total: 0, pct: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [todayLabel, setTodayLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadState().then((state) => {
      if (cancelled) return;
      setOverall(getOverallProgress(state));
      const today = getTodayDay(state);
      if (today) {
        setTodayDone(getDayProgress(today));
        setTodayLabel(today.label);
      }
      setPendingCount(getPendingPastTasks(state).length);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <PageShell title="Studio · CRTP" eyebrow="Programma di Studio" icon={BookOpen} iconColor="text-accent" width="md">
      {/* Hero stat block */}
      <Surface variant="accent" padding="lg" className="mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="section-label mb-2">Roadmap completa</p>
            <p className="text-3xl font-semibold font-mono-display text-heading leading-none">
              {overall.pct}<span className="text-lg text-tertiary">%</span>
            </p>
            <p className="text-[11px] text-muted mt-1.5 font-mono-display">
              {overall.done} / {overall.total} task · target esame 17 Ago
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted tracking-uppercase">Today</p>
            <p className="text-xs font-mono-display text-tertiary mt-1">{todayISO()}</p>
          </div>
        </div>
        <Progress value={overall.pct} color="rgb(var(--accent-primary))" />

        {todayDone.total > 0 && (
          <div className="mt-5 pt-5 border-t border-border-default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-tertiary tracking-uppercase">Oggi</span>
              <span className="text-[11px] font-mono-display text-amber-400">
                {todayDone.done}/{todayDone.total}
              </span>
            </div>
            {todayLabel && <p className="text-xs text-body mb-2.5 truncate">{todayLabel}</p>}
            <Progress value={todayDone.pct} color="#fbbf24" />
          </div>
        )}

        {pendingCount > 0 && (
          <Link
            href="/dashboard/study/today"
            className="mt-5 flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 hover:bg-rose-500/20 transition-colors"
          >
            <AlertTriangle size={13} />
            {pendingCount} task in arretrato — riprogramma
          </Link>
        )}
      </Surface>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className={`group flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-200 ${s.bg} hover:bg-card-solid`}
          >
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-card-solid border border-border-default flex items-center justify-center ${s.accent}`}>
              <s.icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-heading">{s.label}</p>
              <p className="text-xs text-tertiary mt-0.5">{s.description}</p>
            </div>
            <ChevronRight size={16} className="text-muted group-hover:text-tertiary group-hover:translate-x-0.5 transition-all" />
          </Link>
        ))}
      </div>

      <p className="mt-10 text-[11px] text-muted font-mono-display text-center opacity-70">
        <span className="text-accent">// </span>
        roadmap basata su CRTP_Study_Plan_Complete.md
      </p>
    </PageShell>
  );
}
