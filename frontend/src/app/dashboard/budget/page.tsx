'use client';

import React, { useEffect, useState } from 'react';
import { getBudgetDashboard, type BudgetDashboard, type CategorySpending } from '@/services/budgetService';

const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};
const mono = "'JetBrains Mono',monospace";

// Seeded fallback — matches the DB seed, so the page renders identically
// before auth/fetch resolves and never goes blank.
const FALLBACK: BudgetDashboard = {
  bank_connected: false,
  bank_balance: null,
  bank_currency: 'EUR',
  bank_last_sync: null,
  month: '2026-06-01',
  total_income: 0,
  total_expenses: 642,
  net_balance: -642,
  categories: [
    { category: 'Affitto · Barcellona', spent: 420, limit: 420, remaining: 0, percentage: 100 },
    { category: 'Spesa', spent: 150, limit: 200, remaining: 50, percentage: 75 },
    { category: 'Trasporti', spent: 42, limit: 80, remaining: 38, percentage: 52.5 },
    { category: 'Studio · HTB + libri', spent: 30, limit: 100, remaining: 70, percentage: 30 },
    { category: 'Svago', spent: 0, limit: 100, remaining: 100, percentage: 0 },
  ],
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

const orderedCategories = (cats: CategorySpending[]) =>
  [...cats].sort(
    (a, b) =>
      (CATEGORY_META[a.category]?.order ?? 99) - (CATEGORY_META[b.category]?.order ?? 99),
  );

export default function BudgetPage() {
  const [data, setData] = useState<BudgetDashboard>(FALLBACK);

  useEffect(() => {
    let alive = true;
    getBudgetDashboard(6, 2026)
      .then((d) => { if (alive) setData(d); })
      .catch(() => {/* keep fallback */});
    return () => { alive = false; };
  }, []);

  const totalLimit = data.categories.reduce((s, c) => s + (c.limit ?? 0), 0);
  const remaining = Math.max(0, totalLimit - data.total_expenses);
  const overallPct = totalLimit ? Math.floor((data.total_expenses / totalLimit) * 100) : 0;
  const daysLeft = daysLeftInMonth(data.month);

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
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 2, ...card, padding: '22px 24px' }}>
        <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Per categoria</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {orderedCategories(data.categories).map((c) => (
            <CategoryBar
              key={c.category}
              name={c.category}
              amount={`${fmtEur(c.spent)} / ${Math.round(c.limit ?? 0)}`}
              width={`${Math.max(2, Math.floor(c.percentage))}%`}
              color={CATEGORY_META[c.category]?.color ?? 'rgb(var(--color-muted))'}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryBar({ name, amount, width, color }: { name: string; amount: string; width: string; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{name}</span>
        <span style={{ fontFamily: mono, fontSize: 13, color: 'rgb(var(--color-tertiary))' }}>{amount}</span>
      </div>
      <div style={{ height: 8, borderRadius: 8, background: 'rgb(var(--color-card-inner))', overflow: 'hidden' }}><div style={{ height: '100%', width, borderRadius: 8, background: color }} /></div>
    </div>
  );
}
