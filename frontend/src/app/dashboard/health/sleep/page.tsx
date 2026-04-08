'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Moon,
  Sun,
  Plus,
  Clock,
  AlertTriangle,
  X,
  Brain,
  Eye,
  Flame,
  Calendar,
  Trash2,
  Volume2,
  Heart,
  Timer,
  Zap,
  Shield,
  CloudMoon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import sleepService, {
  SleepSession,
  SleepMorningReport,
  SleepWeekSummary,
  SleepSessionCreate,
} from '@/services/sleepService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function qualityColor(label: string): string {
  switch (label) {
    case 'Ottimo': return 'text-emerald-400';
    case 'Buono': return 'text-blue-400';
    case 'Sufficiente': return 'text-amber-400';
    case 'Scarso': return 'text-red-400';
    default: return 'text-slate-500';
  }
}

function qualityBgColor(label: string): string {
  switch (label) {
    case 'Ottimo': return 'bg-emerald-500';
    case 'Buono': return 'bg-blue-500';
    case 'Sufficiente': return 'bg-amber-500';
    case 'Scarso': return 'bg-red-500';
    default: return 'bg-slate-600';
  }
}

const phaseColors: Record<string, string> = {
  awake: '#EF4444',
  light: '#60A5FA',
  deep: '#6366F1',
  rem: '#A78BFA',
};

const phaseLabels: Record<string, string> = {
  awake: 'Sveglio',
  light: 'Leggero',
  deep: 'Profondo',
  rem: 'REM',
};

// ─── Phase Bar Component ─────────────────────────────────────────────────────

function PhaseBar({
  awake,
  light,
  deep,
  rem,
  total,
}: {
  awake: number;
  light: number;
  deep: number;
  rem: number;
  total: number;
}) {
  if (total === 0) return null;

  const segments = [
    { phase: 'deep', minutes: deep, color: phaseColors.deep },
    { phase: 'rem', minutes: rem, color: phaseColors.rem },
    { phase: 'light', minutes: light, color: phaseColors.light },
    { phase: 'awake', minutes: awake, color: phaseColors.awake },
  ];

  return (
    <div className="space-y-2">
      <div className="h-4 rounded-full overflow-hidden flex bg-card-solid">
        {segments.map((seg) => (
          <div
            key={seg.phase}
            className="h-full transition-all duration-500"
            style={{
              width: `${(seg.minutes / total) * 100}%`,
              backgroundColor: seg.color,
            }}
            title={`${phaseLabels[seg.phase]}: ${formatDuration(seg.minutes)}`}
          />
        ))}
      </div>
      <div className="flex gap-4 text-[10px] text-tertiary">
        {segments.map((seg) => (
          <div key={seg.phase} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
            <span>{phaseLabels[seg.phase]} {Math.round((seg.minutes / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Morning Report Card ─────────────────────────────────────────────────────

function MorningReportCard({ report }: { report: SleepMorningReport }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-950/50 to-slate-900 border border-indigo-500/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sun size={18} className="text-amber-400" />
          <h3 className="text-sm font-semibold text-heading">Buongiorno</h3>
        </div>
        {report.streak_days > 0 && (
          <span className="text-[10px] bg-indigo-600/20 text-indigo-300 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Flame size={10} /> {report.streak_days}g streak
          </span>
        )}
      </div>

      {report.session ? (
        <>
          {/* Quality + Duration */}
          <div className="flex items-center gap-6">
            <div>
              <p className={`text-2xl font-bold ${qualityColor(report.quality_label)}`}>
                {report.quality_label}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Qualità del sonno
              </p>
            </div>
            <div className="h-10 w-px bg-slate-700" />
            <div>
              <p className="text-2xl font-bold text-heading">
                {report.total_hours}h
              </p>
              <p className="text-xs text-tertiary mt-0.5">Durata totale</p>
            </div>
            <div className="h-10 w-px bg-border-default" />
            <div>
              <p className="text-2xl font-bold text-heading">
                {report.efficiency_pct}%
              </p>
              <p className="text-xs text-tertiary mt-0.5">Efficienza</p>
            </div>
          </div>

          {/* Phase bar */}
          {report.session && (
            <PhaseBar
              awake={report.session.awake_minutes}
              light={report.session.light_minutes}
              deep={report.session.deep_minutes}
              rem={report.session.rem_minutes}
              total={report.session.duration_minutes}
            />
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl p-3 text-center">
              <Brain size={16} className="text-indigo-400 mx-auto mb-1" />
              <p className="text-sm font-semibold text-heading">{report.deep_pct}%</p>
              <p className="text-[10px] text-tertiary">Profondo</p>
            </div>
            <div className="bg-card rounded-xl p-3 text-center">
              <Eye size={16} className="text-purple-400 mx-auto mb-1" />
              <p className="text-sm font-semibold text-heading">{report.rem_pct}%</p>
              <p className="text-[10px] text-tertiary">REM</p>
            </div>
            <div className="bg-card rounded-xl p-3 text-center">
              <Clock size={16} className="text-blue-400 mx-auto mb-1" />
              <p className="text-sm font-semibold text-heading">
                {report.session
                  ? new Date(report.session.sleep_start).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                  : '--'}
                {' → '}
                {report.session
                  ? new Date(report.session.sleep_end).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                  : '--'}
              </p>
              <p className="text-[10px] text-tertiary">Orari</p>
            </div>
          </div>

          {/* Sleep Cycle extras in morning report */}
          {report.session?.source === 'sleep_cycle' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {report.session.sc_quality_score != null && (
                <div className="bg-cyan-900/10 border border-cyan-800/20 rounded-xl p-2.5 text-center">
                  <Shield size={14} className="text-cyan-400 mx-auto mb-1" />
                  <p className="text-sm font-semibold text-cyan-300">{report.session.sc_quality_score}%</p>
                  <p className="text-[9px] text-slate-500">SC Quality</p>
                </div>
              )}
              {report.session.snoring_minutes != null && (
                <div className="bg-orange-900/10 border border-orange-800/20 rounded-xl p-2.5 text-center">
                  <Volume2 size={14} className="text-orange-400 mx-auto mb-1" />
                  <p className="text-sm font-semibold text-orange-300">
                    {report.session.snoring_minutes}m
                    {report.session.snoring_pct != null && (
                      <span className="text-[10px] text-orange-400/60 ml-1">({report.session.snoring_pct}%)</span>
                    )}
                  </p>
                  <p className="text-[9px] text-slate-500">Russamento</p>
                </div>
              )}
              {report.session.heart_rate_lowest != null && (
                <div className="bg-rose-900/10 border border-rose-800/20 rounded-xl p-2.5 text-center">
                  <Heart size={14} className="text-rose-400 mx-auto mb-1" />
                  <p className="text-sm font-semibold text-rose-300">{report.session.heart_rate_lowest} bpm</p>
                  <p className="text-[9px] text-slate-500">FC minima</p>
                </div>
              )}
              {report.session.regularity_score != null && (
                <div className="bg-emerald-900/10 border border-emerald-800/20 rounded-xl p-2.5 text-center">
                  <Zap size={14} className="text-emerald-400 mx-auto mb-1" />
                  <p className="text-sm font-semibold text-emerald-300">{report.session.regularity_score}%</p>
                  <p className="text-[9px] text-slate-500">Regolarità</p>
                </div>
              )}
            </div>
          )}

          {/* Tip */}
          {report.tip && (
            <div className="bg-amber-900/10 border border-amber-700/20 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-300/80 leading-relaxed">{report.tip}</p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-6">
          <Moon size={24} className="text-muted mx-auto mb-2" />
          <p className="text-sm text-tertiary">Nessun dato per la notte scorsa</p>
          <p className="text-xs text-muted mt-1">Registra una sessione di sonno per vedere il report</p>
        </div>
      )}
    </div>
  );
}

// ─── Session Card ────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onDelete,
}: {
  session: SleepSession;
  onDelete: () => void;
}) {
  const dateStr = new Date(session.sleep_start).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const startTime = new Date(session.sleep_start).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const endTime = new Date(session.sleep_end).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const total = session.awake_minutes + session.light_minutes + session.deep_minutes + session.rem_minutes;

  const score = session.quality_score || 0;
  let label = 'N/D';
  if (score >= 85) label = 'Ottimo';
  else if (score >= 70) label = 'Buono';
  else if (score >= 50) label = 'Sufficiente';
  else if (score > 0) label = 'Scarso';

  const isSleepCycle = session.source === 'sleep_cycle';

  return (
    <div className="rounded-xl bg-card border border-border-default hover:border-border-hover p-4 transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-8 rounded-full ${qualityBgColor(label)}`} />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-heading">{dateStr}</p>
              {isSleepCycle && (
                <span className="text-[9px] bg-cyan-600/20 text-cyan-300 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <CloudMoon size={9} /> Sleep Cycle
                </span>
              )}
            </div>
            <p className="text-xs text-tertiary">
              {startTime} → {endTime} · {formatDuration(session.duration_minutes)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.quality_score && (
            <span className={`text-xs font-semibold ${qualityColor(label)}`}>
              {session.quality_score}/100
            </span>
          )}
          <button
            onClick={onDelete}
            className="p-1 rounded-lg opacity-0 group-hover:opacity-100 bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-all"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {total > 0 && (
        <PhaseBar
          awake={session.awake_minutes}
          light={session.light_minutes}
          deep={session.deep_minutes}
          rem={session.rem_minutes}
          total={total}
        />
      )}

      {/* Sleep Cycle extra data */}
      {isSleepCycle && (session.sc_quality_score || session.snoring_minutes !== null || session.heart_rate_lowest) && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {session.sc_quality_score != null && (
            <div className="bg-cyan-900/10 border border-cyan-800/20 rounded-lg px-2.5 py-1.5 text-center">
              <Shield size={12} className="text-cyan-400 mx-auto mb-0.5" />
              <p className="text-xs font-semibold text-cyan-300">{session.sc_quality_score}%</p>
              <p className="text-[9px] text-slate-500">SC Quality</p>
            </div>
          )}
          {session.snoring_minutes != null && session.snoring_minutes > 0 && (
            <div className="bg-orange-900/10 border border-orange-800/20 rounded-lg px-2.5 py-1.5 text-center">
              <Volume2 size={12} className="text-orange-400 mx-auto mb-0.5" />
              <p className="text-xs font-semibold text-orange-300">{session.snoring_minutes}m</p>
              <p className="text-[9px] text-slate-500">Russamento</p>
            </div>
          )}
          {session.heart_rate_lowest != null && (
            <div className="bg-rose-900/10 border border-rose-800/20 rounded-lg px-2.5 py-1.5 text-center">
              <Heart size={12} className="text-rose-400 mx-auto mb-0.5" />
              <p className="text-xs font-semibold text-rose-300">{session.heart_rate_lowest} bpm</p>
              <p className="text-[9px] text-slate-500">FC min</p>
            </div>
          )}
          {session.steps_to_sleep != null && (
            <div className="bg-violet-900/10 border border-violet-800/20 rounded-lg px-2.5 py-1.5 text-center">
              <Timer size={12} className="text-violet-400 mx-auto mb-0.5" />
              <p className="text-xs font-semibold text-violet-300">{session.steps_to_sleep}m</p>
              <p className="text-[9px] text-slate-500">Addormentamento</p>
            </div>
          )}
        </div>
      )}

      {session.notes && (
        <p className="text-[11px] text-tertiary mt-2 italic">{session.notes}</p>
      )}
    </div>
  );
}

// ─── Manual Entry Form Modal ─────────────────────────────────────────────────

function SleepFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SleepSessionCreate) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({
    sleepDate: new Date().toISOString().split('T')[0],
    sleepTime: '23:30',
    wakeTime: '07:30',
    quality: 75,
    deepMin: 60,
    remMin: 90,
    lightMin: 180,
    awakeMin: 15,
    mood: 'good',
    notes: '',
  });

  const totalMin = form.deepMin + form.remMin + form.lightMin + form.awakeMin;

  const handleSubmit = () => {
    const sleepStart = new Date(`${form.sleepDate}T${form.sleepTime}:00`);
    const wakeDate = new Date(sleepStart);
    const [wH, wM] = form.wakeTime.split(':').map(Number);
    const [sH] = form.sleepTime.split(':').map(Number);
    if (wH < sH) wakeDate.setDate(wakeDate.getDate() + 1);
    wakeDate.setHours(wH, wM, 0, 0);

    const durationMin = Math.round((wakeDate.getTime() - sleepStart.getTime()) / 60000);

    onSubmit({
      sleep_start: sleepStart.toISOString(),
      sleep_end: wakeDate.toISOString(),
      duration_minutes: durationMin,
      quality_score: form.quality,
      time_in_bed_minutes: durationMin + 15,
      sleep_efficiency: Math.round((totalMin / (durationMin + 15)) * 100),
      awake_minutes: form.awakeMin,
      light_minutes: form.lightMin,
      deep_minutes: form.deepMin,
      rem_minutes: form.remMin,
      source: 'manual',
      mood_on_wake: form.mood,
      notes: form.notes || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registra sonno" size="md" footer={
      <>
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>Annulla</Button>
        <Button variant="primary" onClick={handleSubmit} isLoading={isLoading}>Salva</Button>
      </>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-body mb-1">Data</label>
            <input type="date" value={form.sleepDate} onChange={e => setForm({...form, sleepDate: e.target.value})}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border-default text-heading text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-body mb-1">Addormentato</label>
            <input type="time" value={form.sleepTime} onChange={e => setForm({...form, sleepTime: e.target.value})}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border-default text-heading text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-body mb-1">Sveglia</label>
            <input type="time" value={form.wakeTime} onChange={e => setForm({...form, wakeTime: e.target.value})}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border-default text-heading text-sm focus:border-blue-500 focus:outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-body mb-1">Qualità ({form.quality}/100)</label>
          <input type="range" min={0} max={100} value={form.quality} onChange={e => setForm({...form, quality: Number(e.target.value)})}
            className="w-full accent-indigo-500" />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { key: 'deepMin', label: 'Profondo', color: '#6366F1' },
            { key: 'remMin', label: 'REM', color: '#A78BFA' },
            { key: 'lightMin', label: 'Leggero', color: '#60A5FA' },
            { key: 'awakeMin', label: 'Sveglio', color: '#EF4444' },
          ].map(({ key, label, color }) => (
            <div key={key}>
              <label className="block text-[10px] mb-1" style={{ color }}>{label} (min)</label>
              <input type="number" min={0} max={600} value={(form as any)[key]}
                onChange={e => setForm({...form, [key]: Number(e.target.value)})}
                className="w-full px-2 py-1.5 rounded-lg bg-input border border-border-default text-heading text-xs focus:border-blue-500 focus:outline-none text-center" />
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted text-center">Totale fasi: {formatDuration(totalMin)}</p>

        <div>
          <label className="block text-xs text-body mb-1">Umore al risveglio</label>
          <div className="flex gap-2">
            {[
              { value: 'great', emoji: '😊' },
              { value: 'good', emoji: '🙂' },
              { value: 'okay', emoji: '😐' },
              { value: 'bad', emoji: '😔' },
              { value: 'terrible', emoji: '😩' },
            ].map(({ value, emoji }) => (
              <button key={value} onClick={() => setForm({...form, mood: value})}
                className={`flex-1 py-2 rounded-lg text-lg transition-all ${
                  form.mood === value ? 'bg-indigo-600/30 border border-indigo-500/30 scale-110' : 'bg-card border border-border-default'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-body mb-1">Note</label>
          <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
            className="w-full px-3 py-2 rounded-lg bg-input border border-border-default text-heading text-sm focus:border-blue-500 focus:outline-none resize-none"
            rows={2} placeholder="Come ti sei sentito..." />
        </div>
      </div>
    </Modal>
  );
}

// ─── Week Summary Card ───────────────────────────────────────────────────────

function WeekSummaryCard({ summary }: { summary: SleepWeekSummary }) {
  if (summary.sessions.length === 0) return null;

  return (
    <div className="rounded-xl bg-card border border-border-default p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Calendar size={16} className="text-blue-400" />
        <h3 className="text-xs font-semibold text-body uppercase tracking-wider">Riepilogo settimanale</h3>
      </div>
      <div className="grid grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-lg font-bold text-heading">{formatDuration(Math.round(summary.avg_duration_minutes))}</p>
          <p className="text-[10px] text-tertiary">Media durata</p>
        </div>
        <div>
          <p className="text-lg font-bold text-heading">{Math.round(summary.avg_quality)}</p>
          <p className="text-[10px] text-tertiary">Media qualità</p>
        </div>
        <div>
          <p className="text-lg font-bold text-indigo-400">{Math.round(summary.avg_deep_pct)}%</p>
          <p className="text-[10px] text-tertiary">Profondo</p>
        </div>
        <div>
          <p className="text-lg font-bold text-purple-400">{Math.round(summary.avg_rem_pct)}%</p>
          <p className="text-[10px] text-tertiary">REM</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SleepPage() {
  const [report, setReport] = useState<SleepMorningReport | null>(null);
  const [weekSummary, setWeekSummary] = useState<SleepWeekSummary | null>(null);
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteSession, setDeleteSession] = useState<SleepSession | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [r, w, s] = await Promise.all([
        sleepService.getMorningReport(),
        sleepService.getWeekSummary(),
        sleepService.list(14),
      ]);
      setReport(r);
      setWeekSummary(w);
      setSessions(s);
    } catch (err: any) {
      console.error('Failed to fetch sleep data:', err);
      setError(err?.response?.data?.detail || 'Errore nel caricamento dei dati sonno');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: SleepSessionCreate) => {
    try {
      setActionLoading(true);
      await sleepService.create(data);
      setShowForm(false);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Errore nella creazione della sessione');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteSession) return;
    try {
      setActionLoading(true);
      await sleepService.delete(deleteSession.id);
      setDeleteSession(null);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Errore nell'eliminazione");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-page text-heading flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-heading">
      <header className="px-6 py-5 border-b border-border-default flex items-center gap-3">
        <Link href="/dashboard/health" className="text-tertiary hover:text-body transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Moon size={18} className="text-indigo-400" />
        <h1 className="text-base font-semibold flex-1">Sonno</h1>
        <button
          onClick={() => setShowForm(true)}
          className="p-2 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition-colors"
          title="Registra sonno"
        >
          <Plus size={18} />
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200"><X size={16} /></button>
          </div>
        )}

        {/* Morning Report */}
        {report && <MorningReportCard report={report} />}

        {/* Week Summary */}
        {weekSummary && <WeekSummaryCard summary={weekSummary} />}

        {/* History */}
        <div>
          <h3 className="text-xs font-semibold text-body uppercase tracking-wider mb-3 px-1">
            Ultime notti
          </h3>
          {sessions.length === 0 ? (
            <div className="text-center py-10">
              <Moon size={28} className="text-muted mx-auto mb-3" />
              <p className="text-sm text-tertiary">Nessuna sessione registrata</p>
              <Button variant="primary" className="mt-4" onClick={() => setShowForm(true)}>
                <Plus size={16} className="mr-1" /> Registra sonno
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} onDelete={() => setDeleteSession(s)} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <SleepFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreate}
        isLoading={actionLoading}
      />

      <ConfirmModal
        isOpen={!!deleteSession}
        title="Elimina sessione"
        message="Sei sicuro di voler eliminare questa sessione di sonno?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteSession(null)}
        isDanger
        isLoading={actionLoading}
      />
    </div>
  );
}
