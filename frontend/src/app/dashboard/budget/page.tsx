'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Trash2, ShoppingCart, Train, Shield, Home, Music, CreditCard, FileUp,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet, Field, FieldRow } from '@/components/sd/FormSheet';
import {
  getBudgetDashboard, listGoals, createGoal, deleteGoal,
  listTransactions, createTransaction, deleteTransaction, importCSV,
  type BudgetDashboard, type CategorySpending, type BudgetGoal,
  type Transaction, type ScadenzaPreview,
} from '@/services/budgetService';

/* ── Budget — "Le tue finanze" (design StudyDesk.dc.html) ───────────────────
   Two views (Panoramica / Flusso) wired to real data: balance, category
   spending (donut / rings / pills), transactions, upcoming scadenze as
   scheduled payments, a real 6-month spend trend, Revolut CSV import, and the
   monthly budget target. No fabricated data — honest empty states throughout. */

const mono = "'JetBrains Mono',monospace";
const MONTH = 6;
const YEAR = 2026;
const FIRST_DAY_ISO = '2026-06-01';
const TODAY_ISO = '2026-06-21';
const errStyle: React.CSSProperties = { margin: '2px 0 0', fontSize: 12.5, color: 'rgb(239 68 68)' };

const FALLBACK: BudgetDashboard = {
  bank_connected: false, bank_balance: null, bank_currency: 'EUR', bank_last_sync: null,
  month: FIRST_DAY_ISO, total_income: 0, total_expenses: 0, net_balance: 0,
  categories: [], upcoming_scadenze: [], overdue_scadenze: [],
  scadenze_total: 0, scadenze_paid: 0, scadenze_remaining: 0, recent_transactions: [],
};

const PALETTE = ['99 102 241', '16 185 129', '245 158 11', '236 72 153', '148 163 184', '34 197 94'];
function colorFor(cat: string, i = 0): string {
  const k = cat.toLowerCase();
  if (/affitt|casa|rent|alloggi/.test(k)) return '245 158 11';
  if (/spesa|cibo|aliment|mercad|grocer|super/.test(k)) return '99 102 241';
  if (/trasport|treno|renfe|metro|bus|rodalies/.test(k)) return '16 185 129';
  if (/studi|htb|libr|corso|hack|uoc/.test(k)) return '236 72 153';
  if (/svago|spotif|abbon|leisure|netflix|intratten/.test(k)) return '148 163 184';
  return PALETTE[i % PALETTE.length];
}
function IconFor({ cat, size = 17 }: { cat: string; size?: number }) {
  const k = cat.toLowerCase();
  const p = { size };
  if (/affitt|casa|rent|alloggi/.test(k)) return <Home {...p} />;
  if (/spesa|cibo|aliment|mercad|grocer|super/.test(k)) return <ShoppingCart {...p} />;
  if (/trasport|treno|renfe|metro|bus|rodalies/.test(k)) return <Train {...p} />;
  if (/studi|htb|libr|corso|hack|uoc/.test(k)) return <Shield {...p} />;
  if (/svago|spotif|abbon|musica|netflix/.test(k)) return <Music {...p} />;
  return <CreditCard {...p} />;
}

const eur = (n: number, dec = false) => {
  const s = Math.abs(n).toLocaleString('it-IT', dec
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { maximumFractionDigits: 0 });
  return (n < 0 ? '−' : '') + '€' + s;
};
const fmtTxDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const fmtMonthLabel = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase());
const monthShort = (m: number) =>
  ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'][((m - 1) % 12 + 12) % 12];
const daysLeftInMonth = (iso: string) => {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1;
  const last = new Date(y, m + 1, 0).getDate();
  const t = new Date();
  return (t.getFullYear() === y && t.getMonth() === m) ? Math.max(0, last - t.getDate()) : last;
};

type Cat = { name: string; color: string; amount: number; budget: number };

/* ── view model from real data ── */
function toCats(categories: CategorySpending[]): Cat[] {
  return [...categories]
    .sort((a, b) => b.spent - a.spent)
    .map((c, i) => ({ name: c.category, color: colorFor(c.category, i), amount: c.spent, budget: c.limit ?? 0 }));
}

export default function BudgetPage() {
  const [data, setData] = useState<BudgetDashboard>(FALLBACK);
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [trend, setTrend] = useState<{ m: string; v: number }[]>([]);

  const [view, setView] = useState<'a' | 'b'>('a');
  const [budget, setBudget] = useState(0);          // monthly target (localStorage)
  const [dragOver, setDragOver] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [goalOpen, setGoalOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [del, setDel] = useState<{ kind: 'goal' | 'tx'; id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dash, gls, tx] = await Promise.all([
        getBudgetDashboard(MONTH, YEAR),
        listGoals(),
        listTransactions({ month: MONTH, year: YEAR, limit: 30 }),
      ]);
      setData(dash);
      setGoals(gls);
      setTxs(tx);
    } catch {/* keep current */}
  }, []);
  useEffect(() => { load(); }, [load]);

  // restore prefs
  useEffect(() => {
    try {
      const b = localStorage.getItem('sd-fin-budget'); if (b) setBudget(parseInt(b, 10) || 0);
      const v = localStorage.getItem('sd-fin-view'); if (v === 'a' || v === 'b') setView(v);
    } catch {/* ignore */}
  }, []);
  const setViewP = (v: 'a' | 'b') => { setView(v); try { localStorage.setItem('sd-fin-view', v); } catch {/**/} };
  const onBudget = (v: number) => { setBudget(v); try { localStorage.setItem('sd-fin-budget', String(v)); } catch {/**/} };

  // real 6-month spend trend
  useEffect(() => {
    let alive = true;
    const months = Array.from({ length: 6 }, (_, i) => {
      const idx = MONTH - 5 + i;            // Jan..Jun for MONTH=6
      const m = ((idx - 1) % 12 + 12) % 12 + 1;
      const y = YEAR + Math.floor((idx - 1) / 12);
      return { m, y };
    });
    Promise.all(months.map(({ m, y }) =>
      getBudgetDashboard(m, y).then((d) => d.total_expenses).catch(() => 0)))
      .then((vals) => { if (alive) setTrend(months.map((mm, i) => ({ m: monthShort(mm.m), v: Math.round(vals[i]) }))); });
    return () => { alive = false; };
  }, []);

  const cats = toCats(data.categories);
  const totalLimit = data.categories.reduce((s, c) => s + (c.limit ?? 0), 0);
  const spent = Math.round(data.total_expenses);
  const net = Math.round(data.net_balance);
  const balance = data.bank_balance;                 // number | null
  const target = budget || Math.round(totalLimit) || 0;
  const remain = Math.max(target - spent, 0);
  const spentPct = target > 0 ? Math.min((spent / target) * 100, 100) : 0;
  const daysLeft = daysLeftInMonth(data.month);

  const goalByCategory = new Map(goals.map((g) => [g.category, g.id]));
  const categoryNames = Array.from(new Set([...data.categories.map((c) => c.category), ...goals.map((g) => g.category)]));

  const txView = txs.map((t, i) => ({
    id: t.id,
    name: t.description || t.merchant_name || t.category,
    sub: `${t.category} · ${fmtTxDate(t.date)}`,
    amount: t.transaction_type === 'expense' ? -t.amount : t.amount,
    color: colorFor(t.category, i),
    cat: t.category,
    label: t.description || t.category,
  }));

  /* ── handlers ── */
  const handleFile = async (f: File) => {
    setImporting(true); setImportErr(null); setImportMsg(null);
    try {
      const res = await importCSV(f);
      setImportMsg(`${res.imported} importate · ${res.skipped} saltate${res.errors ? ` · ${res.errors} errori` : ''}`);
      await load();
    } catch {
      setImportErr('Import non riuscito. Usa un estratto conto Revolut in formato .csv.');
    } finally { setImporting(false); setDragOver(false); }
  };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); };

  const submitGoal = async (b: { category: string; monthly_limit: number }) => {
    await createGoal({ category: b.category, monthly_limit: b.monthly_limit, month: FIRST_DAY_ISO });
    setGoalOpen(false); await load();
  };
  const submitTx = async (b: { amount: number; category: string; description: string; date: string }) => {
    await createTransaction({ amount: b.amount, category: b.category, description: b.description, transaction_type: 'expense', date: b.date });
    setTxOpen(false); await load();
  };
  const confirmDelete = async () => {
    if (!del) return;
    setBusy(true);
    try {
      if (del.kind === 'goal') await deleteGoal(del.id); else await deleteTransaction(del.id);
      setDel(null); await load();
    } finally { setBusy(false); }
  };

  const hasData = cats.length > 0 || txView.length > 0 || balance != null;

  return (
    <div>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPick} style={{ display: 'none' }} />

      {/* Header + view toggle */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 26 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(16 185 129)', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>Finanze · {fmtMonthLabel(data.month)}</div>
          <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>Le tue <span style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>finanze</span>.</h1>
          <p style={{ margin: '11px 0 0', fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>Saldo, spese e pagamenti in arrivo · tutto in un posto.</p>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 13, border: '1px solid rgb(var(--color-border))', background: 'rgb(var(--color-card-inner))' }}>
          <ViewTab active={view === 'a'} dot="16 185 129" label="Panoramica" onClick={() => setViewP('a')} />
          <ViewTab active={view === 'b'} dot="99 102 241" label="Flusso" onClick={() => setViewP('b')} />
        </div>
      </header>

      {/* CSV import */}
      <div className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 18 }}>
        <div
          onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
          onDrop={onDrop}
          style={{ border: `1px dashed ${dragOver ? 'rgb(99 102 241)' : 'rgb(var(--color-border))'}`, background: 'rgb(var(--color-card-inner))', borderRadius: 16, padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 15, flexWrap: 'wrap', transition: 'border-color .15s ease' }}
        >
          <span style={{ width: 42, height: 42, borderRadius: 12, background: 'rgb(99 102 241/0.14)', color: 'rgb(99 102 241)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><FileUp size={20} /></span>
          <div style={{ flex: 1, minWidth: 170 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Importa il tuo estratto conto Revolut</div>
            <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>
              {importMsg ?? <>Trascina qui il file <span style={{ fontFamily: mono }}>.csv</span> o sfoglia · vengono categorizzate automaticamente</>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgb(var(--color-tertiary))', whiteSpace: 'nowrap' }}>Budget mensile
              <span style={{ display: 'inline-flex', alignItems: 'center', background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', borderRadius: 9, padding: '6px 10px', fontFamily: mono, color: 'rgb(var(--color-heading))' }}>€
                <input type="number" min={0} value={budget || ''} placeholder={String(Math.round(totalLimit) || 900)} onChange={(e) => onBudget(parseInt(e.target.value, 10) || 0)} style={{ width: 62, background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: 13, marginLeft: 2 }} />
              </span>
            </label>
            <Button size="sm" variant="primary" isLoading={importing} onClick={() => fileRef.current?.click()}>Carica CSV</Button>
          </div>
        </div>
        {importErr && <div style={{ marginTop: 10, fontSize: 12.5, color: 'rgb(245 158 11)', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgb(245 158 11)', flex: 'none' }} />{importErr}</div>}
      </div>

      {view === 'a'
        ? <Panoramica cats={cats} spent={spent} net={net} balance={balance} target={target} remain={remain} spentPct={spentPct} trend={trend} txView={txView} scadenze={data.upcoming_scadenze} hasData={hasData} onAddTx={() => setTxOpen(true)} onAddCat={() => setGoalOpen(true)} onDelTx={(t) => setDel({ kind: 'tx', id: t.id, label: t.label })} goalByCategory={goalByCategory} onDelCat={(name, id) => setDel({ kind: 'goal', id, label: name })} />
        : <Flusso cats={cats} spent={spent} net={net} balance={balance} target={target} remain={remain} spentPct={spentPct} trend={trend} txView={txView} scadenze={data.upcoming_scadenze} daysLeft={daysLeft} hasData={hasData} onDelTx={(t) => setDel({ kind: 'tx', id: t.id, label: t.label })} goalByCategory={goalByCategory} onDelCat={(name, id) => setDel({ kind: 'goal', id, label: name })} />}

      {/* Sheets */}
      <Sheet open={goalOpen} onClose={() => setGoalOpen(false)} title="Nuova categoria" subtitle="Limite di spesa mensile">
        <GoalForm key={goalOpen ? 'g' : 'c'} onSubmit={submitGoal} onCancel={() => setGoalOpen(false)} />
      </Sheet>
      <Sheet open={txOpen} onClose={() => setTxOpen(false)} title="Nuova spesa" subtitle="Movimento del mese">
        <TransactionForm key={txOpen ? 't' : 'c'} categoryNames={categoryNames} onSubmit={submitTx} onCancel={() => setTxOpen(false)} />
      </Sheet>
      <Sheet open={!!del} onClose={() => setDel(null)} title="Eliminare?" subtitle={del?.label} maxWidth={400}>
        <p style={{ margin: '0 0 4px', fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>L&apos;elemento verrà rimosso definitivamente.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <Button variant="secondary" onClick={() => setDel(null)} disabled={busy}>Annulla</Button>
          <Button variant="danger" isLoading={busy} onClick={confirmDelete}>Elimina</Button>
        </div>
      </Sheet>
    </div>
  );
}

/* ════════════════ VARIANT A — PANORAMICA ════════════════ */
function Panoramica(p: {
  cats: Cat[]; spent: number; net: number; balance: number | null; target: number; remain: number; spentPct: number;
  trend: { m: string; v: number }[]; txView: TxView[]; scadenze: ScadenzaPreview[]; hasData: boolean;
  onAddTx: () => void; onAddCat: () => void; onDelTx: (t: TxView) => void;
  goalByCategory: Map<string, string>; onDelCat: (name: string, id: string) => void;
}) {
  return (
    <>
      {/* ROW 1 · balance + donut */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,0.95fr)', gap: 18, marginBottom: 18 }} className="sd-fin-row1">
        <div className="sd-reveal sd-accentcard" style={{ ['--i' as string]: 1, borderRadius: 20, padding: '28px 30px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 252 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .85, fontWeight: 600 }}>Saldo disponibile</div>
              <span style={{ fontFamily: mono, fontSize: 11, background: 'rgb(255 255 255/0.18)', padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>Conto · EUR</span>
            </div>
            <div style={{ fontFamily: mono, fontSize: 44, fontWeight: 700, letterSpacing: '-.02em', marginTop: 16, lineHeight: 1 }}>{p.balance != null ? eur(p.balance, true) : '€ —'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 13, fontSize: 13 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgb(255 255 255/0.18)', padding: '5px 10px', borderRadius: 8, fontFamily: mono, fontWeight: 600 }}>{p.net >= 0 ? '▲' : '▼'} {eur(Math.abs(p.net))}</span>
              <span style={{ opacity: .82 }}>{p.balance != null ? 'netto questo mese' : 'collega un conto o importa il CSV'}</span>
            </div>
          </div>
          <Sparkline trend={p.trend} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="sd-press" onClick={p.onAddTx} style={{ flex: 1, background: '#fff', color: 'rgb(79 70 229)', border: 'none', padding: '11px 14px', borderRadius: 11, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>+ Aggiungi spesa</button>
            <button className="sd-press" onClick={p.onAddCat} style={{ flex: 1, background: 'rgb(255 255 255/0.16)', color: '#fff', border: '1px solid rgb(255 255 255/0.28)', padding: '11px 14px', borderRadius: 11, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>+ Categoria</button>
          </div>
        </div>

        <Card i={2} pad="24px 26px" radius={20}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={h3}>Spese per categoria</h3>
            <span style={{ fontSize: 11, color: 'rgb(var(--color-tertiary))', textTransform: 'uppercase', letterSpacing: '.12em', whiteSpace: 'nowrap' }}>Mese</span>
          </div>
          {p.cats.length === 0 ? <Empty>Nessuna spesa registrata.</Empty> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
              <Donut cats={p.cats} total={p.spent} budget={p.target} size={140} />
              <div style={{ flex: 1, minWidth: 148, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {p.cats.map((c) => {
                  const gid = p.goalByCategory.get(c.name);
                  return (
                    <div key={c.name} className="sd-fin-legend" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: `rgb(${c.color})`, flex: 'none' }} />
                      <span style={{ flex: 1, fontSize: 13, color: c.amount > 0 ? 'rgb(var(--color-body))' : 'rgb(var(--color-tertiary))' }}>{c.name}</span>
                      <span style={{ fontFamily: mono, fontSize: 12.5, color: c.amount > 0 ? 'rgb(var(--color-heading))' : 'rgb(var(--color-tertiary))', fontWeight: 500 }}>{eur(c.amount)}</span>
                      {gid && <button className="sd-iconbtn sd-fin-del" aria-label="Elimina categoria" onClick={() => p.onDelCat(c.name, gid)}><Trash2 size={12} /></button>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ROW 2 · budget rings */}
      {p.cats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16, marginBottom: 18 }}>
          {p.cats.slice(0, 5).map((c, i) => <Ring key={c.name} cat={c} total={p.spent} i={i} />)}
        </div>
      )}

      {/* ROW 3 · transactions + scheduled */}
      <div className="sd-twocol">
        <Card i={8} pad="22px 24px">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h3 style={h3}>Transazioni recenti</h3>
            <button onClick={p.onAddTx} style={{ fontSize: 12, color: 'rgb(99 102 241)', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', background: 'none', border: 'none', fontFamily: 'inherit' }}>+ Spesa</button>
          </div>
          <TxList txs={p.txView} onDel={p.onDelTx} />
        </Card>

        <Card i={9} pad="22px 24px">
          <h3 style={{ ...h3, margin: '0 0 2px' }}>Pagamenti in arrivo</h3>
          <Scheduled scadenze={p.scadenze} />
        </Card>
      </div>
    </>
  );
}

/* ════════════════ VARIANT B — FLUSSO ════════════════ */
function Flusso(p: {
  cats: Cat[]; spent: number; net: number; balance: number | null; target: number; remain: number; spentPct: number;
  trend: { m: string; v: number }[]; txView: TxView[]; scadenze: ScadenzaPreview[]; daysLeft: number; hasData: boolean;
  onDelTx: (t: TxView) => void; goalByCategory: Map<string, string>; onDelCat: (name: string, id: string) => void;
}) {
  const avg = p.trend.length ? Math.round(p.trend.reduce((s, t) => s + t.v, 0) / p.trend.length) : 0;
  return (
    <>
      {/* balance strip + trend */}
      <div className="sd-reveal sd-accentcard" style={{ ['--i' as string]: 1, borderRadius: 20, padding: '26px 30px', color: '#fff', marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,0.9fr) minmax(0,1.1fr)', gap: 34, alignItems: 'center' }} className="sd-fin-strip">
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .85, fontWeight: 600 }}>Saldo disponibile</div>
            <div style={{ fontFamily: mono, fontSize: 42, fontWeight: 700, letterSpacing: '-.02em', marginTop: 12, lineHeight: 1 }}>{p.balance != null ? eur(p.balance, true) : '€ —'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '16px 0 14px', fontSize: 13, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: mono, fontWeight: 600 }}>{p.net >= 0 ? '▲' : '▼'} {eur(Math.abs(p.net))} netto</span>
              <span style={{ opacity: .55 }}>·</span>
              <span style={{ opacity: .85 }}><span style={{ fontFamily: mono, fontWeight: 600 }}>{eur(p.remain)}</span> rimasti di {eur(p.target)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 8, background: 'rgb(255 255 255/0.22)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${p.spentPct.toFixed(0)}%`, borderRadius: 8, background: '#fff' }} /></div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .85, fontWeight: 600 }}>Andamento spese · 6 mesi</span>
              {avg > 0 && <span style={{ fontFamily: mono, fontSize: 12, opacity: .85 }}>media {eur(avg)}</span>}
            </div>
            <TrendBars trend={p.trend} />
          </div>
        </div>
      </div>

      {/* category pills */}
      {p.cats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 18 }}>
          {p.cats.slice(0, 5).map((c, i) => <Pill key={c.name} cat={c} i={i} />)}
        </div>
      )}

      {/* timeline + side rail */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 18 }} className="sd-fin-flow">
        <Card i={7} pad="22px 24px">
          <h3 style={{ ...h3, margin: '0 0 2px' }}>Movimenti &amp; scadenze</h3>
          <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(245 158 11)', fontWeight: 600, margin: '16px 0 0' }}>In arrivo</div>
          <ScheduledTimeline scadenze={p.scadenze} />
          <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600, margin: '20px 0 0' }}>Recenti</div>
          <TxList txs={p.txView} onDel={p.onDelTx} />
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card i={8} pad="22px 24px">
            <h3 style={{ ...h3, margin: '0 0 16px', fontSize: 15 }}>Dove vanno i soldi</h3>
            {p.cats.length === 0 ? <Empty>Nessuna spesa.</Empty> : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                <Donut cats={p.cats} total={p.spent} budget={p.target} size={128} />
                <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '8px 14px', justifyContent: 'center' }}>
                  {p.cats.filter((c) => c.amount > 0).slice(0, 5).map((c) => (
                    <span key={c.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgb(var(--color-body))' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: `rgb(${c.color})` }} />{c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <div className="sd-reveal sd-accentcard" style={{ ['--i' as string]: 9, borderRadius: 16, padding: '22px 24px', color: '#fff' }}>
            <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .85, fontWeight: 600, marginBottom: 10 }}>Budget di {fmtMonthLabel(FIRST_DAY_ISO).split(' ')[0].toLowerCase()}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}><span style={{ fontFamily: mono, fontSize: 26, fontWeight: 700 }}>{eur(p.remain)}</span><span style={{ fontSize: 12, opacity: .85 }}>rimasti · {p.daysLeft} giorni</span></div>
            <div style={{ height: 7, borderRadius: 7, background: 'rgb(255 255 255/0.22)', overflow: 'hidden', marginTop: 14 }}><div style={{ height: '100%', width: `${p.spentPct.toFixed(0)}%`, borderRadius: 7, background: '#fff' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: .8, marginTop: 8, fontFamily: mono }}><span>{eur(p.spent)} spesi</span><span>{eur(p.target)} totale</span></div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════ shared bits ════════════════ */
type TxView = { id: string; name: string; sub: string; amount: number; color: string; cat: string; label: string };

const h3: React.CSSProperties = { margin: 0, fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' };
const cardBase: React.CSSProperties = { background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', boxShadow: '0 1px 2px rgba(17,17,26,.04)' };

function Card({ i, pad, radius = 16, children }: { i: number; pad: string; radius?: number; children: React.ReactNode }) {
  return <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: i, ...cardBase, borderRadius: radius, padding: pad }}>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgb(var(--color-muted))' }}>{children}</p>;
}
function ViewTab({ active, dot, label, onClick }: { active: boolean; dot: string; label: string; onClick: () => void }) {
  return (
    <button className="sd-press" onClick={onClick} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 15px', background: 'transparent', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap' }}>
      {active && <span style={{ position: 'absolute', inset: 0, borderRadius: 9, background: `rgb(${dot}/0.16)`, border: `1px solid rgb(${dot}/0.42)` }} />}
      <span style={{ position: 'relative', width: 8, height: 8, borderRadius: 2, background: `rgb(${dot})` }} /><span style={{ position: 'relative' }}>{label}</span>
    </button>
  );
}

function Donut({ cats, total, budget, size }: { cats: Cat[]; total: number; budget: number; size: number }) {
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  const segs = cats.filter((c) => c.amount > 0).map((c, i) => {
    const len = total > 0 ? C * (c.amount / total) : 0;
    const vis = Math.max(len - 6, 0);
    const el = <circle key={i} cx={60} cy={60} r={R} fill="none" stroke={`rgb(${c.color})`} strokeWidth={13} strokeDasharray={`${vis} ${C - vis}`} strokeDashoffset={-acc} />;
    acc += len; return el;
  });
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg viewBox="0 0 120 120" style={{ width: size, height: size, transform: 'rotate(-90deg)' }}>
        <circle cx={60} cy={60} r={R} fill="none" stroke="rgb(var(--color-card-inner))" strokeWidth={13} />
        {segs}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: mono, fontSize: size >= 140 ? 23 : 21, fontWeight: 700, color: 'rgb(var(--color-heading))', lineHeight: 1 }}>{eur(total)}</div>
        {budget > 0 && <div style={{ fontSize: 11, color: 'rgb(var(--color-tertiary))', marginTop: 3 }}>di {eur(budget)}</div>}
      </div>
    </div>
  );
}

function Ring({ cat, total, i }: { cat: Cat; total: number; i: number }) {
  const R = 26, C = 2 * Math.PI * R;
  const pct = cat.budget ? Math.min((cat.amount / cat.budget) * 100, 100) : (total ? (cat.amount / total) * 100 : 0);
  const off = C * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  const sub = cat.budget ? `${eur(cat.amount)}/${eur(cat.budget)}` : eur(cat.amount);
  return (
    <div className="sd-reveal sd-lift" style={{ ['--i' as string]: 3 + i, ...cardBase, borderRadius: 16, padding: '18px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <svg viewBox="0 0 64 64" width={64} height={64} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={32} cy={32} r={R} fill="none" stroke="rgb(var(--color-card-inner))" strokeWidth={6} />
          <circle cx={32} cy={32} r={R} fill="none" stroke={`rgb(${cat.color})`} strokeWidth={6} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: 13, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{Math.round(pct)}%</div>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{cat.name}</div>
        <div style={{ fontFamily: mono, fontSize: 11.5, color: 'rgb(var(--color-tertiary))', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function Pill({ cat, i }: { cat: Cat; i: number }) {
  const frac = cat.budget ? Math.min(cat.amount / cat.budget, 1) : 0;
  return (
    <div className="sd-reveal sd-lift" style={{ ['--i' as string]: 2 + i, ...cardBase, borderRadius: 14, padding: '15px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 3, background: `rgb(${cat.color})`, flex: 'none' }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{cat.name}</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{eur(cat.amount)}{cat.budget ? <span style={{ color: 'rgb(var(--color-muted))', fontSize: 11 }}> /{eur(cat.budget).replace('€', '')}</span> : null}</div>
      <div style={{ height: 5, borderRadius: 5, background: 'rgb(var(--color-card-inner))', overflow: 'hidden', marginTop: 9 }}><div style={{ height: '100%', width: `${(frac * 100).toFixed(0)}%`, borderRadius: 5, background: `rgb(${cat.color})` }} /></div>
    </div>
  );
}

function TxList({ txs, onDel }: { txs: TxView[]; onDel: (t: TxView) => void }) {
  if (txs.length === 0) return <Empty>Nessun movimento registrato.</Empty>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {txs.map((t) => (
        <div key={t.id} className="sd-fin-tx" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', borderTop: '1px solid rgb(var(--color-border))' }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: `rgb(${t.color}/0.14)`, color: `rgb(${t.color})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><IconFor cat={t.cat} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
            <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{t.sub}</div>
          </div>
          <div style={{ fontFamily: mono, fontSize: 13.5, fontWeight: 600, color: t.amount > 0 ? 'rgb(16 185 129)' : 'rgb(var(--color-heading))', flex: 'none' }}>{eur(t.amount, true)}</div>
          <button className="sd-iconbtn sd-fin-del" aria-label="Elimina movimento" onClick={() => onDel(t)} style={{ flex: 'none' }}><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function Scheduled({ scadenze }: { scadenze: ScadenzaPreview[] }) {
  if (scadenze.length === 0) return <Empty>Nessun pagamento in arrivo.</Empty>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {scadenze.map((s) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 0', borderTop: '1px solid rgb(var(--color-border))' }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: `rgb(${colorFor(s.desc + s.tipo)}/0.14)`, color: `rgb(${colorFor(s.desc + s.tipo)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><IconFor cat={s.desc + ' ' + s.tipo} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{s.desc}</div>
            <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{s.tipo} · {s.scadenza_gg_mm}</div>
          </div>
          {s.importo > 0
            ? <div style={{ fontFamily: mono, fontSize: 13.5, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{eur(s.importo, true)}</div>
            : <DaysBadge days={s.days_until} />}
        </div>
      ))}
    </div>
  );
}

function ScheduledTimeline({ scadenze }: { scadenze: ScadenzaPreview[] }) {
  if (scadenze.length === 0) return <Empty>Niente in arrivo.</Empty>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {scadenze.map((s) => {
        const [dd, mm] = s.scadenza_gg_mm.split('/');
        const col = colorFor(s.desc + s.tipo);
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderTop: '1px solid rgb(var(--color-border))' }}>
            <div style={{ width: 48, flex: 'none', textAlign: 'center' }}>
              <div style={{ fontFamily: mono, fontSize: 19, fontWeight: 700, color: `rgb(${col})`, lineHeight: 1 }}>{dd}</div>
              <div style={{ fontSize: 10, letterSpacing: '.1em', color: 'rgb(var(--color-tertiary))', textTransform: 'uppercase' }}>{mm ? monthShort(Number(mm)) : ''}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{s.desc}</div>
              <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{s.tipo}{s.importo > 0 ? '' : ' · scadenza'}</div>
            </div>
            {s.importo > 0
              ? <div style={{ fontFamily: mono, fontSize: 13.5, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{eur(s.importo, true)}</div>
              : <DaysBadge days={s.days_until} />}
          </div>
        );
      })}
    </div>
  );
}

function DaysBadge({ days }: { days: number }) {
  const warn = days <= 7;
  const col = warn ? '245 158 11' : '99 102 241';
  return <span style={{ flex: 'none', whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: 600, color: `rgb(${col})`, background: `rgb(${col}/0.14)`, border: `1px solid rgb(${col}/0.3)`, borderRadius: 999, padding: '3px 9px' }}>{days} {days === 1 ? 'giorno' : 'giorni'}</span>;
}

function Sparkline({ trend }: { trend: { m: string; v: number }[] }) {
  if (trend.length < 2) return <div style={{ height: 46, marginTop: 14 }} />;
  const max = Math.max(...trend.map((t) => t.v), 1);
  const pts = trend.map((t, i) => {
    const x = (i / (trend.length - 1)) * 340;
    const y = 50 - (t.v / max) * 42;
    return `${x.toFixed(0)},${y.toFixed(0)}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 340 56" preserveAspectRatio="none" style={{ width: '100%', height: 46, marginTop: 14 }}>
      <polyline fill="none" stroke="rgba(255,255,255,.5)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

function TrendBars({ trend }: { trend: { m: string; v: number }[] }) {
  if (trend.length === 0) return <div style={{ height: 84, display: 'flex', alignItems: 'center', fontSize: 12, opacity: .7 }}>Storico non disponibile.</div>;
  const max = Math.max(...trend.map((t) => t.v), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
      {trend.map((t, i) => {
        const last = i === trend.length - 1;
        const h = Math.max((t.v / max) * 100, 3);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: '100%', height: 76, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 30, height: `${h}%`, borderRadius: '6px 6px 0 0', background: last ? '#fff' : 'rgb(255 255 255/0.32)', boxShadow: last ? '0 0 0 1px rgb(255 255 255/0.4)' : 'none' }} />
            </div>
            <span style={{ fontSize: 10, opacity: last ? 1 : .7, fontWeight: last ? 600 : 400, fontFamily: mono }}>{t.m}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Forms ── */
function FormActions({ onCancel, submitting }: { onCancel: () => void; submitting: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6, paddingTop: 6 }}>
      <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annulla</Button>
      <Button type="submit" variant="primary" isLoading={submitting}>Aggiungi</Button>
    </div>
  );
}

function GoalForm({ onSubmit, onCancel }: { onSubmit: (b: { category: string; monthly_limit: number }) => Promise<void>; onCancel: () => void }) {
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category.trim() || !limit) { setError('Nome categoria e limite sono obbligatori.'); return; }
    setSubmitting(true); setError('');
    try { await onSubmit({ category: category.trim(), monthly_limit: Number(limit) || 0 }); }
    catch { setError('Salvataggio non riuscito. Riprova.'); setSubmitting(false); }
  };
  return (
    <form onSubmit={submit}>
      <Field label="Nome categoria"><input className="sd-input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Spesa" autoFocus /></Field>
      <Field label="Limite mensile (€)"><input className="sd-input" type="number" min={0} step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="300" /></Field>
      {error && <p style={errStyle}>{error}</p>}
      <FormActions onCancel={onCancel} submitting={submitting} />
    </form>
  );
}

function TransactionForm({ categoryNames, onSubmit, onCancel }: { categoryNames: string[]; onSubmit: (b: { amount: number; category: string; description: string; date: string }) => Promise<void>; onCancel: () => void }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(TODAY_ISO);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category.trim() || !date) { setError('Importo, categoria e data sono obbligatori.'); return; }
    setSubmitting(true); setError('');
    try { await onSubmit({ amount: Number(amount) || 0, category: category.trim(), description: description.trim(), date }); }
    catch { setError('Salvataggio non riuscito. Riprova.'); setSubmitting(false); }
  };
  return (
    <form onSubmit={submit}>
      <FieldRow>
        <Field label="Importo (€)"><input className="sd-input" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="24.90" autoFocus /></Field>
        <Field label="Data"><input className="sd-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </FieldRow>
      <Field label="Categoria">
        <input className="sd-input" list="budget-categorie" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Spesa" />
        <datalist id="budget-categorie">{categoryNames.map((n) => <option key={n} value={n} />)}</datalist>
      </Field>
      <Field label="Descrizione"><input className="sd-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mercadona" /></Field>
      {error && <p style={errStyle}>{error}</p>}
      <FormActions onCancel={onCancel} submitting={submitting} />
    </form>
  );
}
