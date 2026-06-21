'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CircularProgress } from '@/components/ui/ProgressBar';
import { Checkbox } from '@/components/ui/Toggle';
import { getUniversitaDashboard, type UniDashboard } from '@/services/universitaService';
import { getBudgetDashboard, type BudgetDashboard } from '@/services/budgetService';

const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};
const eyebrow: React.CSSProperties = {
  fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase',
  color: 'rgb(var(--color-tertiary))', fontWeight: 600,
};
const mono = "'JetBrains Mono',monospace";

// ── Seeded fallbacks — match the DB seed so the page renders identically
// before auth/fetch resolves and never goes blank. ───────────────────────────
const FALLBACK_UNI: UniDashboard = {
  profilo: { corso_laurea: 'Ingegneria Informatica', semestre: '2º semestre · 2025–26', cfu_totali: 240, cfu_superati: 138, cfu_in_corso: 24 },
  corsi: [],
  prossimo_esame: { id: 'e', tipo: 'esame', corso: 'Sistemi Operativi', titolo: 'Esame — Sistemi Operativi', descrizione: '', data: '2026-07-08', ora: '09:00', aula: 'Aula 3.1', cfu: 6, stato: 'da_fare' },
  consegne: [
    { id: 'c1', tipo: 'consegna', corso: 'Basi di Dati', titolo: 'PEC2 — Basi di Dati', descrizione: 'Consegna · UOC', data: '2026-06-26', ora: '', aula: '', cfu: null, stato: 'da_fare' },
  ],
};

const FALLBACK_BUDGET: Pick<BudgetDashboard, 'total_expenses' | 'categories'> = {
  total_expenses: 642,
  categories: [
    { category: 'Affitto · Barcellona', spent: 420, limit: 420, remaining: 0, percentage: 100 },
    { category: 'Spesa', spent: 150, limit: 200, remaining: 50, percentage: 75 },
    { category: 'Studio · HTB + libri', spent: 30, limit: 100, remaining: 70, percentage: 30 },
    { category: 'Svago', spent: 0, limit: 100, remaining: 100, percentage: 0 },
    { category: 'Trasporti', spent: 42, limit: 80, remaining: 38, percentage: 52.5 },
  ],
};

// ── Date helpers (it-IT), today = 2026-06-21 ─────────────────────────────────
const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const daysTo = (iso: string) => Math.max(0, Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000));

// Non-academic certification scadenze (no dedicated service for this screen) —
// kept as the approved static content; their badges are computed by days-to-due.
const CERT_SCADENZE = [
  { id: 'cert-cpts-ad', title: 'CPTS — modulo Active Directory', sub: 'Studio · certificazione', data: '2026-06-28' },
  { id: 'cert-cpts-exam', title: 'Esame CPTS', sub: 'Certificazione · HTB', data: '2026-07-31' },
];

const scadenzaBadge = (d: number) =>
  d <= 6 ? <Badge variant="warning" size="sm">{d} giorni</Badge>
  : d <= 7 ? <Badge variant="primary" size="sm">{d} giorni</Badge>
  : d <= 20 ? <Badge variant="info" size="sm">{d} giorni</Badge>
  : <Badge variant="secondary" size="sm">{d} giorni</Badge>;

const scadenzaDot = (d: number) =>
  d <= 6 ? 'rgb(245 158 11)'
  : d <= 7 ? 'rgb(99 102 241)'
  : d <= 20 ? 'rgb(99 102 241)'
  : 'rgb(var(--color-muted))';

export default function HomePage() {
  const [uni, setUni] = useState<UniDashboard>(FALLBACK_UNI);
  const [budget, setBudget] = useState<Pick<BudgetDashboard, 'total_expenses' | 'categories'>>(FALLBACK_BUDGET);

  useEffect(() => {
    let alive = true;
    getUniversitaDashboard().then((d) => { if (alive) setUni(d); }).catch(() => {/* keep fallback */});
    getBudgetDashboard(6, 2026).then((d) => { if (alive) setBudget(d); }).catch(() => {/* keep fallback */});
    return () => { alive = false; };
  }, []);

  const { profilo, prossimo_esame, consegne } = uni;

  // At-a-glance · CFU
  const cfuPct = profilo.cfu_totali ? Math.round((profilo.cfu_superati / profilo.cfu_totali) * 100) : 0;

  // Signature + cards · prossimo esame
  const esameDays = prossimo_esame ? daysTo(prossimo_esame.data) : 0;

  // At-a-glance · budget
  const budgetLimit = budget.categories.reduce((s, c) => s + (c.limit ?? 0), 0);
  const budgetSpent = budget.total_expenses;
  const budgetLeft = Math.max(0, budgetLimit - budgetSpent);
  const budgetPct = budgetLimit ? Math.round((budgetSpent / budgetLimit) * 100) : 0;

  // Scadenze imminenti · curated like the design: the nearest UOC consegna +
  // the next exam + the two non-academic certification items, sorted by date.
  const nearestConsegna = [...consegne].sort((a, b) => a.data.localeCompare(b.data))[0];
  const scadenze = [
    ...(nearestConsegna ? [{ id: nearestConsegna.id, title: nearestConsegna.titolo, sub: 'Consegna · UOC', data: nearestConsegna.data }] : []),
    ...(prossimo_esame ? [{ id: prossimo_esame.id, title: `Esame — ${prossimo_esame.corso}`, sub: 'Esame · UOC', data: prossimo_esame.data }] : []),
    ...CERT_SCADENZE,
  ]
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 4);

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 30 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontFamily: mono, marginBottom: 12 }}>Domenica 21 giugno · sessione d&apos;esami</div>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.04, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>
            Buongiorno, <span className="sd-accent" style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>Giuseppe</span>.
          </h1>
          <p style={{ margin: '12px 0 0', fontSize: 16, color: 'rgb(var(--color-tertiary))', maxWidth: 540, lineHeight: 1.5 }}>Oggi è giorno di ripasso. Una cosa conta più delle altre — il resto può aspettare.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'rgb(var(--color-tertiary))', textTransform: 'uppercase', letterSpacing: '.12em', whiteSpace: 'nowrap' }}>Streak studio</div>
          <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>12<span style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))', fontWeight: 400 }}> giorni</span></div>
        </div>
      </header>

      {/* Signature: focus + today */}
      <section className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, borderRadius: 20, overflow: 'hidden', marginBottom: 18 }}>
        <div className="sd-focus">
          <div style={{ padding: '30px 30px 30px 32px', borderRight: '1px solid rgb(var(--color-border))', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, top: 30, bottom: 30, width: 4, borderRadius: 4, background: 'rgb(99 102 241)' }} />
            <div style={{ fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontWeight: 600, marginBottom: 14 }}>La cosa più importante</div>
            <h2 style={{ margin: 0, fontSize: 27, lineHeight: 1.12, letterSpacing: '-.01em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>Ripasso <span style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>Sistemi Operativi</span></h2>
            <p style={{ margin: '12px 0 0', fontSize: 14, color: 'rgb(var(--color-tertiary))', lineHeight: 1.55 }}>Scheduling, gestione della memoria e sincronizzazione. L&apos;esame è il primo banco di prova della sessione.</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '20px 0 22px' }}>
              <span style={{ fontFamily: mono, fontSize: 30, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{esameDays}</span>
              <span style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))' }}>giorni all&apos;esame · 8 luglio</span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button variant="primary" size="md">Inizia il ripasso</Button>
              <Link href="/dashboard/universita"><Button variant="ghost" size="md">Apri il corso</Button></Link>
            </div>
          </div>

          <div style={{ padding: '30px 32px 30px 30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={eyebrow}>Il tuo oggi</div>
              <div className="sd-now" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'rgb(99 102 241)', fontFamily: mono }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgb(99 102 241)' }} />ORA · 14:20</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TimelineRow time="09:30" bar="rgb(16 185 129)" title="Ripasso SO · scheduling" sub="Completato · 2h" badge={<Badge variant="success" size="sm">Fatto</Badge>} dim />
              <TimelineRow time="15:00" bar="rgb(99 102 241)" title="CPTS · Active Directory" sub="Lab · lateral movement" badge={<Badge variant="primary" size="sm">Adesso</Badge>} highlight />
              <TimelineRow time="18:30" bar="rgb(245 158 11)" title="PEC2 · Basi di Dati" sub="Query e normalizzazione" badge={<Badge variant="warning" size="sm">5 giorni</Badge>} />
              <TimelineRow time="21:00" bar="rgb(var(--color-muted))" title="Chiusura · appunti vault" sub="15 min · review della giornata" />
            </div>
          </div>
        </div>
      </section>

      {/* At a glance */}
      <div className="sd-grid4" style={{ marginBottom: 18 }}>
        <div className="sd-reveal sd-lift" style={{ ['--i' as string]: 2, ...card, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <CircularProgress value={cfuPct} size="md" variant="primary" />
          <div>
            <div style={eyebrow}>CFU · UOC</div>
            <div style={{ fontFamily: mono, fontSize: 21, fontWeight: 600, color: 'rgb(var(--color-heading))', marginTop: 3 }}>{profilo.cfu_superati}<span style={{ color: 'rgb(var(--color-muted))' }}> / {profilo.cfu_totali}</span></div>
            <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>del percorso</div>
          </div>
        </div>
        <div className="sd-reveal sd-lift" style={{ ['--i' as string]: 3, ...card, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <CircularProgress value={67} size="md" variant="warning" />
          <div>
            <div style={eyebrow}>CPTS</div>
            <div style={{ fontFamily: mono, fontSize: 21, fontWeight: 600, color: 'rgb(var(--color-heading))', marginTop: 3 }}>8<span style={{ color: 'rgb(var(--color-muted))' }}> / 12</span></div>
            <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>settimane · esame 31 lug</div>
          </div>
        </div>
        <div className="sd-reveal sd-lift" style={{ ['--i' as string]: 4, ...card, padding: 20 }}>
          <div style={{ ...eyebrow, marginBottom: 10 }}>Prossimo esame</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}><span style={{ fontFamily: mono, fontSize: 28, fontWeight: 600, color: 'rgb(99 102 241)' }}>{esameDays}</span><span style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>giorni</span></div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgb(var(--color-heading))', marginTop: 8 }}>{prossimo_esame?.corso ?? 'Sistemi Operativi'}</div>
          <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', fontFamily: mono }}>8 lug · {prossimo_esame?.ora || '09:00'}</div>
        </div>
        <div className="sd-reveal sd-lift" style={{ ['--i' as string]: 5, ...card, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}><div style={eyebrow}>Budget giugno</div><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgb(16 185 129)' }} /></div>
          <div style={{ fontFamily: mono, fontSize: 21, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>€{Math.round(budgetSpent)}<span style={{ color: 'rgb(var(--color-muted))', fontSize: 15 }}> / {Math.round(budgetLimit)}</span></div>
          <div style={{ margin: '12px 0 6px' }}><div style={{ height: 8, borderRadius: 8, background: 'rgb(var(--color-card-inner))', overflow: 'hidden' }}><div style={{ height: '100%', width: `${budgetPct}%`, borderRadius: 8, background: 'rgb(16 185 129)' }} /></div></div>
          <div style={{ fontSize: 12, color: 'rgb(16 185 129)' }}>€{Math.round(budgetLeft)} rimasti</div>
        </div>
      </div>

      {/* Scadenze + studio oggi */}
      <div className="sd-twocol">
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 6, ...card, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Scadenze imminenti</h3>
            <span style={{ fontSize: 11, color: 'rgb(var(--color-tertiary))', textTransform: 'uppercase', letterSpacing: '.12em', whiteSpace: 'nowrap' }}>Uni + Cert</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {scadenze.map((s, idx) => {
              const d = daysTo(s.data);
              return (
                <DeadlineRow key={s.id} dot={scadenzaDot(d)} title={s.title} sub={s.sub} date={fmtDate(s.data)} badge={scadenzaBadge(d)} last={idx === scadenze.length - 1} />
              );
            })}
          </div>
        </div>

        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 7, ...card, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Studio di oggi</h3>
            <span style={{ fontFamily: mono, fontSize: 12, color: 'rgb(16 185 129)' }}>2 / 5</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Checkbox label="Enumerazione AD con BloodHound" defaultChecked />
            <Checkbox label="Kerberoasting · estrazione TGS" defaultChecked />
            <Checkbox label="Lateral movement · Pass-the-Hash" />
            <Checkbox label="Ripasso SO · sincronizzazione" />
            <Checkbox label="Aggiorna writeup nel vault Obsidian" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({ time, bar, title, sub, badge, dim, highlight }: { time: string; bar: string; title: string; sub: string; badge?: React.ReactNode; dim?: boolean; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', opacity: dim ? 0.6 : 1, ...(highlight ? { background: 'rgb(99 102 241 / 0.06)', margin: '0 -10px', padding: 10, borderRadius: 12 } : {}) }}>
      <div style={{ fontFamily: mono, fontSize: 12, color: highlight ? 'rgb(99 102 241)' : 'rgb(var(--color-tertiary))', width: 46, flex: 'none', paddingTop: 2 }}>{time}</div>
      <div style={{ width: 3, borderRadius: 3, background: bar, flex: 'none' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: highlight ? 600 : 500, color: 'rgb(var(--color-heading))' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{sub}</div>
      </div>
      {badge && <div style={{ flex: 'none', width: 'max-content' }}>{badge}</div>}
    </div>
  );
}

function DeadlineRow({ dot, title, sub, date, badge, last }: { dot: string; title: string; sub: string; date: string; badge: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: last ? '14px 0 4px' : '14px 0', borderTop: '1px solid rgb(var(--color-border))' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot, flex: 'none' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{sub}</div>
      </div>
      <div style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{date}</div>
      <div style={{ flex: 'none', width: 'max-content' }}>{badge}</div>
    </div>
  );
}
