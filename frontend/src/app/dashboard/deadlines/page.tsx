'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Sheet, Field, FieldRow } from '@/components/sd/FormSheet';
import {
  getScadenze,
  createDeadline, updateDeadline, deleteDeadline,
  type ScadenzaItem, type Deadline, type DeadlineInput,
} from '@/services/scadenzeService';

const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};
const mono = "'JetBrains Mono',monospace";
const errStyle: React.CSSProperties = { margin: '2px 0 0', fontSize: 12.5, color: 'rgb(239 68 68)' };

// Honest empty fallback — no fabricated content. Real items are loaded from
// the API; until/unless they arrive the page shows an empty-state.
const FALLBACK: ScadenzaItem[] = [];

const TODAY = new Date('2026-06-21T00:00:00');
const daysTo = (iso: string) => Math.max(0, Math.round((new Date(iso + 'T00:00:00').getTime() - TODAY.getTime()) / 86_400_000));
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit' });
const monthAbbr = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');

const HEADING = 'rgb(var(--color-heading))';
const INDIGO = 'rgb(99 102 241)';
const AMBER = 'rgb(245 158 11)';
const MUTED = 'rgb(var(--color-muted))';

// Deadline form enums → Italian labels.
const CATEGORIES: { value: string; label: string }[] = [
  { value: 'university', label: 'Università' },
  { value: 'personal', label: 'Personale' },
  { value: 'work', label: 'Lavoro' },
  { value: 'certification', label: 'Certificazione' },
  { value: 'ctf', label: 'CTF' },
  { value: 'other', label: 'Altro' },
];
const PRIORITIES: { value: string; label: string }[] = [
  { value: 'low', label: 'Bassa' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

// Day-number color + badge variant derived from item kind/urgency,
// reproducing the approved design exactly.
const dayColor = (it: ScadenzaItem): string => {
  if (it.kind === 'esame' || it.kind === 'ctf') return INDIGO;
  if (it.kind === 'certification') return MUTED;
  if (it.kind === 'consegna' && daysTo(it.data) <= 7) return AMBER;
  return HEADING;
};

const itemBadge = (it: ScadenzaItem): React.ReactNode => {
  const label = `${daysTo(it.data)} giorni`;
  if (it.kind === 'esame' || it.kind === 'ctf') return <Badge variant="primary" size="sm" style={{ flex: 'none', width: 'max-content' }}>{label}</Badge>;
  if (it.kind === 'certification') return <Badge variant="secondary" size="sm" style={{ flex: 'none', width: 'max-content' }}>{label}</Badge>;
  if (it.kind === 'consegna' && daysTo(it.data) <= 7) return <Badge variant="warning" size="sm" style={{ flex: 'none', width: 'max-content' }}>{label}</Badge>;
  return <Badge variant="info" size="sm" style={{ flex: 'none', width: 'max-content' }}>{label}</Badge>;
};

export default function DeadlinesPage() {
  const [items, setItems] = useState<ScadenzaItem[]>(FALLBACK);
  const load = useCallback(async () => {
    try { setItems(await getScadenze()); } catch {/* keep current */}
  }, []);
  useEffect(() => { load(); }, [load]);

  const [ed, setEd] = useState<{ open: boolean; editing: Deadline | null }>({ open: false, editing: null });
  const [del, setDel] = useState<{ id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submitDeadline = async (body: DeadlineInput) => {
    if (ed.editing) await updateDeadline(ed.editing.id, body);
    else await createDeadline(body);
    setEd({ open: false, editing: null });
    await load();
  };
  const confirmDelete = async () => {
    if (!del) return;
    setBusy(true);
    try {
      await deleteDeadline(del.id);
      setDel(null);
      await load();
    } finally { setBusy(false); }
  };

  const thisWeek = items.filter((it) => daysTo(it.data) <= 7);
  const later = items.filter((it) => daysTo(it.data) > 7);

  const renderRow = (it: ScadenzaItem, idx: number, list: ScadenzaItem[]) => (
    <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '16px 0', borderBottom: idx === list.length - 1 ? undefined : '1px solid rgb(var(--color-border))' }}>
      <div style={{ width: 56, flex: 'none', textAlign: 'center' }}><div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: dayColor(it), lineHeight: 1 }}>{dayNum(it.data)}</div><div style={{ fontSize: 10, letterSpacing: '.12em', color: 'rgb(var(--color-tertiary))', textTransform: 'uppercase' }}>{monthAbbr(it.data)}</div></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{it.titolo}</span>
          {it.source === 'academic' && <span style={{ fontSize: 9.5, letterSpacing: '.1em', fontWeight: 600, color: 'rgb(var(--color-muted))', fontFamily: mono, background: 'rgb(0 0 0 / 0.04)', padding: '2px 6px', borderRadius: 5 }}>UOC</span>}
        </div>
        {it.sottotitolo && <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{it.sottotitolo}</div>}
      </div>
      {itemBadge(it)}
      {it.source === 'deadline' && (
        <div style={{ display: 'flex', gap: 2, flex: 'none' }}>
          <button className="sd-iconbtn" aria-label="Modifica" onClick={() => setEd({ open: true, editing: it.raw ?? null })}><Pencil size={14} /></button>
          <button className="sd-iconbtn" aria-label="Elimina" onClick={() => setDel({ id: it.id, label: it.titolo })}><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>Pianificazione</div>
          <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>Scadenze</h1>
          <p style={{ margin: '11px 0 0', fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>Tutto ciò che ha una data · Università + Certificazioni</p>
        </div>
        <Button size="sm" variant="primary" onClick={() => setEd({ open: true, editing: null })}><Plus size={15} style={{ marginRight: 6 }} />Scadenza</Button>
      </header>

      {/* Empty-state — honest message when there are no scadenze at all */}
      {items.length === 0 && (
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, padding: '28px 22px' }}>
          <p style={{ margin: 0, fontSize: 14, color: 'rgb(var(--color-muted))' }}>Nessuna scadenza in arrivo. Aggiungine una con <strong style={{ fontWeight: 600 }}>+ Scadenza</strong>.</p>
        </div>
      )}

      {/* Questa settimana */}
      {thisWeek.length > 0 && (
        <>
          <div className="sd-reveal" style={{ ['--i' as string]: 1, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(245 158 11)', fontWeight: 600, margin: '0 0 12px' }}>Questa settimana</div>
          <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, padding: '8px 22px', marginBottom: 24 }}>
            {thisWeek.map((it, idx) => renderRow(it, idx, thisWeek))}
          </div>
        </>
      )}

      {/* Più avanti */}
      {later.length > 0 && (
        <>
          <div className="sd-reveal" style={{ ['--i' as string]: 2, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontWeight: 600, margin: '0 0 12px' }}>Più avanti</div>
          <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 2, ...card, padding: '8px 22px' }}>
            {later.map((it, idx) => renderRow(it, idx, later))}
          </div>
        </>
      )}

      {/* Footer note — academic items are managed elsewhere */}
      <p className="sd-reveal" style={{ ['--i' as string]: 3, margin: '18px 0 0', fontSize: 12, color: 'rgb(var(--color-muted))' }}>Le scadenze accademiche si gestiscono in Università.</p>

      {/* ── Sheets ── */}
      <Sheet open={ed.open} onClose={() => setEd({ open: false, editing: null })} title={ed.editing ? 'Modifica scadenza' : 'Nuova scadenza'} subtitle="Certificazione, CTF o altra scadenza">
        <DeadlineForm key={ed.editing?.id ?? 'new'} initial={ed.editing} onSubmit={submitDeadline} onCancel={() => setEd({ open: false, editing: null })} />
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

/* ── Form ── */

function DeadlineForm({ initial, onSubmit, onCancel }: { initial: Deadline | null; onSubmit: (b: DeadlineInput) => Promise<void>; onCancel: () => void }) {
  const [titolo, setTitolo] = useState(initial?.title ?? '');
  const [dataISO, setDataISO] = useState(initial?.due_date ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'certification');
  const [priority, setPriority] = useState(initial?.priority ?? 'medium');
  const [descrizione, setDescrizione] = useState(initial?.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titolo.trim() || !dataISO) { setError('Titolo e data sono obbligatori.'); return; }
    setSubmitting(true); setError('');
    try {
      await onSubmit({
        title: titolo.trim(),
        due_date: dataISO,
        category,
        priority,
        description: descrizione.trim(),
      });
    } catch { setError('Salvataggio non riuscito. Riprova.'); setSubmitting(false); }
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
        <div />
      </FieldRow>
      <Field label="Descrizione"><textarea className="sd-textarea" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Dettagli, note…" /></Field>
      {error && <p style={errStyle}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6, paddingTop: 6 }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annulla</Button>
        <Button type="submit" variant="primary" isLoading={submitting}>{initial ? 'Salva' : 'Aggiungi'}</Button>
      </div>
    </form>
  );
}
