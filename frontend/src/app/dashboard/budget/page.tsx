'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet, Field, FieldRow } from '@/components/sd/FormSheet';
import {
  getBudgetDashboard, listGoals, createGoal, deleteGoal,
  listTransactions, createTransaction, deleteTransaction,
  type BudgetDashboard, type CategorySpending, type BudgetGoal, type Transaction,
} from '@/services/budgetService';

const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};
const mono = "'JetBrains Mono',monospace";
const errStyle: React.CSSProperties = { margin: '2px 0 0', fontSize: 12.5, color: 'rgb(239 68 68)' };

// Current month context (today is 2026-06-21).
const MONTH = 6;
const YEAR = 2026;
const FIRST_DAY_ISO = '2026-06-01';
const TODAY_ISO = '2026-06-21';

// Empty fallback — no fabricated data. The page renders honest zero/empty
// states before auth/fetch resolves and on error, never invented numbers.
const FALLBACK: BudgetDashboard = {
  bank_connected: false,
  bank_balance: null,
  bank_currency: 'EUR',
  bank_last_sync: null,
  month: '2026-06-01',
  total_income: 0,
  total_expenses: 0,
  net_balance: 0,
  categories: [],
  upcoming_scadenze: [],
  overdue_scadenze: [],
  scadenze_total: 0,
  scadenze_paid: 0,
  scadenze_remaining: 0,
  recent_transactions: [],
};

// Per-category display metadata (order + bar color) matching the approved design.
// The API returns categories alphabetically; this preserves the original order/colors.
const CATEGORY_META: Record<string, { order: number; color: string }> = {
  'Affitto · Barcellona': { order: 0, color: 'rgb(245 158 11)' },
  'Spesa': { order: 1, color: 'rgb(99 102 241)' },
  'Trasporti': { order: 2, color: 'rgb(16 185 129)' },
  'Studio · HTB + libri': { order: 3, color: 'rgb(16 185 129)' },
  'Svago': { order: 4, color: 'rgb(var(--color-muted))' },
};

const fmtEur = (n: number) => `€${Math.round(n)}`;
const monthIndex = (iso: string) => Number(iso.slice(5, 7)) - 1;
const daysLeftInMonth = (iso: string) => {
  const year = Number(iso.slice(0, 4));
  const m = monthIndex(iso);
  const lastDay = new Date(year, m + 1, 0).getDate();
  const today = new Date();
  // Only meaningful when viewing the current month.
  if (today.getFullYear() === year && today.getMonth() === m) {
    return Math.max(0, lastDay - today.getDate());
  }
  return lastDay;
};
const fmtMonthLabel = (iso: string) =>
  new Date(iso + 'T00:00:00')
    .toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase());
const fmtTxDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

const orderedCategories = (cats: CategorySpending[]) =>
  [...cats].sort(
    (a, b) =>
      (CATEGORY_META[a.category]?.order ?? 99) - (CATEGORY_META[b.category]?.order ?? 99),
  );

export default function BudgetPage() {
  const [data, setData] = useState<BudgetDashboard>(FALLBACK);
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const load = useCallback(async () => {
    try {
      const [dash, gls, txs] = await Promise.all([
        getBudgetDashboard(MONTH, YEAR),
        listGoals(),
        listTransactions({ month: MONTH, year: YEAR, limit: 20 }),
      ]);
      setData(dash);
      setGoals(gls);
      setTransactions(txs);
    } catch {/* keep current */}
  }, []);
  useEffect(() => { load(); }, [load]);

  const [goalOpen, setGoalOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [del, setDel] = useState<{ kind: 'goal' | 'tx'; id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // category name → goal id, for deletion from the category bar.
  const goalByCategory = new Map(goals.map((g) => [g.category, g.id]));
  const categoryNames = Array.from(
    new Set([...data.categories.map((c) => c.category), ...goals.map((g) => g.category)]),
  );

  const totalLimit = data.categories.reduce((s, c) => s + (c.limit ?? 0), 0);
  const remaining = Math.max(0, totalLimit - data.total_expenses);
  const overallPct = totalLimit ? Math.floor((data.total_expenses / totalLimit) * 100) : 0;
  const daysLeft = daysLeftInMonth(data.month);

  const submitGoal = async (body: { category: string; monthly_limit: number }) => {
    await createGoal({ category: body.category, monthly_limit: body.monthly_limit, month: FIRST_DAY_ISO });
    setGoalOpen(false);
    await load();
  };
  const submitTx = async (body: { amount: number; category: string; description: string; date: string }) => {
    await createTransaction({
      amount: body.amount, category: body.category, description: body.description,
      transaction_type: 'expense', date: body.date,
    });
    setTxOpen(false);
    await load();
  };
  const confirmDelete = async () => {
    if (!del) return;
    setBusy(true);
    try {
      if (del.kind === 'goal') await deleteGoal(del.id);
      else await deleteTransaction(del.id);
      setDel(null);
      await load();
    } finally { setBusy(false); }
  };

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(16 185 129)', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>{fmtMonthLabel(data.month)}</div>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>Budget</h1>
        <p style={{ margin: '11px 0 0', fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>Spese del mese per categoria</p>
      </header>

      {/* Month total */}
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, borderRadius: 18, padding: '26px 28px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600, marginBottom: 8 }}>Speso questo mese</div>
            <div style={{ fontFamily: mono, fontSize: 34, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{fmtEur(data.total_expenses)} <span style={{ color: 'rgb(var(--color-muted))', fontSize: 20 }}>/ {Math.round(totalLimit)}</span></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 600, color: 'rgb(16 185 129)' }}>{fmtEur(remaining)}</div>
            <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>rimasti · {daysLeft} giorni</div>
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 8, background: 'rgb(var(--color-card-inner))', overflow: 'hidden' }}><div style={{ height: '100%', width: `${overallPct}%`, borderRadius: 8, background: 'rgb(16 185 129)' }} /></div>
      </div>

      {/* Per categoria */}
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 2, ...card, padding: '22px 24px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Per categoria</h3>
          <Button size="sm" variant="primary" onClick={() => setGoalOpen(true)}><Plus size={15} style={{ marginRight: 6 }} />Categoria</Button>
        </div>
        {data.categories.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: 'rgb(var(--color-muted))' }}>Nessuna spesa registrata questo mese.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {orderedCategories(data.categories).map((c) => {
              const goalId = goalByCategory.get(c.category);
              return (
                <CategoryBar
                  key={c.category}
                  name={c.category}
                  amount={`${fmtEur(c.spent)} / ${Math.round(c.limit ?? 0)}`}
                  width={`${Math.max(2, Math.floor(c.percentage))}%`}
                  color={CATEGORY_META[c.category]?.color ?? 'rgb(var(--color-muted))'}
                  onDelete={goalId ? () => setDel({ kind: 'goal', id: goalId, label: c.category }) : undefined}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Movimenti recenti */}
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 3, ...card, padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Movimenti recenti</h3>
          <Button size="sm" variant="secondary" onClick={() => setTxOpen(true)}><Plus size={15} style={{ marginRight: 6 }} />Spesa</Button>
        </div>
        {transactions.length === 0 ? (
          <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>Nessun movimento registrato.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {transactions.map((t, idx) => (
              <TransactionRow key={t.id} tx={t} onDelete={() => setDel({ kind: 'tx', id: t.id, label: t.description || t.category })} last={idx === transactions.length - 1} />
            ))}
          </div>
        )}
      </div>

      {/* ── Sheets ── */}
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

function CategoryBar({ name, amount, width, color, onDelete }: { name: string; amount: string; width: string; color: string; onDelete?: () => void }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{name}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: mono, fontSize: 13, color: 'rgb(var(--color-tertiary))' }}>{amount}</span>
          {onDelete && <button className="sd-iconbtn" aria-label="Elimina categoria" onClick={onDelete} style={{ alignSelf: 'center' }}><Trash2 size={13} /></button>}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 8, background: 'rgb(var(--color-card-inner))', overflow: 'hidden' }}><div style={{ height: '100%', width, borderRadius: 8, background: color }} /></div>
    </div>
  );
}

function TransactionRow({ tx, onDelete, last }: { tx: Transaction; onDelete: () => void; last?: boolean }) {
  const isExpense = tx.transaction_type === 'expense';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: last ? '14px 0 4px' : '14px 0', borderTop: '1px solid rgb(var(--color-border))' }}>
      <div style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-tertiary))', width: 52, flex: 'none' }}>{fmtTxDate(tx.date)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{tx.category}</div>
        {tx.description && <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>}
      </div>
      <div style={{ fontFamily: mono, fontSize: 13.5, fontWeight: 600, color: isExpense ? 'rgb(239 68 68)' : 'rgb(16 185 129)', flex: 'none' }}>{isExpense ? '−' : '+'}{fmtEur(tx.amount)}</div>
      <button className="sd-iconbtn" aria-label="Elimina movimento" onClick={onDelete} style={{ flex: 'none' }}><Trash2 size={14} /></button>
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
    try {
      await onSubmit({ category: category.trim(), monthly_limit: Number(limit) || 0 });
    } catch { setError('Salvataggio non riuscito. Riprova.'); setSubmitting(false); }
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
    try {
      await onSubmit({ amount: Number(amount) || 0, category: category.trim(), description: description.trim(), date });
    } catch { setError('Salvataggio non riuscito. Riprova.'); setSubmitting(false); }
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
