'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import medicationService, {
  MedicationResponse,
  MedicationScheduleItem,
  MedicationTodayResponse,
  MedicationCreate,
  MedicationLogResponse,
} from '@/services/medicationService';

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
          : 'bg-white/[0.02] border-white/5 hover:border-white/10'
      }`}
    >
      {/* Status icon */}
      <div className="flex-shrink-0">
        {done ? (
          <CheckCircle2 size={22} className="text-emerald-400" />
        ) : skipped ? (
          <SkipForward size={22} className="text-amber-400" />
        ) : (
          <Circle size={22} className="text-slate-600" />
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
        <p className={`text-sm font-medium ${done ? 'text-emerald-300 line-through' : 'text-slate-200'}`}>
          {med.name}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {med.dosage}
          {med.notes && <span className="ml-2 text-slate-600">— {med.notes}</span>}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!done && !skipped && (
          <>
            <button
              onClick={onTake}
              disabled={loading}
              className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition-colors disabled:opacity-30"
              title="Preso"
            >
              <Check size={16} />
            </button>
            <button
              onClick={onSkip}
              disabled={loading}
              className="p-1.5 rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 transition-colors disabled:opacity-30"
              title="Saltato"
            >
              <SkipForward size={16} />
            </button>
          </>
        )}
        <button
          onClick={onShowHistory}
          className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"
          title="Storico"
        >
          <History size={16} />
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"
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
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: (med.color || '#EF4444') + '20' }}
      >
        {med.icon || '🆘'}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{med.name}</p>
        <p className="text-xs text-slate-500 mt-0.5">
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
          className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"
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
          <label className="block text-xs text-slate-400 mb-1">Nome</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Dosaggio</label>
            <input
              type="text"
              value={form.dosage}
              onChange={(e) => setForm({ ...form, dosage: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="es. 60mg"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Frequenza</label>
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
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
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
              <label className="block text-xs text-slate-400 mb-1">Orario</label>
              <input
                type="time"
                value={form.scheduled_time || '08:30'}
                onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Momento</label>
              <select
                value={form.time_of_day}
                onChange={(e) => setForm({ ...form, time_of_day: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
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
            <label className="block text-xs text-slate-400 mb-1">Colore</label>
            <input
              type="color"
              value={form.color || '#6366F1'}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="w-full h-9 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Icona</label>
            <input
              type="text"
              value={form.icon || ''}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none text-center"
              placeholder="💊"
              maxLength={4}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Note</label>
          <textarea
            value={form.notes || ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm focus:border-blue-500 focus:outline-none resize-none"
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
        <p className="text-sm text-slate-500 text-center py-8">Nessun log registrato.</p>
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
                <p className="text-xs text-slate-300">
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
                {log.notes && <p className="text-[11px] text-slate-500 mt-0.5">{log.notes}</p>}
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
  const [tab, setTab] = useState<'oggi' | 'tutti'>('oggi');

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

  // ─── Stats ─────────────────────────────────────────────────────────────────

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
      <div className="min-h-screen bg-[#0f1117] text-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100">
      {/* Header */}
      <header className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
        <Link href="/dashboard/health" className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Pill size={18} className="text-indigo-400" />
        <h1 className="text-base font-semibold flex-1">Farmaci</h1>
        <button
          onClick={() => setShowForm(true)}
          className="p-2 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition-colors"
          title="Aggiungi farmaco"
        >
          <Plus size={18} />
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Error / Offline banners */}
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {isOffline && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-amber-900/20 border border-amber-700/30 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            <p className="text-sm text-amber-300">Modalità offline — alcune funzioni non disponibili</p>
          </div>
        )}

        {/* Progress bar */}
        {totalScheduled > 0 && (
          <div className="px-1">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span>Progresso di oggi</span>
              <span>{takenCount}/{totalScheduled} presi · {progressPct}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/5">
          {(['oggi', 'tutti'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t ? 'bg-indigo-600/30 text-indigo-300' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t === 'oggi' ? 'Oggi' : 'Tutti i farmaci'}
            </button>
          ))}
        </div>

        {/* Empty state + seed — visibile sempre quando non ci sono farmaci */}
        {allMeds.length === 0 && (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center mx-auto mb-4">
              <Pill size={24} className="text-indigo-400" />
            </div>
            <p className="text-sm text-slate-400 mb-2">Nessun farmaco registrato</p>
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
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
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
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
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

        {/* ALL tab */}
        {tab === 'tutti' && allMeds.length > 0 && (
          <div className="space-y-3">
            {allMeds.map((med) => (
              <div
                key={med.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: (med.color || '#6366F1') + '20' }}
                >
                  {med.icon || '💊'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{med.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {med.dosage} · {med.is_prn ? 'Al bisogno' : `${med.scheduled_time || med.time_of_day}`}
                    {!med.is_active && <span className="ml-2 text-red-400">(inattivo)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleShowHistory(med)}
                    className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"
                  >
                    <History size={16} />
                  </button>
                  <button
                    onClick={() => setEditMed(med)}
                    className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"
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
      </main>

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
    </div>
  );
}
