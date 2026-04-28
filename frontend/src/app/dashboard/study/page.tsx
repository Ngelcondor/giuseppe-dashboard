'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Calendar, Sun, Timer } from 'lucide-react';
import { loadState, getOverallProgress, getTodayDay, getDayProgress, getPendingPastTasks } from '@/lib/studyPlanState';

const sections = [
  {
    id: 'today',
    label: 'Cosa fare oggi',
    description: "I task del giorno + eventuali task riprogrammati",
    icon: <Sun size={22} />,
    href: '/dashboard/study/today',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Roadmap CRTP completa con checklist e progress per fase',
    icon: <Calendar size={22} />,
    href: '/dashboard/study/timeline',
    color: 'text-teal-400',
    bg: 'bg-teal-500/10 border-teal-500/20',
  },
  {
    id: 'pomodoro',
    label: 'Pomodoro',
    description: 'Timer 45/15 ADHD-friendly per le sessioni di studio',
    icon: <Timer size={22} />,
    href: '/dashboard/study/pomodoro',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
  },
];

export default function StudyHubPage() {
  const [overall, setOverall] = useState({ done: 0, total: 0, pct: 0 });
  const [todayDone, setTodayDone] = useState({ done: 0, total: 0, pct: 0 });
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const state = loadState();
    setOverall(getOverallProgress(state));
    const today = getTodayDay(state);
    if (today) setTodayDone(getDayProgress(today));
    setPendingCount(getPendingPastTasks(state).length);
  }, []);

  return (
    <div className="min-h-screen bg-page text-heading">
      <header className="px-6 py-5 border-b border-border-default flex items-center gap-3">
        <Link href="/dashboard" className="text-tertiary hover:text-body transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <BookOpen size={18} className="text-teal-400" />
        <h1 className="text-base font-semibold">Studio — CRTP</h1>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8 space-y-6">
        {/* Progress overview */}
        <div className="p-5 rounded-2xl bg-card border border-border-default space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-tertiary uppercase tracking-widest">Progresso totale</p>
              <p className="text-xs text-muted">{overall.done}/{overall.total} task</p>
            </div>
            <div className="h-2 bg-card-inner rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-400 transition-all duration-500"
                style={{ width: `${overall.pct}%` }}
              />
            </div>
            <p className="text-xs text-tertiary mt-1.5">{overall.pct}% completato</p>
          </div>

          {todayDone.total > 0 && (
            <div className="pt-3 border-t border-border-default">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-tertiary uppercase tracking-widest">Oggi</p>
                <p className="text-xs text-muted">{todayDone.done}/{todayDone.total} task</p>
              </div>
              <div className="h-2 bg-card-inner rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${todayDone.pct}%` }}
                />
              </div>
            </div>
          )}

          {pendingCount > 0 && (
            <div className="pt-3 border-t border-border-default">
              <p className="text-xs text-rose-400">
                ⚠️ Hai {pendingCount} task in arretrato. Vai su Timeline o Cosa fare oggi per riprogrammarli.
              </p>
            </div>
          )}
        </div>

        {/* Sections */}
        <div className="grid gap-3">
          {sections.map((s) => (
            <Link
              key={s.id}
              href={s.href}
              className={`flex items-center gap-4 px-5 py-4 rounded-xl border transition-all duration-200 ${s.bg} hover:scale-[1.01] cursor-pointer`}
            >
              <div className={`flex-shrink-0 ${s.color}`}>{s.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-heading">{s.label}</p>
                <p className="text-xs text-tertiary mt-0.5">{s.description}</p>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-[11px] text-muted text-center pt-4">
          Roadmap basata su <span className="text-body">CRTP_Study_Plan_Complete.md</span> · Esame target 17-18 Agosto 2026
        </p>
      </main>
    </div>
  );
}
