'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { CircularProgress } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import { Sheet, Field, FieldRow } from '@/components/sd/FormSheet';
import {
  getUniversitaDashboard,
  createCorso, updateCorso, deleteCorso,
  createEvento, updateEvento, deleteEvento,
  updateProfilo,
  type UniDashboard, type UniCorso, type UniEvento, type UniProfilo,
  type CorsoInput, type EventoInput,
} from '@/services/universitaService';

const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};
const mono = "'JetBrains Mono',monospace";

// Opzioni semestre per l'anno accademico 2026/27.
const SEMESTRE_OPZIONI = ['1° semestre 26/27', '2° semestre 26/27'];
const errStyle: React.CSSProperties = { margin: '2px 0 0', fontSize: 12.5, color: 'rgb(239 68 68)' };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Honest empty state — no fabricated data. Populated from the API on fetch.
const FALLBACK: UniDashboard = {
  profilo: { corso_laurea: '', semestre: '', cfu_totali: 0, cfu_superati: 0, cfu_in_corso: 0 },
  corsi: [],
  prossimo_esame: null,
  consegne: [],
};

const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const daysTo = (iso: string) => Math.max(0, Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000));
const fmtLongDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

const corsoBadge = (s: UniCorso['stato']) =>
  s === 'in_esame' ? <Badge variant="warning" size="sm">In esame</Badge>
  : s === 'consegna' ? <Badge variant="warning" size="sm">Consegna</Badge>
  : s === 'completato' ? <Badge variant="success" size="sm">Superato</Badge>
  : <Badge variant="info" size="sm">In corso</Badge>;

const eventoBadge = (s: UniEvento['stato']) =>
  s === 'in_corso' ? <StatusBadge status="active">In corso</StatusBadge>
  : s === 'fatto' ? <StatusBadge status="completed">Fatto</StatusBadge>
  : <StatusBadge status="pending">Da fare</StatusBadge>;

export default function UniversitaPage() {
  const [data, setData] = useState<UniDashboard>(FALLBACK);
  const load = useCallback(async () => {
    try { setData(await getUniversitaDashboard()); } catch {/* keep current */}
  }, []);
  useEffect(() => { load(); }, [load]);

  const [corsoEd, setCorsoEd] = useState<{ open: boolean; editing: UniCorso | null }>({ open: false, editing: null });
  const [eventoEd, setEventoEd] = useState<{ open: boolean; editing: UniEvento | null; tipo: UniEvento['tipo'] }>({ open: false, editing: null, tipo: 'consegna' });
  const [profiloEd, setProfiloEd] = useState(false);
  const [del, setDel] = useState<{ kind: 'corso' | 'evento'; id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { profilo, corsi, prossimo_esame, consegne } = data;
  const cfuPct = profilo.cfu_totali ? Math.round((profilo.cfu_superati / profilo.cfu_totali) * 100) : 0;
  const cfuRim = Math.max(0, profilo.cfu_totali - profilo.cfu_superati - profilo.cfu_in_corso);
  const totCfu = corsi.reduce((s, c) => s + c.cfu, 0);
  const corsiNomi = corsi.map((c) => c.nome);

  const submitCorso = async (body: Partial<CorsoInput>) => {
    if (corsoEd.editing) await updateCorso(corsoEd.editing.id, body);
    else await createCorso({ ...body, ordine: corsi.length });
    setCorsoEd({ open: false, editing: null });
    await load();
  };
  const submitEvento = async (body: Partial<EventoInput>) => {
    if (eventoEd.editing) await updateEvento(eventoEd.editing.id, body);
    else await createEvento(body);
    setEventoEd({ open: false, editing: null, tipo: 'consegna' });
    await load();
  };
  const submitProfilo = async (body: Partial<UniProfilo>) => {
    await updateProfilo(body);
    setProfiloEd(false);
    await load();
  };
  const confirmDelete = async () => {
    if (!del) return;
    setBusy(true);
    try {
      if (del.kind === 'corso') await deleteCorso(del.id);
      else await deleteEvento(del.id);
      setDel(null);
      await load();
    } finally { setBusy(false); }
  };

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>Università · UOC</div>
        <h1 style={{ margin: 0, fontSize: 'clamp(28px, 7vw, 38px)', lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>
          {profilo.corso_laurea
            ? <>{profilo.corso_laurea.split(' ')[0]} <span style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>{profilo.corso_laurea.split(' ').slice(1).join(' ')}</span></>
            : 'Università'}
        </h1>
        {profilo.semestre && <p style={{ margin: '11px 0 0', fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>{profilo.semestre} · Barcellona · sessione d&apos;esami</p>}
      </header>

      {/* CFU + prossimo esame */}
      <div className="sd-twocol" style={{ marginBottom: 18 }}>
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, borderRadius: 18, padding: 'clamp(16px,4vw,26px) clamp(16px,4.5vw,28px)', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', position: 'relative' }}>
          <button className="sd-iconbtn" aria-label="Modifica profilo" onClick={() => setProfiloEd(true)} style={{ position: 'absolute', top: 14, right: 14 }}><Pencil size={15} /></button>
          <CircularProgress value={cfuPct} size="lg" variant="primary" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600, marginBottom: 8 }}>Avanzamento CFU</div>
            <div style={{ fontFamily: mono, fontSize: 30, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{profilo.cfu_superati} <span style={{ color: 'rgb(var(--color-muted))', fontSize: 20 }}>/ {profilo.cfu_totali}</span></div>
            <div style={{ display: 'flex', gap: 22, marginTop: 18 }}>
              <div><div style={{ fontFamily: mono, fontSize: 17, fontWeight: 600, color: 'rgb(16 185 129)' }}>{profilo.cfu_superati}</div><div style={{ fontSize: 11, color: 'rgb(var(--color-tertiary))' }}>superati</div></div>
              <div><div style={{ fontFamily: mono, fontSize: 17, fontWeight: 600, color: 'rgb(99 102 241)' }}>{profilo.cfu_in_corso}</div><div style={{ fontSize: 11, color: 'rgb(var(--color-tertiary))' }}>in corso</div></div>
              <div><div style={{ fontFamily: mono, fontSize: 17, fontWeight: 600, color: 'rgb(var(--color-muted))' }}>{cfuRim}</div><div style={{ fontSize: 11, color: 'rgb(var(--color-tertiary))' }}>rimanenti</div></div>
            </div>
          </div>
        </div>

        {prossimo_esame ? (
          <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 2, background: 'rgb(99 102 241)', borderRadius: 18, padding: 'clamp(16px,4vw,26px) clamp(16px,4.5vw,28px)', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 14, right: 12, display: 'flex', gap: 2 }}>
              <button className="sd-iconbtn" aria-label="Modifica esame" onClick={() => setEventoEd({ open: true, editing: prossimo_esame, tipo: 'esame' })} style={{ color: 'rgba(255,255,255,.85)' }}><Pencil size={15} /></button>
              <button className="sd-iconbtn" aria-label="Elimina esame" onClick={() => setDel({ kind: 'evento', id: prossimo_esame.id, label: prossimo_esame.titolo })} style={{ color: 'rgba(255,255,255,.85)' }}><Trash2 size={15} /></button>
            </div>
            <div>
              <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .8, fontWeight: 600, marginBottom: 12 }}>Prossimo esame</div>
              <div style={{ fontSize: 23, fontWeight: 600, lineHeight: 1.1 }}>{prossimo_esame.corso}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 14 }}><span style={{ fontFamily: mono, fontSize: 30, fontWeight: 700 }}>{daysTo(prossimo_esame.data)}</span><span style={{ opacity: .85, fontSize: 13 }}>giorni · {fmtLongDate(prossimo_esame.data)}{prossimo_esame.ora ? ` · ${prossimo_esame.ora}` : ''}</span></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22, fontFamily: mono, fontSize: 12 }}>
              {prossimo_esame.aula && <span style={{ background: 'rgb(255 255 255 / 0.18)', padding: '5px 10px', borderRadius: 8 }}>{prossimo_esame.aula}</span>}
              {prossimo_esame.cfu != null && <span style={{ background: 'rgb(255 255 255 / 0.18)', padding: '5px 10px', borderRadius: 8 }}>{prossimo_esame.cfu} CFU</span>}
            </div>
          </div>
        ) : (
          <div className="sd-reveal" style={{ ['--i' as string]: 2, ...card, borderRadius: 18, padding: 'clamp(16px,4vw,26px) clamp(16px,4.5vw,28px)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 14 }}>
            <div>
              <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600, marginBottom: 8 }}>Prossimo esame</div>
              <p style={{ margin: 0, fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>Nessun esame in programma.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setEventoEd({ open: true, editing: null, tipo: 'esame' })}><Plus size={15} style={{ marginRight: 6 }} />Aggiungi esame</Button>
          </div>
        )}
      </div>

      {/* Corsi */}
      <div className="sd-reveal" style={{ ['--i' as string]: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '30px 0 14px', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Corsi del semestre</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', fontFamily: mono, whiteSpace: 'nowrap' }}>{corsi.length} corsi · {totCfu} CFU</span>
          <Button size="sm" variant="primary" onClick={() => setCorsoEd({ open: true, editing: null })}><Plus size={15} style={{ marginRight: 6 }} />Corso</Button>
        </div>
      </div>
      {corsi.length === 0 ? (
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 4, ...card, padding: 'clamp(16px,4vw,22px) clamp(16px,4.5vw,24px)', marginBottom: 18 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>Nessun corso ancora. Aggiungi il primo con <strong style={{ fontWeight: 600 }}>+ Corso</strong>.</p>
        </div>
      ) : (
        <div className="sd-grid2" style={{ marginBottom: 18 }}>
          {corsi.map((c, idx) => (
            <CourseCard key={c.id} i={4 + idx} corso={c} onEdit={() => setCorsoEd({ open: true, editing: c })} onDelete={() => setDel({ kind: 'corso', id: c.id, label: c.nome })} />
          ))}
        </div>
      )}

      {/* Consegne */}
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 8, ...card, padding: 'clamp(16px,4vw,22px) clamp(16px,4.5vw,24px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Consegne in arrivo</h3>
          <Button size="sm" variant="secondary" onClick={() => setEventoEd({ open: true, editing: null, tipo: 'consegna' })}><Plus size={15} style={{ marginRight: 6 }} />Consegna</Button>
        </div>
        {consegne.length === 0 ? (
          <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>Nessuna consegna in arrivo.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {consegne.map((e, idx) => (
              <DeliveryRow key={e.id} evento={e} onEdit={() => setEventoEd({ open: true, editing: e, tipo: 'consegna' })} onDelete={() => setDel({ kind: 'evento', id: e.id, label: e.titolo })} last={idx === consegne.length - 1} />
            ))}
          </div>
        )}
      </div>

      {/* ── Sheets ── */}
      <Sheet open={corsoEd.open} onClose={() => setCorsoEd({ open: false, editing: null })} title={corsoEd.editing ? 'Modifica corso' : 'Nuovo corso'} subtitle="Dati del corso del semestre">
        <CorsoForm key={corsoEd.editing?.id ?? 'new'} initial={corsoEd.editing} onSubmit={submitCorso} onCancel={() => setCorsoEd({ open: false, editing: null })} />
      </Sheet>

      <Sheet open={eventoEd.open} onClose={() => setEventoEd({ open: false, editing: null, tipo: 'consegna' })} title={eventoEd.editing ? 'Modifica' : (eventoEd.tipo === 'esame' ? 'Nuovo esame' : 'Nuova consegna')} subtitle="Esame o consegna con scadenza">
        <EventoForm key={eventoEd.editing?.id ?? `new-${eventoEd.tipo}`} initial={eventoEd.editing} defaultTipo={eventoEd.tipo} corsiNomi={corsiNomi} onSubmit={submitEvento} onCancel={() => setEventoEd({ open: false, editing: null, tipo: 'consegna' })} />
      </Sheet>

      <Sheet open={profiloEd} onClose={() => setProfiloEd(false)} title="Profilo accademico" subtitle="Corso di laurea e CFU">
        <ProfiloForm key={profiloEd ? 'p' : 'c'} initial={profilo} onSubmit={submitProfilo} onCancel={() => setProfiloEd(false)} />
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

function CourseCard({ i, corso, onEdit, onDelete }: { i: number; corso: UniCorso; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="sd-reveal sd-lift" style={{ ['--i' as string]: i, ...card, padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
        <span style={{ fontFamily: mono, fontSize: 11, color: 'rgb(var(--color-tertiary))', background: 'rgb(0 0 0 / 0.04)', padding: '3px 9px', borderRadius: 7, whiteSpace: 'nowrap', flex: 'none' }}>{corso.codice} · {corso.cfu} CFU</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {corsoBadge(corso.stato)}
          <button className="sd-iconbtn" aria-label="Modifica" onClick={onEdit}><Pencil size={14} /></button>
          <button className="sd-iconbtn" aria-label="Elimina" onClick={onDelete}><Trash2 size={14} /></button>
        </div>
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, color: 'rgb(var(--color-heading))', marginBottom: 4 }}>{corso.nome}</div>
      <div style={{ fontSize: 12.5, color: 'rgb(var(--color-tertiary))', marginBottom: 16 }}>{corso.prossimo ? `Prossimo: ${corso.prossimo}` : (corso.docente || ' ')}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}><span style={{ fontSize: 11, color: 'rgb(var(--color-tertiary))' }}>Programma</span><span style={{ fontSize: 11, fontFamily: mono, color: 'rgb(var(--color-tertiary))' }}>{corso.progress}%</span></div>
      <div style={{ height: 8, borderRadius: 8, background: 'rgb(var(--color-card-inner))', overflow: 'hidden' }}><div style={{ height: '100%', width: `${clamp(corso.progress, 0, 100)}%`, borderRadius: 8, background: 'rgb(99 102 241)' }} /></div>
    </div>
  );
}

function DeliveryRow({ evento, onEdit, onDelete, last }: { evento: UniEvento; onEdit: () => void; onDelete: () => void; last?: boolean }) {
  const dot = daysTo(evento.data) <= 7 ? 'rgb(245 158 11)' : 'rgb(99 102 241)';
  return (
    <div className="sd-m-wrap" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: last ? '14px 0 4px' : '14px 0', borderTop: '1px solid rgb(var(--color-border))' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot, flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{evento.titolo}</div><div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{evento.descrizione}</div></div>
      {/* ≤560px: data/badge/azioni scendono su riga piena sotto dot+titolo */}
      <div className="sd-m-full" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{fmtDate(evento.data)}</div>
        <div style={{ flex: 'none' }}>{eventoBadge(evento.stato)}</div>
        <div style={{ display: 'flex', gap: 2, flex: 'none' }}>
          <button className="sd-iconbtn" aria-label="Modifica" onClick={onEdit}><Pencil size={14} /></button>
          <button className="sd-iconbtn" aria-label="Elimina" onClick={onDelete}><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}

/* ── Forms ── */

function FormActions({ onCancel, submitting, editing }: { onCancel: () => void; submitting: boolean; editing: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6, paddingTop: 6 }}>
      <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annulla</Button>
      <Button type="submit" variant="primary" isLoading={submitting}>{editing ? 'Salva' : 'Aggiungi'}</Button>
    </div>
  );
}

function CorsoForm({ initial, onSubmit, onCancel }: { initial: UniCorso | null; onSubmit: (b: Partial<CorsoInput>) => Promise<void>; onCancel: () => void }) {
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [codice, setCodice] = useState(initial?.codice ?? '');
  const [cfu, setCfu] = useState(String(initial?.cfu ?? 6));
  const [docente, setDocente] = useState(initial?.docente ?? '');
  const [semestre, setSemestre] = useState(initial?.semestre ?? '');
  const [stato, setStato] = useState<UniCorso['stato']>(initial?.stato ?? 'in_corso');
  const [progress, setProgress] = useState(String(initial?.progress ?? 0));
  const [prossimo, setProssimo] = useState(initial?.prossimo ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !codice.trim()) { setError('Nome e codice sono obbligatori.'); return; }
    setSubmitting(true); setError('');
    try {
      await onSubmit({
        nome: nome.trim(), codice: codice.trim(), cfu: Number(cfu) || 0,
        docente: docente.trim(), semestre: semestre.trim(), stato,
        progress: clamp(Number(progress) || 0, 0, 100), prossimo: prossimo.trim(),
      });
    } catch { setError('Salvataggio non riuscito. Riprova.'); setSubmitting(false); }
  };

  return (
    <form onSubmit={submit}>
      <Field label="Nome del corso"><input className="sd-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Sistemi Operativi" autoFocus /></Field>
      <FieldRow>
        <Field label="Codice"><input className="sd-input" value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="SO.302" /></Field>
        <Field label="CFU"><input className="sd-input" type="number" min={0} value={cfu} onChange={(e) => setCfu(e.target.value)} /></Field>
      </FieldRow>
      <FieldRow>
        <Field label="Docente"><input className="sd-input" value={docente} onChange={(e) => setDocente(e.target.value)} placeholder="prof. …" /></Field>
        <Field label="Semestre">
          <select className="sd-select" value={semestre} onChange={(e) => setSemestre(e.target.value)}>
            <option value="">—</option>
            {!SEMESTRE_OPZIONI.includes(semestre) && semestre && <option value={semestre}>{semestre}</option>}
            {SEMESTRE_OPZIONI.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Stato">
          <select className="sd-select" value={stato} onChange={(e) => setStato(e.target.value as UniCorso['stato'])}>
            <option value="in_corso">In corso</option>
            <option value="in_esame">In esame</option>
            <option value="consegna">Consegna</option>
            <option value="completato">Superato</option>
          </select>
        </Field>
        <Field label="Avanzamento (%)"><input className="sd-input" type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(e.target.value)} /></Field>
      </FieldRow>
      <Field label="Prossimo impegno" hint="Testo libero, es. «Esame · 8 luglio»"><input className="sd-input" value={prossimo} onChange={(e) => setProssimo(e.target.value)} placeholder="Esame · 8 luglio" /></Field>
      {error && <p style={errStyle}>{error}</p>}
      <FormActions onCancel={onCancel} submitting={submitting} editing={!!initial} />
    </form>
  );
}

function EventoForm({ initial, defaultTipo, corsiNomi, onSubmit, onCancel }: { initial: UniEvento | null; defaultTipo: UniEvento['tipo']; corsiNomi: string[]; onSubmit: (b: Partial<EventoInput>) => Promise<void>; onCancel: () => void }) {
  const [tipo, setTipo] = useState<UniEvento['tipo']>(initial?.tipo ?? defaultTipo);
  const [titolo, setTitolo] = useState(initial?.titolo ?? '');
  const [corso, setCorso] = useState(initial?.corso ?? '');
  const [dataISO, setDataISO] = useState(initial?.data ?? '');
  const [ora, setOra] = useState(initial?.ora ?? '');
  const [aula, setAula] = useState(initial?.aula ?? '');
  const [cfu, setCfu] = useState(initial?.cfu != null ? String(initial.cfu) : '');
  const [descrizione, setDescrizione] = useState(initial?.descrizione ?? '');
  const [stato, setStato] = useState<UniEvento['stato']>(initial?.stato ?? 'da_fare');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titolo.trim() || !dataISO) { setError('Titolo e data sono obbligatori.'); return; }
    setSubmitting(true); setError('');
    try {
      await onSubmit({
        tipo, titolo: titolo.trim(), corso: corso.trim(), data: dataISO,
        ora: ora.trim(), aula: aula.trim(),
        cfu: cfu === '' ? null : Number(cfu),
        descrizione: descrizione.trim(), stato,
      });
    } catch { setError('Salvataggio non riuscito. Riprova.'); setSubmitting(false); }
  };

  return (
    <form onSubmit={submit}>
      <FieldRow>
        <Field label="Tipo">
          <select className="sd-select" value={tipo} onChange={(e) => setTipo(e.target.value as UniEvento['tipo'])}>
            <option value="consegna">Consegna</option>
            <option value="esame">Esame</option>
          </select>
        </Field>
        <Field label="Stato">
          <select className="sd-select" value={stato} onChange={(e) => setStato(e.target.value as UniEvento['stato'])}>
            <option value="da_fare">Da fare</option>
            <option value="in_corso">In corso</option>
            <option value="fatto">Fatto</option>
          </select>
        </Field>
      </FieldRow>
      <Field label="Titolo"><input className="sd-input" value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder={tipo === 'esame' ? 'Esame — Sistemi Operativi' : 'PEC2 — Basi di Dati'} autoFocus /></Field>
      <Field label="Corso">
        <input className="sd-input" list="uni-corsi-nomi" value={corso} onChange={(e) => setCorso(e.target.value)} placeholder="Basi di Dati" />
        <datalist id="uni-corsi-nomi">{corsiNomi.map((n) => <option key={n} value={n} />)}</datalist>
      </Field>
      <FieldRow>
        <Field label="Data"><input className="sd-input" type="date" value={dataISO} onChange={(e) => setDataISO(e.target.value)} /></Field>
        <Field label="Ora" hint={tipo === 'esame' ? undefined : 'facoltativa'}><input className="sd-input" type="time" value={ora} onChange={(e) => setOra(e.target.value)} /></Field>
      </FieldRow>
      <FieldRow>
        <Field label="Aula"><input className="sd-input" value={aula} onChange={(e) => setAula(e.target.value)} placeholder="Aula 3.1" /></Field>
        <Field label="CFU"><input className="sd-input" type="number" min={0} value={cfu} onChange={(e) => setCfu(e.target.value)} placeholder="6" /></Field>
      </FieldRow>
      <Field label="Descrizione"><textarea className="sd-textarea" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Dettagli, argomenti, note…" /></Field>
      {error && <p style={errStyle}>{error}</p>}
      <FormActions onCancel={onCancel} submitting={submitting} editing={!!initial} />
    </form>
  );
}

function ProfiloForm({ initial, onSubmit, onCancel }: { initial: UniProfilo; onSubmit: (b: Partial<UniProfilo>) => Promise<void>; onCancel: () => void }) {
  const [corsoLaurea, setCorsoLaurea] = useState(initial.corso_laurea ?? '');
  const [semestre, setSemestre] = useState(initial.semestre ?? '');
  const [tot, setTot] = useState(String(initial.cfu_totali ?? 0));
  const [sup, setSup] = useState(String(initial.cfu_superati ?? 0));
  const [inc, setInc] = useState(String(initial.cfu_in_corso ?? 0));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      await onSubmit({
        corso_laurea: corsoLaurea.trim(), semestre: semestre.trim(),
        cfu_totali: Number(tot) || 0, cfu_superati: Number(sup) || 0, cfu_in_corso: Number(inc) || 0,
      });
    } catch { setError('Salvataggio non riuscito. Riprova.'); setSubmitting(false); }
  };

  return (
    <form onSubmit={submit}>
      <Field label="Corso di laurea"><input className="sd-input" value={corsoLaurea} onChange={(e) => setCorsoLaurea(e.target.value)} placeholder="Ingegneria Informatica" autoFocus /></Field>
      <Field label="Semestre">
        <select className="sd-select" value={semestre} onChange={(e) => setSemestre(e.target.value)}>
          {!SEMESTRE_OPZIONI.includes(semestre) && semestre && <option value={semestre}>{semestre}</option>}
          {SEMESTRE_OPZIONI.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 12 }}>
        <Field label="CFU totali"><input className="sd-input" type="number" min={0} value={tot} onChange={(e) => setTot(e.target.value)} /></Field>
        <Field label="Superati"><input className="sd-input" type="number" min={0} value={sup} onChange={(e) => setSup(e.target.value)} /></Field>
        <Field label="In corso"><input className="sd-input" type="number" min={0} value={inc} onChange={(e) => setInc(e.target.value)} /></Field>
      </div>
      {error && <p style={errStyle}>{error}</p>}
      <FormActions onCancel={onCancel} submitting={submitting} editing />
    </form>
  );
}
