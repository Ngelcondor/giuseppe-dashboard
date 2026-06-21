'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CircularProgress } from '@/components/ui/ProgressBar';
import { Checkbox } from '@/components/ui/Toggle';
import { getUniversitaDashboard, type UniDashboard } from '@/services/universitaService';
import { getBudgetDashboard, type BudgetDashboard } from '@/services/budgetService';
import { getScadenze, type ScadenzaItem } from '@/services/scadenzeService';
import { getStudyOverview, type StudyOverview } from '@/services/studyService';
import { getFamilyWeather, weatherDescription, weatherIcon, type FamilyWeather } from '@/services/weatherService';

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

// ── Empty fallbacks — render an honest empty state before/without data, never
// fabricated content. Real data is fetched in useEffect. ──────────────────────
const EMPTY_UNI: UniDashboard = {
  profilo: { corso_laurea: '', semestre: '', cfu_totali: 0, cfu_superati: 0, cfu_in_corso: 0 },
  corsi: [],
  prossimo_esame: null,
  consegne: [],
};

const EMPTY_BUDGET: Pick<BudgetDashboard, 'total_expenses' | 'categories'> = {
  total_expenses: 0,
  categories: [],
};

// ── Date helpers (it-IT) ─────────────────────────────────────────────────────
const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const fmtDateLong = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
const daysTo = (iso: string) => Math.max(0, Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000));
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

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
  const [uni, setUni] = useState<UniDashboard>(EMPTY_UNI);
  const [budget, setBudget] = useState<Pick<BudgetDashboard, 'total_expenses' | 'categories'>>(EMPTY_BUDGET);
  const [scadenze, setScadenze] = useState<ScadenzaItem[]>([]);
  const [study, setStudy] = useState<StudyOverview | null>(null);
  const [family, setFamily] = useState<FamilyWeather[]>([]);

  // Dynamic "today" — never hardcode the date.
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const headerDate = cap(now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }));
  const budgetMonthLabel = cap(now.toLocaleDateString('it-IT', { month: 'long' }));

  useEffect(() => {
    let alive = true;
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    getUniversitaDashboard().then((d) => { if (alive) setUni(d); }).catch(() => {/* keep empty */});
    getBudgetDashboard(m, y).then((d) => { if (alive) setBudget(d); }).catch(() => {/* keep empty */});
    getScadenze().then((d) => { if (alive) setScadenze(d); }).catch(() => {/* keep empty */});
    getStudyOverview().then((d) => { if (alive) setStudy(d); }).catch(() => {/* keep empty */});
    getFamilyWeather().then((d) => { if (alive) setFamily(d); }).catch(() => {/* keep empty */});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { profilo, prossimo_esame } = uni;

  // At-a-glance · CFU
  const cfuPct = profilo.cfu_totali ? Math.round((profilo.cfu_superati / profilo.cfu_totali) * 100) : 0;

  // Signature + cards · prossimo esame
  const esameDays = prossimo_esame ? daysTo(prossimo_esame.data) : 0;

  // At-a-glance · budget
  const budgetLimit = budget.categories.reduce((s, c) => s + (c.limit ?? 0), 0);
  const budgetSpent = budget.total_expenses;
  const budgetLeft = Math.max(0, budgetLimit - budgetSpent);
  const budgetPct = budgetLimit ? Math.round((budgetSpent / budgetLimit) * 100) : 0;

  // Study overview · today + overall progress (real)
  const today = study?.today ?? null;
  const overall = study?.overall ?? { done: 0, total: 0, pct: 0 };
  const todayHasTasks = !!today && !today.isRest && today.tasks.length > 0;

  // Scadenze imminenti · first 4 upcoming (data >= today), real service data.
  const upcoming = scadenze.filter((s) => s.data >= todayIso).slice(0, 4);

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 30 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontFamily: mono, marginBottom: 12 }}>{headerDate}</div>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.04, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>
            Buongiorno, <span className="sd-accent" style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>Giuseppe</span>.
          </h1>
          <p style={{ margin: '12px 0 0', fontSize: 16, color: 'rgb(var(--color-tertiary))', maxWidth: 540, lineHeight: 1.5 }}>Ecco il riepilogo della tua giornata.</p>
        </div>
      </header>

      {/* Signature: focus + today */}
      <section className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, borderRadius: 20, overflow: 'hidden', marginBottom: 18 }}>
        <div className="sd-focus">
          <div style={{ padding: '30px 30px 30px 32px', borderRight: '1px solid rgb(var(--color-border))', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, top: 30, bottom: 30, width: 4, borderRadius: 4, background: 'rgb(99 102 241)' }} />
            <div style={{ fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontWeight: 600, marginBottom: 14 }}>La cosa più importante</div>
            {prossimo_esame ? (
              <>
                <h2 style={{ margin: 0, fontSize: 27, lineHeight: 1.12, letterSpacing: '-.01em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>
                  <span style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>{prossimo_esame.corso}</span>
                </h2>
                {prossimo_esame.descrizione && (
                  <p style={{ margin: '12px 0 0', fontSize: 14, color: 'rgb(var(--color-tertiary))', lineHeight: 1.55 }}>{prossimo_esame.descrizione}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '20px 0 22px' }}>
                  <span style={{ fontFamily: mono, fontSize: 30, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{esameDays}</span>
                  <span style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))' }}>giorni all&apos;esame · {fmtDateLong(prossimo_esame.data)}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link href="/dashboard/universita"><Button variant="primary" size="md">Apri il corso</Button></Link>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ margin: 0, fontSize: 27, lineHeight: 1.12, letterSpacing: '-.01em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>Nessun esame imminente</h2>
                <p style={{ margin: '12px 0 22px', fontSize: 14, color: 'rgb(var(--color-tertiary))', lineHeight: 1.55 }}>Non ci sono esami in programma al momento.</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link href="/dashboard/universita"><Button variant="ghost" size="md">Apri il corso</Button></Link>
                </div>
              </>
            )}
          </div>

          <div style={{ padding: '30px 32px 30px 30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={eyebrow}>Il tuo oggi</div>
              {todayHasTasks && (
                <span style={{ fontFamily: mono, fontSize: 12, color: 'rgb(16 185 129)' }}>{today!.done} / {today!.total}</span>
              )}
            </div>
            {todayHasTasks ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {today!.tasks.map((t) => (
                  <Checkbox key={t.id} label={t.text} checked={t.completed} readOnly />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{today?.isRest ? 'Oggi è riposo' : 'Niente in programma per oggi'}</div>
                <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>Goditi la pausa o apri il piano di studio.</div>
              </div>
            )}
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
          <CircularProgress value={overall.pct} size="md" variant="warning" />
          <div>
            <div style={eyebrow}>CPTS</div>
            <div style={{ fontFamily: mono, fontSize: 21, fontWeight: 600, color: 'rgb(var(--color-heading))', marginTop: 3 }}>{overall.done}<span style={{ color: 'rgb(var(--color-muted))' }}> / {overall.total}</span></div>
            <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>task completati</div>
          </div>
        </div>
        <div className="sd-reveal sd-lift" style={{ ['--i' as string]: 4, ...card, padding: 20 }}>
          <div style={{ ...eyebrow, marginBottom: 10 }}>Prossimo esame</div>
          {prossimo_esame ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}><span style={{ fontFamily: mono, fontSize: 28, fontWeight: 600, color: 'rgb(99 102 241)' }}>{esameDays}</span><span style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>giorni</span></div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgb(var(--color-heading))', marginTop: 8 }}>{prossimo_esame.corso}</div>
              <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', fontFamily: mono }}>{fmtDate(prossimo_esame.data)}{prossimo_esame.ora ? ` · ${prossimo_esame.ora}` : ''}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'rgb(var(--color-heading))', marginTop: 4 }}>Nessun esame</div>
              <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>Niente in programma</div>
            </>
          )}
        </div>
        <div className="sd-reveal sd-lift" style={{ ['--i' as string]: 5, ...card, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}><div style={eyebrow}>Budget {budgetMonthLabel.toLowerCase()}</div><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgb(16 185 129)' }} /></div>
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
          {upcoming.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {upcoming.map((s, idx) => {
                const d = daysTo(s.data);
                return (
                  <DeadlineRow key={s.id} dot={scadenzaDot(d)} title={s.titolo} sub={s.sottotitolo} date={fmtDate(s.data)} badge={scadenzaBadge(d)} last={idx === upcoming.length - 1} />
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '18px 0 4px', fontSize: 13, color: 'rgb(var(--color-tertiary))' }}>Nessuna scadenza imminente.</div>
          )}
        </div>

        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 7, ...card, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Studio di oggi</h3>
            {todayHasTasks && <span style={{ fontFamily: mono, fontSize: 12, color: 'rgb(16 185 129)' }}>{today!.done} / {today!.total}</span>}
          </div>
          {todayHasTasks ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {today!.tasks.map((t) => (
                <Checkbox key={t.id} label={t.text} checked={t.completed} readOnly />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))', padding: '4px 0' }}>{today?.isRest ? 'Oggi è riposo.' : 'Niente in programma per oggi.'}</div>
          )}
        </div>
      </div>

      {/* Famiglia · meteo reale delle città */}
      <section className="sd-reveal sd-shadow" style={{ ['--i' as string]: 8, ...card, padding: '22px 24px', marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>La famiglia</h3>
          <span style={{ fontSize: 11, color: 'rgb(var(--color-tertiary))', textTransform: 'uppercase', letterSpacing: '.12em', whiteSpace: 'nowrap' }}>Meteo · Open-Meteo</span>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>
          Posizione live non disponibile (Find My non espone API pubbliche). Mostro la città configurata di ogni familiare.
        </p>
        {family.length > 0 ? (
          <div className="sd-grid4" style={{ gridTemplateColumns: `repeat(${Math.min(family.length, 3)}, minmax(0, 1fr))` }}>
            {family.map((m) => (
              <FamilyWeatherCard key={`${m.label}-${m.city}`} m={m} />
            ))}
          </div>
        ) : (
          <div style={{ padding: '12px 0 4px', fontSize: 13, color: 'rgb(var(--color-tertiary))' }}>Meteo non disponibile al momento.</div>
        )}
      </section>
    </div>
  );
}

function FamilyWeatherCard({ m }: { m: FamilyWeather }) {
  const hasTemp = m.temp !== null && m.temp !== undefined;
  return (
    <div className="sd-lift" style={{ border: '1px solid rgb(var(--color-border))', borderRadius: 14, padding: 18, background: 'rgb(var(--color-card-inner))' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgb(var(--color-heading))', fontFamily: "'Fraunces',serif", fontStyle: 'italic' }}>{m.label || m.city}</div>
          <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{m.city}</div>
        </div>
        <span style={{ fontSize: 30, lineHeight: 1 }} aria-hidden>{weatherIcon(m.code)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
        <span style={{ fontFamily: mono, fontSize: 28, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{hasTemp ? `${m.temp}°` : '—'}</span>
        <span style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{weatherDescription(m.code)}</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-tertiary))', marginTop: 6 }}>
        {m.min !== null && m.min !== undefined ? `min ${m.min}°` : 'min —'} · {m.max !== null && m.max !== undefined ? `max ${m.max}°` : 'max —'}
      </div>
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
