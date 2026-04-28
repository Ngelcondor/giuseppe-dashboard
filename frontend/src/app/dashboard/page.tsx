'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ChevronRight, CheckCircle2, Circle,
  Sun, Sunset, CloudMoon, Coffee,
} from 'lucide-react';
import routineService, { type RoutineResponse, type TimeOfDay } from '@/services/routineService';
import SleepWidget from '@/components/widgets/SleepWidget';
import api from '@/lib/api';
import { BottomDock } from '@/components/ui/AppShell';
import {
  loadState, toggleTask, getTodayDay, getDayProgress,
  getPendingPastTasks, getOverallProgress,
  type StudyDay,
} from '@/lib/studyPlanState';

/* ─────────────────────────────────────────────────────── helpers */

function dayOfYear(d = new Date()) {
  const start = Date.UTC(d.getFullYear(), 0, 0);
  const now = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((now - start) / 86_400_000);
}

function greetingFor(d: Date) {
  const h = d.getHours();
  if (h < 5) return 'Notte fonda';
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

const DAY_NAMES_IT = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

/* ─────────────────────────────────────────────────────── tile primitives */

function Tile({
  href, span = '', children, accent = false,
}: {
  href?: string;
  span?: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  const base = `
    relative flex flex-col p-6 sm:p-7 rounded-[28px]
    bg-card border border-border-default overflow-hidden
    transition-[border-color,background-color,transform] duration-200 ease-out
    ${accent ? 'sm:p-9' : ''}
  `;
  const interactive = href
    ? 'group cursor-pointer hover:border-border-hover hover:bg-card-inner'
    : '';
  if (href) {
    return (
      <Link href={href} className={`${base} ${interactive} ${span}`}>
        {accent && <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-accent-line" />}
        {children}
      </Link>
    );
  }
  return (
    <div className={`${base} ${span}`}>
      {accent && <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-accent-line" />}
      {children}
    </div>
  );
}

function Eyebrow({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return <p className={`eyebrow ${accent ? 'text-accent' : ''}`}>{children}</p>;
}

function ArrowChevron() {
  return (
    <ChevronRight
      size={16}
      className="text-muted group-hover:text-heading group-hover:translate-x-0.5 transition-all duration-200"
    />
  );
}

/* ─────────────────────────────────────────────────────── hero */

function Hero({ now }: { now: Date }) {
  const greeting = greetingFor(now);
  const dayName = DAY_NAMES_IT[now.getDay()];
  const dayN = dayOfYear(now);
  const time = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="pt-12 pb-10 sm:pt-20 sm:pb-16">
      <div className="flex items-center justify-between mb-6">
        <p className="font-mono-display text-[11px] tracking-[0.18em] uppercase text-tertiary">
          {dayName} · Day {String(dayN).padStart(3, '0')} of {now.getFullYear()}
        </p>
        <p className="font-mono-display text-[11px] tracking-[0.18em] uppercase text-tertiary">
          {time}
        </p>
      </div>

      <h1 className="font-display text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.95] tracking-[-0.04em] text-heading">
        <span className="font-extrabold">{greeting},</span>{' '}
        <span className="font-serif italic font-medium text-accent">Giuseppe</span>
        <span className="text-heading font-extrabold">.</span>
      </h1>

      <p className="mt-6 max-w-2xl text-[17px] sm:text-[19px] leading-relaxed text-tertiary">
        <span className="text-body">Day 0 di CRTP.</span>{' '}
        Setup ambiente attivo. Esame target — <span className="font-serif italic text-body">17 agosto</span>.
      </p>
    </header>
  );
}

/* ─────────────────────────────────────────────────────── HERO TILE: Studio CRTP */

function StudioHeroTile() {
  const [today, setToday] = useState<StudyDay | undefined>(undefined);
  const [pendingCount, setPendingCount] = useState(0);
  const [overall, setOverall] = useState({ done: 0, total: 0, pct: 0 });
  const [, force] = useState(0);

  useEffect(() => {
    const s = loadState();
    setToday(getTodayDay(s));
    setPendingCount(getPendingPastTasks(s).length);
    setOverall(getOverallProgress(s));
  }, []);

  const handleToggle = (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!today) return;
    const s = loadState();
    const next = toggleTask(s, today.date, taskId);
    setToday(getTodayDay(next));
    setOverall(getOverallProgress(next));
    force((n) => n + 1);
  };

  const progress = today ? getDayProgress(today) : { done: 0, total: 0, pct: 0 };

  return (
    <Tile
      span="lg:col-span-7 lg:row-span-2 min-h-[320px] sm:min-h-[440px]"
      accent
    >
      <div className="flex items-start justify-between mb-8">
        <div>
          <Eyebrow accent>Mission · CRTP</Eyebrow>
          <p className="mt-2 font-display font-extrabold text-[28px] sm:text-[34px] leading-[1.05] tracking-[-0.025em] text-heading max-w-md">
            {today?.label ?? 'Nessun giorno pianificato'}
          </p>
        </div>
        <Link
          href="/dashboard/study"
          aria-label="Apri Studio"
          className="shrink-0 w-10 h-10 rounded-full bg-card-inner border border-border-default flex items-center justify-center text-tertiary hover:text-heading hover:border-border-hover transition-colors"
        >
          <ChevronRight size={16} />
        </Link>
      </div>

      {today?.isRest ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-8">
          <Coffee size={32} className="text-blue-400" />
          <p className="font-serif italic text-2xl text-heading">Domenica sacra.</p>
          <p className="text-sm text-tertiary max-w-xs">Il riposo non è negoziabile.</p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-3 mt-2 mb-8">
            <p className="font-mono-display font-semibold text-[56px] sm:text-[72px] leading-none tracking-[-0.04em] text-heading">
              {progress.done}
              <span className="text-tertiary">/{progress.total}</span>
            </p>
            <p className="text-sm text-tertiary translate-y-[-8px]">task oggi</p>
          </div>

          <div className="h-[3px] rounded-full bg-card-inner overflow-hidden mb-8">
            <div
              className="h-full bg-accent transition-[width] duration-500"
              style={{ width: `${progress.pct}%` }}
            />
          </div>

          <ul className="space-y-3 flex-1">
            {today?.tasks.slice(0, 4).map((t) => (
              <li key={t.id}>
                <button
                  onClick={(e) => handleToggle(e, t.id)}
                  className="flex items-start gap-3.5 w-full text-left group/task"
                >
                  {t.completed ? (
                    <CheckCircle2 size={18} className="text-accent shrink-0 mt-[2px]" />
                  ) : (
                    <Circle
                      size={18}
                      className="text-muted shrink-0 mt-[2px] group-hover/task:text-tertiary transition-colors"
                    />
                  )}
                  <span
                    className={`text-[15px] leading-snug ${
                      t.completed ? 'text-muted line-through' : 'text-body'
                    }`}
                  >
                    {t.text}
                  </span>
                </button>
              </li>
            )) ?? (
              <li className="text-sm text-tertiary">Piano fuori range (28 Apr → 22 Set 2026).</li>
            )}
          </ul>

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border-default text-[13px]">
            {pendingCount > 0 ? (
              <span className="flex items-center gap-2 text-rose-400">
                <AlertTriangle size={14} />
                {pendingCount} arretrati
              </span>
            ) : (
              <span className="text-tertiary">Roadmap totale</span>
            )}
            <span className="font-mono-display text-tertiary">
              {overall.pct}% · {overall.done}/{overall.total}
            </span>
          </div>
        </>
      )}
    </Tile>
  );
}

/* ─────────────────────────────────────────────────────── small tiles */

function PomodoroTile() {
  return (
    <Tile href="/dashboard/study/pomodoro" span="lg:col-span-3">
      <Eyebrow>Pomodoro</Eyebrow>
      <p className="mt-3 font-mono-display font-medium text-[44px] leading-none tracking-[-0.03em] text-heading">
        45<span className="text-tertiary">:00</span>
      </p>
      <p className="mt-3 text-sm text-tertiary">ADHD-friendly · 45 / 15</p>
      <div className="mt-auto flex items-center justify-between pt-6">
        <span className="text-[13px] text-body">Avvia sessione</span>
        <ArrowChevron />
      </div>
    </Tile>
  );
}

function SleepTile() {
  return (
    <Tile href="/dashboard/health/sleep" span="lg:col-span-2">
      <Eyebrow>Sonno</Eyebrow>
      <div className="mt-2 -mx-1 flex-1">
        <SleepWidget />
      </div>
    </Tile>
  );
}

interface HealthMetricData { metric_type: string; value: number; unit: string; recorded_at: string; source: string; }
interface HealthSummaryData { period: string; metrics: Record<string, HealthMetricData[]>; }

function HealthTile() {
  const [summary, setSummary] = useState<HealthSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/health/summary?period=daily')
      .then((r) => setSummary(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const latest = (t: string) => summary?.metrics?.[t]?.slice(-1)[0];
  const hr = latest('heart_rate');

  return (
    <Tile href="/dashboard/health" span="lg:col-span-2">
      <Eyebrow>Battito</Eyebrow>
      {loading ? (
        <div className="mt-3 h-10 w-20 rounded bg-card-inner animate-pulse" />
      ) : (
        <p className="mt-3 font-mono-display font-medium text-[44px] leading-none tracking-[-0.03em] text-heading">
          {hr ? Math.round(hr.value) : '—'}
          <span className="text-tertiary text-2xl ml-1">bpm</span>
        </p>
      )}
      <p className="mt-3 text-sm text-tertiary">
        {hr?.source ? `via ${hr.source.replace(/_/g, ' ')}` : 'Collega Apple Health'}
      </p>
      <div className="mt-auto pt-6 flex items-center justify-end">
        <ArrowChevron />
      </div>
    </Tile>
  );
}

function MoodTile() {
  const moods = ['😫', '😕', '😐', '🙂', '😄'];
  return (
    <Tile span="lg:col-span-2">
      <Eyebrow>Umore</Eyebrow>
      <p className="mt-3 font-serif italic text-2xl text-heading">Come va?</p>
      <div className="mt-5 grid grid-cols-5 gap-1">
        {moods.map((m, i) => (
          <Link
            key={i}
            href={`/dashboard/mood?initial=${i + 1}`}
            className="aspect-square flex items-center justify-center rounded-full text-2xl bg-card-inner border border-border-default hover:border-accent hover:bg-accent-soft transition-all duration-150"
          >
            {m}
          </Link>
        ))}
      </div>
    </Tile>
  );
}

const TIME_ICONS: Record<TimeOfDay, React.ElementType> = { morning: Sun, afternoon: Sun, evening: Sunset, night: CloudMoon };
const TIME_LABELS: Record<TimeOfDay, string> = { morning: 'Mattina', afternoon: 'Pomeriggio', evening: 'Sera', night: 'Notte' };

function RoutineTile() {
  const [routine, setRoutine] = useState<RoutineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<Set<string>>(new Set());

  const hour = new Date().getHours();
  const current: TimeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

  useEffect(() => {
    routineService.getToday().then((data) => {
      const order: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];
      const idx = order.indexOf(current);
      for (let i = 0; i < order.length; i++) {
        const k = order[(idx + i) % order.length];
        if (data[k]) { setRoutine(data[k]); break; }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [current]);

  if (!loading && !routine) {
    return (
      <Tile href="/dashboard/routines" span="lg:col-span-7">
        <Eyebrow>Routine</Eyebrow>
        <p className="mt-3 font-serif italic text-2xl text-heading">Nessuna routine attiva</p>
        <p className="mt-2 text-sm text-tertiary">Configurane una per oggi.</p>
      </Tile>
    );
  }

  if (loading || !routine) {
    return (
      <Tile span="lg:col-span-7">
        <div className="h-32 animate-pulse" />
      </Tile>
    );
  }

  const steps = [...routine.steps].sort((a, b) => a.order - b.order);
  const Icon = TIME_ICONS[routine.time_of_day];
  const pct = steps.length ? Math.round((done.size / steps.length) * 100) : 0;

  const toggle = (id: string) =>
    setDone((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <Tile span="lg:col-span-7">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Eyebrow>Routine · {TIME_LABELS[routine.time_of_day]}</Eyebrow>
          <p className="mt-2 font-display font-extrabold text-2xl tracking-[-0.02em] text-heading">{routine.name}</p>
        </div>
        <Link
          href="/dashboard/routines"
          aria-label="Apri Routine"
          className="shrink-0 w-9 h-9 rounded-full bg-card-inner border border-border-default flex items-center justify-center text-tertiary hover:text-heading hover:border-border-hover transition-colors"
        >
          <Icon size={15} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        {steps.slice(0, 6).map((s) => {
          const isDone = done.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className="flex items-center gap-3 text-left group/step"
            >
              {isDone ? (
                <CheckCircle2 size={16} className="text-accent shrink-0" />
              ) : (
                <Circle size={16} className="text-muted shrink-0 group-hover/step:text-tertiary transition-colors" />
              )}
              <span className={`text-[14px] ${isDone ? 'text-muted line-through' : 'text-body'}`}>
                {s.icon && <span className="mr-1.5">{s.icon}</span>}
                {s.title}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-7 pt-5 border-t border-border-default flex items-center justify-between text-[13px]">
        <span className="text-tertiary font-mono-display">{done.size}/{steps.length} step</span>
        <span className="text-accent font-mono-display">{pct}%</span>
      </div>
    </Tile>
  );
}

interface DeadlineData { id: string; title: string; due_date: string; category: string; priority: string; is_completed: boolean; }
const PRIORITY_COLORS: Record<string, string> = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#6b7280' };
const CATEGORY_EMOJI: Record<string, string> = { university: '🎓', work: '💼', personal: '📌', certification: '📜', ctf: '🏴', other: '📋' };

function DeadlinesTile() {
  const [data, setData] = useState<{ upcoming: DeadlineData[]; overdue: DeadlineData[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/deadlines/upcoming/list')
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const items = data?.upcoming?.slice(0, 3) ?? [];
  const overdue = data?.overdue?.length ?? 0;

  const fmt = (d: string) => {
    const date = new Date(d);
    const today = new Date();
    const tom = new Date(); tom.setDate(today.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return 'Oggi';
    if (date.toDateString() === tom.toDateString()) return 'Domani';
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };

  return (
    <Tile href="/dashboard/deadlines" span="lg:col-span-2">
      <Eyebrow>Scadenze</Eyebrow>
      {loading ? (
        <div className="mt-3 h-12 animate-pulse" />
      ) : items.length === 0 && overdue === 0 ? (
        <>
          <p className="mt-3 font-serif italic text-2xl text-heading">Tutto in ordine.</p>
          <p className="mt-2 text-sm text-tertiary">Nessuna scadenza imminente.</p>
        </>
      ) : (
        <ul className="mt-4 space-y-3 flex-1">
          {overdue > 0 && (
            <li className="text-sm text-rose-400 font-medium flex items-center gap-2">
              <AlertTriangle size={13} /> {overdue} scadut{overdue === 1 ? 'a' : 'e'}
            </li>
          )}
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3">
              <span className="w-1 h-7 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[it.priority] || '#6b7280' }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-body truncate">{CATEGORY_EMOJI[it.category]} {it.title}</p>
                <p className="text-[11px] text-muted font-mono-display">{fmt(it.due_date)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-5 flex items-center justify-end">
        <ArrowChevron />
      </div>
    </Tile>
  );
}

function HabitsTile() {
  return (
    <Tile href="/dashboard/habits" span="lg:col-span-2">
      <Eyebrow>Abitudini</Eyebrow>
      <p className="mt-3 font-mono-display font-medium text-[44px] leading-none tracking-[-0.03em] text-heading">
        3<span className="text-tertiary">/5</span>
      </p>
      <p className="mt-3 text-sm text-tertiary">oggi completate</p>
      <div className="mt-auto pt-6 flex items-center justify-end">
        <ArrowChevron />
      </div>
    </Tile>
  );
}

/* ─────────────────────────────────────────────────────── page */

export default function DashboardPage() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-page text-heading">
      {/* Slim brand bar */}
      <header className="px-5 sm:px-10 py-4 flex items-center justify-between border-b border-border-default">
        <Link href="/dashboard" className="font-serif italic text-[15px] text-heading">
          giuseppe<span className="text-accent">.</span>dashboard
        </Link>
        <Link
          href="/dashboard/settings"
          className="text-[13px] text-tertiary hover:text-heading transition-colors"
        >
          impostazioni
        </Link>
      </header>

      <div className="max-w-6xl mx-auto px-5 sm:px-10 pb-32">
        <Hero now={now} />

        {/* Bento grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 lg:auto-rows-[160px] gap-3 sm:gap-4">
          <StudioHeroTile />
          <SleepTile />
          <PomodoroTile />
          <HealthTile />
          <MoodTile />
          <RoutineTile />
          <DeadlinesTile />
          <HabitsTile />
        </section>

        <p className="mt-16 text-center font-serif italic text-[13px] text-muted">
          Made for clear mornings and quiet hyperfocus.
        </p>
      </div>

      <BottomDock />
    </div>
  );
}
