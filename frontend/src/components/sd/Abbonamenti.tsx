'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/sd/FormSheet';
import { DeadlineForm, INTERVAL_LABEL, INTERVAL_MONTHS, toAmount, fmtEur } from '@/components/sd/DeadlineForm';
import {
  getSubscriptions, createDeadline, updateDeadline, deleteDeadline, getCurrentUserRole,
  type Deadline, type DeadlineInput, type RecurrenceInterval,
} from '@/services/scadenzeService';

/* Budget → "Abbonamenti" view: every recurring subscription (recurrence_type
   'subscription' — NOT rate/installments), with monthly + yearly spend totals,
   next charge date and full CRUD. The single home for "quanto mi costano gli
   abbonamenti al mese". */

const mono = "'JetBrains Mono',monospace";
const card: React.CSSProperties = { background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', boxShadow: '0 1px 2px rgba(17,17,26,.04)', borderRadius: 16 };
const eyebrow: React.CSSProperties = { fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600 };

const intervalColor = (i: RecurrenceInterval): string =>
  i === 'monthly' ? '99 102 241' : i === 'quarterly' ? '45 212 191' : '245 158 11';

const fmtCharge = (d: Date, withYear?: boolean) =>
  d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).replace('.', '');
const round2 = (n: number) => Math.round(n * 100) / 100;

type Row = { d: Deadline; interval: RecurrenceInterval; amt: number; monthly: number; next: Date };

// Next charge ≥ today, stepping from the first charge (due_date) by the cadence.
const nextCharge = (dueISO: string, interval: RecurrenceInterval): Date => {
  const step = INTERVAL_MONTHS[interval];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dueISO + 'T00:00:00');
  let guard = 0;
  while (d < today && guard < 600) { d.setMonth(d.getMonth() + step); guard += 1; }
  return d;
};

export function Abbonamenti() {
  const [subs, setSubs] = useState<Deadline[]>([]);
  const [isGuest, setIsGuest] = useState(false);
  const [ed, setEd] = useState<{ open: boolean; editing: Deadline | null }>({ open: false, editing: null });
  const [del, setDel] = useState<{ id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setSubs(await getSubscriptions()); } catch {/* keep */}
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { getCurrentUserRole().then((u) => setIsGuest(u?.role === 'guest')); }, []);

  const submit = async (b: DeadlineInput) => {
    if (ed.editing) await updateDeadline(ed.editing.id, b); else await createDeadline(b);
    setEd({ open: false, editing: null }); await load();
  };
  const confirmDelete = async () => {
    if (!del) return;
    setBusy(true);
    try { await deleteDeadline(del.id); setDel(null); await load(); } finally { setBusy(false); }
  };

  // view model: amount + monthly-normalized cost, ordered by charge day-of-month
  // (when in the month the money leaves), then by soonest next charge.
  const rows = useMemo(() => subs
    .map((d) => {
      const interval = (d.recurrence_interval ?? 'monthly') as RecurrenceInterval;
      const amt = toAmount(d.amount) ?? 0;
      return { d, interval, amt, monthly: amt / INTERVAL_MONTHS[interval], next: nextCharge(d.due_date, interval) };
    })
    .sort((a, b) => a.next.getDate() - b.next.getDate() || a.next.getTime() - b.next.getTime()), [subs]);

  // Annuali listed apart from sub-annual subscriptions (recurring within the month/quarter).
  const recurring = rows.filter((r) => r.interval !== 'yearly'); // already day-of-month ordered
  const annual = useMemo(
    () => rows.filter((r) => r.interval === 'yearly')
      .sort((a, b) => a.next.getMonth() - b.next.getMonth() || a.next.getDate() - b.next.getDate()),
    [rows],
  );

  const monthlyTotal = rows.reduce((s, r) => s + r.monthly, 0);
  const yearlyTotal = monthlyTotal * 12;

  return (
    <div>
      <div className="sd-reveal" style={{ ['--i' as string]: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Abbonamenti attivi</h3>
        {!isGuest && <Button size="sm" variant="primary" onClick={() => setEd({ open: true, editing: null })}><Plus size={15} style={{ marginRight: 6 }} />Abbonamento</Button>}
      </div>

      {/* spend summary */}
      <div className="sd-grid3" style={{ marginBottom: 18 }}>
        <Stat label="Spesa mensile" value={fmtEur(Math.round(monthlyTotal * 100) / 100)} accent />
        <Stat label="Spesa annua" value={fmtEur(Math.round(yearlyTotal))} />
        <Stat label="Attivi" value={String(rows.length)} />
      </div>

      {rows.length === 0 ? (
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, padding: '28px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <span style={{ width: 46, height: 46, borderRadius: 13, background: 'rgb(99 102 241/0.12)', color: 'rgb(99 102 241)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Repeat size={20} /></span>
          <p style={{ margin: 0, fontSize: 14, color: 'rgb(var(--color-muted))' }}>
            {isGuest ? 'Nessun abbonamento.' : <>Nessun abbonamento. Aggiungine uno con <strong style={{ fontWeight: 600 }}>+ Abbonamento</strong>.</>}
          </p>
        </div>
      ) : (
        <>
          <Group
            title="Mensili e trimestrali"
            rows={recurring}
            totalLabel={recurring.length ? `${fmtEur(round2(recurring.reduce((s, r) => s + r.monthly, 0)))}/mese` : ''}
            isGuest={isGuest}
            onEdit={(d) => setEd({ open: true, editing: d })}
            onDel={(d) => setDel({ id: d.id, label: d.title })}
          />
          <Group
            title="Annuali"
            yearly
            rows={annual}
            totalLabel={annual.length ? `${fmtEur(Math.round(annual.reduce((s, r) => s + r.amt, 0)))}/anno` : ''}
            isGuest={isGuest}
            onEdit={(d) => setEd({ open: true, editing: d })}
            onDel={(d) => setDel({ id: d.id, label: d.title })}
          />
        </>
      )}

      <Sheet open={ed.open} onClose={() => setEd({ open: false, editing: null })} title={ed.editing ? 'Modifica abbonamento' : 'Nuovo abbonamento'} subtitle="Servizio ricorrente · costo per periodo">
        <DeadlineForm key={ed.editing?.id ?? 'new-sub'} initial={ed.editing} defaultType="subscription" onSubmit={submit} onCancel={() => setEd({ open: false, editing: null })} />
      </Sheet>
      <Sheet open={!!del} onClose={() => setDel(null)} title="Eliminare?" subtitle={del?.label} maxWidth={400}>
        <p style={{ margin: '0 0 4px', fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>L&apos;abbonamento verrà rimosso definitivamente.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <Button variant="secondary" onClick={() => setDel(null)} disabled={busy}>Annulla</Button>
          <Button variant="danger" isLoading={busy} onClick={confirmDelete}>Elimina</Button>
        </div>
      </Sheet>
    </div>
  );
}

function Group({ title, totalLabel, rows, yearly, isGuest, onEdit, onDel }: {
  title: string; totalLabel: string; rows: Row[]; yearly?: boolean; isGuest: boolean;
  onEdit: (d: Deadline) => void; onDel: (d: Deadline) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="sd-reveal" style={{ ['--i' as string]: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, margin: '0 4px 10px' }}>
        <span style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600 }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11.5, color: 'rgb(var(--color-muted))' }}>{rows.length} {rows.length === 1 ? 'voce' : 'voci'}</span>
          {totalLabel && <span style={{ fontFamily: mono, fontSize: 13.5, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{totalLabel}</span>}
        </span>
      </div>
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, padding: '6px 22px' }}>
        {rows.map((r, i) => <SubRow key={r.d.id} r={r} first={i === 0} yearly={yearly} isGuest={isGuest} onEdit={onEdit} onDel={onDel} />)}
      </div>
    </div>
  );
}

function SubRow({ r, first, yearly, isGuest, onEdit, onDel }: {
  r: Row; first: boolean; yearly?: boolean; isGuest: boolean;
  onEdit: (d: Deadline) => void; onDel: (d: Deadline) => void;
}) {
  const c = intervalColor(r.interval);
  const perLabel = INTERVAL_LABEL[r.interval];
  const cadence = r.interval === 'monthly' ? 'Mensile' : r.interval === 'quarterly' ? 'Trimestrale' : 'Annuale';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: first ? undefined : '1px solid rgb(var(--color-border))' }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, flex: 'none', background: `rgb(${c})` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{r.d.title}</span>
          {!yearly && <span style={{ flex: 'none', width: 'max-content', fontSize: 10.5, fontWeight: 600, color: `rgb(${c})`, background: `rgb(${c} / 0.12)`, border: `1px solid rgb(${c} / 0.3)`, borderRadius: 6, padding: '1px 7px' }}>{cadence}</span>}
        </div>
        <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', marginTop: 2 }}>
          Prossimo addebito · {fmtCharge(r.next, yearly)}{r.d.description ? ` · ${r.d.description}` : ''}
        </div>
      </div>
      <div style={{ flex: 'none', textAlign: 'right' }}>
        <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{fmtEur(r.amt)}<span style={{ fontSize: 11, color: 'rgb(var(--color-muted))', fontWeight: 400 }}>/{perLabel}</span></div>
        {r.interval !== 'monthly' && <div style={{ fontSize: 10.5, color: 'rgb(var(--color-muted))', fontFamily: mono }}>≈ {fmtEur(round2(r.monthly))}/mese</div>}
      </div>
      {!isGuest && (
        <div style={{ display: 'flex', gap: 2, flex: 'none' }}>
          <button className="sd-iconbtn" aria-label="Modifica" onClick={() => onEdit(r.d)}><Pencil size={14} /></button>
          <button className="sd-iconbtn" aria-label="Elimina" onClick={() => onDel(r.d)}><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, borderRadius: 14, padding: '16px 18px', ...(accent ? { background: 'rgb(99 102 241/0.10)', borderColor: 'rgb(99 102 241/0.30)' } : null) }}>
      <div style={{ ...eyebrow, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 600, lineHeight: 1, color: accent ? 'rgb(99 102 241)' : 'rgb(var(--color-heading))' }}>{value}</div>
    </div>
  );
}
