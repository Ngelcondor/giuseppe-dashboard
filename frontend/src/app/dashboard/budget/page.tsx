'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Wallet, RefreshCw, Link2, Upload, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, AlertTriangle, Check, Clock, CreditCard,
  Plus, X, Banknote, PieChart, Calendar, ArrowUpRight, ArrowDownRight,
  Unlink,
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/constants';
import { EditorialPage } from '@/components/ui/EditorialPage';
import {
  getBudgetDashboard,
  getBankConnection,
  getBankProviderStatus,
  initBankAuth,
  completeBankAuth,
  syncBankTransactions,
  disconnectBank,
  importCSV,
  createTransaction,
  type BudgetDashboard,
  type BankConnection,
  type BankProviderStatus,
  type CategorySpending,
  type ScadenzaPreview,
  type Transaction,
  type ImportResult,
} from '@/services/budgetService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESI = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
];

function fmtEur(n: number, showSign = true): string {
  const sign = showSign ? (n >= 0 ? '+' : '') : (n < 0 ? '-' : '');
  return sign + Math.abs(n).toFixed(2).replace('.', ',') + ' €';
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}

const TIPO_DOT: Record<string, string> = {
  Uscita: '#f87171', Entrata: '#4ade80', Abbonamento: '#60a5fa',
  Rata: '#fb923c', Ricorrente: '#a78bfa',
};

const CATEGORY_COLORS: Record<string, string> = {
  Alimentari: '#4ade80', Ristorazione: '#fb923c', Trasporti: '#60a5fa',
  Abbonamenti: '#a78bfa', Salute: '#f87171', Tech: '#38bdf8',
  Casa: '#fbbf24', Shopping: '#f472b6', Svago: '#34d399', Altro: '#94a3b8',
};

type View = 'overview' | 'transactions' | 'scadenze' | 'settings';

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BudgetPage() {
  const [view, setView] = useState<View>('overview');
  const [dashboard, setDashboard] = useState<BudgetDashboard | null>(null);
  const [bankConn, setBankConn] = useState<BankConnection | null>(null);
  const [bankStatus, setBankStatus] = useState<BankProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(2026);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add transaction form
  const [showAddTx, setShowAddTx] = useState(false);
  const [txForm, setTxForm] = useState({ desc: '', amount: '', category: 'Altro', type: 'expense' as 'income' | 'expense', date: new Date().toISOString().slice(0, 10) });

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [dash, conn, status] = await Promise.all([
        getBudgetDashboard(selectedMonth + 1, selectedYear),
        getBankConnection().catch(() => null),
        getBankProviderStatus().catch(() => ({ provider_available: false, provider_name: null })),
      ]);
      setDashboard(dash);
      setBankConn(conn);
      setBankStatus(status);
    } catch (e: any) {
      setError(e?.message || 'Errore caricamento dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Check for bank callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (params.get('bank') === 'callback' && ref) {
      completeBankAuth(ref)
        .then(() => { setSuccessMsg('Conto collegato con successo!'); fetchDashboard(); })
        .catch(() => setError('Errore nel collegamento del conto'))
        .finally(() => window.history.replaceState({}, '', '/dashboard/budget'));
    }
  }, [fetchDashboard]);

  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 4000); return () => clearTimeout(t); }
  }, [successMsg]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleConnectBank = async () => {
    try {
      setSyncing(true);
      const result = await initBankAuth();
      window.location.href = result.auth_link;
    } catch (e: any) {
      setError(e?.message || 'Errore avvio collegamento banca');
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const result = await syncBankTransactions(30);
      setSuccessMsg(`${result.message} (${result.skipped} duplicate saltate)`);
      await fetchDashboard();
    } catch (e: any) {
      setError(e?.message || 'Errore sync transazioni');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectBank();
      setBankConn(null);
      setSuccessMsg('Conto disconnesso');
      await fetchDashboard();
    } catch (e: any) {
      setError(e?.message || 'Errore disconnessione');
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSyncing(true);
      const result = await importCSV(file);
      setSuccessMsg(result.message);
      await fetchDashboard();
    } catch (err: any) {
      setError(err?.message || 'Errore import CSV');
    } finally {
      setSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddTx = async () => {
    const amount = parseFloat(txForm.amount.replace(',', '.'));
    if (!txForm.desc || isNaN(amount)) return;
    try {
      await createTransaction({
        amount,
        category: txForm.category,
        description: txForm.desc,
        transaction_type: txForm.type,
        date: txForm.date,
      });
      setShowAddTx(false);
      setTxForm({ desc: '', amount: '', category: 'Altro', type: 'expense', date: new Date().toISOString().slice(0, 10) });
      setSuccessMsg('Transazione aggiunta');
      await fetchDashboard();
    } catch (e: any) {
      setError(e?.message || 'Errore salvataggio');
    }
  };

  const prevMonth = () => { if (selectedMonth > 0) setSelectedMonth(selectedMonth - 1); };
  const nextMonth = () => { if (selectedMonth < 11) setSelectedMonth(selectedMonth + 1); };

  // ── Sub-components ─────────────────────────────────────────────────────────

  const StatCard = ({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: any }) => (
    <div className="p-4 rounded-xl bg-card border border-border-default">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={13} style={{ color }} />
        <p className="text-[11px] text-muted uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-lg font-semibold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );

  const CategoryBar = ({ cat }: { cat: CategorySpending }) => {
    const pct = Math.min(cat.percentage, 100);
    const isOver = cat.limit !== null && cat.percentage > 100;
    const barColor = isOver ? '#f87171' : (CATEGORY_COLORS[cat.category] || '#94a3b8');
    return (
      <div className="py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: barColor }} />
            <span className="text-xs text-body">{cat.category}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium tabular-nums text-heading">{fmtEur(cat.spent, false)}</span>
            {cat.limit !== null && (
              <span className="text-[10px] text-muted">/ {fmtEur(cat.limit, false)}</span>
            )}
          </div>
        </div>
        {cat.limit !== null && (
          <div className="h-1.5 rounded-full bg-card-inner overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: barColor }}
            />
          </div>
        )}
      </div>
    );
  };

  const ScadenzaRow = ({ s }: { s: ScadenzaPreview }) => (
    <div className={`flex items-center justify-between px-4 py-3 ${s.pagato ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        {s.pagato ? (
          <Check size={14} className="text-emerald-500 shrink-0" />
        ) : s.is_overdue ? (
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
        ) : (
          <Clock size={14} className="text-muted shrink-0" />
        )}
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TIPO_DOT[s.tipo] || '#94a3b8' }} />
        <div className="min-w-0">
          <p className={`text-sm truncate ${s.pagato ? 'line-through text-muted' : 'text-heading'}`}>{s.desc}</p>
          <p className="text-[11px] text-muted mt-0.5">
            {s.scadenza_gg_mm} · {s.tipo}
            {!s.pagato && !s.is_overdue && ` · tra ${s.days_until}g`}
            {s.is_overdue && ` · scaduta da ${Math.abs(s.days_until)}g`}
          </p>
        </div>
      </div>
      <span className={`text-sm font-medium tabular-nums shrink-0 ml-3 ${s.importo < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
        {fmtEur(s.importo)}
      </span>
    </div>
  );

  const TxRow = ({ tx }: { tx: Transaction }) => (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        {tx.transaction_type === 'income' ? (
          <ArrowDownRight size={14} className="text-emerald-400 shrink-0" />
        ) : (
          <ArrowUpRight size={14} className="text-red-400 shrink-0" />
        )}
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[tx.category] || '#94a3b8' }} />
        <div className="min-w-0">
          <p className="text-sm truncate text-heading">{tx.description || tx.merchant_name || '—'}</p>
          <p className="text-[11px] text-muted mt-0.5">
            {new Date(tx.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
            {' · '}{tx.category}
            {tx.source !== 'manual' && ` · ${tx.source === 'bank_sync' ? 'Banca' : 'CSV'}`}
          </p>
        </div>
      </div>
      <span className={`text-sm font-medium tabular-nums shrink-0 ml-3 ${tx.transaction_type === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>
        {tx.transaction_type === 'expense' ? '-' : '+'}{fmtEur(tx.amount, false)}
      </span>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const headerActions = (
    <>
      <button onClick={fetchDashboard} disabled={loading} className="p-2 text-tertiary hover:text-body transition-colors rounded-lg hover:bg-card-inner" aria-label="Ricarica">
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      </button>
      <div className="flex gap-0.5 p-1 rounded-xl bg-card-inner border border-border-default">
        {([
          { key: 'overview' as View, label: 'Panoramica' },
          { key: 'transactions' as View, label: 'Movimenti' },
          { key: 'scadenze' as View, label: 'Scadenze' },
          { key: 'settings' as View, label: 'Banca' },
        ]).map(({ key, label }) => (
          <button key={key} onClick={() => setView(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === key ? 'bg-surface-hover text-heading' : 'text-tertiary hover:text-body'}`}>
            {label}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <EditorialPage
      eyebrow="Finance"
      title="Il tuo"
      titleAccent="budget"
      description="Entrate, uscite, scadenze. Controllo, non ansia."
      width="lg"
      actions={headerActions}
    >
      {/* Global hidden file input for CSV */}
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />

      {/* Messages */}
      {error && (
        <div className="mb-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs">
            <span>{error}</span>
            <button onClick={() => setError('')}><X size={12} /></button>
          </div>
        </div>
      )}
      {successMsg && (
        <div className="mb-4">
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-xs">
            {successMsg}
          </div>
        </div>
      )}

      <div className="space-y-6">

        {/* Loading */}
        {loading && !dashboard && (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-card border-t-heading rounded-full animate-spin" />
          </div>
        )}

        {dashboard && (
          <>
            {/* Month Selector */}
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} disabled={selectedMonth === 0}
                className="p-2 text-tertiary hover:text-body disabled:opacity-20 transition-colors rounded-lg hover:bg-card">
                <ChevronLeft size={16} />
              </button>
              <p className="text-sm font-semibold">{MESI[selectedMonth]} {selectedYear}</p>
              <button onClick={nextMonth} disabled={selectedMonth === 11}
                className="p-2 text-tertiary hover:text-body disabled:opacity-20 transition-colors rounded-lg hover:bg-card">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/*  OVERVIEW                                                        */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {view === 'overview' && (
              <>
                {/* Bank Balance Banner */}
                {dashboard.bank_connected && dashboard.bank_balance !== null && (
                  <div className="p-5 rounded-2xl bg-card border border-border-default">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} className="text-blue-400" />
                        <span className="text-[11px] text-muted uppercase tracking-widest">Saldo Revolut</span>
                      </div>
                      <span className="text-[10px] text-muted">
                        Sync: {fmtDate(dashboard.bank_last_sync)}
                      </span>
                    </div>
                    <p className={`text-2xl font-bold tabular-nums ${dashboard.bank_balance >= 0 ? 'text-heading' : 'text-red-400'}`}>
                      {fmtEur(dashboard.bank_balance, false)}
                    </p>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Entrate" value={fmtEur(dashboard.total_income, false)} color="#4ade80" icon={TrendingUp} />
                  <StatCard label="Uscite" value={fmtEur(dashboard.total_expenses, false)} color="#f87171" icon={TrendingDown} />
                  <StatCard label="Saldo" value={fmtEur(dashboard.net_balance)} color={dashboard.net_balance >= 0 ? '#4ade80' : '#f87171'} icon={Banknote} />
                  <StatCard label="Da pagare" value={fmtEur(dashboard.scadenze_remaining, false)} color="#fbbf24" icon={Calendar} />
                </div>

                {/* Scadenze progress */}
                {dashboard.scadenze_total > 0 && (
                  <div className="p-4 rounded-xl bg-card border border-border-default">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-muted uppercase tracking-widest">Scadenze mese</span>
                      <span className="text-xs text-body tabular-nums">
                        {fmtEur(dashboard.scadenze_paid, false)} / {fmtEur(dashboard.scadenze_total, false)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-card-inner overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.min((dashboard.scadenze_paid / dashboard.scadenze_total) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Category Spending */}
                {dashboard.categories.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-body uppercase tracking-widest mb-3 flex items-center gap-2">
                      <PieChart size={12} /> Spese per categoria
                    </p>
                    <div className="rounded-2xl bg-card border border-border-default p-4">
                      {dashboard.categories
                        .filter(c => c.spent > 0)
                        .sort((a, b) => b.spent - a.spent)
                        .map(cat => <CategoryBar key={cat.category} cat={cat} />)}
                      {dashboard.categories.filter(c => c.spent > 0).length === 0 && (
                        <p className="text-xs text-muted text-center py-4">Nessuna spesa questo mese</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Overdue */}
                {dashboard.overdue_scadenze.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <AlertTriangle size={12} /> Scadenze in ritardo
                    </p>
                    <div className="rounded-2xl bg-card border border-red-500/20 divide-y divide-border-default overflow-hidden">
                      {dashboard.overdue_scadenze.map(s => <ScadenzaRow key={s.id} s={s} />)}
                    </div>
                  </div>
                )}

                {/* Upcoming scadenze */}
                {dashboard.upcoming_scadenze.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-body uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Clock size={12} /> Prossime scadenze
                    </p>
                    <div className="rounded-2xl bg-card border border-border-default divide-y divide-border-default overflow-hidden">
                      {dashboard.upcoming_scadenze.slice(0, 8).map(s => <ScadenzaRow key={s.id} s={s} />)}
                    </div>
                  </div>
                )}

                {/* Recent Transactions */}
                {dashboard.recent_transactions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-body uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Wallet size={12} /> Ultime transazioni
                    </p>
                    <div className="rounded-2xl bg-card border border-border-default divide-y divide-border-default overflow-hidden">
                      {dashboard.recent_transactions.slice(0, 5).map(tx => <TxRow key={tx.id} tx={tx} />)}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/*  TRANSACTIONS                                                    */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {view === 'transactions' && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-body uppercase tracking-widest">Movimenti</p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddTx(!showAddTx)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-card border border-border-default hover:bg-surface-hover text-heading transition-colors">
                      <Plus size={12} /> Manuale
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={syncing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-card border border-border-default hover:bg-surface-hover text-heading transition-colors">
                      <Upload size={12} /> CSV
                    </button>
                    {dashboard.bank_connected && (
                      <button onClick={handleSync} disabled={syncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-card border border-border-default hover:bg-surface-hover text-heading transition-colors">
                        <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> Sync
                      </button>
                    )}
                  </div>
                </div>

                {/* Add transaction form */}
                {showAddTx && (
                  <div className="rounded-2xl bg-card border border-border-default p-5">
                    <p className="text-xs font-medium text-tertiary uppercase tracking-widest mb-4">Nuova transazione</p>
                    <div className="space-y-3">
                      <input
                        value={txForm.desc}
                        onChange={e => setTxForm(f => ({ ...f, desc: e.target.value }))}
                        placeholder="Descrizione"
                        className="w-full bg-transparent border border-border-hover rounded-xl px-4 py-2.5 text-sm placeholder-muted focus:outline-none"
                      />
                      <div className="grid grid-cols-3 gap-3">
                        <input
                          value={txForm.amount}
                          onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder="Importo"
                          className="bg-transparent border border-border-hover rounded-xl px-4 py-2.5 text-sm placeholder-muted focus:outline-none"
                        />
                        <select
                          value={txForm.type}
                          onChange={e => setTxForm(f => ({ ...f, type: e.target.value as any }))}
                          className="bg-input border border-border-hover rounded-xl px-3 py-2.5 text-sm text-heading focus:outline-none"
                        >
                          <option value="expense">Uscita</option>
                          <option value="income">Entrata</option>
                        </select>
                        <input
                          type="date"
                          value={txForm.date}
                          onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))}
                          className="bg-input border border-border-hover rounded-xl px-3 py-2.5 text-sm text-heading focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={txForm.category}
                          onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}
                          className="bg-input border border-border-hover rounded-xl px-3 py-2.5 text-sm text-heading focus:outline-none"
                        >
                          {Object.keys(CATEGORY_COLORS).map(c => <option key={c}>{c}</option>)}
                        </select>
                        <button onClick={handleAddTx}
                          className="py-2.5 rounded-xl bg-card hover:bg-surface-hover border border-border-hover text-heading text-sm font-medium transition-colors">
                          Aggiungi
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transaction list */}
                {dashboard.recent_transactions.length > 0 ? (
                  <div className="rounded-2xl bg-card border border-border-default divide-y divide-border-default overflow-hidden">
                    {dashboard.recent_transactions.map(tx => <TxRow key={tx.id} tx={tx} />)}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <p className="text-sm text-muted">Nessuna transazione per {MESI[selectedMonth]}</p>
                    <p className="text-xs text-muted mt-2">Collega la banca, importa un CSV o aggiungi manualmente</p>
                  </div>
                )}
              </>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/*  SCADENZE                                                        */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {view === 'scadenze' && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-card border border-border-default text-center">
                    <p className="text-[11px] text-muted mb-1">Totale</p>
                    <p className="text-base font-semibold tabular-nums text-heading">{fmtEur(dashboard.scadenze_total, false)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border-default text-center">
                    <p className="text-[11px] text-muted mb-1">Pagate</p>
                    <p className="text-base font-semibold tabular-nums text-emerald-400">{fmtEur(dashboard.scadenze_paid, false)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border-default text-center">
                    <p className="text-[11px] text-muted mb-1">Rimanente</p>
                    <p className="text-base font-semibold tabular-nums text-amber-400">{fmtEur(dashboard.scadenze_remaining, false)}</p>
                  </div>
                </div>

                {/* Overdue */}
                {dashboard.overdue_scadenze.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-400 uppercase tracking-widest mb-3">In ritardo ({dashboard.overdue_scadenze.length})</p>
                    <div className="rounded-2xl bg-card border border-red-500/20 divide-y divide-border-default overflow-hidden">
                      {dashboard.overdue_scadenze.map(s => <ScadenzaRow key={s.id} s={s} />)}
                    </div>
                  </div>
                )}

                {/* Upcoming */}
                {dashboard.upcoming_scadenze.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-body uppercase tracking-widest mb-3">In arrivo ({dashboard.upcoming_scadenze.length})</p>
                    <div className="rounded-2xl bg-card border border-border-default divide-y divide-border-default overflow-hidden">
                      {dashboard.upcoming_scadenze.map(s => <ScadenzaRow key={s.id} s={s} />)}
                    </div>
                  </div>
                )}

                {dashboard.overdue_scadenze.length === 0 && dashboard.upcoming_scadenze.length === 0 && (
                  <p className="text-xs text-muted text-center py-8">Nessuna scadenza per {MESI[selectedMonth]}</p>
                )}

                <div className="text-center">
                  <Link href="/dashboard/deadlines" className="text-xs text-tertiary hover:text-body transition-colors">
                    Vai alla gestione scadenze completa →
                  </Link>
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/*  SETTINGS / BANK CONNECTION                                      */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {view === 'settings' && (
              <div className="space-y-6">

                {/* CSV Import — Primary method */}
                <div>
                  <p className="text-xs font-medium text-body uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Upload size={12} /> Importa da CSV Revolut
                  </p>
                  <div className="rounded-2xl bg-card border border-border-default p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Upload size={18} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-heading">Import CSV</p>
                        <p className="text-[11px] text-muted">
                          Metodo principale — funziona sempre, senza API esterne
                        </p>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-card-inner text-xs text-muted space-y-1">
                      <p className="font-medium text-body">Come esportare da Revolut:</p>
                      <p>1. Apri l&apos;app Revolut → Profilo → Estratto conto</p>
                      <p>2. Seleziona il periodo e formato CSV</p>
                      <p>3. Importa il file qui sotto</p>
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} disabled={syncing}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
                      <Upload size={14} /> {syncing ? 'Importando...' : 'Seleziona file CSV'}
                    </button>
                  </div>
                </div>

                {/* Bank Connection — Secondary/optional */}
                <div>
                  <p className="text-xs font-medium text-body uppercase tracking-widest mb-3 flex items-center gap-2">
                    <CreditCard size={12} /> Collegamento bancario (opzionale)
                  </p>

                  {bankConn && bankConn.status === 'active' ? (
                    <div className="rounded-2xl bg-card border border-border-default p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <CreditCard size={18} className="text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-heading">{bankConn.institution_name}</p>
                            <p className="text-[11px] text-muted">
                              {bankConn.account_iban ? `••••${bankConn.account_iban.slice(-4)}` : bankConn.account_name || 'Conto collegato'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-[11px] text-emerald-400">Attivo</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-3 rounded-xl bg-card-inner">
                          <p className="text-[10px] text-muted mb-0.5">Ultimo sync</p>
                          <p className="text-xs text-body">{fmtDate(bankConn.last_sync_at)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-card-inner">
                          <p className="text-[10px] text-muted mb-0.5">Scade</p>
                          <p className="text-xs text-body">{fmtDate(bankConn.expires_at)}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={handleSync} disabled={syncing}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-card hover:bg-surface-hover border border-border-hover text-heading text-sm transition-colors">
                          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Sincronizza
                        </button>
                        <button onClick={handleDisconnect}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-card hover:bg-red-500/5 border border-border-hover text-red-400 text-sm transition-colors">
                          <Unlink size={14} /> Disconnetti
                        </button>
                      </div>
                    </div>
                  ) : bankStatus?.provider_available ? (
                    <div className="rounded-2xl bg-card border border-border-default p-6 text-center space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-card-inner border border-border-default flex items-center justify-center mx-auto">
                        <Link2 size={20} className="text-tertiary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-heading mb-1">Collega il tuo conto</p>
                        <p className="text-xs text-muted">
                          Tramite {bankStatus.provider_name} (Open Banking) puoi sincronizzare automaticamente saldo e transazioni.
                          I tuoi dati restano privati e il collegamento scade dopo 90 giorni.
                        </p>
                      </div>
                      <button onClick={handleConnectBank} disabled={syncing}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
                        {syncing ? 'Connessione in corso...' : 'Collega Revolut'}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-card border border-border-default p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-card-inner flex items-center justify-center shrink-0">
                          <Link2 size={18} className="text-muted" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-heading">Sync automatica non configurata</p>
                          <p className="text-[11px] text-muted">Nessun provider Open Banking attivo nel backend</p>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-card-inner text-xs text-muted space-y-1.5">
                        <p className="font-medium text-body">Per abilitare la sync automatica:</p>
                        <p>1. Registrati su <span className="text-heading">Enable Banking</span> (gratuito per uso personale)</p>
                        <p>2. Aggiungi <span className="font-mono text-heading">ENABLE_BANKING_APP_ID</span> e <span className="font-mono text-heading">ENABLE_BANKING_APP_SECRET</span> al file .env</p>
                        <p>3. Riavvia il backend</p>
                        <p className="mt-2 text-muted">Nel frattempo puoi usare l&apos;import CSV qui sopra.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </EditorialPage>
  );
}
