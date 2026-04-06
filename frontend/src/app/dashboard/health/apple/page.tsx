'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Watch,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Database,
  RefreshCw,
  Heart,
  Footprints,
  Scale,
  Flame,
  Thermometer,
  Wind,
  Activity,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import appleHealthService, {
  AppleHealthImportResponse,
  AppleHealthStatus,
} from '@/services/appleHealthService';

// ─── Metric type labels ─────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  heart_rate: { label: 'Battito cardiaco', icon: <Heart size={14} />, color: '#EF4444' },
  weight: { label: 'Peso', icon: <Scale size={14} />, color: '#8B5CF6' },
  calories: { label: 'Calorie', icon: <Flame size={14} />, color: '#F59E0B' },
  steps: { label: 'Passi', icon: <Footprints size={14} />, color: '#10B981' },
  blood_pressure: { label: 'Pressione', icon: <Activity size={14} />, color: '#3B82F6' },
  oxygen: { label: 'Ossigeno', icon: <Wind size={14} />, color: '#06B6D4' },
  temperature: { label: 'Temperatura', icon: <Thermometer size={14} />, color: '#F97316' },
};

// ─── Import Status Card ─────────────────────────────────────────────────────

function StatusCard({ status }: { status: AppleHealthStatus }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-pink-950/40 to-slate-900 border border-pink-500/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-pink-400" />
          <h3 className="text-sm font-semibold text-slate-200">Stato dati</h3>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
          status.connected
            ? 'bg-emerald-600/20 text-emerald-300'
            : 'bg-slate-700 text-slate-400'
        }`}>
          {status.connected ? 'Dati importati' : 'Nessun dato'}
        </span>
      </div>

      {status.connected ? (
        <>
          <p className="text-xs text-slate-400">
            {status.total_records.toLocaleString('it-IT')} record totali da Apple Health
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(status.by_type).map(([type, info]) => {
              const cfg = TYPE_LABELS[type];
              if (!cfg) return null;
              return (
                <div
                  key={type}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5"
                >
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300">{cfg.label}</p>
                    <p className="text-[10px] text-slate-500">
                      {info.count.toLocaleString('it-IT')} record
                      {info.latest && (
                        <> · ultimo {new Date(info.latest).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500">
          Importa i tuoi dati da Apple Health per visualizzarli nella dashboard.
        </p>
      )}
    </div>
  );
}

// ─── Import Result Card ─────────────────────────────────────────────────────

function ImportResultCard({ result }: { result: AppleHealthImportResponse }) {
  const total = result.metrics_imported + result.workouts_imported + result.sleep_sessions_imported;
  const hasErrors = result.errors.length > 0;

  return (
    <div className={`rounded-xl border p-4 space-y-2 ${
      hasErrors
        ? 'bg-amber-900/20 border-amber-700/30'
        : 'bg-emerald-900/20 border-emerald-700/30'
    }`}>
      <div className="flex items-center gap-2">
        {hasErrors
          ? <AlertTriangle size={16} className="text-amber-400" />
          : <CheckCircle2 size={16} className="text-emerald-400" />
        }
        <p className="text-sm font-medium text-slate-200">
          {total > 0 ? `Importati ${total.toLocaleString('it-IT')} record` : 'Nessun nuovo dato importato'}
        </p>
      </div>

      {total > 0 && (
        <div className="flex gap-4 text-xs text-slate-400">
          {result.metrics_imported > 0 && (
            <span>{result.metrics_imported} metriche</span>
          )}
          {result.workouts_imported > 0 && (
            <span>{result.workouts_imported} allenamenti</span>
          )}
          {result.sleep_sessions_imported > 0 && (
            <span>{result.sleep_sessions_imported} sessioni sonno</span>
          )}
        </div>
      )}

      {hasErrors && (
        <div className="mt-2">
          <p className="text-[10px] text-amber-400 mb-1">{result.errors.length} errori:</p>
          {result.errors.slice(0, 3).map((e, i) => (
            <p key={i} className="text-[10px] text-amber-300/60 truncate">{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AppleHealthPage() {
  const [status, setStatus] = useState<AppleHealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<AppleHealthImportResponse | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const s = await appleHealthService.getStatus();
      setStatus(s);
    } catch (err: any) {
      console.error('Failed to fetch status:', err);
      setError(err?.response?.data?.detail || 'Errore nel caricamento dello stato');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleFileImport = async (file: File) => {
    if (!file.name.endsWith('.xml') && !file.name.endsWith('.zip')) {
      setError('Formato non supportato. Usa il file export.xml da Apple Salute.');
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setImportResult(null);
      const result = await appleHealthService.importXml(file);
      setImportResult(result);
      await fetchStatus();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Errore durante l'importazione");
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileImport(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileImport(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] text-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100">
      <header className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
        <Link href="/dashboard/health" className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Watch size={18} className="text-pink-400" />
        <h1 className="text-base font-semibold flex-1">Apple Health</h1>
        <button
          onClick={fetchStatus}
          className="p-2 rounded-lg bg-white/[0.03] text-slate-400 hover:text-slate-200 transition-colors"
          title="Aggiorna stato"
        >
          <RefreshCw size={16} />
        </button>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200"><X size={16} /></button>
          </div>
        )}

        {/* Status */}
        {status && <StatusCard status={status} />}

        {/* Import Zone */}
        <div
          className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
            dragActive
              ? 'border-pink-400 bg-pink-600/10'
              : 'border-white/10 hover:border-white/20 bg-white/[0.01]'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          {importing ? (
            <div className="space-y-3">
              <div className="w-10 h-10 border-2 border-pink-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-300">Importazione in corso...</p>
              <p className="text-xs text-slate-500">I file grandi possono richiedere qualche minuto</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload size={32} className={`mx-auto ${dragActive ? 'text-pink-400' : 'text-slate-600'}`} />
              <div>
                <p className="text-sm text-slate-300">
                  Trascina qui il file <span className="font-mono text-pink-400">export.xml</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">oppure</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText size={14} className="mr-1" /> Seleziona file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,.zip"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Import Result */}
        {importResult && <ImportResultCard result={importResult} />}

        {/* Instructions */}
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-blue-400" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Come esportare da Apple Salute</h3>
          </div>
          <ol className="space-y-2 text-xs text-slate-400">
            <li className="flex gap-2">
              <span className="text-slate-600 font-mono w-5 text-right flex-shrink-0">1.</span>
              <span>Apri l'app <strong className="text-slate-300">Salute</strong> su iPhone</span>
            </li>
            <li className="flex gap-2">
              <span className="text-slate-600 font-mono w-5 text-right flex-shrink-0">2.</span>
              <span>Tocca la tua <strong className="text-slate-300">foto profilo</strong> in alto a destra</span>
            </li>
            <li className="flex gap-2">
              <span className="text-slate-600 font-mono w-5 text-right flex-shrink-0">3.</span>
              <span>Scorri fino a <strong className="text-slate-300">Esporta tutti i dati sanitari</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="text-slate-600 font-mono w-5 text-right flex-shrink-0">4.</span>
              <span>Condividi il file ZIP risultante e caricalo qui</span>
            </li>
          </ol>
          <p className="text-[10px] text-slate-600 mt-2">
            Supportati: battito cardiaco, passi, peso, calorie, pressione, ossigeno, temperatura
          </p>
        </div>
      </main>
    </div>
  );
}
