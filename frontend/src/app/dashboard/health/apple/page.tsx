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
  Zap,
  Copy,
  Check,
  Clock,
  Smartphone,
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

// ─── Copy button helper ─────────────────────────────────────────────────────

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded-md transition-colors ${
        copied
          ? 'text-emerald-400 bg-emerald-500/10'
          : 'text-slate-500 hover:text-slate-300 bg-white/[0.03] hover:bg-white/[0.07]'
      } ${className}`}
      title={copied ? 'Copiato!' : 'Copia'}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

// ─── Status Card ────────────────────────────────────────────────────────────

function StatusCard({ status }: { status: AppleHealthStatus }) {
  const lastSync = status.last_shortcut_sync
    ? new Date(status.last_shortcut_sync)
    : null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-pink-950/40 to-slate-900 border border-pink-500/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-pink-400" />
          <h3 className="text-sm font-semibold text-slate-200">Stato dati</h3>
        </div>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Clock size={10} />
              {lastSync.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            status.connected
              ? 'bg-emerald-600/20 text-emerald-300'
              : 'bg-slate-700 text-slate-400'
          }`}>
            {status.connected ? 'Dati presenti' : 'Nessun dato'}
          </span>
        </div>
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
                        <> · {new Date(info.latest).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</>
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
          Nessun dato ancora. Configura il sync automatico oppure importa un file XML.
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
          {result.metrics_imported > 0 && <span>{result.metrics_imported} metriche</span>}
          {result.workouts_imported > 0 && <span>{result.workouts_imported} allenamenti</span>}
          {result.sleep_sessions_imported > 0 && <span>{result.sleep_sessions_imported} sessioni sonno</span>}
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

// ─── Auto-sync section ──────────────────────────────────────────────────────

function AutoSyncSection() {
  const webhookUrl = appleHealthService.getWebhookUrl();

  // The iOS Shortcut JSON body template
  const shortcutBody = JSON.stringify({
    metrics: [
      { type: 'heart_rate', value: '«Var: heart_rate»', unit: 'bpm', recorded_at: '«Var: now_iso»' },
      { type: 'steps', value: '«Var: steps»', unit: 'passi', recorded_at: '«Var: now_iso»' },
      { type: 'weight', value: '«Var: weight»', unit: 'kg', recorded_at: '«Var: now_iso»' },
    ],
  }, null, 2);

  const steps = [
    {
      step: 1,
      title: 'Crea una nuova Automazione',
      detail: 'Apri Comandi (Shortcuts) su iPhone → scheda "Automazione" → "+" → "Ora" → ogni ora',
    },
    {
      step: 2,
      title: 'Aggiungi "Ottieni campioni di salute"',
      detail: 'Cerca l\'azione "Ottieni campioni di salute" e aggiungila per ogni metrica che vuoi sincronizzare (battito, passi, peso…)',
    },
    {
      step: 3,
      title: 'Aggiungi "Ottieni testo dalla richiesta URL"',
      detail: 'Usa l\'azione "Ottieni contenuto URL" con metodo POST, URL qui sotto, header Authorization: Bearer <il-tuo-token> e corpo JSON con i valori delle variabili precedenti',
    },
    {
      step: 4,
      title: 'Imposta il token sul server',
      detail: 'Sul tuo VPS Hetzner, aggiungi APPLE_HEALTH_WEBHOOK_SECRET=<token-segreto> nel file .env del backend e riavvia il container',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Webhook URL */}
      <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap size={15} className="text-yellow-400" />
          <h3 className="text-xs font-semibold text-slate-300">URL webhook</h3>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/30 border border-white/5 font-mono text-[11px] text-emerald-300 break-all">
          <span className="flex-1">{webhookUrl}</span>
          <CopyButton text={webhookUrl} />
        </div>
        <p className="text-[10px] text-slate-500">
          Usa questo URL nell'azione "Ottieni contenuto URL" del tuo Comando iOS.
        </p>
      </div>

      {/* Token reminder */}
      <div className="rounded-xl bg-amber-900/10 border border-amber-700/20 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-300 font-medium">Configura il token segreto</p>
        </div>
        <p className="text-[11px] text-amber-200/60 leading-relaxed">
          Sul server, aggiungi <span className="font-mono bg-black/30 px-1 py-0.5 rounded text-amber-300">APPLE_HEALTH_WEBHOOK_SECRET=tuo_token</span> nel{' '}
          <span className="font-mono text-amber-300">.env</span> del backend, poi riavvia il container.
          Il token viene usato come Bearer header: <span className="font-mono text-amber-300">Authorization: Bearer tuo_token</span>
        </p>
      </div>

      {/* JSON payload example */}
      <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-blue-400" />
            <h3 className="text-xs font-semibold text-slate-300">Struttura JSON da inviare</h3>
          </div>
          <CopyButton text={`{"metrics":[{"type":"heart_rate","value":72,"unit":"bpm","recorded_at":"${new Date().toISOString()}"},{"type":"steps","value":8500,"unit":"passi","recorded_at":"${new Date().toISOString()}"}]}`} />
        </div>
        <pre className="text-[10px] text-slate-400 bg-black/30 rounded-lg p-3 overflow-x-auto leading-relaxed">
{`{
  "metrics": [
    {
      "type": "heart_rate",
      "value": 72,
      "unit": "bpm",
      "recorded_at": "2026-04-06T10:00:00+02:00"
    },
    {
      "type": "steps",
      "value": 8500,
      "unit": "passi",
      "recorded_at": "2026-04-06T10:00:00+02:00"
    }
  ]
}`}
        </pre>
        <p className="text-[10px] text-slate-500">
          Tipi supportati: <span className="font-mono">heart_rate</span>, <span className="font-mono">steps</span>, <span className="font-mono">weight</span>, <span className="font-mono">calories</span>, <span className="font-mono">blood_pressure</span>, <span className="font-mono">oxygen</span>, <span className="font-mono">temperature</span>
        </p>
      </div>

      {/* Step-by-step guide */}
      <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone size={15} className="text-pink-400" />
          <h3 className="text-xs font-semibold text-slate-300">Guida configurazione iOS Shortcut</h3>
        </div>
        <ol className="space-y-3">
          {steps.map(({ step, title, detail }) => (
            <li key={step} className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-bold flex items-center justify-center mt-0.5">
                {step}
              </span>
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-slate-200">{title}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

type Tab = 'auto' | 'manual';

export default function AppleHealthPage() {
  const [status, setStatus] = useState<AppleHealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<AppleHealthImportResponse | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('auto');
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

      <main className="max-w-xl mx-auto px-4 py-6 space-y-5">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200"><X size={16} /></button>
          </div>
        )}

        {/* Status overview */}
        {status && <StatusCard status={status} />}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/5">
          <button
            onClick={() => setActiveTab('auto')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'auto'
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Zap size={13} /> Sync automatico
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'manual'
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Upload size={13} /> Import manuale
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'auto' ? (
          <AutoSyncSection />
        ) : (
          <>
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

            {importResult && <ImportResultCard result={importResult} />}

            {/* Export instructions */}
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-blue-400" />
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Come esportare da Apple Salute</h3>
              </div>
              <ol className="space-y-2 text-xs text-slate-400">
                {[
                  'Apri l\'app Salute su iPhone',
                  'Tocca la tua foto profilo in alto a destra',
                  'Scorri fino a "Esporta tutti i dati sanitari"',
                  'Condividi il file ZIP risultante e caricalo qui',
                ].map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-slate-600 font-mono w-5 text-right flex-shrink-0">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p className="text-[10px] text-slate-600">
                Supportati: battito cardiaco, passi, peso, calorie, pressione, ossigeno, temperatura
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
