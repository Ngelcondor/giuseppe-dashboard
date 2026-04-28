'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { EditorialPage } from '@/components/ui/EditorialPage';
import {
  ArrowLeft,
  Pill,
  Check,
  X,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Circle,
  SkipForward,
  Trash2,
  Edit3,
  Download,
  History,
  Heart,
  Copy,
  ExternalLink,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import medicationService, {
  MedicationResponse,
  MedicationScheduleItem,
  MedicationTodayResponse,
  MedicationCreate,
  MedicationLogResponse,
  MedicationStatsResponse,
} from '@/services/medicationService';
import appleHealthService from '@/services/appleHealthService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeLabel(time: string): string {
  const map: Record<string, string> = {
    '08:30': '🌅 Mattina — 08:30',
    '21:00': '🌆 Sera — 21:00',
    '23:30': '🌙 Notte — 23:30',
  };
  return map[time] || `🕐 ${time}`;
}

function timeSortKey(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// ─── Error Banner ────────────────────────────────────────────────────────────

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 flex items-start gap-3">
      <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-red-300 flex-1">{message}</p>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-200">
        <X size={16} />
      </button>
    </div>
  );
}

// ─── Medication Card ─────────────────────────────────────────────────────────

function MedCard({
  item,
  onTake,
  onSkip,
  onEdit,
  onDelete,
  onShowHistory,
  loading,
}: {
  item: MedicationScheduleItem;
  onTake: () => void;
  onSkip: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShowHistory: () => void;
  loading: boolean;
}) {
  const med = item.medication;
  const done = item.taken_today;
  const skipped = item.skipped_today;

  return (
    <div
      className={`group relative flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-200 ${
        done
          ? 'bg-emerald-900/15 border-emerald-700/30'
          : skipped
          ? 'bg-amber-900/15 border-amber-700/30 opacity-60'
          : 'bg-card border-border-default hover:border-border-hover'
      }`}
    >
      {/* Status icon */}
      <div className="flex-shrink-0">
        {done ? (
          <CheckCircle2 size={22} className="text-emerald-400" />
        ) : skipped ? (
          <SkipForward size={22} className="text-amber-400" />
        ) : (
          <Circle size={22} className="text-muted" />
        )}
      </div>

      {/* Color dot + icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: (med.color || '#6366F1') + '20' }}
      >
        {med.icon || '💊'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'text-emerald-300 line-through' : 'text-heading'}`}>
          {med.name}
        </p>
        <p className="text-xs text-tertiary mt-0.5">
          {med.dosage}
          {med.notes && <span className="ml-2 text-muted">— {med.notes}</span>}
        </p>
      </div>

      {/* Actions — primary (take/skip) always visible, secondary on hover */}
      {!done && !skipped && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onTake}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition-colors disabled:opacity-30 text-xs font-medium"
          >
            <Check size={16} className="inline -mt-0.5 mr-1" />
            Preso
          </button>
          <button
            onClick={onSkip}
            disabled={loading}
            className="p-1.5 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 transition-colors disabled:opacity-30"
            title="Saltato"
          >
            <SkipForward size={16} />
          </button>
        </div>
      )}
      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={onShowHistory}
          className="p-1.5 rounded-lg bg-card-inner text-body hover:bg-surface-hover transition-colors"
          title="Storico"
        >
          <History size={16} />
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg bg-card-inner text-body hover:bg-surface-hover transition-colors"
          title="Modifica"
        >
          <Edit3 size={16} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-colors"
          title="Elimina"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Taken timestamp */}
      {done && item.last_log && (
        <span className="text-[10px] text-emerald-600 flex-shrink-0">
          {new Date(item.last_log.taken_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

// ─── PRN Card ────────────────────────────────────────────────────────────────

function PRNCard({
  item,
  onTake,
  onShowHistory,
  loading,
}: {
  item: MedicationScheduleItem;
  onTake: () => void;
  onShowHistory: () => void;
  loading: boolean;
}) {
  const med = item.medication;
  const takenCount = item.taken_today ? 1 : 0; // simplified, could track multiple

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-card border border-border-default hover:border-border-hover transition-all">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: (med.color || '#EF4444') + '20' }}
      >
        {med.icon || '🆘'}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-heading">{med.name}</p>
        <p className="text-xs text-tertiary mt-0.5">
          {med.dosage} — al bisogno
          {takenCount > 0 && (
            <span className="ml-2 text-amber-400">
              (preso oggi: {takenCount}x)
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onTake}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-red-600/20 text-red-300 hover:bg-red-600/30 text-xs font-medium transition-colors disabled:opacity-30"
        >
          Registra assunzione
        </button>
        <button
          onClick={onShowHistory}
          className="p-1.5 rounded-lg bg-card text-body hover:bg-surface-hover transition-colors"
          title="Storico"
        >
          <History size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Medication Form Modal ───────────────────────────────────────────────────

function MedFormModal({
  isOpen,
  onClose,
  onSubmit,
  initial,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MedicationCreate) => void;
  initial?: MedicationResponse | null;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<MedicationCreate>({
    name: '',
    dosage: '',
    frequency: 'daily',
    time_of_day: 'mattina',
    scheduled_time: '08:30',
    is_prn: false,
    notes: '',
    color: '#6366F1',
    icon: '💊',
  });

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        dosage: initial.dosage,
        frequency: initial.frequency,
        time_of_day: initial.time_of_day,
        scheduled_time: initial.scheduled_time,
        is_prn: initial.is_prn,
        notes: initial.notes || '',
        color: initial.color || '#6366F1',
        icon: initial.icon || '💊',
      });
    } else {
      setForm({
        name: '',
        dosage: '',
        frequency: 'daily',
        time_of_day: 'mattina',
        scheduled_time: '08:30',
        is_prn: false,
        notes: '',
        color: '#6366F1',
        icon: '💊',
      });
    }
  }, [initial, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? 'Modifica farmaco' : 'Nuovo farmaco'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Annulla
          </Button>
          <Button variant="primary" onClick={() => onSubmit(form)} isLoading={isLoading}>
            {initial ? 'Salva' : 'Aggiungi'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-body mb-1">Nome</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-input border border-border-default text-heading text-sm focus:border-blue-500 focus:outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-body mb-1">Dosaggio</label>
            <input
              type="text"
              value={form.dosage}
              onChange={(e) => setForm({ ...form, dosage: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border-default text-heading text-sm focus:border-blue-500 focus:outline-none"
              placeholder="es. 60mg"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-body mb-1">Frequenza</label>
            <select
              value={form.frequency}
              onChange={(e) => {
                const freq = e.target.value;
                setForm({
                  ...form,
                  frequency: freq,
                  is_prn: freq === 'prn',
                  scheduled_time: freq === 'prn' ? null : form.scheduled_time,
                  time_of_day: freq === 'prn' ? 'al bisogno' : form.time_of_day,
                });
              }}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border-default text-heading text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="daily">Giornaliero</option>
              <option value="twice_daily">Due volte al giorno</option>
              <option value="weekly">Settimanale</option>
              <option value="prn">Al bisogno (PRN)</option>
            </select>
          </div>
        </div>

        {!form.is_prn && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-body mb-1">Orario</label>
              <input
                type="time"
                value={form.scheduled_time || '08:30'}
                onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border-default text-heading text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-body mb-1">Momento</label>
              <select
                value={form.time_of_day}
                onChange={(e) => setForm({ ...form, time_of_day: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border-default text-heading text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="mattina">Mattina</option>
                <option value="pomeriggio">Pomeriggio</option>
                <option value="sera">Sera</option>
                <option value="notte">Notte</option>
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-body mb-1">Colore</label>
            <input
              type="color"
              value={form.color || '#6366F1'}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="w-full h-9 rounded-lg bg-input border border-border-default cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-xs text-body mb-1">Icona</label>
            <input
              type="text"
              value={form.icon || ''}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border-default text-heading text-sm focus:border-blue-500 focus:outline-none text-center"
              placeholder="💊"
              maxLength={4}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-body mb-1">Note</label>
          <textarea
            value={form.notes || ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-input border border-border-default text-heading text-sm focus:border-blue-500 focus:outline-none resize-none"
            rows={2}
            placeholder="Note opzionali..."
          />
        </div>
      </form>
    </Modal>
  );
}

// ─── History Modal ───────────────────────────────────────────────────────────

function HistoryModal({
  isOpen,
  onClose,
  medication,
  logs,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  medication: MedicationResponse | null;
  logs: MedicationLogResponse[];
  isLoading: boolean;
}) {
  if (!medication) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Storico — ${medication.name}`} size="md">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-tertiary text-center py-8">Nessun log registrato.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                log.skipped ? 'bg-amber-900/10' : 'bg-emerald-900/10'
              }`}
            >
              {log.skipped ? (
                <SkipForward size={16} className="text-amber-400" />
              ) : (
                <CheckCircle2 size={16} className="text-emerald-400" />
              )}
              <div className="flex-1">
                <p className="text-xs text-heading">
                  {new Date(log.taken_at).toLocaleDateString('it-IT', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  {' — '}
                  {new Date(log.taken_at).toLocaleTimeString('it-IT', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {log.notes && <p className="text-[11px] text-tertiary mt-0.5">{log.notes}</p>}
              </div>
              <span className={`text-[10px] ${log.skipped ? 'text-amber-500' : 'text-emerald-500'}`}>
                {log.skipped ? 'Saltato' : 'Preso'}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ─── Stats Panel ────────────────────────────────────────────────────────────

function AdherenceBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 bg-card-solid rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function StatsPanel({
  stats,
  loading,
  onPrev,
  onNext,
}: {
  stats: MedicationStatsResponse | null;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <BarChart3 size={32} className="text-tertiary mx-auto mb-3" />
        <p className="text-sm text-tertiary">Nessun dato statistico disponibile</p>
      </div>
    );
  }

  const adherenceColor = (pct: number) =>
    pct >= 90 ? '#10B981' : pct >= 70 ? '#F59E0B' : '#EF4444';

  return (
    <div className="space-y-6">
      {/* Period navigation */}
      <div className="flex items-center justify-between">
        <button onClick={onPrev} className="p-2 rounded-lg bg-card text-body hover:bg-surface-hover transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-heading">{stats.period_label}</h3>
          <p className="text-[11px] text-tertiary">{stats.total_days} giorni</p>
        </div>
        <button onClick={onNext} className="p-2 rounded-lg bg-card text-body hover:bg-surface-hover transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Overall adherence card */}
      <div className="px-5 py-4 rounded-xl bg-card border border-border-default">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: adherenceColor(stats.overall_adherence_pct) + '20' }}
          >
            <TrendingUp size={20} style={{ color: adherenceColor(stats.overall_adherence_pct) }} />
          </div>
          <div>
            <p className="text-xs text-tertiary">Aderenza complessiva</p>
            <p className="text-2xl font-bold text-heading">{stats.overall_adherence_pct}%</p>
          </div>
        </div>
        <AdherenceBar pct={stats.overall_adherence_pct} color={adherenceColor(stats.overall_adherence_pct)} />
      </div>

      {/* Per-medication stats */}
      {stats.scheduled_stats.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-body uppercase tracking-wider mb-3 px-1">
            Farmaci schedulati
          </h4>
          <div className="space-y-3">
            {stats.scheduled_stats.map((item) => (
              <div
                key={item.medication_id}
                className="px-4 py-3 rounded-xl bg-card border border-border-default"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: (item.color || '#6366F1') + '20' }}
                  >
                    {item.icon || '💊'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-heading">{item.name} {item.dosage}</p>
                    <p className="text-[11px] text-tertiary">{item.scheduled_time || ''}</p>
                  </div>
                  <span
                    className="text-lg font-bold"
                    style={{ color: adherenceColor(item.adherence_pct) }}
                  >
                    {item.adherence_pct}%
                  </span>
                </div>
                <AdherenceBar pct={item.adherence_pct} color={item.color || '#6366F1'} />
                <div className="flex gap-4 mt-2 text-[11px]">
                  <span className="text-emerald-400">
                    {item.total_taken} prese
                  </span>
                  <span className="text-amber-400">
                    {item.total_skipped} saltate
                  </span>
                  <span className="text-red-400">
                    {item.total_missed} mancate
                  </span>
                  <span className="text-tertiary ml-auto">
                    su {item.total_expected} previste
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PRN stats */}
      {stats.prn_stats.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3 px-1">
            🆘 Farmaci al bisogno (PRN)
          </h4>
          <div className="space-y-3">
            {stats.prn_stats.map((item) => (
              <div
                key={item.medication_id}
                className="px-4 py-3 rounded-xl bg-card border border-border-default"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: (item.color || '#EF4444') + '20' }}
                  >
                    {item.icon || '🆘'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-heading">{item.name} {item.dosage}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-heading">{item.total_intakes}</p>
                    <p className="text-[10px] text-tertiary">assunzioni</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-[11px] text-tertiary">
                  <span>Usato in {item.days_used} giorni</span>
                  {item.avg_per_day_used > 0 && (
                    <span>Media {item.avg_per_day_used}/giorno quando usato</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Total PRN summary */}
          <div className="mt-3 px-4 py-2 rounded-lg bg-red-900/10 border border-red-700/20">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-red-400" />
              <p className="text-xs text-red-300">
                Totale assunzioni al bisogno nel periodo: <strong>{stats.total_prn_intakes}</strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MedicationsPage() {
  const [todayData, setTodayData] = useState<MedicationTodayResponse | null>(null);
  const [allMeds, setAllMeds] = useState<MedicationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [editMed, setEditMed] = useState<MedicationResponse | null>(null);
  const [deleteMed, setDeleteMed] = useState<MedicationResponse | null>(null);
  const [historyMed, setHistoryMed] = useState<MedicationResponse | null>(null);
  const [historyLogs, setHistoryLogs] = useState<MedicationLogResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Tab state
  const [tab, setTab] = useState<'oggi' | 'tutti' | 'stats'>('oggi');

  // Stats state
  const [statsData, setStatsData] = useState<MedicationStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsYear, setStatsYear] = useState<number>(new Date().getFullYear());
  const [statsMonth, setStatsMonth] = useState<number>(new Date().getMonth() + 1);

  // Apple Health sync panel
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [syncUrlCopied, setSyncUrlCopied] = useState(false);

  const handleCopySyncUrl = () => {
    const url = appleHealthService.getMedicationSyncUrl();
    navigator.clipboard.writeText(url).then(() => {
      setSyncUrlCopied(true);
      setTimeout(() => setSyncUrlCopied(false), 2000);
    });
  };

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsOffline(false);

    // Fetch list e today separatamente — se uno fallisce l'altro continua
    let medsOk = false;
    try {
      const meds = await medicationService.list();
      setAllMeds(meds);
      medsOk = true;
    } catch (err: any) {
      console.error('Failed to fetch medications list:', err);
      if (err?.code === 'ERR_NETWORK' || err?.message?.includes('Network')) {
        setIsOffline(true);
      }
      // Non settiamo error qui — proviamo ancora il today
    }

    try {
      const today = await medicationService.getToday();
      setTodayData(today);
    } catch (err: any) {
      console.error('Failed to fetch today schedule:', err);
      if (!medsOk && (err?.code === 'ERR_NETWORK' || err?.message?.includes('Network'))) {
        setIsOffline(true);
      }
      // Se la lista funziona ma il today no, usiamo fallback dal list
      // Non blocchiamo la pagina per questo
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleTake = async (medId: string) => {
    try {
      setActionLoading(true);
      await medicationService.log(medId, {
        medication_id: medId,
        taken_at: new Date().toISOString(),
        skipped: false,
      });
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Errore nella registrazione dell'assunzione");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = async (medId: string) => {
    try {
      setActionLoading(true);
      await medicationService.log(medId, {
        medication_id: medId,
        taken_at: new Date().toISOString(),
        skipped: true,
      });
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Errore nella registrazione dello skip');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async (data: MedicationCreate) => {
    try {
      setActionLoading(true);
      await medicationService.create(data);
      setShowForm(false);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Errore nella creazione del farmaco');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (data: MedicationCreate) => {
    if (!editMed) return;
    try {
      setActionLoading(true);
      await medicationService.update(editMed.id, data);
      setEditMed(null);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Errore nell'aggiornamento del farmaco");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteMed) return;
    try {
      setActionLoading(true);
      await medicationService.delete(deleteMed.id);
      setDeleteMed(null);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Errore nell'eliminazione del farmaco");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeed = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const seeded = await medicationService.seed();
      // Aggiorna subito la lista locale con i dati appena creati
      setAllMeds(seeded);
      // Poi ricarica tutto in background (today schedule, ecc.)
      fetchData().catch(() => {});
    } catch (err: any) {
      console.error('Seed failed:', err);
      if (err?.response?.status === 409) {
        setError('I farmaci sono già stati importati.');
        // Ricarica la lista nel caso ci siano già
        fetchData().catch(() => {});
      } else {
        const detail = err?.response?.data?.detail;
        const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
        setError(msg || "Errore nell'importazione dei farmaci. Controlla che il backend sia raggiungibile e le migrazioni applicate.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleShowHistory = async (med: MedicationResponse) => {
    setHistoryMed(med);
    setHistoryLoading(true);
    try {
      const logs = await medicationService.getLogs(med.id, 30);
      setHistoryLogs(logs);
    } catch (err: any) {
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ─── Stats fetching ────────────────────────────────────────────────────────

  const fetchStats = useCallback(async (y: number, m: number) => {
    setStatsLoading(true);
    try {
      const data = await medicationService.getStats(y, m);
      setStatsData(data);
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
      setStatsData(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch stats when switching to the stats tab or changing month
  useEffect(() => {
    if (tab === 'stats') {
      fetchStats(statsYear, statsMonth);
    }
  }, [tab, statsYear, statsMonth, fetchStats]);

  const handleStatsPrev = () => {
    if (statsMonth === 1) {
      setStatsMonth(12);
      setStatsYear(statsYear - 1);
    } else {
      setStatsMonth(statsMonth - 1);
    }
  };

  const handleStatsNext = () => {
    const now = new Date();
    const nextMonth = statsMonth === 12 ? 1 : statsMonth + 1;
    const nextYear = statsMonth === 12 ? statsYear + 1 : statsYear;
    // Don't allow navigating past current month
    if (nextYear > now.getFullYear() || (nextYear === now.getFullYear() && nextMonth > now.getMonth() + 1)) {
      return;
    }
    setStatsMonth(nextMonth);
    setStatsYear(nextYear);
  };

  // ─── Today Stats ──────────────────────────────────────────────────────────

  const scheduledItems = todayData
    ? Object.values(todayData.scheduled).flat()
    : [];
  const totalScheduled = scheduledItems.length;
  const takenCount = scheduledItems.filter((i) => i.taken_today).length;
  const skippedCount = scheduledItems.filter((i) => i.skipped_today).length;
  const progressPct = totalScheduled > 0 ? Math.round(((takenCount + skippedCount) / totalScheduled) * 100) : 0;

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-page text-heading flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const headerActions = (
    <>
      <button
        onClick={() => setShowSyncPanel(!showSyncPanel)}
        className={`p-2 rounded-lg transition-colors ${
          showSyncPanel
            ? 'bg-red-600/20 text-red-300 hover:bg-red-600/30'
            : 'bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25'
        }`}
        title="Sync Apple Health"
      >
        <Heart size={14} />
      </button>
      <button
        onClick={() => setShowForm(true)}
        className="chip border-accent-soft bg-accent-soft text-accent hover:bg-accent hover:text-white"
        title="Aggiungi farmaco"
      >
        <Plus size={12} /> Aggiungi
      </button>
    </>
  );

  return (
    <EditorialPage
      eyebrow="Therapy"
      title="I tuoi"
      titleAccent="farmaci"
      description="Terapia, dosaggi, PRN. Sincronizzato con Apple Health."
      back="/dashboard/health"
      width="md"
      actions={headerActions}
    >
      <div className="space-y-6">
        {/* Error / Offline banners */}
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {isOffline && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-amber-900/20 border border-amber-700/30 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            <p className="text-sm text-amber-300">Modalità offline — alcune funzioni non disponibili</p>
          </div>
        )}

        {/* Apple Health Sync Panel */}
        {showSyncPanel && (
          <div className="px-4 py-4 rounded-xl bg-emerald-900/10 border border-emerald-700/20 space-y-3">
            <div className="flex items-center gap-2">
              <Heart size={16} className="text-emerald-400" />
              <h3 className="text-sm font-semibold text-emerald-300">Sync con Apple Health</h3>
            </div>
            <p className="text-xs text-body">
              Configura <strong>Health Auto Export</strong> per inviare automaticamente i dati farmaci alla dashboard.
              L'app sincronizza le assunzioni registrate in Apple Salute.
            </p>
            <div className="space-y-2">
              <label className="block text-[11px] text-body uppercase tracking-wider">Webhook URL (Farmaci)</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-input border border-border-default text-[11px] text-heading font-mono truncate">
                  {appleHealthService.getMedicationSyncUrl()}
                </code>
                <button
                  onClick={handleCopySyncUrl}
                  className="p-2 rounded-lg bg-card-solid text-body hover:text-heading hover:bg-surface-hover transition-colors flex-shrink-0"
                  title="Copia URL"
                >
                  {syncUrlCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div className="pt-2 border-t border-border-default">
              <p className="text-[11px] text-body">
                <strong>Setup:</strong> In Health Auto Export → Automations → REST API, incolla l'URL sopra.
                Imposta il metodo su POST, aggiungi header{' '}
                <code className="text-emerald-400/80">Authorization: Bearer &lt;token&gt;</code>{' '}
                con lo stesso APPLE_HEALTH_WEBHOOK_SECRET del server. Abilita "Medications" nei dati da esportare.
              </p>
            </div>
            <a
              href="https://apps.apple.com/us/app/health-auto-export-json-csv/id1115567069"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <ExternalLink size={12} />
              Health Auto Export su App Store
            </a>
          </div>
        )}

        {/* Progress bar */}
        {totalScheduled > 0 && (
          <div className="px-1">
            <div className="flex items-center justify-between text-xs text-tertiary mb-2">
              <span>Progresso di oggi</span>
              <span>{takenCount}/{totalScheduled} presi · {progressPct}%</span>
            </div>
            <div className="h-2 bg-card-solid rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-card rounded-xl border border-border-default">
          {([
            { key: 'oggi' as const, label: 'Oggi' },
            { key: 'tutti' as const, label: 'Tutti' },
            { key: 'stats' as const, label: 'Statistiche' },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.key ? 'bg-indigo-600/30 text-indigo-300' : 'text-tertiary hover:text-body'
              }`}
            >
              {t.key === 'stats' && <BarChart3 size={12} className="inline mr-1 -mt-0.5" />}
              {t.label}
            </button>
          ))}
        </div>

        {/* Empty state + seed — visibile sempre quando non ci sono farmaci */}
        {allMeds.length === 0 && (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center mx-auto mb-4">
              <Pill size={24} className="text-indigo-400" />
            </div>
            <p className="text-sm text-body mb-2">Nessun farmaco registrato</p>
            {isOffline && (
              <p className="text-xs text-amber-400 mb-4">Sei offline — l'importazione richiede connessione al server</p>
            )}
            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="primary" onClick={() => setShowForm(true)} disabled={isOffline}>
                <Plus size={16} className="mr-1" /> Aggiungi
              </Button>
              <Button variant="secondary" onClick={handleSeed} isLoading={actionLoading} disabled={isOffline}>
                <Download size={16} className="mr-1" /> Importa i miei farmaci
              </Button>
            </div>
          </div>
        )}

        {/* TODAY tab */}
        {tab === 'oggi' && allMeds.length > 0 && (
          <div className="space-y-6">
            {todayData ? (
              <>
                {/* Scheduled groups by time — from API today endpoint */}
                {Object.entries(todayData.scheduled)
                  .sort(([a], [b]) => timeSortKey(a) - timeSortKey(b))
                  .map(([time, items]) => (
                    <div key={time}>
                      <h3 className="text-xs font-semibold text-body uppercase tracking-wider mb-3 px-1">
                        {timeLabel(time)}
                      </h3>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <MedCard
                            key={item.medication.id}
                            item={item}
                            onTake={() => handleTake(item.medication.id)}
                            onSkip={() => handleSkip(item.medication.id)}
                            onEdit={() => setEditMed(item.medication)}
                            onDelete={() => setDeleteMed(item.medication)}
                            onShowHistory={() => handleShowHistory(item.medication)}
                            loading={actionLoading}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                {/* PRN section */}
                {todayData.prn.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3 px-1">
                      🆘 Al bisogno (PRN)
                    </h3>
                    <div className="space-y-2">
                      {todayData.prn.map((item) => (
                        <PRNCard
                          key={item.medication.id}
                          item={item}
                          onTake={() => handleTake(item.medication.id)}
                          onShowHistory={() => handleShowHistory(item.medication)}
                          loading={actionLoading}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Fallback: todayData non disponibile, mostra da allMeds raggruppati */
              <>
                {Object.entries(
                  allMeds
                    .filter((m) => m.is_active && !m.is_prn)
                    .reduce<Record<string, MedicationResponse[]>>((acc, med) => {
                      const key = med.scheduled_time || med.time_of_day || 'altro';
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(med);
                      return acc;
                    }, {})
                )
                  .sort(([a], [b]) => timeSortKey(a) - timeSortKey(b))
                  .map(([time, meds]) => (
                    <div key={time}>
                      <h3 className="text-xs font-semibold text-body uppercase tracking-wider mb-3 px-1">
                        {timeLabel(time)}
                      </h3>
                      <div className="space-y-2">
                        {meds.map((med) => (
                          <MedCard
                            key={med.id}
                            item={{ medication: med, taken_today: false, skipped_today: false, last_log: null }}
                            onTake={() => handleTake(med.id)}
                            onSkip={() => handleSkip(med.id)}
                            onEdit={() => setEditMed(med)}
                            onDelete={() => setDeleteMed(med)}
                            onShowHistory={() => handleShowHistory(med)}
                            loading={actionLoading}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                {/* PRN fallback */}
                {allMeds.filter((m) => m.is_prn).length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3 px-1">
                      🆘 Al bisogno (PRN)
                    </h3>
                    <div className="space-y-2">
                      {allMeds.filter((m) => m.is_prn).map((med) => (
                        <PRNCard
                          key={med.id}
                          item={{ medication: med, taken_today: false, skipped_today: false, last_log: null }}
                          onTake={() => handleTake(med.id)}
                          onShowHistory={() => handleShowHistory(med)}
                          loading={actionLoading}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="px-4 py-2 rounded-lg bg-amber-900/10 border border-amber-700/20">
                  <p className="text-[11px] text-amber-400/70">
                    Lo stato di assunzione di oggi non è disponibile. I farmaci vengono mostrati dalla lista.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* STATS tab */}
        {tab === 'stats' && allMeds.length > 0 && (
          <StatsPanel
            stats={statsData}
            loading={statsLoading}
            onPrev={handleStatsPrev}
            onNext={handleStatsNext}
          />
        )}

        {/* ALL tab */}
        {tab === 'tutti' && allMeds.length > 0 && (
          <div className="space-y-3">
            {allMeds.map((med) => (
              <div
                key={med.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-card border border-border-default hover:border-border-hover transition-all group"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: (med.color || '#6366F1') + '20' }}
                >
                  {med.icon || '💊'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-heading">{med.name}</p>
                  <p className="text-xs text-tertiary mt-0.5">
                    {med.dosage} · {med.is_prn ? 'Al bisogno' : `${med.scheduled_time || med.time_of_day}`}
                    {!med.is_active && <span className="ml-2 text-red-400">(inattivo)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleShowHistory(med)}
                    className="p-1.5 rounded-lg bg-card text-body hover:bg-surface-hover transition-colors"
                  >
                    <History size={16} />
                  </button>
                  <button
                    onClick={() => setEditMed(med)}
                    className="p-1.5 rounded-lg bg-card text-body hover:bg-surface-hover transition-colors"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteMed(med)}
                    className="p-1.5 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <MedFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreate}
        isLoading={actionLoading}
      />

      <MedFormModal
        isOpen={!!editMed}
        onClose={() => setEditMed(null)}
        onSubmit={handleUpdate}
        initial={editMed}
        isLoading={actionLoading}
      />

      <ConfirmModal
        isOpen={!!deleteMed}
        title="Elimina farmaco"
        message={`Sei sicuro di voler eliminare ${deleteMed?.name}? Questa azione è irreversibile.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteMed(null)}
        isDanger
        isLoading={actionLoading}
      />

      <HistoryModal
        isOpen={!!historyMed}
        onClose={() => {
          setHistoryMed(null);
          setHistoryLogs([]);
        }}
        medication={historyMed}
        logs={historyLogs}
        isLoading={historyLoading}
      />
    </EditorialPage>
  );
}
