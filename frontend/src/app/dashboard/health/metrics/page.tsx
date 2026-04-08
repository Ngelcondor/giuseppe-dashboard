'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Activity,
  Plus,
  Heart,
  Footprints,
  Scale,
  Flame,
  Wind,
  Thermometer,
  X,
  AlertTriangle,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import metricsService, {
  HealthMetric,
  HealthMetricCreate,
  MetricType,
  METRIC_CONFIG,
} from '@/services/metricsService';

// ─── Icon mapper ────────────────────────────────────────────────────────────

const iconMap: Record<string, React.ReactNode> = {
  Heart: <Heart size={18} />,
  Footprints: <Footprints size={18} />,
  Scale: <Scale size={18} />,
  Flame: <Flame size={18} />,
  Activity: <Activity size={18} />,
  Wind: <Wind size={18} />,
  Thermometer: <Thermometer size={18} />,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatValue(value: number, type: MetricType): string {
  if (type === 'weight') return value.toFixed(1);
  if (type === 'temperature') return value.toFixed(1);
  if (type === 'oxygen') return `${Math.round(value)}`;
  if (type === 'steps') return value.toLocaleString('it-IT');
  return Math.round(value).toString();
}

function getTrend(metrics: HealthMetric[]): { direction: 'up' | 'down' | 'stable'; pct: number } {
  if (metrics.length < 2) return { direction: 'stable', pct: 0 };
  const sorted = [...metrics].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
  const recent = sorted.slice(-3);
  const older = sorted.slice(0, Math.min(3, sorted.length - 3));
  if (older.length === 0) return { direction: 'stable', pct: 0 };
  const avgRecent = recent.reduce((s, m) => s + m.value, 0) / recent.length;
  const avgOlder = older.reduce((s, m) => s + m.value, 0) / older.length;
  const pct = avgOlder !== 0 ? ((avgRecent - avgOlder) / avgOlder) * 100 : 0;
  if (Math.abs(pct) < 2) return { direction: 'stable', pct: 0 };
  return { direction: pct > 0 ? 'up' : 'down', pct: Math.abs(Math.round(pct)) };
}

// ─── Metric Card ────────────────────────────────────────────────────────────

function MetricCard({
  type,
  metrics,
  onAdd,
}: {
  type: MetricType;
  metrics: HealthMetric[];
  onAdd: (type: MetricType) => void;
}) {
  const config = METRIC_CONFIG[type];
  const latest = metrics.length > 0
    ? [...metrics].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0]
    : null;
  const trend = getTrend(metrics);

  return (
    <div className="rounded-xl bg-card border border-border-default hover:border-border-hover p-4 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${config.color}15` }}>
            <span style={{ color: config.color }}>{iconMap[config.icon]}</span>
          </div>
          <div>
            <p className="text-xs text-body">{config.label}</p>
            {latest ? (
              <p className="text-lg font-bold text-heading">
                {formatValue(latest.value, type)}
                <span className="text-xs text-tertiary ml-1">{config.unit}</span>
              </p>
            ) : (
              <p className="text-sm text-muted">—</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {trend.direction !== 'stable' && (
            <div className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
              trend.direction === 'up' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'
            }`}>
              {trend.direction === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {trend.pct}%
            </div>
          )}
          <button
            onClick={() => onAdd(type)}
            className="p-1.5 rounded-lg bg-card text-body hover:text-heading hover:bg-surface-hover transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Mini sparkline bar */}
      {metrics.length > 1 && (
        <div className="flex items-end gap-0.5 h-8">
          {[...metrics]
            .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
            .slice(-14)
            .map((m, i) => {
              const values = metrics.map((x) => x.value);
              const min = Math.min(...values);
              const max = Math.max(...values);
              const range = max - min || 1;
              const height = ((m.value - min) / range) * 100;
              return (
                <div
                  key={m.id || i}
                  className="flex-1 rounded-sm transition-all hover:opacity-80"
                  style={{
                    height: `${Math.max(height, 10)}%`,
                    backgroundColor: config.color,
                    opacity: 0.5 + (i / 14) * 0.5,
                  }}
                  title={`${formatValue(m.value, type)} ${config.unit} — ${new Date(m.recorded_at).toLocaleDateString('it-IT')}`}
                />
              );
            })}
        </div>
      )}

      {latest && (
        <p className="text-[10px] text-muted mt-2">
          Ultimo: {new Date(latest.recorded_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {latest.source !== 'manual' && (
            <span className="ml-1 text-muted">· {latest.source}</span>
          )}
        </p>
      )}
    </div>
  );
}

// ─── Add Metric Modal ───────────────────────────────────────────────────────

function AddMetricModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  selectedType,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: HealthMetricCreate) => void;
  isLoading: boolean;
  selectedType: MetricType;
}) {
  const config = METRIC_CONFIG[selectedType];
  const [value, setValue] = useState<number>(config.min);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));

  useEffect(() => {
    // Reset value when type changes
    const defaults: Record<MetricType, number> = {
      heart_rate: 72,
      steps: 5000,
      weight: 70,
      calories: 300,
      blood_pressure: 120,
      oxygen: 98,
      temperature: 36.5,
    };
    setValue(defaults[selectedType] || config.min);
  }, [selectedType, config.min]);

  const handleSubmit = () => {
    onSubmit({
      metric_type: selectedType,
      value,
      unit: config.unit,
      recorded_at: new Date(date).toISOString(),
      source: 'manual',
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Aggiungi ${config.label}`} size="sm" footer={
      <>
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>Annulla</Button>
        <Button variant="primary" onClick={handleSubmit} isLoading={isLoading}>Salva</Button>
      </>
    }>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-body mb-1">Valore ({config.unit})</label>
          <input
            type="number"
            min={config.min}
            max={config.max}
            step={config.step}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-input border border-border-default text-heading text-lg font-semibold focus:border-blue-500 focus:outline-none text-center"
          />
          <input
            type="range"
            min={config.min}
            max={config.max}
            step={config.step}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full mt-2"
            style={{ accentColor: config.color }}
          />
        </div>
        <div>
          <label className="block text-xs text-body mb-1">Data e ora</label>
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-input border border-border-default text-heading text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>
    </Modal>
  );
}

// ─── History Section ────────────────────────────────────────────────────────

function HistorySection({
  metrics,
  onDelete,
}: {
  metrics: HealthMetric[];
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<MetricType | 'all'>('all');

  const filtered = filter === 'all'
    ? metrics
    : metrics.filter((m) => m.metric_type === filter);

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  );

  const metricTypes: MetricType[] = ['heart_rate', 'steps', 'weight', 'calories', 'blood_pressure', 'oxygen', 'temperature'];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-body uppercase tracking-wider">Storico</h3>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${
            filter === 'all' ? 'bg-surface-hover text-heading' : 'bg-card text-tertiary hover:text-body'
          }`}
        >
          Tutti
        </button>
        {metricTypes.map((t) => {
          const cfg = METRIC_CONFIG[t];
          const count = metrics.filter((m) => m.metric_type === t).length;
          if (count === 0) return null;
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${
                filter === t ? 'text-heading' : 'text-tertiary hover:text-body'
              }`}
              style={filter === t ? { backgroundColor: cfg.color } : { backgroundColor: 'rgba(255,255,255,0.03)' }}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-8">
          <Activity size={24} className="text-muted mx-auto mb-2" />
          <p className="text-sm text-tertiary">Nessuna metrica registrata</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.slice(0, 30).map((m) => {
            const cfg = METRIC_CONFIG[m.metric_type as MetricType];
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card border border-border-default group"
              >
                <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: cfg?.color || '#64748b' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-heading">
                    <span className="font-semibold">{formatValue(m.value, m.metric_type as MetricType)}</span>
                    <span className="text-tertiary ml-1 text-xs">{m.unit}</span>
                  </p>
                  <p className="text-[10px] text-muted">
                    {cfg?.label} · {new Date(m.recorded_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {m.source !== 'manual' && ` · ${m.source}`}
                  </p>
                </div>
                <button
                  onClick={() => onDelete(m.id)}
                  className="p-1 rounded-lg opacity-0 group-hover:opacity-100 bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<MetricType>('heart_rate');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await metricsService.list(undefined, 30);
      setMetrics(data);
    } catch (err: any) {
      console.error('Failed to fetch metrics:', err);
      setError(err?.response?.data?.detail || 'Errore nel caricamento delle metriche');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async (data: HealthMetricCreate) => {
    try {
      setActionLoading(true);
      await metricsService.create(data);
      setShowAddModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Errore nella creazione');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setActionLoading(true);
      await metricsService.delete(deleteId);
      setDeleteId(null);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Errore nell'eliminazione");
    } finally {
      setActionLoading(false);
    }
  };

  const openAdd = (type: MetricType) => {
    setSelectedType(type);
    setShowAddModal(true);
  };

  const metricTypes: MetricType[] = ['heart_rate', 'steps', 'weight', 'calories', 'blood_pressure', 'oxygen', 'temperature'];

  // Group metrics by type
  const byType: Record<string, HealthMetric[]> = {};
  for (const m of metrics) {
    if (!byType[m.metric_type]) byType[m.metric_type] = [];
    byType[m.metric_type].push(m);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-page text-heading flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-heading">
      <header className="px-6 py-5 border-b border-border-default flex items-center gap-3">
        <Link href="/dashboard/health" className="text-tertiary hover:text-body transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Activity size={18} className="text-emerald-400" />
        <h1 className="text-base font-semibold flex-1">Metriche</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200"><X size={16} /></button>
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 gap-3">
          {metricTypes.map((type) => (
            <MetricCard
              key={type}
              type={type}
              metrics={byType[type] || []}
              onAdd={openAdd}
            />
          ))}
        </div>

        {/* History */}
        <HistorySection metrics={metrics} onDelete={(id) => setDeleteId(id)} />
      </main>

      {/* Add Modal */}
      <AddMetricModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAdd}
        isLoading={actionLoading}
        selectedType={selectedType}
      />

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteId}
        title="Elimina metrica"
        message="Sei sicuro di voler eliminare questa misurazione?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        isDanger
        isLoading={actionLoading}
      />
    </div>
  );
}
