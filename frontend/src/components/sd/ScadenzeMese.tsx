'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/sd/FormSheet';
import { DeadlineForm, INTERVAL_LABEL, toAmount, fmtEur } from '@/components/sd/DeadlineForm';
import {
  getScadenze, createDeadline, updateDeadline, deleteDeadline, payInstallment, getCurrentUserRole,
  type ScadenzaItem, type Deadline, type DeadlineInput,
} from '@/services/scadenzeService';

/* Budget → "Scadenze" view: every dated item (academic + certifications +
   rate/abbonamenti) grouped by month with a per-month total, a search box, and
   full CRUD on editable deadlines. A general planning + spend overview that
   makes Budget the single home for scadenze. */

const mono = "'JetBrains Mono',monospace";
const card: React.CSSProperties = { background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', boxShadow: '0 1px 2px rgba(17,17,26,.04)', borderRadius: 16 };
const HEADING = 'rgb(var(--color-heading))';
const INDIGO = 'rgb(99 102 241)';
const AMBER = 'rgb(245 158 11)';
const MUTED = 'rgb(var(--color-muted))';

const TODAY = '2026-06-22';
const daysTo = (iso: string) => Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(TODAY + 'T00:00:00').getTime()) / 86_400_000);
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit' });
const monthAbbr = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');
const monthKey = (iso: string) => iso.slice(0, 7); // YYYY-MM
const monthTitle = (key: string) =>
  new Date(key + '-01T00:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());

const dayColor = (it: ScadenzaItem): string => {
  if (it.kind === 'esame' || it.kind === 'ctf') return INDIGO;
  if (it.kind === 'certification') return MUTED;
  if (it.kind === 'consegna' && daysTo(it.data) <= 7) return AMBER;
  return HEADING;
};

// per-item amount due (one installment / one period / single amount)
const itemAmount = (it: ScadenzaItem): number | null => toAmount(it.raw?.amount);
const amountLine = (d?: Deadline): string => {
  if (!d) return '';
  const amt = toAmount(d.amount);
  if (amt === null) return '';
  if (d.recurrence_type === 'subscription') return `${fmtEur(amt)} / ${INTERVAL_LABEL[d.recurrence_interval ?? 'monthly']}`;
  if (d.recurrence_type === 'installments') return `${fmtEur(amt)} a rata · ${d.installments_total ?? 0} rate`;
  return fmtEur(amt);
};

const recurrenceBadge = (d?: Deadline): React.ReactNode => {
  if (!d) return null;
  if (d.recurrence_type === 'installments') {
    const total = d.installments_total ?? 0;
    const next = Math.min((d.installments_paid ?? 0) + 1, total);
    return <Badge variant="warning" size="sm" style={{ flex: 'none', width: 'max-content' }}>rata {next}/{total}</Badge>;
  }
  if (d.recurrence_type === 'subscription') {
    return <Badge variant="info" size="sm" style={{ flex: 'none', width: 'max-content' }}>Abbonamento · {INTERVAL_LABEL[d.recurrence_interval ?? 'monthly']}</Badge>;
  }
  return null;
};

const daysBadge = (it: ScadenzaItem): React.ReactNode => {
  const d = daysTo(it.data);
  if (d < 0) return <Badge variant="secondary" size="sm" style={{ flex: 'none', width: 'max-content' }}>passata</Badge>;
  const label = `${d} ${d === 1 ? 'giorno' : 'giorni'}`;
  if (it.kind === 'esame' || it.kind === 'ctf') return <Badge variant="primary" size="sm" style={{ flex: 'none', width: 'max-content' }}>{label}</Badge>;
  if (it.kind === 'consegna' && d <= 7) return <Badge variant="warning" size="sm" style={{ flex: 'none', width: 'max-content' }}>{label}</Badge>;
  return <Badge variant="info" size="sm" style={{ flex: 'none', width: 'max-content' }}>{label}</Badge>;
};

export function ScadenzeMese() {
  const [items, setItems] = useState<ScadenzaItem[]>([]);
  const [isGuest, setIsGuest] = useState(false);
  const [q, setQ] = useState('');
  const [ed, setEd] = useState<{ open: boolean; editing: Deadline | null }>({ open: false, editing: null });
  const [del, setDel] = useState<{ id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems(await getScadenze()); } catch {/* keep */}
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
  // Mark a deadline paid via the left checkbox. Single/subscription toggle the
  // is_completed flag; installments pay the next rata (fully paid → done).
  const patchItem = (id: string, raw: Deadline) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, raw } : it)));

  const onCheck = async (it: ScadenzaItem) => {
    if (it.source !== 'deadline' || isGuest || !it.raw) return;
    const d = it.raw;
    const isInst = d.recurrence_type === 'installments';
    const paidN = d.installments_paid ?? 0;
    const total = d.installments_total ?? 0;
    if (isInst && total > 0 && paidN >= total) return; // fully paid → undo via edit
    setSavingId(it.id);
    try {
      if (isInst) {
        patchItem(it.id, await payInstallment(it.id));
      } else {
        const next = !d.is_completed;
        patchItem(it.id, { ...d, is_completed: next }); // optimistic
        patchItem(it.id, await updateDeadline(it.id, { is_completed: next }));
      }
    } catch { await load(); } finally { setSavingId(null); }
  };

  // filter → group by month (ascending)
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = term
      ? items.filter((it) => (it.titolo + ' ' + it.sottotitolo + ' ' + it.kind).toLowerCase().includes(term))
      : items;
    const byMonth = new Map<string, ScadenzaItem[]>();
    for (const it of filtered) {
      const k = monthKey(it.data);
      (byMonth.get(k) ?? byMonth.set(k, []).get(k)!).push(it);
    }
    return [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, list]) => ({
        key,
        list,
        total: list.reduce((s, it) => s + (itemAmount(it) ?? 0), 0),
      }));
  }, [items, q]);

  const totalCount = groups.reduce((s, g) => s + g.list.length, 0);

  return (
    <div>
      {/* search + add */}
      <div className="sd-reveal" style={{ ['--i' as string]: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgb(var(--color-tertiary))', pointerEvents: 'none' }} />
          <input
            className="sd-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca scadenze · titolo, tipo, descrizione…"
            style={{ paddingLeft: 38 }}
            aria-label="Cerca scadenze"
          />
        </div>
        {!isGuest && <Button size="sm" variant="primary" onClick={() => setEd({ open: true, editing: null })}><Plus size={15} style={{ marginRight: 6 }} />Scadenza</Button>}
      </div>

      {totalCount === 0 ? (
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, padding: '28px 22px' }}>
          <p style={{ margin: 0, fontSize: 14, color: 'rgb(var(--color-muted))' }}>
            {q.trim()
              ? <>Nessuna scadenza trovata per «{q.trim()}».</>
              : isGuest ? 'Nessuna scadenza.' : <>Nessuna scadenza. Aggiungine una con <strong style={{ fontWeight: 600 }}>+ Scadenza</strong>.</>}
          </p>
        </div>
      ) : groups.map((g, gi) => (
        <div key={g.key} style={{ marginBottom: 22 }}>
          <div className="sd-reveal" style={{ ['--i' as string]: gi + 1, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, margin: '0 4px 10px' }}>
            <span style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600 }}>{monthTitle(g.key)}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11.5, color: 'rgb(var(--color-muted))' }}>{g.list.length} {g.list.length === 1 ? 'voce' : 'voci'}</span>
              {g.total > 0 && <span style={{ fontFamily: mono, fontSize: 13.5, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{fmtEur(Math.round(g.total))}</span>}
            </span>
          </div>
          <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: gi + 1, ...card, padding: '6px 22px' }}>
            {g.list.map((it, idx) => {
              const d = it.raw;
              const isInstallment = it.source === 'deadline' && d?.recurrence_type === 'installments';
              const paidN = d?.installments_paid ?? 0;
              const total = d?.installments_total ?? 0;
              const allPaid = isInstallment && total > 0 && paidN >= total;
              const paid = it.source === 'deadline' && (!!d?.is_completed || allPaid);
              const interactive = it.source === 'deadline' && !isGuest && !(isInstallment && allPaid);
              const secondary = amountLine(d) || it.sottotitolo;
              return (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: idx === 0 ? undefined : '1px solid rgb(var(--color-border))' }}>
                  {/* Paid checkbox — deadlines only; academic rows keep the slot empty for alignment */}
                  <div style={{ width: 22, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {it.source === 'deadline' && (
                      <button
                        type="button"
                        onClick={() => onCheck(it)}
                        disabled={!interactive || savingId === it.id}
                        className={interactive ? 'sd-press' : undefined}
                        aria-label={paid ? 'Segna non pagata' : isInstallment ? 'Segna rata pagata' : 'Segna pagata'}
                        title={paid ? 'Pagata' : isInstallment ? `Paga rata ${Math.min(paidN + 1, total)}/${total}` : 'Segna pagata'}
                        style={{ border: 'none', background: 'transparent', padding: 0, display: 'flex', cursor: interactive ? 'pointer' : 'default', color: paid ? 'rgb(16 185 129)' : 'rgb(var(--color-muted))', opacity: savingId === it.id ? 0.5 : 1 }}
                      >
                        {paid ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                      </button>
                    )}
                  </div>
                  <div style={{ width: 46, flex: 'none', textAlign: 'center', opacity: paid ? 0.55 : 1 }}>
                    <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: dayColor(it), lineHeight: 1 }}>{dayNum(it.data)}</div>
                    <div style={{ fontSize: 10, letterSpacing: '.1em', color: 'rgb(var(--color-tertiary))', textTransform: 'uppercase' }}>{monthAbbr(it.data)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, opacity: paid ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 500, color: paid ? 'rgb(var(--color-tertiary))' : 'rgb(var(--color-heading))', textDecoration: paid ? 'line-through' : 'none' }}>{it.titolo}</span>
                      {it.source === 'academic' && <span style={{ fontSize: 9.5, letterSpacing: '.1em', fontWeight: 600, color: 'rgb(var(--color-muted))', fontFamily: mono, background: 'rgb(128 128 128 / 0.12)', padding: '2px 6px', borderRadius: 5 }}>UOC</span>}
                      {paid
                        ? <span style={{ flex: 'none', width: 'max-content', fontSize: 10.5, fontWeight: 600, color: 'rgb(16 185 129)', background: 'rgb(16 185 129 / 0.12)', border: '1px solid rgb(16 185 129 / 0.3)', borderRadius: 6, padding: '1px 7px' }}>Pagata</span>
                        : recurrenceBadge(d)}
                    </div>
                    {secondary && <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondary}</div>}
                  </div>
                  {itemAmount(it) != null
                    ? <span style={{ flex: 'none', fontFamily: mono, fontSize: 13.5, fontWeight: 600, color: paid ? 'rgb(var(--color-muted))' : 'rgb(var(--color-heading))', textDecoration: paid ? 'line-through' : 'none' }}>{fmtEur(itemAmount(it)!)}</span>
                    : daysBadge(it)}
                  {it.source === 'deadline' && !isGuest && (
                    <div style={{ display: 'flex', gap: 2, flex: 'none' }}>
                      <button className="sd-iconbtn" aria-label="Modifica" onClick={() => setEd({ open: true, editing: it.raw ?? null })}><Pencil size={14} /></button>
                      <button className="sd-iconbtn" aria-label="Elimina" onClick={() => setDel({ id: it.id, label: it.titolo })}><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="sd-reveal" style={{ ['--i' as string]: 2, margin: '4px 0 0', fontSize: 12, color: 'rgb(var(--color-muted))' }}>Le scadenze accademiche (UOC) si gestiscono in Università.</p>

      <Sheet open={ed.open} onClose={() => setEd({ open: false, editing: null })} title={ed.editing ? 'Modifica scadenza' : 'Nuova scadenza'} subtitle="Singola, a rate o abbonamento">
        <DeadlineForm key={ed.editing?.id ?? 'new'} initial={ed.editing} onSubmit={submit} onCancel={() => setEd({ open: false, editing: null })} />
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
