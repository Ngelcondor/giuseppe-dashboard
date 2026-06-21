'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { getScadenze, type ScadenzaItem } from '@/services/scadenzeService';

const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};
const mono = "'JetBrains Mono',monospace";

// Seeded fallback — matches the DB seed (academic /university scadenze +
// certification /deadlines), so the page renders identically before fetch
// resolves and never goes blank.
const FALLBACK: ScadenzaItem[] = [
  { id: 'pec2', data: '2026-06-26', titolo: 'PEC2 — Basi di Dati', sottotitolo: 'Consegna · UOC · query e normalizzazione', kind: 'consegna' },
  { id: 'cpts-ad', data: '2026-06-28', titolo: 'CPTS — modulo Active Directory', sottotitolo: 'Studio · HTB · chiusura modulo', kind: 'ctf' },
  { id: 'labuml', data: '2026-07-02', titolo: 'Lab UML — Ingegneria del Software', sottotitolo: 'Consegna · UOC', kind: 'consegna' },
  { id: 'pec3', data: '2026-07-04', titolo: 'PEC3 — Reti di Calcolatori', sottotitolo: 'Consegna · UOC', kind: 'consegna' },
  { id: 'esame-so', data: '2026-07-08', titolo: 'Esame — Sistemi Operativi', sottotitolo: 'Esame · UOC · Aula 3.1', kind: 'esame' },
  { id: 'esame-cpts', data: '2026-07-31', titolo: 'Esame CPTS', sottotitolo: 'Certificazione · HTB', kind: 'certification' },
];

const TODAY = new Date('2026-06-21T00:00:00');
const daysTo = (iso: string) => Math.max(0, Math.round((new Date(iso + 'T00:00:00').getTime() - TODAY.getTime()) / 86_400_000));
const dayNum = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit' });
const monthAbbr = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');

const HEADING = 'rgb(var(--color-heading))';
const INDIGO = 'rgb(99 102 241)';
const AMBER = 'rgb(245 158 11)';
const MUTED = 'rgb(var(--color-muted))';

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

  useEffect(() => {
    let alive = true;
    getScadenze().then((d) => { if (alive && d.length) setItems(d); }).catch(() => {/* keep fallback */});
    return () => { alive = false; };
  }, []);

  const thisWeek = items.filter((it) => daysTo(it.data) <= 7);
  const later = items.filter((it) => daysTo(it.data) > 7);

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>Pianificazione</div>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>Scadenze</h1>
        <p style={{ margin: '11px 0 0', fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>Tutto ciò che ha una data · Università + Certificazioni</p>
      </header>

      {/* Questa settimana */}
      <div className="sd-reveal" style={{ ['--i' as string]: 1, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(245 158 11)', fontWeight: 600, margin: '0 0 12px' }}>Questa settimana</div>
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, padding: '8px 22px', marginBottom: 24 }}>
        {thisWeek.map((it, idx) => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '16px 0', borderBottom: idx === thisWeek.length - 1 ? undefined : '1px solid rgb(var(--color-border))' }}>
            <div style={{ width: 56, flex: 'none', textAlign: 'center' }}><div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: dayColor(it), lineHeight: 1 }}>{dayNum(it.data)}</div><div style={{ fontSize: 10, letterSpacing: '.12em', color: 'rgb(var(--color-tertiary))', textTransform: 'uppercase' }}>{monthAbbr(it.data)}</div></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{it.titolo}</div><div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{it.sottotitolo}</div></div>
            {itemBadge(it)}
          </div>
        ))}
      </div>

      {/* A luglio */}
      <div className="sd-reveal" style={{ ['--i' as string]: 2, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontWeight: 600, margin: '0 0 12px' }}>A luglio</div>
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 2, ...card, padding: '8px 22px' }}>
        {later.map((it, idx) => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '16px 0', borderBottom: idx === later.length - 1 ? undefined : '1px solid rgb(var(--color-border))' }}>
            <div style={{ width: 56, flex: 'none', textAlign: 'center' }}><div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: dayColor(it), lineHeight: 1 }}>{dayNum(it.data)}</div><div style={{ fontSize: 10, letterSpacing: '.12em', color: 'rgb(var(--color-tertiary))', textTransform: 'uppercase' }}>{monthAbbr(it.data)}</div></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{it.titolo}</div><div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{it.sottotitolo}</div></div>
            {itemBadge(it)}
          </div>
        ))}
      </div>
    </div>
  );
}
