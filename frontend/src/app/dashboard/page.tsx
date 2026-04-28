'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ChevronRight, CheckCircle2, Circle,
  Coffee, Moon, Clock,
} from 'lucide-react';
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

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

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

/* ─────────────────────────────────────────────────────── SLEEP TILE — Apple Watch only */

interface SleepSession {
  id: string;
  sleep_start: string;
  sleep_end: string;
  duration_minutes: number;
  quality_score: number | null;
  light_minutes: number;
  deep_minutes: number;
  rem_minutes: number;
  awake_minutes: number;
  source: string;
}

const APPLE_SOURCES = new Set(['apple_watch', 'health_auto_export', 'apple_health']);

function SleepTile() {
  const [latest, setLatest] = useState<SleepSession | null>(null);
  const [recent, setRecent] = useState<SleepSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/sleep?days=7')
      .then((r) => {
        const all: SleepSession[] = Array.isArray(r.data) ? r.data : [];
        const apple = all.filter((s) => APPLE_SOURCES.has(s.source));
        setRecent(apple.slice(0, 7));
        setLatest(apple[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Build a 7-night sparkline of duration_minutes (newest right)
  const maxMin = Math.max(...recent.map(r => r.duration_minutes), 480);
  const sparkline = [...recent].reverse(); // oldest left → newest right

  if (loading) {
    return (
      <Tile span="lg:col-span-5 lg:row-span-2">
        <Eyebrow>Sonno</Eyebrow>
        <div className="mt-6 h-32 rounded-xl bg-card-inner animate-pulse" />
      </Tile>
    );
  }

  if (!latest) {
    return (
      <Tile href="/dashboard/health/sleep" span="lg:col-span-5 lg:row-span-2">
        <Eyebrow>Sonno</Eyebrow>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-8">
          <Moon size={28} className="text-blue-400" />
          <p className="font-serif italic text-xl text-heading">Niente Apple Watch</p>
          <p className="text-xs text-tertiary max-w-xs">
            Indossa l&apos;orologio durante la notte e i dati appariranno qui.
          </p>
        </div>
      </Tile>
    );
  }

  const totalMin = latest.duration_minutes;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;

  const stagesTotal = latest.light_minutes + latest.deep_minutes + latest.rem_minutes + latest.awake_minutes;
  const stages = stagesTotal > 0 ? [
    { key: 'awake',  label: 'Sveglio', min: latest.awake_minutes, color: '#ef4444' },
    { key: 'rem',    label: 'REM',     min: latest.rem_minutes,   color: '#a78bfa' },
    { key: 'light',  label: 'Leggero', min: latest.light_minutes, color: '#60a5fa' },
    { key: 'deep',   label: 'Profondo', min: latest.deep_minutes, color: '#1e40af' },
  ] : [];

  const startDate = new Date(latest.sleep_start);
  const endDate = new Date(latest.sleep_end);
  const fmtTime = (d: Date) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  return (
    <Tile href="/dashboard/health/sleep" span="lg:col-span-5 lg:row-span-2">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Eyebrow>Sonno · Apple Watch</Eyebrow>
          <p className="mt-2 text-[13px] text-tertiary font-mono-display">
            {fmtTime(startDate)} → {fmtTime(endDate)}
          </p>
        </div>
        <ArrowChevron />
      </div>

      {/* Big total */}
      <div className="flex items-baseline gap-2 mb-6">
        <p className="font-mono-display font-semibold text-[56px] sm:text-[64px] leading-none tracking-[-0.04em] text-heading">
          {hours}<span className="text-tertiary text-3xl">h</span>{' '}
          {String(mins).padStart(2, '0')}<span className="text-tertiary text-3xl">m</span>
        </p>
      </div>

      {/* Stage bar */}
      {stagesTotal > 0 && (
        <>
          <div className="flex h-2 rounded-full overflow-hidden bg-card-inner mb-3">
            {stages.map(s => s.min > 0 && (
              <span
                key={s.key}
                style={{ width: `${(s.min / stagesTotal) * 100}%`, backgroundColor: s.color }}
              />
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 mb-6">
            {stages.map(s => (
              <div key={s.key}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[10px] text-tertiary tracking-uppercase">{s.label}</span>
                </div>
                <p className="text-[13px] font-mono-display text-body">
                  {Math.floor(s.min / 60)}h {String(s.min % 60).padStart(2, '0')}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 7-night sparkline */}
      {sparkline.length > 1 && (
        <div className="mt-auto pt-4 border-t border-border-default">
          <div className="flex items-end justify-between gap-1 h-12">
            {sparkline.map((s, i) => {
              const h = Math.max(8, (s.duration_minutes / maxMin) * 48);
              const isLast = i === sparkline.length - 1;
              return (
                <div
                  key={s.id ?? i}
                  className="flex-1 rounded-t-md"
                  style={{
                    height: `${h}px`,
                    backgroundColor: isLast ? 'rgb(var(--accent-primary))' : 'rgb(var(--color-tertiary) / 0.4)',
                  }}
                  title={`${(s.duration_minutes / 60).toFixed(1)}h`}
                />
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-muted tracking-uppercase">Ultime 7 notti</p>
        </div>
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
    <Tile href="/dashboard/health" span="lg:col-span-3">
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

/* ─────────────────────────────────────────────────────── DEADLINES TILE — today + week */

interface DeadlineData {
  id: string;
  title: string;
  due_date: string;
  category: string;
  priority: string;
  is_completed: boolean;
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

function isInThisWeek(date: Date, today: Date): boolean {
  // "Questa settimana" = days 1-7 from today (excluding today itself)
  const diffDays = Math.floor((date.getTime() - today.getTime()) / 86_400_000);
  return diffDays >= 1 && diffDays <= 7;
}

function DeadlinesTile() {
  const [data, setData] = useState<{ upcoming: DeadlineData[]; overdue: DeadlineData[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/deadlines/upcoming/list')
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayItems = (data?.upcoming ?? []).filter((d) => {
    const dd = new Date(d.due_date);
    dd.setHours(0, 0, 0, 0);
    return isSameDay(dd, today);
  });
  const weekItems = (data?.upcoming ?? []).filter((d) => {
    const dd = new Date(d.due_date);
    dd.setHours(0, 0, 0, 0);
    return isInThisWeek(dd, today);
  });
  const overdue = data?.overdue?.length ?? 0;

  const fmtDay = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes();
    if (h === 0 && m === 0) return null;
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const renderItem = (it: DeadlineData, withDay = false) => {
    const time = fmtTime(it.due_date);
    return (
      <li key={it.id} className="flex items-center gap-3 py-1.5">
        <span className="w-1 h-7 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[it.priority] || '#6b7280' }} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-body truncate">
            <span className="mr-1.5">{CATEGORY_EMOJI[it.category] || '📋'}</span>
            {it.title}
          </p>
          <p className="text-[11px] text-muted font-mono-display">
            {withDay ? fmtDay(it.due_date) : 'Oggi'}{time ? ` · ${time}` : ''}
          </p>
        </div>
      </li>
    );
  };

  return (
    <Tile href="/dashboard/deadlines" span="lg:col-span-6">
      <div className="flex items-center justify-between mb-4">
        <Eyebrow>Scadenze</Eyebrow>
        {overdue > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] text-rose-400 font-mono-display">
            <AlertTriangle size={11} /> {overdue} scadut{overdue === 1 ? 'a' : 'e'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-24 rounded-xl bg-card-inner animate-pulse" />
      ) : todayItems.length === 0 && weekItems.length === 0 && overdue === 0 ? (
        <>
          <p className="font-serif italic text-2xl text-heading">Tutto in ordine.</p>
          <p className="mt-1.5 text-sm text-tertiary">Nessuna scadenza imminente.</p>
        </>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {/* Oggi */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[11px] tracking-uppercase text-tertiary">Oggi</p>
              <span className="text-[11px] font-mono-display text-muted">{todayItems.length}</span>
            </div>
            {todayItems.length > 0 ? (
              <ul className="divide-y divide-white/[0.04]">
                {todayItems.slice(0, 3).map((it) => renderItem(it, false))}
              </ul>
            ) : (
              <p className="text-[12px] text-muted py-1.5">Niente per oggi</p>
            )}
          </div>

          {/* Questa settimana */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[11px] tracking-uppercase text-tertiary">Questa settimana</p>
              <span className="text-[11px] font-mono-display text-muted">{weekItems.length}</span>
            </div>
            {weekItems.length > 0 ? (
              <ul className="divide-y divide-white/[0.04]">
                {weekItems.slice(0, 3).map((it) => renderItem(it, true))}
              </ul>
            ) : (
              <p className="text-[12px] text-muted py-1.5">Settimana libera</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-auto pt-4 flex items-center justify-end">
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

        {/* Bento — 5 tiles */}
        <section className="grid grid-cols-1 lg:grid-cols-12 lg:auto-rows-[160px] gap-3 sm:gap-4">
          <StudioHeroTile />
          <SleepTile />
          <PomodoroTile />
          <HealthTile />
          <DeadlinesTile />
        </section>

        <p className="mt-16 text-center font-serif italic text-[13px] text-muted">
          Made for clear mornings and quiet hyperfocus.
        </p>
      </div>

      <BottomDock />
    </div>
  );
}
