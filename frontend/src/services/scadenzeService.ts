import api from '@/lib/api';
import { getScadenzeAccademiche, type UniEvento } from '@/services/universitaService';

export type RecurrenceType = 'none' | 'installments' | 'subscription';
export type RecurrenceInterval = 'monthly' | 'quarterly' | 'yearly';

// A non-academic deadline (certifications / CTF / rate / abbonamenti) from /deadlines.
export interface Deadline {
  id: string;
  title: string;
  description: string | null;
  due_date: string; // ISO date
  category: string; // e.g. 'ctf' | 'certification'
  priority: string; // e.g. 'high' | 'medium' | 'low'
  is_completed: boolean;
  // Recurrence (rate / abbonamento)
  recurrence_type: RecurrenceType;
  installments_total: number | null;
  installments_paid: number | null;
  recurrence_interval: RecurrenceInterval | null;
  amount: number | string | null; // numeric serialized; coerce before formatting
  // ISO dates (YYYY-MM-DD) of individually-paid rate / subscription charges.
  paid_occurrences: string[] | null;
}

// Unified item rendered by the Scadenze page (academic + certifications).
export interface ScadenzaItem {
  id: string;
  data: string; // ISO date
  titolo: string;
  sottotitolo: string;
  // 'esame' / 'consegna' (academic) or 'ctf' / 'certification' (deadlines)
  kind: 'esame' | 'consegna' | 'ctf' | 'certification' | 'altro';
  // 'academic' (read-only here, managed in Università) or 'deadline' (editable here).
  source: 'academic' | 'deadline';
  // Original deadline, carried so an edit form can prefill its fields.
  raw?: Deadline;
  // For an expanded installment occurrence: which rata this row is (1-based) and
  // the plan total, so a rate plan reads "rata 2/4" per row instead of per plan.
  occIndex?: number;
  occTotal?: number;
  // Whether THIS occurrence (this date) has been individually ticked as paid.
  // Only meaningful for recurring rows; single deadlines use raw.is_completed.
  // On the collapsed row of a settled plan it carries the settled state.
  occPaid?: boolean;
  // True for an EXPANDED occurrence row (one rata / one subscription charge):
  // the tick must PATCH that occurrence by date. Absent on single deadlines and
  // on the collapsed row of a completed plan, where the tick flips is_completed.
  occurrence?: boolean;
}

// A computed (non-persisted) occurrence of a recurring deadline.
export interface DeadlineOccurrence {
  deadline_id: string;
  title: string;
  category: string;
  priority: string;
  recurrence_type: RecurrenceType;
  date: string; // ISO date
  amount: number | string | null;
  occurrence_index: number | null; // 1-based rata number
  occurrence_total: number | null; // installments_total
}

export interface DeadlineOccurrencesResponse {
  months: number;
  horizon_end: string;
  occurrences: DeadlineOccurrence[];
}

async function getDeadlines(): Promise<Deadline[]> {
  const { data } = await api.get<Deadline[]>('/deadlines');
  return data;
}

// Only the subscription deadlines (recurring services — not installments/one-offs).
export async function getSubscriptions(): Promise<Deadline[]> {
  const all = await getDeadlines();
  return all.filter((d) => d.recurrence_type === 'subscription');
}

// Compose the academic subtitle in the design's format:
//   "Esame · UOC · {aula}"  /  "Consegna · UOC[ · {dettaglio}]"
// The design shows a short dettaglio only for some items; we surface the API
// aula for esami and otherwise keep the canonical "{Tipo} · UOC".
const academicSubtitle = (e: UniEvento): string => {
  const tipo = e.tipo === 'esame' ? 'Esame' : 'Consegna';
  const extra = e.tipo === 'esame' ? e.aula : '';
  return ['Esame', 'Consegna'].includes(tipo) && extra
    ? `${tipo} · UOC · ${extra}`
    : `${tipo} · UOC`;
};

const academicToItem = (e: UniEvento): ScadenzaItem => ({
  id: e.id,
  data: e.data,
  titolo: e.titolo,
  sottotitolo: academicSubtitle(e),
  kind: e.tipo,
  source: 'academic',
});

// Fields shared by every row of one deadline, before occurrence expansion.
const deadlineBase = (d: Deadline): Omit<ScadenzaItem, 'id' | 'data'> => ({
  titolo: d.title,
  sottotitolo: d.description ?? '',
  kind: d.category === 'certification' ? 'certification' : d.category === 'ctf' ? 'ctf' : 'altro',
  source: 'deadline',
  raw: d,
});

// ── Recurrence expansion (mirrors backend _expand_occurrences) ──
const INTERVAL_STEP: Record<RecurrenceInterval, number> = { monthly: 1, quarterly: 3, yearly: 12 };
// How far ahead open-ended subscriptions are projected into the month list.
const SUBSCRIPTION_HORIZON_MONTHS = 12;

const pad2 = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// Add `n` months to an ISO date, clamping the day to the target month length (so
// e.g. Jan 31 + 1 month → Feb 28/29 — same rule as dateutil.relativedelta).
const addMonths = (iso: string, n: number): string => {
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return isoOf(d);
};

// Expand one deadline into the rows shown in the month-grouped Scadenze view:
//   - none: the deadline itself, once.
//   - installments: one row per REMAINING unpaid rata (#paid+1 … #total), spaced
//     one month apart from due_date — so a rate plan spans future months instead
//     of collapsing onto its next due date (the bug: list stopped at that month).
//   - subscription: one row per charge dall'inizio del MESE CORRENTE (una ricarica
//     spuntata il giorno 1 resta visibile "Pagata" per tutto il mese, non sparisce
//     l'indomani), up to the projection horizon.
// A completed (or fully-paid) plan collapses back to a single row that CARRIES
// the settled state in occPaid — before, the collapsed row of a paid plan read
// as unpaid and the tick never survived a reload.
function expandDeadline(d: Deadline): ScadenzaItem[] {
  const base = deadlineBase(d);
  const paidSet = new Set(d.paid_occurrences ?? []);
  const total = d.installments_total ?? 0;
  const paid = Math.max(0, d.installments_paid ?? 0);
  const settled = d.is_completed || (d.recurrence_type === 'installments' && total > 0 && paid >= total);
  const single: ScadenzaItem = { ...base, id: d.id, data: d.due_date, occPaid: settled };
  if (d.is_completed) return [single];

  if (d.recurrence_type === 'installments') {
    if (total <= 0) return [single];
    const out: ScadenzaItem[] = [];
    for (let i = 0; i < total - paid; i++) {
      const index = paid + 1 + i;
      const data = addMonths(d.due_date, i);
      out.push({ ...base, id: `${d.id}#${index}`, data, occIndex: index, occTotal: total, occPaid: paidSet.has(data), occurrence: true });
    }
    return out.length ? out : [single];
  }

  if (d.recurrence_type === 'subscription') {
    const step = INTERVAL_STEP[d.recurrence_interval ?? 'monthly'];
    const today = isoOf(new Date());
    const monthStart = today.slice(0, 8) + '01';
    const horizon = addMonths(today, SUBSCRIPTION_HORIZON_MONTHS);
    const out: ScadenzaItem[] = [];
    let when = d.due_date;
    let guard = 0;
    while (when < monthStart && guard < 1200) { when = addMonths(when, step); guard += 1; }
    while (when <= horizon && guard < 1200) {
      out.push({ ...base, id: `${d.id}@${when}`, data: when, occPaid: paidSet.has(when), occurrence: true });
      when = addMonths(when, step);
      guard += 1;
    }
    return out.length ? out : [single];
  }

  return [single];
}

// Aggregates academic scadenze (from /university) with certification / CTF
// deadlines (from /deadlines) — the latter expanded into their recurring
// occurrences — merged and sorted ascending by date.
export async function getScadenze(): Promise<ScadenzaItem[]> {
  // Tolleranza per fonte: un ospite può avere accesso solo a una delle due
  // sezioni (universita/finanze) — il 403 dell'altra non deve azzerare tutto.
  const [academic, deadlines] = await Promise.all([
    getScadenzeAccademiche().catch(() => [] as UniEvento[]),
    getDeadlines().catch(() => [] as Deadline[]),
  ]);
  return [...academic.map(academicToItem), ...deadlines.flatMap(expandDeadline)].sort(
    (a, b) => a.data.localeCompare(b.data),
  );
}

// Expanded recurring/installment occurrences for the next N months (computed
// server-side, not persisted). Subscriptions -> recurring dates; installments
// -> remaining unpaid rate.
export async function getUpcomingOccurrences(months = 6): Promise<DeadlineOccurrencesResponse> {
  const { data } = await api.get<DeadlineOccurrencesResponse>('/deadlines/occurrences/upcoming', {
    params: { months },
  });
  return data;
}

// ── Deadline mutations (only the editable, non-academic items) ──
export interface DeadlineInput {
  title: string;
  description?: string;
  due_date: string;
  category: string;
  priority: string;
  // Recurrence (rate / abbonamento). Send 'none' for a single deadline.
  recurrence_type?: RecurrenceType;
  installments_total?: number | null;
  installments_paid?: number | null;
  recurrence_interval?: RecurrenceInterval | null;
  amount?: number | null;
  // Paid/done flag (single deadlines + subscriptions). The PUT accepts it.
  is_completed?: boolean;
}

export async function createDeadline(b: DeadlineInput): Promise<Deadline> {
  const { data } = await api.post('/deadlines', b);
  return data;
}
export async function updateDeadline(id: string, b: Partial<DeadlineInput>): Promise<Deadline> {
  const { data } = await api.put(`/deadlines/${id}`, b);
  return data;
}
export async function deleteDeadline(id: string): Promise<void> {
  await api.delete(`/deadlines/${id}`);
}

// Mark the next rata of an installment plan as paid (increments installments_paid).
export async function payInstallment(id: string): Promise<Deadline> {
  const { data } = await api.patch(`/deadlines/${id}/pay-installment`);
  return data;
}

// Tick/untick a single occurrence (one rata or one subscription charge) as paid,
// by its ISO date. Reversible and per-date; returns the updated deadline.
export async function setOccurrencePaid(id: string, date: string, paid: boolean): Promise<Deadline> {
  const { data } = await api.patch(`/deadlines/${id}/occurrence`, { date, paid });
  return data;
}

// ── Current-user role (for hiding mutation controls for guests) ──
export interface CurrentUser {
  email: string;
  role: 'admin' | 'guest';
  full_name?: string;
}

export async function getCurrentUserRole(): Promise<CurrentUser | null> {
  try {
    const { data } = await api.get<CurrentUser>('/auth/me');
    return data;
  } catch {
    return null;
  }
}
