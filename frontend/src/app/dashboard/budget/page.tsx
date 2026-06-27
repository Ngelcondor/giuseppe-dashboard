'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, FileUp, Landmark, RefreshCw, Tags, Tag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet, Field, FieldRow } from '@/components/sd/FormSheet';
import {
  getBudgetDashboard,
  listTransactions, createTransaction, updateTransaction, deleteTransaction, importCSV,
  recategorizeTransactions,
  initBankAuth, completeBankAuth, listInstitutions, syncBankTransactions,
  type BudgetDashboard, type CategorySpending,
  type Transaction, type ScadenzaPreview, type Institution,
} from '@/services/budgetService';
import { getCurrentUserRole } from '@/services/scadenzeService';
import { ScadenzeMese } from '@/components/sd/ScadenzeMese';
import { Abbonamenti } from '@/components/sd/Abbonamenti';

/* ── Gestione finanziaria / Banking (design Banking.dc.html) ───────────────────
   Clean banking page wired to real data: account balance + income/expenses/net,
   spending-composition donut, recent transactions, cash-flow breakdown, an
   upcoming deadline timeline, the Enable Banking connect flow, Revolut CSV import
   and the scadenze list. No budgeting/targets — just what actually happened. */

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
// Canonical category → colour, kept in sync with the backend categoriser.
const CAT_COLORS: Record<string, string> = {
  Alimentari: '99 102 241', Trasporti: '16 185 129', Casa: '245 158 11',
  Bollette: '234 179 8', Ristorazione: '236 72 153', Abbonamenti: '139 92 246',
  Studio: '168 85 247', Salute: '244 63 94', Tech: '14 165 233',
  Shopping: '249 115 22', Svago: '148 163 184', Viaggi: '6 182 212',
  Prelievi: '120 113 108', Commissioni: '113 113 122', Entrate: '34 197 94',
  Altro: '100 116 139',
};
function colorFor(cat: string, i = 0): string {
  if (CAT_COLORS[cat]) return CAT_COLORS[cat];
  const k = (cat || '').toLowerCase();
  if (/affitt|casa|rent|alloggi/.test(k)) return '245 158 11';
  if (/spesa|cibo|aliment|mercad|grocer|super|lidl/.test(k)) return '99 102 241';
  if (/trasport|treno|renfe|metro|bus|rodalies|tmb/.test(k)) return '16 185 129';
  if (/studi|htb|libr|corso|hack|uoc/.test(k)) return '168 85 247';
  if (/svago|spotif|abbon|leisure|netflix|intratten/.test(k)) return '148 163 184';
  if (/stipend|borsa|entrat|salar|income|tirocin/.test(k)) return '34 197 94';
  return PALETTE[i % PALETTE.length];
}
const round2 = (n: number) => Math.round(n * 100) / 100;

const eur = (n: number, dec = false) => {
  const s = Math.abs(n).toLocaleString('it-IT', dec
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { maximumFractionDigits: 0 });
  return (n < 0 ? '−' : '') + '€' + s;
};
const fmtTxDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
const fmtMonthLabel = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase());
const fmtSync = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'mai';

type Cat = { name: string; color: string; amount: number };
function toCats(categories: CategorySpending[]): Cat[] {
  return [...categories]
    .sort((a, b) => b.spent - a.spent)
    .map((c, i) => ({ name: c.category, color: colorFor(c.category, i), amount: c.spent }));
}
type TxView = { id: string; name: string; cat: string; dateLabel: string; amount: number; color: string; label: string };

export default function BudgetPage() {
  const [data, setData] = useState<BudgetDashboard>(FALLBACK);
  const [txs, setTxs] = useState<Transaction[]>([]);

  const [view, setView] = useState<'a' | 'b' | 'c' | 'd'>('a');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [txOpen, setTxOpen] = useState(false);
  const [del, setDel] = useState<{ id: string; label: string } | null>(null);
  const [editTx, setEditTx] = useState<TxView | null>(null);
  const [busy, setBusy] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [recatting, setRecatting] = useState(false);

  // ── Bank connection (Enable Banking) ──
  const [bankOpen, setBankOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [bankCallback, setBankCallback] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [bankCallbackMsg, setBankCallbackMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [dash, tx] = await Promise.all([
        getBudgetDashboard(MONTH, YEAR),
        listTransactions({ month: MONTH, year: YEAR, limit: 30 }),
      ]);
      setData(dash); setTxs(tx);
    } catch {/* keep current */}
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { getCurrentUserRole().then((u) => setIsGuest(u?.role === 'guest')).catch(() => {}); }, []);

  // Re-bucket imported transactions with the current category rules.
  const doRecat = async () => {
    setRecatting(true); setImportErr(null); setImportMsg(null);
    try {
      const r = await recategorizeTransactions();
      setImportMsg(r.updated > 0 ? `${r.updated} transazioni ricategorizzate` : 'Categorie già aggiornate');
      await load();
    } catch { setImportErr('Ricategorizzazione non riuscita. Riprova.'); }
    finally { setRecatting(false); }
  };

  // restore prefs (active tab)
  useEffect(() => {
    try {
      const map: Record<string, 'a' | 'b' | 'c' | 'd'> = { a: 'a', b: 'b', c: 'c', d: 'd', panoramica: 'a', flusso: 'b', scadenze: 'c', abbonamenti: 'd' };
      const param = new URLSearchParams(window.location.search).get('view');
      if (param && map[param]) setView(map[param]);
      else { const v = localStorage.getItem('sd-fin-view'); if (v === 'a' || v === 'b' || v === 'c' || v === 'd') setView(v); }
    } catch {/* ignore */}
  }, []);
  const setViewP = (v: 'a' | 'b' | 'c' | 'd') => { setView(v); try { localStorage.setItem('sd-fin-view', v); } catch {/**/} };

  // Manual bank sync (pull transactions for an already-connected account).
  const doSync = async () => {
    setSyncing(true); setImportErr(null); setImportMsg(null);
    try {
      const r = await syncBankTransactions(90);
      setImportMsg(`${r.imported} transazioni sincronizzate${r.skipped ? ` · ${r.skipped} già presenti` : ''}`);
      await load();
    } catch { setImportErr('Sincronizzazione non riuscita. Riprova.'); }
    finally { setSyncing(false); }
  };

  // Enable Banking callback: bank redirects back with ?code=&state=.
  useEffect(() => {
    let alive = true;
    const sp = new URLSearchParams(window.location.search);
    const code = sp.get('code');
    if (!code) return;
    const state = sp.get('state') ?? undefined;
    setBankCallback('busy'); setBankCallbackMsg('Collegamento in corso…');
    (async () => {
      try {
        await completeBankAuth(code, state);
        let synced = 0;
        try { synced = (await syncBankTransactions(90)).imported; } catch {/* balance still works */}
        await load();
        if (!alive) return;
        setBankCallback('done');
        setBankCallbackMsg(synced > 0 ? `Conto collegato · ${synced} transazioni importate.` : 'Conto collegato. Saldo aggiornato; nessuna transazione recente.');
      } catch {
        if (!alive) return;
        setBankCallback('error');
        setBankCallbackMsg('Collegamento al conto non riuscito. Riprova o usa l’import CSV.');
      } finally {
        try { window.history.replaceState(null, '', '/dashboard/budget'); } catch {/* ignore */}
      }
    })();
    return () => { alive = false; };
  }, [load]);

  // ── derived view model ──
  const cats = toCats(data.categories);
  // Donut + legend reconcile against the exact sum of the category rows, so the
  // centre figure always equals what the rows add up to (down to the cent).
  const catTotal = round2(cats.reduce((s, c) => s + c.amount, 0));
  const spent = Math.round(data.total_expenses);
  const income = Math.round(data.total_income);
  const net = Math.round(data.net_balance);
  const balance = data.bank_balance;                 // number | null
  const bankConnected = data.bank_connected || balance != null;

  // All categories offered in pickers: the canonical set + whatever's in use.
  const categoryNames = Array.from(
    new Set([...Object.keys(CAT_COLORS), ...data.categories.map((c) => c.category)]),
  );

  const txView: TxView[] = txs.map((t, i) => ({
    id: t.id,
    name: t.description || t.merchant_name || t.category,
    cat: t.category,
    dateLabel: fmtTxDate(t.date),
    amount: t.transaction_type === 'expense' ? -t.amount : t.amount,
    color: colorFor(t.category, i),
    label: t.description || t.category,
  }));

  // cash-flow breakdowns (Flusso)
  const incomeMap = new Map<string, number>();
  txs.filter((t) => t.transaction_type === 'income').forEach((t) => {
    const k = t.description || t.merchant_name || t.category || 'Entrata';
    incomeMap.set(k, (incomeMap.get(k) || 0) + t.amount);
  });
  const incomeRows = [...incomeMap.entries()].map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v);
  const incomeTotal = income || incomeRows.reduce((s, r) => s + r.v, 0);

  /* ── handlers ── */
  const handleFile = async (f: File) => {
    setImporting(true); setImportErr(null); setImportMsg(null);
    try {
      const res = await importCSV(f);
      setImportMsg(`${res.imported} importate · ${res.skipped} saltate${res.errors ? ` · ${res.errors} errori` : ''}`);
      await load();
    } catch { setImportErr('Import non riuscito. Usa un estratto conto Revolut in formato .csv.'); }
    finally { setImporting(false); }
  };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; };

  const submitTx = async (b: { amount: number; category: string; description: string; date: string }) => {
    await createTransaction({ amount: b.amount, category: b.category, description: b.description, transaction_type: 'expense', date: b.date });
    setTxOpen(false); await load();
  };
  const confirmDelete = async () => {
    if (!del) return;
    setBusy(true);
    try {
      await deleteTransaction(del.id);
      setDel(null); await load();
    } finally { setBusy(false); }
  };
  const saveCategory = async (category: string) => {
    if (!editTx) return;
    await updateTransaction(editTx.id, { category });
    setEditTx(null); await load();
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPick} style={{ display: 'none' }} />

      {/* ═══ HEADER ═══ */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(16 185 129)', fontFamily: mono, marginBottom: 10, fontWeight: 600 }}>Banca · {fmtMonthLabel(data.month)}</div>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.05, letterSpacing: '.02em', color: 'rgb(var(--color-heading))', fontWeight: 700 }}>Gestione finanziaria</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Button size="md" variant="secondary" isLoading={importing} onClick={() => fileRef.current?.click()}><FileUp size={15} style={{ marginRight: 6 }} />Importa CSV</Button>
          {bankConnected
            ? <Button size="md" variant="secondary" isLoading={syncing} onClick={doSync}><RefreshCw size={15} style={{ marginRight: 6 }} />Sincronizza</Button>
            : <Button size="md" variant="primary" onClick={() => setBankOpen(true)}><Landmark size={15} style={{ marginRight: 6 }} />Aggiungi banca</Button>}
        </div>
      </header>

      {(importMsg || importErr) && (
        <div className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 14, fontSize: 12.5, color: importErr ? 'rgb(245 158 11)' : 'rgb(16 185 129)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: importErr ? 'rgb(245 158 11)' : 'rgb(16 185 129)', flex: 'none' }} />{importErr ?? importMsg}
        </div>
      )}

      {/* Bank-connect callback banner */}
      {bankCallback !== 'idle' && (
        <div className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 14, border: `1px solid rgb(${bankCallback === 'error' ? '239 68 68' : '16 185 129'}/0.32)`, background: `rgb(${bankCallback === 'error' ? '239 68 68' : '16 185 129'}/0.08)` }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: `rgb(${bankCallback === 'error' ? '239 68 68' : '16 185 129'})` }} />
            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{bankCallbackMsg}</span>
          </div>
        </div>
      )}

      {/* ═══ CONTO CARD / EMPTY STATE ═══ */}
      {bankConnected ? (
        <Card i={1} pad="24px 28px" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 36, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 220 }}>
              <div style={eyebrow}>Saldo disponibile</div>
              <div style={{ fontFamily: mono, fontSize: 44, fontWeight: 600, letterSpacing: '-.03em', color: 'rgb(var(--color-heading))', lineHeight: 1, marginTop: 10 }}>{balance != null ? eur(balance, true) : '€ —'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 15 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgb(16 185 129)', flex: 'none' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgb(16 185 129)' }}>Connesso</span>
                <span style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))' }}>· {data.bank_currency} · ultimo sync {fmtSync(data.bank_last_sync)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 36, alignItems: 'center', paddingLeft: 36, borderLeft: '1px solid rgb(var(--color-border))', flexWrap: 'wrap' }}>
              <Stat label="Entrate" value={eur(income)} color="rgb(16 185 129)" />
              <Stat label="Uscite" value={eur(spent)} color="rgb(239 68 68)" />
              <Stat label="Netto" value={(net >= 0 ? '+' : '−') + eur(Math.abs(net)).replace('−', '')} />
            </div>
          </div>
        </Card>
      ) : (
        <Card i={1} pad="34px 28px" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
            <span style={{ width: 52, height: 52, borderRadius: 14, background: 'rgb(99 102 241/0.12)', color: 'rgb(99 102 241)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Landmark size={24} /></span>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'rgb(var(--color-heading))', marginTop: 4 }}>Nessuna banca collegata</div>
            <p style={{ margin: 0, fontSize: 13.5, color: 'rgb(var(--color-tertiary))', maxWidth: 420, lineHeight: 1.5 }}>Collega il tuo conto per vedere saldo, entrate, uscite e scadenze in un unico posto. Banche italiane e spagnole, sola lettura.</p>
            <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
              <Button variant="primary" onClick={() => setBankOpen(true)}><Landmark size={15} style={{ marginRight: 6 }} />Collega banca</Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>Importa CSV</Button>
            </div>
          </div>
        </Card>
      )}

      {/* ═══ TABS ═══ */}
      <div className="sd-reveal" style={{ ['--i' as string]: 2, marginBottom: 20, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 13, border: '1px solid rgb(var(--color-border))', background: 'rgb(var(--color-card-inner))' }}>
          <ViewTab active={view === 'a'} dot="16 185 129" label="Panoramica" onClick={() => setViewP('a')} />
          <ViewTab active={view === 'b'} dot="99 102 241" label="Flusso" onClick={() => setViewP('b')} />
          <ViewTab active={view === 'c'} dot="245 158 11" label="Scadenze" onClick={() => setViewP('c')} />
          <ViewTab active={view === 'd'} dot="236 72 153" label="Abbonamenti" onClick={() => setViewP('d')} />
        </div>
      </div>

      {view === 'a' && (
        <div className="sd-twocol">
          {/* Spese per categoria */}
          <Card i={3} pad="22px 24px">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <h3 style={h3}>Spese per categoria</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {!isGuest && (
                  <button onClick={doRecat} disabled={recatting} title="Riassegna le categorie alle transazioni importate"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'rgb(99 102 241)', cursor: recatting ? 'default' : 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', opacity: recatting ? 0.6 : 1 }}>
                    <Tags size={13} />{recatting ? 'Ricategorizzo…' : 'Ricategorizza'}
                  </button>
                )}
                <span style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{fmtMonthLabel(data.month).split(' ')[0]}</span>
              </div>
            </div>
            {cats.length === 0 ? <Empty>Nessuna spesa registrata.</Empty> : (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 20px' }}><CompositionDonut cats={cats} total={catTotal} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {cats.map((c) => <CatRow key={c.name} cat={c} spent={catTotal} />)}
                </div>
              </>
            )}
          </Card>

          {/* Transazioni recenti */}
          <Card i={4} pad="22px 24px">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3 style={h3}>Transazioni recenti</h3>
              <button onClick={() => setTxOpen(true)} style={{ fontSize: 12, color: 'rgb(99 102 241)', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', background: 'none', border: 'none', fontFamily: 'inherit' }}>+ Spesa</button>
            </div>
            <TxList txs={txView} onDel={(t) => setDel({ id: t.id, label: t.label })} onEdit={isGuest ? undefined : (t) => setEditTx(t)} />
          </Card>
        </div>
      )}

      {view === 'b' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 18 }} className="sd-grid3">
            <SurfaceStat i={3} label={`Entrate · ${fmtMonthLabel(data.month).split(' ')[0]}`} value={eur(income, true)} color="rgb(16 185 129)" />
            <SurfaceStat i={4} label={`Uscite · ${fmtMonthLabel(data.month).split(' ')[0]}`} value={eur(spent, true)} color="rgb(239 68 68)" />
            <SurfaceStat i={5} label="Netto" value={(net >= 0 ? '+' : '−') + eur(Math.abs(net), true).replace('−', '')} accent />
          </div>
          <div className="sd-twocol">
            <Card i={6} pad="22px 24px">
              <h3 style={{ ...h3, marginBottom: 16 }}>Entrate</h3>
              {incomeRows.length === 0 ? <Empty>Nessuna entrata registrata.</Empty> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {incomeRows.map((r) => <FlowRow key={r.name} name={r.name} value={r.v} frac={incomeTotal ? r.v / incomeTotal : 0} color="16 185 129" />)}
                </div>
              )}
            </Card>
            <Card i={7} pad="22px 24px">
              <h3 style={{ ...h3, marginBottom: 16 }}>Uscite</h3>
              {cats.length === 0 ? <Empty>Nessuna uscita registrata.</Empty> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                  {cats.map((c) => <FlowRow key={c.name} name={c.name} value={c.amount} frac={spent ? c.amount / spent : 0} color={c.color} />)}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {view === 'c' && (
        <>
          <Timeline scadenze={data.upcoming_scadenze} />
          <ScadenzeMese />
        </>
      )}

      {view === 'd' && <Abbonamenti />}

      {/* ═══ SHEETS ═══ */}
      <Sheet open={txOpen} onClose={() => setTxOpen(false)} title="Nuova spesa" subtitle="Movimento del mese">
        <TransactionForm key={txOpen ? 't' : 'c'} categoryNames={categoryNames} onSubmit={submitTx} onCancel={() => setTxOpen(false)} />
      </Sheet>
      <Sheet open={!!editTx} onClose={() => setEditTx(null)} title="Cambia categoria" subtitle={editTx?.name} maxWidth={420}>
        <CategoryEditForm key={editTx?.id ?? 'none'} current={editTx?.cat ?? ''} categoryNames={categoryNames} onSubmit={saveCategory} onCancel={() => setEditTx(null)} />
      </Sheet>
      <Sheet open={!!del} onClose={() => setDel(null)} title="Eliminare?" subtitle={del?.label} maxWidth={400}>
        <p style={{ margin: '0 0 4px', fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>L&apos;elemento verrà rimosso definitivamente.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <Button variant="secondary" onClick={() => setDel(null)} disabled={busy}>Annulla</Button>
          <Button variant="danger" isLoading={busy} onClick={confirmDelete}>Elimina</Button>
        </div>
      </Sheet>
      <Sheet open={bankOpen} onClose={() => setBankOpen(false)} title="Aggiungi banca" subtitle="Open Banking · Enable Banking · sola lettura">
        <BankConnectForm key={bankOpen ? 'open' : 'closed'} onCancel={() => setBankOpen(false)} />
      </Sheet>
    </div>
  );
}

/* ════════════════ shared bits ════════════════ */
const h3: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 600, color: 'rgb(var(--color-heading))' };
const eyebrow: React.CSSProperties = { fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600 };
const cardBase: React.CSSProperties = { background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', boxShadow: '0 1px 2px rgba(17,17,26,.04)' };

function Card({ i, pad, radius = 16, style, children }: { i: number; pad: string; radius?: number; style?: React.CSSProperties; children: React.ReactNode }) {
  return <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: i, ...cardBase, borderRadius: radius, padding: pad, ...style }}>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgb(var(--color-muted))' }}>{children}</p>;
}
function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...eyebrow, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 600, color: color ?? 'rgb(var(--color-heading))', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}
function SurfaceStat({ i, label, value, color, accent }: { i: number; label: string; value: string; color?: string; accent?: boolean }) {
  return (
    <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: i, ...cardBase, borderRadius: 14, padding: '18px 20px', ...(accent ? { background: 'rgb(99 102 241/0.10)', borderColor: 'rgb(99 102 241/0.30)' } : null) }}>
      <div style={{ ...eyebrow, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 26, fontWeight: 600, lineHeight: 1, color: color ?? 'rgb(var(--color-heading))' }}>{value}</div>
    </div>
  );
}
function ViewTab({ active, dot, label, onClick }: { active: boolean; dot: string; label: string; onClick: () => void }) {
  return (
    <button className="sd-press" onClick={onClick} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: 'transparent', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap' }}>
      {active && <span style={{ position: 'absolute', inset: 0, borderRadius: 9, background: `rgb(${dot}/0.16)`, border: `1px solid rgb(${dot}/0.42)` }} />}
      <span style={{ position: 'relative', width: 8, height: 8, borderRadius: 2, background: `rgb(${dot})` }} /><span style={{ position: 'relative' }}>{label}</span>
    </button>
  );
}

/* Spending-composition ring: each category is a slice of the month's expenses. */
function CompositionDonut({ cats, total }: { cats: Cat[]; total: number }) {
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div style={{ position: 'relative', width: 150, height: 150, flex: 'none' }}>
      <svg viewBox="0 0 120 120" width={150} height={150} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={60} cy={60} r={R} fill="none" stroke="rgb(var(--color-card-inner))" strokeWidth={13} />
        {total > 0 && cats.map((c) => {
          const seg = (c.amount / total) * C;
          const off = -acc;
          acc += seg;
          return <circle key={c.name} cx={60} cy={60} r={R} fill="none" stroke={`rgb(${c.color})`} strokeWidth={13} strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={off} />;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: mono, fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', lineHeight: 1, whiteSpace: 'nowrap' }}>{eur(total, true)}</span>
        <span style={{ ...eyebrow, marginTop: 6 }}>speso</span>
      </div>
    </div>
  );
}

function CatRow({ cat, spent }: { cat: Cat; spent: number }) {
  const frac = spent ? cat.amount / spent : 0;
  const pct = Math.round(frac * 100);
  return (
    <div className="sd-fin-legend">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'rgb(var(--color-heading))', background: 'rgb(var(--color-card-inner))', border: '1px solid rgb(var(--color-border))', borderRadius: 999, padding: '3px 10px' }}>
          <span style={{ width: 7, height: 7, borderRadius: 9, background: `rgb(${cat.color})` }} />{cat.name}
        </span>
        <span style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: mono, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{eur(cat.amount, true)}</span> · {pct}%
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 8, background: 'rgb(var(--color-card-inner))', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(frac * 100).toFixed(0)}%`, borderRadius: 8, background: `rgb(${cat.color})` }} />
      </div>
    </div>
  );
}

function FlowRow({ name, value, frac, color }: { name: string; value: number; frac: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 7 }}>
        <span style={{ fontSize: 13.5, color: 'rgb(var(--color-body))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: 'rgb(var(--color-heading))', flex: 'none' }}>{eur(value, true)}</span>
      </div>
      <div style={{ height: 8, borderRadius: 8, background: 'rgb(var(--color-card-inner))', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.round(frac * 100)}%`, borderRadius: 8, background: `rgb(${color})` }} />
      </div>
    </div>
  );
}

function TxList({ txs, onDel, onEdit }: { txs: TxView[]; onDel: (t: TxView) => void; onEdit?: (t: TxView) => void }) {
  if (txs.length === 0) return <Empty>Nessun movimento registrato.</Empty>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {txs.map((t) => (
        <div key={t.id} className="sd-fin-tx" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '13px 0', borderTop: '1px solid rgb(var(--color-border))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <span style={{ flex: 'none', width: 9, height: 9, borderRadius: 9, background: `rgb(${t.color})` }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
              {onEdit ? (
                <button onClick={() => onEdit(t)} title="Cambia categoria"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3, padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, color: `rgb(${t.color})` }}>
                  <Tag size={10} />{t.cat}
                </button>
              ) : (
                <div style={{ fontSize: 11.5, color: 'rgb(var(--color-muted))', marginTop: 2 }}>{t.cat}</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 'none' }}>
            <span style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-muted))' }}>{t.dateLabel}</span>
            <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: t.amount > 0 ? 'rgb(16 185 129)' : 'rgb(239 68 68)', minWidth: 80, textAlign: 'right' }}>{eur(t.amount, true)}</span>
            <button className="sd-iconbtn sd-fin-del" aria-label="Elimina movimento" onClick={() => onDel(t)}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Scadenze timeline (forward, next 30 days) ── */
function Timeline({ scadenze }: { scadenze: ScadenzaPreview[] }) {
  const MAXD = 30;
  const items = scadenze.filter((s) => s.days_until >= 0 && s.days_until <= MAXD).slice(0, 8);
  if (items.length === 0) return null;
  return (
    <Card i={1} pad="22px 24px" style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={h3}>Linea del tempo</h3>
        <span style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>prossimi {MAXD} giorni</span>
      </div>
      <div style={{ position: 'relative', marginTop: 4 }}>
        {/* vertical rail */}
        <div style={{ position: 'absolute', left: 5, top: 16, bottom: 16, width: 2, background: 'rgb(var(--color-border))' }} />

        {/* Oggi anchor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', position: 'relative' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', flex: 'none', background: 'rgb(var(--color-card))', border: '2px solid rgb(99 102 241)', boxShadow: '0 0 0 4px rgb(var(--color-card))' }} />
          <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 600, color: 'rgb(99 102 241)' }}>Oggi</span>
        </div>

        {items.map((s) => {
          const col = s.pagato ? '16 185 129' : s.days_until === 0 ? '239 68 68' : s.days_until <= 7 ? '245 158 11' : '99 102 241';
          const rel = s.pagato ? 'pagata' : s.days_until === 0 ? 'oggi' : s.days_until === 1 ? 'domani' : `tra ${s.days_until}g`;
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', position: 'relative', opacity: s.pagato ? 0.6 : 1 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', flex: 'none', background: `rgb(${col})`, boxShadow: '0 0 0 4px rgb(var(--color-card))' }} />
              <span style={{ width: 46, flex: 'none', fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{s.scadenza_gg_mm}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'rgb(var(--color-heading))', textDecoration: s.pagato ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.desc}</span>
              {s.importo > 0 && <span style={{ flex: 'none', fontFamily: mono, fontSize: 13, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{eur(s.importo, true)}</span>}
              <span style={{ flex: 'none', fontSize: 11, fontWeight: 600, color: `rgb(${col})`, background: `rgb(${col} / 0.12)`, border: `1px solid rgb(${col} / 0.28)`, borderRadius: 999, padding: '2px 9px', minWidth: 58, textAlign: 'center' }}>{rel}</span>
            </div>
          );
        })}
      </div>
    </Card>
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

/* Change a transaction's category — pick an existing one or type a new name. */
function CategoryEditForm({ current, categoryNames, onSubmit, onCancel }: { current: string; categoryNames: string[]; onSubmit: (category: string) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState(current);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const quick = Object.keys(CAT_COLORS).filter((c) => c !== 'Altro' && c !== 'Entrate');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) { setError('Scegli o scrivi una categoria.'); return; }
    setSubmitting(true); setError('');
    try { await onSubmit(v); }
    catch { setError('Salvataggio non riuscito. Riprova.'); setSubmitting(false); }
  };
  return (
    <form onSubmit={submit}>
      <Field label="Categoria">
        <input className="sd-input" list="tx-categorie" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Es. Alimentari" autoFocus />
        <datalist id="tx-categorie">{categoryNames.map((n) => <option key={n} value={n} />)}</datalist>
      </Field>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
        {quick.map((c) => {
          const on = value.trim().toLowerCase() === c.toLowerCase();
          const col = colorFor(c);
          return (
            <button type="button" key={c} className="sd-press" onClick={() => setValue(c)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                color: on ? `rgb(${col})` : 'rgb(var(--color-tertiary))', background: on ? `rgb(${col} / 0.14)` : 'rgb(var(--color-card-inner))', border: `1px solid ${on ? `rgb(${col} / 0.5)` : 'rgb(var(--color-border))'}` }}>
              <span style={{ width: 7, height: 7, borderRadius: 9, background: `rgb(${col})` }} />{c}
            </button>
          );
        })}
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 12, color: 'rgb(var(--color-muted))' }}>Scrivi un nome nuovo per creare una categoria.</p>
      {error && <p style={errStyle}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annulla</Button>
        <Button type="submit" variant="primary" isLoading={submitting}>Salva</Button>
      </div>
    </form>
  );
}

/* ── Bank connect (Enable Banking) ── */
function BankConnectForm({ onCancel }: { onCancel: () => void }) {
  const [country, setCountry] = useState<'ES' | 'IT'>('ES');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    listInstitutions(country)
      .then((list) => { if (alive) setInstitutions(list); })
      .catch(() => { if (alive) { setInstitutions([]); setError('Impossibile caricare le banche. Riprova più tardi.'); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [country]);

  const connect = async (bankId: string) => {
    setConnectingId(bankId); setError('');
    try {
      const res = await initBankAuth(bankId, country);
      if (res.auth_link) window.location.href = res.auth_link;
      else { setError('Il provider non ha restituito un link di autorizzazione.'); setConnectingId(null); }
    } catch { setError('Avvio del collegamento non riuscito. Riprova.'); setConnectingId(null); }
  };

  return (
    <div>
      <p style={{ ...eyebrow, margin: '0 0 10px' }}>Paese</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        {(['IT', 'ES'] as const).map((cc) => {
          const on = country === cc;
          return (
            <button key={cc} type="button" className="sd-press" onClick={() => setCountry(cc)}
              style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', padding: '13px 15px', borderRadius: 12, cursor: 'pointer',
                background: on ? 'rgb(99 102 241/0.12)' : 'rgb(var(--color-card-inner))', border: `1px solid ${on ? 'rgb(99 102 241/0.6)' : 'rgb(var(--color-border))'}`, color: on ? 'rgb(165 180 252)' : 'rgb(var(--color-tertiary))', fontFamily: 'inherit' }}>
              <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 600 }}>{cc}</span>
              <span style={{ fontSize: 13 }}>{cc === 'IT' ? 'Italia' : 'Spagna'}</span>
            </button>
          );
        })}
      </div>

      <p style={{ ...eyebrow, margin: '0 0 10px' }}>Banche disponibili</p>
      {loading ? (
        <p style={{ margin: '4px 0', fontSize: 13.5, color: 'rgb(var(--color-muted))' }}>Caricamento banche…</p>
      ) : institutions.length === 0 ? (
        <p style={{ margin: '4px 0', fontSize: 13.5, color: 'rgb(var(--color-muted))' }}>Nessuna banca disponibile per questo paese.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {institutions.map((inst) => (
            <button key={inst.id} type="button" className="sd-press" disabled={connectingId !== null} onClick={() => connect(inst.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%', padding: '11px 13px', borderRadius: 12, cursor: connectingId !== null ? 'default' : 'pointer', background: 'rgb(var(--color-card-inner))', border: '1px solid rgb(var(--color-border))', fontFamily: 'inherit', opacity: connectingId && connectingId !== inst.id ? 0.55 : 1 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgb(99 102 241/0.14)', color: 'rgb(99 102 241)', overflow: 'hidden' }}>
                {inst.logo
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={inst.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <Landmark size={17} />}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inst.name}</span>
              {connectingId === inst.id && <span style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>Avvio…</span>}
            </button>
          ))}
        </div>
      )}

      {error && <p style={errStyle}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={connectingId !== null}>Chiudi</Button>
      </div>
    </div>
  );
}
