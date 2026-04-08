'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Moon, BedDouble, AlarmClock } from 'lucide-react';
import api from '@/lib/api';

/* ── Types ──────────────────────────────────────────────── */

interface SleepPhase {
  id: string;
  phase: 'awake' | 'light' | 'deep' | 'rem';
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

interface SleepSession {
  id: string;
  sleep_start: string;
  sleep_end: string;
  duration_minutes: number;
  quality_score: number | null;
  time_in_bed_minutes: number | null;
  sleep_efficiency: number | null;
  awake_minutes: number;
  light_minutes: number;
  deep_minutes: number;
  rem_minutes: number;
  phases: SleepPhase[];
  source: string;
}

interface MorningReport {
  session: SleepSession | null;
  quality_label: string;
  total_hours: number;
  deep_pct: number;
  rem_pct: number;
  efficiency_pct: number;
  tip: string;
  streak_days: number;
}

/* ── Constants ──────────────────────────────────────────── */

const PHASE_COLORS = {
  awake: '#8e8e93',
  light: '#64d2ff',
  deep: '#0a84ff',
  rem:   '#bf5af2',
} as const;

const PHASE_LABELS: Record<string, string> = {
  awake: 'Veglia',
  light: 'Leggero',
  deep:  'Profondo',
  rem:   'Sogno',
};

const PHASE_Y: Record<string, number> = {
  awake: 0.08,
  rem:   0.35,
  light: 0.58,
  deep:  0.85,
};

/* ── Helpers ────────────────────────────────────────────── */

function fmt(date: Date): string {
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m.toString().padStart(2, '0')}min`;
}

/* ── Quality Ring (SVG) ─────────────────────────────────── */

function QualityRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(score, 100)) / 100;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* bg track */}
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke="rgba(255,255,255,0.06)" strokeWidth={6} fill="none" />
        {/* gradient arc */}
        <defs>
          <linearGradient id="sleepRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff9f0a" />
            <stop offset="100%" stopColor="#ff375f" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke="url(#sleepRingGrad)" strokeWidth={6} fill="none"
          strokeDasharray={`${circ * pct} ${circ}`}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-heading">{score}</span>
        <span className="text-[10px] text-tertiary -mt-0.5">Qualità</span>
      </div>
    </div>
  );
}

/* ── Hypnogram (SVG waveform) ──────────────────────────── */

function Hypnogram({ phases, sleepStart, sleepEnd }: {
  phases: SleepPhase[];
  sleepStart: Date;
  sleepEnd: Date;
}) {
  const W = 600;
  const H = 120;
  const PAD = { top: 8, bottom: 8, left: 0, right: 0 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const totalMs = sleepEnd.getTime() - sleepStart.getTime();

  // Sort phases by start_time
  const sorted = useMemo(() =>
    [...phases].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [phases]
  );

  if (sorted.length === 0) return null;

  // Build polyline path with smooth transitions
  const points: string[] = [];

  sorted.forEach((ph, i) => {
    const startMs = new Date(ph.start_time).getTime() - sleepStart.getTime();
    const endMs = new Date(ph.end_time).getTime() - sleepStart.getTime();
    const x1 = PAD.left + (startMs / totalMs) * plotW;
    const x2 = PAD.left + (endMs / totalMs) * plotW;
    const y = PAD.top + PHASE_Y[ph.phase] * plotH;

    if (i === 0) {
      points.push(`M ${x1} ${y}`);
    } else {
      // smooth step to new level
      points.push(`L ${x1} ${y}`);
    }
    points.push(`L ${x2} ${y}`);
  });

  const pathD = points.join(' ');

  // Time labels
  const labels: { x: number; text: string }[] = [];
  const intervalMs = totalMs / 6;
  for (let i = 0; i <= 6; i++) {
    const t = new Date(sleepStart.getTime() + i * intervalMs);
    labels.push({
      x: PAD.left + (i / 6) * plotW,
      text: fmt(t),
    });
  }

  // Phase level labels on right
  const phaseLabelArr = [
    { label: 'Veglia', y: PAD.top + PHASE_Y.awake * plotH },
    { label: 'REM', y: PAD.top + PHASE_Y.rem * plotH },
    { label: 'Leggero', y: PAD.top + PHASE_Y.light * plotH },
    { label: 'Profondo', y: PAD.top + PHASE_Y.deep * plotH },
  ];

  // Color segments for each phase
  const segments = sorted.map((ph) => {
    const startMs = new Date(ph.start_time).getTime() - sleepStart.getTime();
    const endMs = new Date(ph.end_time).getTime() - sleepStart.getTime();
    const x1 = PAD.left + (startMs / totalMs) * plotW;
    const x2 = PAD.left + (endMs / totalMs) * plotW;
    const y = PAD.top + PHASE_Y[ph.phase] * plotH;
    return { x1, x2, y, phase: ph.phase };
  });

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Subtle grid lines */}
        {phaseLabelArr.map((p, i) => (
          <line key={i} x1={PAD.left} x2={W - PAD.right} y1={p.y} y2={p.y}
            stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} />
        ))}

        {/* Colored path segments */}
        {segments.map((seg, i) => {
          const prev = i > 0 ? segments[i - 1] : null;
          const transitionD = prev
            ? `M ${prev.x2} ${prev.y} L ${seg.x1} ${seg.y} L ${seg.x2} ${seg.y}`
            : `M ${seg.x1} ${seg.y} L ${seg.x2} ${seg.y}`;

          return (
            <path key={i} d={transitionD}
              stroke={PHASE_COLORS[seg.phase]} strokeWidth={2.5}
              fill="none" strokeLinecap="round" strokeLinejoin="round"
              opacity={0.9} />
          );
        })}

        {/* Glow on REM segments */}
        {segments.filter(s => s.phase === 'rem').map((seg, i) => (
          <line key={`glow-${i}`} x1={seg.x1} x2={seg.x2} y1={seg.y} y2={seg.y}
            stroke={PHASE_COLORS.rem} strokeWidth={6} opacity={0.15} strokeLinecap="round" />
        ))}

        {/* Time labels */}
        {labels.map((l, i) => (
          <text key={i} x={l.x} y={H + 16} textAnchor="middle"
            fill="rgba(255,255,255,0.25)" fontSize="10" fontFamily="system-ui">
            {l.text}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ── Phase Legend Row ────────────────────────────────────── */

function PhaseLegend({ phase, minutes, totalMinutes }: {
  phase: string;
  minutes: number;
  totalMinutes: number;
}) {
  const pct = totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5 min-w-[140px]">
      <div className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: PHASE_COLORS[phase as keyof typeof PHASE_COLORS] }} />
      <span className="text-xs text-body">{PHASE_LABELS[phase]}</span>
      <span className="text-xs font-medium text-body ml-auto">{fmtDuration(minutes)}</span>
      <span className="text-[10px] text-muted w-8 text-right">{pct}%</span>
    </div>
  );
}

/* ── Main Widget ────────────────────────────────────────── */

export function SleepWidget() {
  const [report, setReport] = useState<MorningReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get('/health/sleep/morning-report')
      .then(res => setReport(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  /* Loading state */
  if (loading) {
    return (
      <div className="p-7 rounded-2xl bg-card border border-border-default">
        <div className="flex items-center gap-3 mb-6">
          <Moon size={18} className="text-indigo-400" />
          <span className="text-sm font-medium text-tertiary uppercase tracking-widest">Sonno</span>
        </div>
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-border-hover border-t-indigo-400/60 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  /* No data / error */
  if (error || !report?.session) {
    return (
      <div className="p-7 rounded-2xl bg-card border border-border-default">
        <div className="flex items-center gap-3 mb-6">
          <Moon size={18} className="text-indigo-400" />
          <span className="text-sm font-medium text-tertiary uppercase tracking-widest">Sonno</span>
        </div>
        <p className="text-sm text-muted">Nessun dato sul sonno disponibile.</p>
        <p className="text-xs text-muted mt-1.5">I dati verranno sincronizzati da Health Auto Export.</p>
      </div>
    );
  }

  const s = report.session;
  const sleepStart = new Date(s.sleep_start);
  const sleepEnd = new Date(s.sleep_end);
  const totalPhaseMin = s.awake_minutes + s.light_minutes + s.deep_minutes + s.rem_minutes;
  const inBed = s.time_in_bed_minutes ?? s.duration_minutes;

  return (
    <div className="p-7 rounded-2xl bg-card border border-border-default hover:bg-surface-hover hover:border-border-hover transition-all duration-200">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Moon size={18} className="text-indigo-400" />
        <span className="text-sm font-medium text-indigo-400/80 uppercase tracking-widest">Sonno</span>
        <span className="text-xs text-muted ml-auto capitalize">{s.source.replace(/_/g, ' ')}</span>
      </div>

      {/* Top section: Ring + Stats */}
      <div className="flex items-center gap-6 mb-6">
        <QualityRing score={s.quality_score ?? 0} size={110} />
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-2xl font-semibold text-heading leading-none">
              {fmtDuration(inBed)}
            </p>
            <p className="text-xs text-tertiary mt-1">A letto</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-heading leading-none">
              {fmtDuration(s.duration_minutes)}
            </p>
            <p className="text-xs text-tertiary mt-1">Addormentato</p>
          </div>
          {s.sleep_efficiency != null && (
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400/80 transition-all duration-700"
                  style={{ width: `${Math.min(s.sleep_efficiency, 100)}%` }} />
              </div>
              <span className="text-[11px] text-emerald-400 font-medium">
                {Math.round(s.sleep_efficiency)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Hypnogram */}
      {s.phases && s.phases.length > 0 && (
        <div className="mb-4 -mx-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-tertiary font-medium">Fasi del sonno</span>
          </div>
          <Hypnogram phases={s.phases} sleepStart={sleepStart} sleepEnd={sleepEnd} />
        </div>
      )}

      {/* Phase legend */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-2 mb-6 px-1">
        <PhaseLegend phase="awake" minutes={s.awake_minutes} totalMinutes={totalPhaseMin} />
        <PhaseLegend phase="rem" minutes={s.rem_minutes} totalMinutes={totalPhaseMin} />
        <PhaseLegend phase="light" minutes={s.light_minutes} totalMinutes={totalPhaseMin} />
        <PhaseLegend phase="deep" minutes={s.deep_minutes} totalMinutes={totalPhaseMin} />
      </div>

      {/* Separator */}
      <div className="border-t border-border-default pt-5">
        {/* Bedtime / wake time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BedDouble size={15} className="text-indigo-400/60" />
            <div>
              <p className="text-xs text-tertiary">Coricato</p>
              <p className="text-base font-semibold text-heading">{fmt(sleepStart)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-right">
            <div>
              <p className="text-xs text-tertiary">Svegliato</p>
              <p className="text-base font-semibold text-heading">{fmt(sleepEnd)}</p>
            </div>
            <AlarmClock size={15} className="text-amber-400/60" />
          </div>
        </div>

        {/* Morning tip */}
        {report.tip && (
          <p className="text-xs text-muted mt-4 italic leading-relaxed">
            💡 {report.tip}
          </p>
        )}

        {/* Streak */}
        {report.streak_days > 1 && (
          <p className="text-xs text-indigo-400/50 mt-2.5">
            🔥 {report.streak_days} notti consecutive tracciate
          </p>
        )}
      </div>
    </div>
  );
}

export default SleepWidget;
