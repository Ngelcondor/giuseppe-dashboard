'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CircularProgress } from '@/components/ui/ProgressBar';
import { getUniversitaDashboard, type UniDashboard } from '@/services/universitaService';
import { getBudgetDashboard, type BudgetDashboard } from '@/services/budgetService';
import { getScadenze, type ScadenzaItem } from '@/services/scadenzeService';
import { getStudyOverview, type StudyOverview } from '@/services/studyService';
import { getUpcomingEvents, type CalendarEventDTO } from '@/services/calendarService';

/* ── Home redesign · "Study Desk" ─────────────────────────────────────────────
   Terminal-style header with a live clock, three horizontal scrollable lanes
   (Studio di oggi · Appuntamenti · Scadenze), and a demoted stats bar. All
   content is wired to the real data layer; the terminal header stays dark in
   every theme. Lane entrance + rail + pulse animations are CSS-driven and
   respect prefers-reduced-motion and the low-stim theme (see globals.css). */

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';

const mono = "'JetBrains Mono',monospace";

// Lane accent triplets (theme-aware, used in rgb(...) and rgb(.../alpha)).
const EMERALD = '16 185 129';
const INDIGO = '99 102 241';
const AMBER = '245 158 11';
const PINK = '236 72 153';

// Terminal palette — always dark, even in light theme (it's a real terminal).
const TERM = {
  bg: '#0a0c12', fg: '#e6edf3', dim: '#9aa7b8', dim2: '#8b97a8', dim3: '#6b7689',
  green: '#7ee787', cyan: '#56c2ff', blue: '#7c9bff', pink: '#ff6b9d',
};

// ── Empty fallbacks — honest empty state before/without data, never fabricated. ─
const EMPTY_UNI: UniDashboard = {
  profilo: { corso_laurea: '', semestre: '', cfu_totali: 0, cfu_superati: 0, cfu_in_corso: 0 },
  corsi: [], prossimo_esame: null, consegne: [],
};
const EMPTY_BUDGET: Pick<BudgetDashboard, 'total_expenses' | 'categories'> = {
  total_expenses: 0, categories: [],
};

// ── Date helpers (it-IT) ──────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0');
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const fmtDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

// ── Live terminal clock (isolated so only it re-renders every second) ──────────
function TerminalClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now ? now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';
  const date = now ? cap(now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : '';
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, flexWrap: 'wrap', margin: '14px 0 4px' }}>
      <span style={{ fontSize: 62, fontWeight: 700, letterSpacing: '-.01em', color: TERM.fg, lineHeight: 0.95, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
      <span style={{ fontSize: 18, color: TERM.dim, whiteSpace: 'nowrap' }}>{date}</span>
    </div>
  );
}

// ── Timeline dot ───────────────────────────────────────────────────────────────
type DotKind = 'now' | 'done' | 'urgent' | 'future';
function Dot({ kind, color, pulseRgb }: { kind: DotKind; color: string; pulseRgb?: string }) {
  const ring = '0 0 0 4px rgb(var(--color-card-inner))';
  if (kind === 'now')
    return <span className="sd-pulse" style={{ position: 'absolute', left: 8, top: 4, width: 14, height: 14, borderRadius: '50%', background: color, boxShadow: ring, ['--pulse' as string]: pulseRgb }} />;
  if (kind === 'urgent')
    return <span style={{ position: 'absolute', left: 8, top: 4, width: 14, height: 14, borderRadius: '50%', background: color, boxShadow: ring }} />;
  if (kind === 'done')
    return <span style={{ position: 'absolute', left: 8, top: 5, width: 12, height: 12, borderRadius: '50%', background: color, boxShadow: ring }} />;
  return <span style={{ position: 'absolute', left: 8, top: 5, width: 12, height: 12, borderRadius: '50%', background: 'rgb(var(--color-card))', border: `2px solid ${color}`, boxShadow: ring }} />;
}

// ── A single timeline node ─────────────────────────────────────────────────────
function LaneNode({ j, width = 226, dimmed, time, timeColor, timeWeight, dot, cardStyle, children }: {
  j: number; width?: number; dimmed?: boolean; time: string; timeColor?: string; timeWeight?: number;
  dot: React.ReactNode; cardStyle?: React.CSSProperties; children: React.ReactNode;
}) {
  return (
    <div className="sd-node" style={{ ['--j' as string]: j, flex: 'none', width, position: 'relative', opacity: dimmed ? 0.62 : undefined }}>
      <div style={{ height: 24, fontFamily: mono, fontSize: 13, color: timeColor ?? 'rgb(var(--color-tertiary))', fontWeight: timeWeight }}>{time}</div>
      <div style={{ height: 22, position: 'relative' }}>{dot}</div>
      <div className="sd-node-card" style={{ background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', borderRadius: 9, padding: '13px 15px', boxShadow: '0 1px 2px rgba(17,17,26,.04)', ...cardStyle }}>{children}</div>
    </div>
  );
}

// ── Lane scaffolding (prompt + scroll container) ───────────────────────────────
function LanePrompt({ cmd, flags, comment }: { cmd: string; flags: { text: string; color: string }[]; comment: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 4px 10px', fontFamily: mono, fontSize: 12.5 }}>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <span style={{ color: `rgb(${EMERALD})`, fontWeight: 600 }}>$</span>{' '}
        <span style={{ color: 'rgb(var(--color-heading))' }}>{cmd}</span>
        {flags.map((f, i) => <span key={i} style={{ color: f.color }}> {f.text}</span>)}
      </span>
      <span style={{ color: 'rgb(var(--color-tertiary))', whiteSpace: 'nowrap' }}>{comment}</span>
    </div>
  );
}
function LaneScroll({ railColor, children }: { railColor: string; children: React.ReactNode }) {
  return (
    <div className="sd-lane-scroll" style={{ border: '1px solid rgb(var(--color-border))', borderRadius: 10, background: 'rgb(var(--color-card-inner))', padding: '20px 20px 22px' }}>
      <div style={{ position: 'relative', display: 'flex', gap: 16, minWidth: 'max-content', alignItems: 'flex-start' }}>
        <span className="sd-rail-line" style={{ position: 'absolute', left: 8, right: 8, top: 35, height: 2, background: railColor }} />
        {children}
      </div>
    </div>
  );
}
function LaneEmpty({ text }: { text: string }) {
  return (
    <div className="sd-lane-scroll" style={{ border: '1px solid rgb(var(--color-border))', borderRadius: 10, background: 'rgb(var(--color-card-inner))', padding: '20px 20px 22px' }}>
      <div style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))' }}>{text}</div>
    </div>
  );
}
const nodeTitle: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' };
const nodeSub: React.CSSProperties = { fontSize: 12, color: 'rgb(var(--color-tertiary))', marginTop: 3 };

export default function HomePage() {
  const [uni, setUni] = useState<UniDashboard>(EMPTY_UNI);
  const [budget, setBudget] = useState<Pick<BudgetDashboard, 'total_expenses' | 'categories'>>(EMPTY_BUDGET);
  const [scadenze, setScadenze] = useState<ScadenzaItem[]>([]);
  const [study, setStudy] = useState<StudyOverview | null>(null);
  const [appts, setAppts] = useState<CalendarEventDTO[]>([]);

  // Stable "today" for date math (local, not UTC — correct near midnight in CET).
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysTo = (iso: string) => Math.round((new Date(iso + 'T00:00:00').getTime() - startOfToday) / 86_400_000);
  const budgetMonthLabel = now.toLocaleDateString('it-IT', { month: 'long' });

  useEffect(() => {
    let alive = true;
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    getUniversitaDashboard().then((d) => { if (alive) setUni(d); }).catch(() => {/* keep empty */});
    getBudgetDashboard(m, y).then((d) => { if (alive) setBudget(d); }).catch(() => {/* keep empty */});
    getScadenze().then((d) => { if (alive) setScadenze(d); }).catch(() => {/* keep empty */});
    getStudyOverview().then((d) => { if (alive) setStudy(d); }).catch(() => {/* keep empty */});
    getUpcomingEvents().then((d) => { if (alive) setAppts(d); }).catch(() => {/* keep empty */});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { profilo, prossimo_esame } = uni;
  const esameDays = prossimo_esame ? Math.max(0, daysTo(prossimo_esame.data)) : null;

  // ── Lane 1 · Studio di oggi (real study overview) ───────────────────────────
  const today = study?.today ?? null;
  const overall = study?.overall ?? { done: 0, total: 0, pct: 0 };
  const tasks = today && !today.isRest ? today.tasks : [];
  const doneCount = today?.done ?? 0;
  const totalCount = today?.total ?? 0;
  const activeIdx = tasks.findIndex((t) => !t.completed);

  // ── Lane 2 · Appuntamenti (real calendar) ───────────────────────────────────
  const appointments = appts.slice(0, 10);

  // ── Lane 3 · Scadenze (real, upcoming) ──────────────────────────────────────
  const upcoming = scadenze.filter((s) => s.data >= todayIso).slice(0, 10);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const cfuPct = profilo.cfu_totali ? Math.round((profilo.cfu_superati / profilo.cfu_totali) * 100) : 0;
  const budgetSpent = budget.total_expenses;
  const topCat = [...budget.categories].sort((a, b) => b.spent - a.spent)[0] ?? null;
  const studioHint = !today || today.isRest ? 'Riposo' : totalCount === 0 ? 'Nessun piano' : doneCount >= totalCount ? 'Tutto fatto ✓' : 'Continua così';
  const studioHintColor = !today || today.isRest || totalCount === 0 ? 'rgb(var(--color-tertiary))' : `rgb(${EMERALD})`;

  return (
    <div>
      {/* ════ Header terminale (Kali style · sempre scuro) ════ */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, margin: '0 0 30px' }}>
        <div style={{ background: TERM.bg, border: '1px solid rgb(255 255 255/0.09)', borderRadius: 11, overflow: 'hidden', fontFamily: mono, boxShadow: '0 18px 44px -26px rgba(0,0,0,.7)' }}>
          {/* title bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'rgb(255 255 255/0.035)', borderBottom: '1px solid rgb(255 255 255/0.07)' }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
              <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c, flex: 'none' }} />
            ))}
            <span style={{ marginLeft: 8, fontSize: 11.5, color: TERM.dim2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>giuseppe@study-desk: ~/sessione-esami</span>
          </div>
          {/* body */}
          <div style={{ padding: '18px 22px 20px' }}>
            <div style={{ fontSize: 13, lineHeight: 1.75 }}>
              <span style={{ color: TERM.cyan }}>┌──(</span><span style={{ color: TERM.blue, fontWeight: 600 }}>giuseppe</span><span style={{ color: TERM.pink }}>㉿</span><span style={{ color: TERM.blue, fontWeight: 600 }}>study-desk</span><span style={{ color: TERM.cyan }}>)-[</span><span style={{ color: TERM.fg }}>~/sessione-esami</span><span style={{ color: TERM.cyan }}>]</span><br />
              <span style={{ color: TERM.cyan }}>└─$</span> <span style={{ color: TERM.green }}>date</span>
            </div>
            <TerminalClock />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 14 }}>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: TERM.cyan }}>└─$</span> <span style={{ color: TERM.fg }}>today --focus</span>
                <span className="sd-cursor" style={{ display: 'inline-block', width: 8, height: 15, background: TERM.green, marginLeft: 5, transform: 'translateY(2px)' }} />
              </div>
              <div style={{ fontSize: 12, color: TERM.dim3, whiteSpace: 'nowrap' }}>
                {prossimo_esame && esameDays !== null
                  ? <># prossimo esame: {prossimo_esame.corso} · <span style={{ color: TERM.green }}>tra {esameDays}g</span></>
                  : <># sessione di studio</>}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ════ CORSIA 1 · STUDIO DI OGGI ════ */}
      <section className="sd-reveal" style={{ ['--i' as string]: 1, marginBottom: 22 }}>
        <LanePrompt
          cmd="studio"
          flags={[{ text: '--oggi', color: `rgb(${INDIGO})` }, { text: '--now', color: `rgb(${PINK})` }]}
          comment={!today || today.isRest ? '# riposo' : `# ${totalCount} blocchi · ${doneCount} fatti`}
        />
        {tasks.length > 0 ? (
          <LaneScroll railColor={`rgb(${EMERALD}/0.3)`}>
            {tasks.map((t, i) => {
              if (t.completed) {
                return (
                  <LaneNode key={t.id} j={i} dimmed time="fatto" dot={<Dot kind="done" color={`rgb(${EMERALD})`} />}>
                    <div style={{ ...nodeTitle, textDecoration: 'line-through', textDecorationColor: 'rgb(var(--color-muted))' }}>{t.text}</div>
                    <div style={{ marginTop: 10 }}><Badge variant="success" size="sm">Fatto</Badge></div>
                  </LaneNode>
                );
              }
              if (i === activeIdx) {
                return (
                  <LaneNode
                    key={t.id} j={i} width={316}
                    time="ADESSO" timeColor={`rgb(${EMERALD})`} timeWeight={600}
                    dot={<Dot kind="now" color={`rgb(${EMERALD})`} pulseRgb={`rgba(16,185,129,.5)`} />}
                    cardStyle={{ background: `rgb(${EMERALD}/0.07)`, border: `1px solid rgb(${EMERALD}/0.32)`, padding: '15px 16px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{t.text}</div>
                      <Badge variant="success" size="sm">In corso</Badge>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <Link href="/dashboard/study"><Button variant="primary" size="sm">Riprendi lo studio</Button></Link>
                    </div>
                  </LaneNode>
                );
              }
              return (
                <LaneNode key={t.id} j={i} time="poi" dot={<Dot kind="future" color={`rgb(${AMBER})`} />}>
                  <div style={nodeTitle}>{t.text}</div>
                  <div style={{ marginTop: 10 }}><Badge variant="secondary" size="sm">Da fare</Badge></div>
                </LaneNode>
              );
            })}
          </LaneScroll>
        ) : (
          <LaneEmpty text={today?.isRest ? 'Oggi è riposo — goditi la pausa.' : 'Nessun blocco di studio per oggi.'} />
        )}
      </section>

      {/* ════ CORSIA 2 · APPUNTAMENTI ════ */}
      <section className="sd-reveal" style={{ ['--i' as string]: 2, marginBottom: 22 }}>
        <LanePrompt cmd="appuntamenti" flags={[{ text: '--prossimi', color: `rgb(${INDIGO})` }]} comment={`# ${appointments.length} in calendario`} />
        {appointments.length > 0 ? (
          <LaneScroll railColor={`rgb(${INDIGO}/0.3)`}>
            {appointments.map((e, i) => {
              const start = new Date(e.startTime);
              const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
              const dayDiff = Math.round((startDay - startOfToday) / 86_400_000);
              const time = `${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
              const when = dayDiff === 0 ? `oggi · ${time}`
                : dayDiff === 1 ? `domani · ${time}`
                : dayDiff > 1 && dayDiff < 7 ? `${start.toLocaleDateString('it-IT', { weekday: 'short' })} · ${time}`
                : `${start.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} · ${time}`;
              const ms = start.getTime() - now.getTime();
              let badge: { label: string; variant: BadgeVariant };
              if (dayDiff === 0 && ms > 0) {
                const totMin = Math.round(ms / 60_000); const h = Math.floor(totMin / 60); const mm = totMin % 60;
                badge = { label: h > 0 ? `Tra ${h}h ${mm}m` : `Tra ${mm}m`, variant: 'primary' };
              } else if (dayDiff === 0) badge = { label: 'Oggi', variant: 'primary' };
              else if (dayDiff === 1) badge = { label: 'Domani', variant: 'info' };
              else if (dayDiff < 7) badge = { label: cap(start.toLocaleDateString('it-IT', { weekday: 'long' })), variant: 'secondary' };
              else badge = { label: start.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }), variant: 'secondary' };
              const isNext = i === 0 && dayDiff === 0;
              const dot = isNext ? <Dot kind="now" color={`rgb(${INDIGO})`} pulseRgb="rgba(99,102,241,.5)" />
                : dayDiff < 7 ? <Dot kind="future" color={`rgb(${INDIGO})`} />
                : <Dot kind="future" color="rgb(var(--color-muted))" />;
              const sub = e.description || e.location || e.calendarName || '';
              return (
                <LaneNode key={e.id} j={i} time={when} timeColor={dayDiff === 0 ? `rgb(${INDIGO})` : undefined} timeWeight={dayDiff === 0 ? 600 : undefined} dot={dot}>
                  <div style={nodeTitle}>{e.title}</div>
                  {sub && <div style={nodeSub}>{sub}</div>}
                  <div style={{ marginTop: 10 }}><Badge variant={badge.variant} size="sm">{badge.label}</Badge></div>
                </LaneNode>
              );
            })}
          </LaneScroll>
        ) : (
          <LaneEmpty text="Nessun appuntamento in calendario." />
        )}
      </section>

      {/* ════ CORSIA 3 · SCADENZE ════ */}
      <section className="sd-reveal" style={{ ['--i' as string]: 3, marginBottom: 30 }}>
        <LanePrompt
          cmd="scadenze" flags={[{ text: '--sort=data', color: `rgb(${INDIGO})` }]}
          comment={upcoming.length > 0 ? `# prossima tra ${Math.max(0, daysTo(upcoming[0].data))} giorni` : '# nessuna scadenza'}
        />
        {upcoming.length > 0 ? (
          <LaneScroll railColor={`rgb(${AMBER}/0.3)`}>
            {upcoming.map((s, i) => {
              const d = Math.max(0, daysTo(s.data));
              const urgent = d <= 6;
              const soon = d <= 20;
              const dateColor = urgent ? `rgb(${AMBER})` : soon ? `rgb(${INDIGO})` : 'rgb(var(--color-muted))';
              const dot = urgent
                ? <Dot kind="urgent" color={`rgb(${AMBER})`} />
                : <Dot kind="future" color={soon ? `rgb(${INDIGO})` : 'rgb(var(--color-muted))'} />;
              const badge: BadgeVariant = urgent ? 'warning' : d <= 7 ? 'primary' : soon ? 'info' : 'secondary';
              return (
                <LaneNode
                  key={s.id} j={i} time={fmtDay(s.data)} timeColor={dateColor} timeWeight={urgent ? 600 : undefined}
                  dot={dot} cardStyle={urgent ? { border: `1px solid rgb(${AMBER}/0.4)` } : undefined}
                >
                  <div style={nodeTitle}>{s.titolo}</div>
                  {s.sottotitolo && <div style={nodeSub}>{s.sottotitolo}</div>}
                  <div style={{ marginTop: 10 }}><Badge variant={badge} size="sm">{d} giorni</Badge></div>
                </LaneNode>
              );
            })}
          </LaneScroll>
        ) : (
          <LaneEmpty text="Nessuna scadenza imminente." />
        )}
      </section>

      {/* ════ STATS · riepilogo ════ */}
      <div className="sd-reveal" style={{ ['--i' as string]: 4, display: 'flex', alignItems: 'center', gap: 14, margin: '6px 0 14px' }}>
        <span style={{ fontFamily: mono, fontSize: 12.5, whiteSpace: 'nowrap' }}>
          <span style={{ color: TERM.green, fontWeight: 600 }}>$</span> <span style={{ color: 'rgb(var(--color-heading))' }}>stats</span> <span style={{ color: `rgb(${INDIGO})` }}>--overview</span>
        </span>
        <span style={{ flex: 1, height: 1, background: 'rgb(var(--color-border))' }} />
      </div>
      <div className="sd-reveal sd-statbar" style={{ ['--i' as string]: 5, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 22px' }}>
          <CircularProgress value={cfuPct} size="md" variant="primary" />
          <div style={{ minWidth: 0 }}>
            <div style={statLabel}>CFU · UOC</div>
            <div style={statValue}>{profilo.cfu_superati}<span style={statUnit}> / {profilo.cfu_totali}</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 22px' }}>
          <CircularProgress value={overall.pct} size="md" variant="warning" />
          <div style={{ minWidth: 0 }}>
            <div style={statLabel}>CPTS · HTB</div>
            <div style={statValue}>{overall.done}<span style={statUnit}> / {overall.total}</span></div>
          </div>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ ...statLabel, marginBottom: 7 }}>Speso · {budgetMonthLabel}</div>
          <div style={statValue}>€{Math.round(budgetSpent)}</div>
          <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {topCat ? `${topCat.category} · €${Math.round(topCat.spent)}` : 'Nessuna spesa'}
          </div>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ ...statLabel, marginBottom: 7 }}>Studio oggi</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={statValue}>{doneCount}<span style={statUnit}> / {totalCount}</span></span>
          </div>
          <div style={{ fontSize: 12, color: studioHintColor, marginTop: 6 }}>{studioHint}</div>
        </div>
      </div>
    </div>
  );
}

const statLabel: React.CSSProperties = { fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600, marginBottom: 4 };
const statValue: React.CSSProperties = { fontFamily: mono, fontSize: 18, fontWeight: 600, color: 'rgb(var(--color-heading))' };
const statUnit: React.CSSProperties = { color: 'rgb(var(--color-muted))', fontSize: 13 };
