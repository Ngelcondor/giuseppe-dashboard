'use client';

import React, { useEffect, useState } from 'react';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { CircularProgress } from '@/components/ui/ProgressBar';
import { getUniversitaDashboard, type UniDashboard, type UniCorso, type UniEvento } from '@/services/universitaService';

const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};
const mono = "'JetBrains Mono',monospace";

// Seeded fallback — matches the DB seed, so the page renders identically
// before auth/fetch resolves and never goes blank.
const FALLBACK: UniDashboard = {
  profilo: { corso_laurea: 'Ingegneria Informatica', semestre: '2º semestre · 2025–26', cfu_totali: 240, cfu_superati: 138, cfu_in_corso: 24 },
  corsi: [
    { id: '1', codice: 'SO.302', nome: 'Sistemi Operativi', cfu: 6, docente: 'prof. Vidal', semestre: '', progress: 72, stato: 'in_esame', prossimo: 'esame · 8 luglio', ordine: 0 },
    { id: '2', codice: 'BD.118', nome: 'Basi di Dati', cfu: 6, docente: 'prof. Roca', semestre: '', progress: 60, stato: 'consegna', prossimo: 'PEC2 · 26 giugno', ordine: 1 },
    { id: '3', codice: 'RC.214', nome: 'Reti di Calcolatori', cfu: 6, docente: 'prof. Soler', semestre: '', progress: 45, stato: 'in_corso', prossimo: 'PEC3 · 4 luglio', ordine: 2 },
    { id: '4', codice: 'IS.330', nome: 'Ingegneria del Software', cfu: 6, docente: 'prof. Ferrer', semestre: '', progress: 30, stato: 'in_corso', prossimo: 'lab UML · 2 luglio', ordine: 3 },
  ],
  prossimo_esame: { id: 'e', tipo: 'esame', corso: 'Sistemi Operativi', titolo: 'Sistemi Operativi', descrizione: '', data: '2026-07-08', ora: '09:00', aula: 'Aula 3.1', cfu: 6, stato: 'da_fare' },
  consegne: [
    { id: 'c1', tipo: 'consegna', corso: 'Basi di Dati', titolo: 'PEC2 — Basi di Dati', descrizione: 'Esercizi su query e normalizzazione', data: '2026-06-26', ora: '', aula: '', cfu: null, stato: 'da_fare' },
    { id: 'c2', tipo: 'consegna', corso: 'Ingegneria del Software', titolo: 'Lab UML — Ingegneria del Software', descrizione: "Diagrammi delle classi e dei casi d'uso", data: '2026-07-02', ora: '', aula: '', cfu: null, stato: 'in_corso' },
    { id: 'c3', tipo: 'consegna', corso: 'Reti di Calcolatori', titolo: 'PEC3 — Reti di Calcolatori', descrizione: 'Routing e livello di trasporto', data: '2026-07-04', ora: '', aula: '', cfu: null, stato: 'da_fare' },
  ],
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

  useEffect(() => {
    let alive = true;
    getUniversitaDashboard().then((d) => { if (alive) setData(d); }).catch(() => {/* keep fallback */});
    return () => { alive = false; };
  }, []);

  const { profilo, corsi, prossimo_esame, consegne } = data;
  const cfuPct = profilo.cfu_totali ? Math.round((profilo.cfu_superati / profilo.cfu_totali) * 100) : 0;
  const cfuRim = Math.max(0, profilo.cfu_totali - profilo.cfu_superati - profilo.cfu_in_corso);
  const totCfu = corsi.reduce((s, c) => s + c.cfu, 0);

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>Università · UOC</div>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>
          {profilo.corso_laurea.split(' ')[0]} <span style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>{profilo.corso_laurea.split(' ').slice(1).join(' ')}</span>
        </h1>
        <p style={{ margin: '11px 0 0', fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>{profilo.semestre} · Barcellona · sessione d&apos;esami</p>
      </header>

      {/* CFU + prossimo esame */}
      <div className="sd-twocol" style={{ marginBottom: 18 }}>
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, borderRadius: 18, padding: '26px 28px', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
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

        {prossimo_esame && (
          <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 2, background: 'rgb(99 102 241)', borderRadius: 18, padding: '26px 28px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
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
        )}
      </div>

      {/* Corsi */}
      <div className="sd-reveal" style={{ ['--i' as string]: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '30px 0 14px' }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Corsi del semestre</h3>
        <span style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', fontFamily: mono, whiteSpace: 'nowrap' }}>{corsi.length} corsi · {totCfu} CFU</span>
      </div>
      <div className="sd-grid2" style={{ marginBottom: 18 }}>
        {corsi.map((c, idx) => (
          <CourseCard key={c.id} i={4 + idx} code={`${c.codice} · ${c.cfu} CFU`} badge={corsoBadge(c.stato)} title={c.nome} next={`Prossimo: ${c.prossimo}`} pct={c.progress} />
        ))}
      </div>

      {/* Consegne */}
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 8, ...card, padding: '22px 24px' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Consegne in arrivo</h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {consegne.map((e, idx) => (
            <DeliveryRow key={e.id} dot={daysTo(e.data) <= 7 ? 'rgb(245 158 11)' : 'rgb(99 102 241)'} title={e.titolo} sub={e.descrizione} date={fmtDate(e.data)} badge={eventoBadge(e.stato)} last={idx === consegne.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CourseCard({ i, code, badge, title, next, pct }: { i: number; code: string; badge: React.ReactNode; title: string; next: string; pct: number }) {
  return (
    <div className="sd-reveal sd-lift" style={{ ['--i' as string]: i, ...card, padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: mono, fontSize: 11, color: 'rgb(var(--color-tertiary))', background: 'rgb(0 0 0 / 0.04)', padding: '3px 9px', borderRadius: 7, whiteSpace: 'nowrap', flex: 'none' }}>{code}</span>
        <div style={{ flex: 'none', width: 'max-content' }}>{badge}</div>
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, color: 'rgb(var(--color-heading))', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: 'rgb(var(--color-tertiary))', marginBottom: 16 }}>{next}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}><span style={{ fontSize: 11, color: 'rgb(var(--color-tertiary))' }}>Programma</span><span style={{ fontSize: 11, fontFamily: mono, color: 'rgb(var(--color-tertiary))' }}>{pct}%</span></div>
      <div style={{ height: 8, borderRadius: 8, background: 'rgb(var(--color-card-inner))', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, borderRadius: 8, background: 'rgb(99 102 241)' }} /></div>
    </div>
  );
}

function DeliveryRow({ dot, title, sub, date, badge, last }: { dot: string; title: string; sub: string; date: string; badge: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: last ? '14px 0 4px' : '14px 0', borderTop: '1px solid rgb(var(--color-border))' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot, flex: 'none' }} />
      <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{title}</div><div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{sub}</div></div>
      <div style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{date}</div>
      <div style={{ flex: 'none', width: 'max-content' }}>{badge}</div>
    </div>
  );
}
