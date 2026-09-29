'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, CheckCircle2, Circle, ChevronDown, History, CalendarRange } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/sd/FormSheet';
import { DeadlineForm, INTERVAL_LABEL, toAmount, fmtEur } from '@/components/sd/DeadlineForm';
import {
  getScadenze, createDeadline, updateDeadline, deleteDeadline, setOccurrencePaid, getCurrentUserRole,
  type ScadenzaItem, type Deadline, type DeadlineInput,
} from '@/services/scadenzeService';

/* Budget → "Scadenze" view: every dated item (academic + certifications +
   rate/abbonamenti) grouped by month, a search box, and full CRUD on editable
   deadlines. A general planning + spend overview that makes Budget the single
   home for scadenze.

   Months are collapsible cards whose header carries the month's money state
   (da pagare / totale / saldato), so the list reads as a ledger even when
   collapsed. Default: only the current month is open; past months fold into a
   single "Storico" block (kept, never dropped) and months beyond the next two
   into "Più avanti". Open/closed state persists. */

const mono = "'JetBrains Mono',monospace";
const card: React.CSSProperties = { background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', boxShadow: '0 1px 2px rgba(17,17,26,.04)', borderRadius: 16 };
const HEADING = 'rgb(var(--color-heading))';
const INDIGO = 'rgb(99 102 241)';
const AMBER = 'rgb(245 158 11)';
const MUTED = 'rgb(var(--color-muted))';
const GREEN = 'rgb(16 185 129)';
const RED = 'rgb(239 68 68)';
const OPEN_KEY = 'sd-scad-open';     // localStorage: { at, open: { [YYYY-MM | fold]: boolean } }
const STORICO = 'storico';           // fold: past months
const LATER = 'later';               // fold: months beyond current + NEAR_MONTHS
const NEAR_MONTHS = 2;

// Local (not UTC) start-of-today, so "X giorni" counts are correct near midnight in CET.
const startOfToday = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(); })();
const daysTo = (iso: string) => Math.round((new Date(iso + 'T00:00:00').getTime() - startOfToday) / 86_400_000);
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
const round2 = (n: number) => Math.round(n * 100) / 100;
// Paid state: expanded occurrence rows use their per-date tick; single
// deadlines and collapsed settled plans use is_completed/occPaid (il collasso
// porta lo stato saldato in occPaid da expandDeadline).
const isPaid = (it: ScadenzaItem): boolean =>
  it.source === 'deadline' && (it.occurrence ? !!it.occPaid : (!!it.raw?.is_completed || !!it.occPaid));

type MonthGroup = { key: string; list: ScadenzaItem[]; total: number; paid: number; remaining: number; unpaidCount: number };
const summarize = (key: string, list: ScadenzaItem[]): MonthGroup => {
  let total = 0, paid = 0, unpaidCount = 0;
  for (const it of list) {
    const a = itemAmount(it);
    if (a == null) continue;
    total += a;
    if (isPaid(it)) paid += a; else unpaidCount += 1;
  }
  return { key, list, total: round2(total), paid: round2(paid), remaining: round2(total - paid), unpaidCount };
};

// Persisted as { at: <month it was saved in>, open: {...} }. When a new month
// starts the per-month overrides are dropped (only the Storico one survives), so
// the new current month opens by default even after a "Comprimi tutto".
const readOpen = (curMonth: string): Record<string, boolean> => {
  try {
    const v = JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}');
    const open = v && typeof v.open === 'object' && v.open ? v.open as Record<string, boolean> : {};
    if (v?.at === curMonth) return open;
    return Object.fromEntries([STORICO, LATER].filter((k) => k in open).map((k) => [k, open[k]]));
  } catch { return {}; }
};
const amountLine = (d?: Deadline): string => {
  if (!d) return '';
  const amt = toAmount(d.amount);
  if (amt === null) return '';
  if (d.recurrence_type === 'subscription') return `${fmtEur(amt)} / ${INTERVAL_LABEL[d.recurrence_interval ?? 'monthly']}`;
  if (d.recurrence_type === 'installments') return `${fmtEur(amt)} a rata · ${d.installments_total ?? 0} rate`;
  return fmtEur(amt);
};

const recurrenceBadge = (it: ScadenzaItem): React.ReactNode => {
  const d = it.raw;
  if (!d) return null;
  if (d.recurrence_type === 'installments') {
    const total = it.occTotal ?? d.installments_total ?? 0;
    const next = it.occIndex ?? Math.min((d.installments_paid ?? 0) + 1, total);
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
  // Explicit open/closed overrides per month key (+ 'storico'); absent → default.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  // While searching every matching month is open; this set holds the ones the
  // user folded during THIS search (reset whenever the query changes).
  const [searchClosed, setSearchClosed] = useState<Set<string>>(new Set());
  const curMonth = useMemo(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; }, []);
  useEffect(() => { setOpenMap(readOpen(curMonth)); }, [curMonth]);
  useEffect(() => { setSearchClosed(new Set()); }, [q]);

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
  const patchItem = (id: string, raw: Deadline) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, raw } : it)));
  const patchOccPaid = (id: string, occPaid: boolean) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, occPaid } : it)));

  // Non-occurrence rows (single deadlines AND the collapsed row of a completed
  // plan): the checkbox flips the whole deadline's is_completed.
  const onCheck = async (it: ScadenzaItem) => {
    const rt = it.raw?.recurrence_type;
    if (it.source !== 'deadline' || isGuest || !it.raw || it.occurrence) return;
    const next = !it.raw.is_completed;
    setSavingId(it.id);
    patchItem(it.id, { ...it.raw, is_completed: next }); // optimistic
    try {
      patchItem(it.id, await updateDeadline(it.raw.id, { is_completed: next }));
      // Un piano ricorrente ri-espanso/collassato cambia il numero di righe:
      // solo un reload ridisegna la lista corretta.
      if (rt && rt !== 'none') await load();
    } catch { await load(); }
    finally { setSavingId(null); }
  };

  // Recurring rows (single rata / single subscription charge): tick THIS occurrence
  // paid/unpaid by its date. Reversible and per-date — independent of the plan's
  // baseline count, so it never advances or loses the rest of the plan.
  const onToggleOcc = async (it: ScadenzaItem) => {
    if (it.source !== 'deadline' || isGuest || !it.raw || !it.occurrence) return;
    const next = !it.occPaid;
    setSavingId(it.id);
    patchOccPaid(it.id, next); // optimistic
    try { await setOccurrencePaid(it.raw.id, it.data, next); }
    catch { await load(); }
    finally { setSavingId(null); }
  };

  const term = q.trim().toLowerCase();
  const searching = term.length > 0;

  // filter → group by month (ascending) → split into Storico (past) / near
  // (current + next NEAR_MONTHS, one card each) / "Più avanti" (the rest of the
  // 12-month subscription projection, folded like Storico).
  const { past, upcoming, near, later } = useMemo(() => {
    const filtered = term
      ? items.filter((it) => (it.titolo + ' ' + it.sottotitolo + ' ' + it.kind).toLowerCase().includes(term))
      : items;
    const byMonth = new Map<string, ScadenzaItem[]>();
    for (const it of filtered) {
      const k = monthKey(it.data);
      (byMonth.get(k) ?? byMonth.set(k, []).get(k)!).push(it);
    }
    const all = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, list]) => summarize(k, list));
    const [y, m] = curMonth.split('-').map(Number);
    const n = new Date(y, m - 1 + NEAR_MONTHS, 1);
    const nearEnd = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    const up = all.filter((g) => g.key >= curMonth);
    return {
      past: all.filter((g) => g.key < curMonth),
      upcoming: up,
      near: up.filter((g) => g.key <= nearEnd),
      later: up.filter((g) => g.key > nearEnd),
    };
  }, [items, term, curMonth]);

  const totalCount = [...past, ...upcoming].reduce((s, g) => s + g.list.length, 0);
  // Open by default: the current month, or — if it has nothing — the next one
  // with items, so the view never opens on a wall of folded headers.
  const defaultOpenKey = upcoming[0]?.key;
  const isOpen = (key: string): boolean => {
    if (searching) return !searchClosed.has(key);
    // "Più avanti" opens by default only when it holds the default month.
    return openMap[key] ?? (key === defaultOpenKey || (key === LATER && near.length === 0));
  };
  const persist = (next: Record<string, boolean>) => {
    setOpenMap(next);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify({ at: curMonth, open: next })); } catch {/* private mode */}
  };
  const toggle = (key: string) => {
    if (searching) {
      setSearchClosed((prev) => { const s = new Set(prev); if (s.has(key)) s.delete(key); else s.add(key); return s; });
      return;
    }
    persist({ ...openMap, [key]: !isOpen(key) });
  };
  const allKeys = [
    ...(past.length ? [STORICO] : []), ...(later.length ? [LATER] : []),
    ...past.map((g) => g.key), ...upcoming.map((g) => g.key),
  ];
  const allOpen = allKeys.every(isOpen);
  const setAll = (open: boolean) => {
    if (searching) { setSearchClosed(open ? new Set() : new Set(allKeys)); return; }
    persist(Object.fromEntries(allKeys.map((k) => [k, open])));
  };

  const sumGroups = (gs: MonthGroup[]) => gs.reduce(
    (a, g) => ({ paid: round2(a.paid + g.paid), remaining: round2(a.remaining + g.remaining), unpaid: a.unpaid + g.unpaidCount }),
    { paid: 0, remaining: 0, unpaid: 0 },
  );

  const renderRow = (it: ScadenzaItem, idx: number) => {
    const d = it.raw;
    const isDeadline = it.source === 'deadline';
    const rowPaid = isPaid(it);
    const amount = itemAmount(it);
    const overdue = isDeadline && !rowPaid && amount != null && daysTo(it.data) < 0;
    const secondary = amountLine(d) || it.sottotitolo;
    return (
      // ≤560px: wrappa in [checkbox+data] / [titolo] / [importo+azioni a destra]
      <div key={it.id} className="sd-m-wrap" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: idx === 0 ? undefined : '1px solid rgb(var(--color-border))' }}>
        {/* Paid checkbox on every deadline row — single flips is_completed,
            each rata / subscription charge ticks its own occurrence.
            Academic rows keep the slot empty for alignment. */}
        <div style={{ width: 22, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isDeadline && (
            <button
              type="button"
              onClick={() => (it.occurrence ? onToggleOcc(it) : onCheck(it))}
              disabled={isGuest || savingId === it.id}
              className={!isGuest ? 'sd-press sd-checkbtn' : 'sd-checkbtn'}
              aria-label={rowPaid ? 'Segna come non pagata' : 'Segna come pagata'}
              title={rowPaid ? 'Pagata · clic per annullare' : 'Segna come pagata'}
              style={{ border: 'none', background: 'transparent', padding: 0, display: 'flex', cursor: isGuest ? 'default' : 'pointer', color: rowPaid ? GREEN : MUTED, opacity: savingId === it.id ? 0.5 : 1 }}
            >
              {rowPaid ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </button>
          )}
        </div>
        <div style={{ width: 46, flex: 'none', textAlign: 'center', opacity: rowPaid ? 0.55 : 1 }}>
          <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: dayColor(it), lineHeight: 1 }}>{dayNum(it.data)}</div>
          <div style={{ fontSize: 10, letterSpacing: '.1em', color: 'rgb(var(--color-tertiary))', textTransform: 'uppercase' }}>{monthAbbr(it.data)}</div>
        </div>
        <div className="sd-m-full" style={{ flex: 1, minWidth: 0, opacity: rowPaid ? 0.6 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14.5, fontWeight: 500, color: rowPaid ? 'rgb(var(--color-tertiary))' : 'rgb(var(--color-heading))', textDecoration: rowPaid ? 'line-through' : 'none' }}>{it.titolo}</span>
            {it.source === 'academic' && <span style={{ fontSize: 9.5, letterSpacing: '.1em', fontWeight: 600, color: MUTED, fontFamily: mono, background: 'rgb(128 128 128 / 0.12)', padding: '2px 6px', borderRadius: 5 }}>UOC</span>}
            {rowPaid
              ? <span style={{ flex: 'none', width: 'max-content', fontSize: 10.5, fontWeight: 600, color: GREEN, background: 'rgb(16 185 129 / 0.12)', border: '1px solid rgb(16 185 129 / 0.3)', borderRadius: 6, padding: '1px 7px' }}>Pagata</span>
              : recurrenceBadge(it)}
            {overdue && <span style={{ flex: 'none', width: 'max-content', fontSize: 10.5, fontWeight: 600, color: RED, background: 'rgb(239 68 68 / 0.10)', border: '1px solid rgb(239 68 68 / 0.3)', borderRadius: 6, padding: '1px 7px' }}>Scaduta</span>}
          </div>
          {secondary && <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondary}</div>}
        </div>
        {/* cluster importo+azioni: gap 14 come il padre → desktop identico */}
        <div className="sd-m-auto" style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 'none' }}>
          {amount != null
            ? <span style={{ flex: 'none', fontFamily: mono, fontSize: 13.5, fontWeight: 600, color: rowPaid ? MUTED : overdue ? RED : HEADING, textDecoration: rowPaid ? 'line-through' : 'none' }}>{fmtEur(amount)}</span>
            : daysBadge(it)}
          {isDeadline && !isGuest && (
            <div style={{ display: 'flex', gap: 2, flex: 'none' }}>
              <button className="sd-iconbtn" aria-label="Modifica" onClick={() => setEd({ open: true, editing: it.raw ?? null })}><Pencil size={14} /></button>
              <button className="sd-iconbtn" aria-label="Elimina" onClick={() => setDel({ id: it.raw?.id ?? it.id, label: it.titolo })}><Trash2 size={14} /></button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMonth = (g: MonthGroup, i: number, isPast: boolean) => {
    const open = isOpen(g.key);
    const isCurrent = g.key === curMonth;
    const settled = g.total > 0 && g.remaining <= 0;
    // "Da pagare" colour: rosso se il mese è passato (arretrato), ambra per il
    // mese corrente, neutro per i mesi futuri (è solo pianificazione).
    const dueColor = isPast ? RED : isCurrent ? AMBER : HEADING;
    const bodyId = `scad-${g.key}`;
    return (
      <div key={g.key} className="sd-reveal sd-shadow" style={{ ['--i' as string]: i + 1, ...card, marginBottom: 12, ...(isCurrent ? { borderColor: 'rgb(245 158 11 / 0.45)' } : null) }}>
        <button
          type="button"
          onClick={() => toggle(g.key)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="sd-m-wrap"
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '15px 20px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'inherit', rowGap: 8 }}
        >
          <ChevronDown size={16} style={{ flex: 'none', color: MUTED, transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: isCurrent ? HEADING : 'rgb(var(--color-tertiary))', fontWeight: 600 }}>{monthTitle(g.key)}</span>
            {isCurrent && <span style={{ fontSize: 10.5, fontWeight: 600, color: AMBER, background: 'rgb(245 158 11 / 0.12)', border: '1px solid rgb(245 158 11 / 0.35)', borderRadius: 999, padding: '1px 8px' }}>Questo mese</span>}
            <span style={{ fontSize: 11.5, color: MUTED }}>{g.list.length} {g.list.length === 1 ? 'voce' : 'voci'}</span>
          </span>
          {g.total > 0 && (
            <span className="sd-m-auto" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 8, flex: 'none', whiteSpace: 'nowrap' }}>
              {settled ? (
                <>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: GREEN }}>Saldato</span>
                  <span style={{ fontFamily: mono, fontSize: 13.5, fontWeight: 600, color: MUTED }}>{fmtEur(g.total)}</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 11.5, color: MUTED }}>{isPast ? 'Non pagato' : 'Da pagare'}</span>
                  <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: dueColor }}>{fmtEur(g.remaining)}</span>
                  {g.paid > 0 && <span style={{ fontFamily: mono, fontSize: 12, color: MUTED }}>/ {fmtEur(g.total)}</span>}
                </>
              )}
            </span>
          )}
        </button>
        {/* Progress pagato/totale: solo quando il mese è parzialmente saldato. */}
        {g.paid > 0 && g.remaining > 0 && (
          <div style={{ height: 3, margin: '-6px 20px 10px', borderRadius: 3, background: 'rgb(var(--color-card-inner))', overflow: 'hidden' }} aria-hidden>
            <div style={{ height: '100%', width: `${Math.round((g.paid / g.total) * 100)}%`, background: GREEN, borderRadius: 3 }} />
          </div>
        )}
        {open && (
          <div id={bodyId} style={{ padding: '0 22px 6px', borderTop: '1px solid rgb(var(--color-border))' }}>
            {g.list.map(renderRow)}
          </div>
        )}
      </div>
    );
  };

  // A folded block of months (Storico / Più avanti): one dashed header row
  // carrying the block's money summary, the month cards nested when open.
  const renderFold = (key: string, groups: MonthGroup[], isPast: boolean, reveal: number) => {
    if (groups.length === 0) return null;
    const open = isOpen(key);
    const s = sumGroups(groups);
    return (
      <>
        <button
          type="button"
          onClick={() => toggle(key)}
          aria-expanded={open}
          className="sd-reveal sd-m-wrap"
          style={{ ['--i' as string]: reveal, display: 'flex', alignItems: 'center', gap: 10, rowGap: 6, width: '100%', padding: '12px 20px', marginBottom: 12, borderRadius: 14, border: '1px dashed rgb(var(--color-border))', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'inherit' }}
        >
          <ChevronDown size={16} style={{ flex: 'none', color: MUTED, transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
          {isPast ? <History size={15} style={{ flex: 'none', color: MUTED }} /> : <CalendarRange size={15} style={{ flex: 'none', color: MUTED }} />}
          <span style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600 }}>{isPast ? 'Storico' : 'Più avanti'}</span>
          <span style={{ fontSize: 11.5, color: MUTED }}>
            {groups.length} {groups.length === 1 ? 'mese' : 'mesi'}
            {!isPast && ` · fino a ${monthTitle(groups[groups.length - 1].key).toLowerCase()}`}
          </span>
          <span className="sd-m-auto" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 10, flex: 'none', whiteSpace: 'nowrap' }}>
            {isPast ? (
              <>
                {s.unpaid > 0 && (
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: RED }}>
                    {s.unpaid} non {s.unpaid === 1 ? 'pagata' : 'pagate'}{s.remaining > 0 ? ` · ${fmtEur(s.remaining)}` : ''}
                  </span>
                )}
                {s.paid > 0 && <span style={{ fontSize: 11.5, color: MUTED }}>pagati <span style={{ fontFamily: mono, fontWeight: 600 }}>{fmtEur(s.paid)}</span></span>}
              </>
            ) : s.remaining > 0 && (
              <>
                <span style={{ fontSize: 11.5, color: MUTED }}>Da pagare</span>
                <span style={{ fontFamily: mono, fontSize: 13.5, fontWeight: 600, color: HEADING }}>{fmtEur(s.remaining)}</span>
              </>
            )}
          </span>
        </button>
        {open && (
          <div style={{ paddingLeft: 12, marginBottom: 18, borderLeft: '2px solid rgb(var(--color-border))' }}>
            {groups.map((g, i) => renderMonth(g, i, isPast))}
          </div>
        )}
      </>
    );
  };

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
        {totalCount > 0 && (
          <button type="button" onClick={() => setAll(!allOpen)}
            style={{ fontSize: 12, fontWeight: 500, color: INDIGO, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '6px 2px', whiteSpace: 'nowrap' }}>
            {allOpen ? 'Comprimi tutto' : 'Espandi tutto'}
          </button>
        )}
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
      ) : (
        <>
          {/* Storico: i mesi passati restano tutti consultabili, piegati in un
              blocco unico così non spingono giù il mese corrente. */}
          {renderFold(STORICO, past, true, 1)}
          {near.map((g, i) => renderMonth(g, i + 1, false))}
          {/* Più avanti: la proiezione a 12 mesi degli abbonamenti, piegata. */}
          {renderFold(LATER, later, false, near.length + 2)}
        </>
      )}

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
