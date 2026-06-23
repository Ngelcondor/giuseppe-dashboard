'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, FieldRow } from '@/components/sd/FormSheet';
import type {
  Deadline, DeadlineInput, RecurrenceType, RecurrenceInterval,
} from '@/services/scadenzeService';

/* Shared scadenza form + label/format helpers, used by the Scadenze page and
   the Budget "Scadenze" view so both edit deadlines through one definition. */

export const CATEGORIES: { value: string; label: string }[] = [
  { value: 'university', label: 'Università' },
  { value: 'personal', label: 'Personale' },
  { value: 'work', label: 'Lavoro' },
  { value: 'certification', label: 'Certificazione' },
  { value: 'ctf', label: 'CTF' },
  { value: 'other', label: 'Altro' },
];
export const PRIORITIES: { value: string; label: string }[] = [
  { value: 'low', label: 'Bassa' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];
export const RECURRENCE_TYPES: { value: RecurrenceType; label: string }[] = [
  { value: 'none', label: 'Singola' },
  { value: 'installments', label: 'A rate' },
  { value: 'subscription', label: 'Abbonamento' },
];
export const INTERVALS: { value: RecurrenceInterval; label: string }[] = [
  { value: 'monthly', label: 'Mensile' },
  { value: 'quarterly', label: 'Trimestrale' },
  { value: 'yearly', label: 'Annuale' },
];
export const INTERVAL_LABEL: Record<RecurrenceInterval, string> = { monthly: 'mese', quarterly: 'trimestre', yearly: 'anno' };
export const INTERVAL_MONTHS: Record<RecurrenceInterval, number> = { monthly: 1, quarterly: 3, yearly: 12 };

export const toAmount = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
export const fmtEur = (n: number) => `€${n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const errStyle: React.CSSProperties = { margin: '2px 0 0', fontSize: 12.5, color: 'rgb(239 68 68)' };

export function DeadlineForm({ initial, onSubmit, onCancel }: { initial: Deadline | null; onSubmit: (b: DeadlineInput) => Promise<void>; onCancel: () => void }) {
  const [titolo, setTitolo] = useState(initial?.title ?? '');
  const [dataISO, setDataISO] = useState(initial?.due_date ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'certification');
  const [priority, setPriority] = useState(initial?.priority ?? 'medium');
  const [descrizione, setDescrizione] = useState(initial?.description ?? '');
  const [recType, setRecType] = useState<RecurrenceType>(initial?.recurrence_type ?? 'none');
  const [installmentsTotal, setInstallmentsTotal] = useState(initial?.installments_total != null ? String(initial.installments_total) : '');
  const [installmentsPaid, setInstallmentsPaid] = useState(initial?.installments_paid != null ? String(initial.installments_paid) : '0');
  const [interval, setInterval] = useState<RecurrenceInterval>(initial?.recurrence_interval ?? 'monthly');
  const [amount, setAmount] = useState(toAmount(initial?.amount) != null ? String(toAmount(initial?.amount)) : '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titolo.trim() || !dataISO) { setError('Titolo e data sono obbligatori.'); return; }
    if (recType === 'installments') {
      const tot = parseInt(installmentsTotal, 10);
      if (!Number.isInteger(tot) || tot < 1) { setError('Indica il numero di rate (≥ 1).'); return; }
      const paid = parseInt(installmentsPaid || '0', 10);
      if (paid < 0 || paid > tot) { setError('Le rate pagate devono essere tra 0 e il totale.'); return; }
    }

    const body: DeadlineInput = {
      title: titolo.trim(),
      due_date: dataISO,
      category,
      priority,
      description: descrizione.trim(),
      recurrence_type: recType,
    };
    if (recType === 'installments') {
      body.installments_total = parseInt(installmentsTotal, 10);
      body.installments_paid = parseInt(installmentsPaid || '0', 10);
      body.amount = amount ? parseFloat(amount) : null;
      body.recurrence_interval = null;
    } else if (recType === 'subscription') {
      body.recurrence_interval = interval;
      body.amount = amount ? parseFloat(amount) : null;
      body.installments_total = null;
      body.installments_paid = null;
    } else {
      body.installments_total = null;
      body.installments_paid = null;
      body.recurrence_interval = null;
      body.amount = null;
    }

    setSubmitting(true); setError('');
    try { await onSubmit(body); }
    catch { setError('Salvataggio non riuscito. Riprova.'); setSubmitting(false); }
  };

  return (
    <form onSubmit={submit}>
      <Field label="Titolo"><input className="sd-input" value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="OSCP — esame" autoFocus /></Field>
      <FieldRow>
        <Field label="Data"><input className="sd-input" type="date" value={dataISO} onChange={(e) => setDataISO(e.target.value)} /></Field>
        <Field label="Categoria">
          <select className="sd-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Priorità">
          <select className="sd-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select className="sd-select" value={recType} onChange={(e) => setRecType(e.target.value as RecurrenceType)}>
            {RECURRENCE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
      </FieldRow>

      {recType === 'installments' && (
        <FieldRow>
          <Field label="N. rate"><input className="sd-input" type="number" min={1} step={1} value={installmentsTotal} onChange={(e) => setInstallmentsTotal(e.target.value)} placeholder="6" /></Field>
          <Field label="Rate già pagate"><input className="sd-input" type="number" min={0} step={1} value={installmentsPaid} onChange={(e) => setInstallmentsPaid(e.target.value)} placeholder="0" /></Field>
        </FieldRow>
      )}
      {recType === 'subscription' && (
        <Field label="Cadenza">
          <select className="sd-select" value={interval} onChange={(e) => setInterval(e.target.value as RecurrenceInterval)}>
            {INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </Field>
      )}
      {recType !== 'none' && (
        <Field label={recType === 'installments' ? 'Importo per rata (€)' : 'Importo per periodo (€)'} hint={recType === 'installments' ? 'La prima rata cade alla data indicata; le successive a distanza di un mese.' : 'La data indicata è il primo addebito.'}>
          <input className="sd-input" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="49.90" />
        </Field>
      )}

      <Field label="Descrizione"><textarea className="sd-textarea" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Dettagli, note…" /></Field>
      {error && <p style={errStyle}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6, paddingTop: 6 }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annulla</Button>
        <Button type="submit" variant="primary" isLoading={submitting}>{initial ? 'Salva' : 'Aggiungi'}</Button>
      </div>
    </form>
  );
}
