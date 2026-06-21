'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Link2,
  ExternalLink,
  RotateCcw,
  Trophy,
  Award,
  Server,
  Cpu,
  CheckCircle2,
  Circle,
  Plug,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet, Field } from '@/components/sd/FormSheet';
import {
  getStudyPlan,
  resetStudyPlan,
  updateStudyModule,
  getHTBProfile,
  getIsEditor,
  type StudyPlan,
  type StudyModule,
  type HTBProfile,
} from '@/services/studyService';

const mono = "'JetBrains Mono',monospace";
const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};

const DEFAULT_START = '2026-06-22';

const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

export default function StudyPage() {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [htb, setHtb] = useState<HTBProfile | null>(null);
  const [isEditor, setIsEditor] = useState(false);
  const [errored, setErrored] = useState(false);

  const [linkEd, setLinkEd] = useState<StudyModule | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const loadPlan = useCallback(async () => {
    try {
      setPlan(await getStudyPlan());
    } catch {
      setErrored(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadPlan();
    getHTBProfile()
      .then((d) => { if (active) setHtb(d); })
      .catch(() => { if (active) setHtb({ connected: false }); });
    getIsEditor()
      .then((v) => { if (active) setIsEditor(v); })
      .catch(() => { if (active) setIsEditor(false); });
    return () => { active = false; };
  }, [loadPlan]);

  const hasPlan = !!plan && plan.total_count > 0;
  const overallPct = plan && plan.total_count > 0
    ? Math.round((plan.completed_count / plan.total_count) * 100)
    : 0;

  const subtitleParts: string[] = [];
  if (plan) subtitleParts.push(`Settimana ${plan.current_week} di ${plan.total_weeks}`);
  subtitleParts.push('Hack The Box');
  const subtitle = subtitleParts.join(' · ');

  const toggleModule = async (m: StudyModule) => {
    if (!isEditor) return;
    // Optimistic flip, then persist.
    const next = !m.completed;
    setPlan((prev) => prev && {
      ...prev,
      modules: prev.modules.map((x) => (x.id === m.id ? { ...x, completed: next } : x)),
      completed_count: prev.completed_count + (next ? 1 : -1),
    });
    try {
      await updateStudyModule(m.id, { completed: next });
    } catch {
      await loadPlan(); // revert to server truth on failure
    }
  };

  const saveLink = async (link: string) => {
    if (!linkEd) return;
    await updateStudyModule(linkEd.id, { obsidian_link: link });
    setLinkEd(null);
    await loadPlan();
  };

  const doReset = async (startDate: string) => {
    const fresh = await resetStudyPlan(startDate);
    setPlan(fresh);
    setResetOpen(false);
  };

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>Certificazioni · HTB</div>
          <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>Percorso <span style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>CPTS</span></h1>
          <p style={{ margin: '11px 0 0', fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>{subtitle}</p>
        </div>
        {isEditor && hasPlan && (
          <Button size="sm" variant="secondary" onClick={() => setResetOpen(true)}>
            <RotateCcw size={15} style={{ marginRight: 6 }} />Reset percorso
          </Button>
        )}
      </header>

      {errored && (
        <div className="sd-reveal" style={{ ['--i' as string]: 1, ...card, padding: '20px 24px', color: 'rgb(var(--color-tertiary))', fontSize: 14 }}>
          Impossibile caricare il piano di studio. Riprova più tardi.
        </div>
      )}

      {!errored && (
        <>
          {/* HTB panel + avanzamento */}
          <div className="sd-twocol" style={{ marginBottom: 18 }}>
            <HTBPanel htb={htb} />

            {/* Avanzamento percorso (REAL: completed / total) */}
            <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 2, ...card, padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600, marginBottom: 12 }}>Avanzamento percorso</div>
                {hasPlan ? (
                  <>
                    <div style={{ fontFamily: mono, fontSize: 30, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>
                      {plan!.completed_count} <span style={{ color: 'rgb(var(--color-muted))', fontSize: 20 }}>/ {plan!.total_count}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))', marginTop: 4 }}>moduli completati</div>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: 14, color: 'rgb(var(--color-tertiary))', lineHeight: 1.5 }}>Nessun percorso inizializzato.</p>
                )}
              </div>
              {hasPlan && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontFamily: mono, marginBottom: 8, color: 'rgb(var(--color-tertiary))' }}>
                    <span>Inizio {fmtDate(plan!.start_date)}</span>
                    <span>{overallPct}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 8, background: 'rgb(var(--color-border))', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${overallPct}%`, background: 'rgb(99 102 241)', borderRadius: 8, transition: 'width .4s ease' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Moduli del percorso */}
          <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 3, ...card, padding: '24px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Moduli CPTS</h3>
              {hasPlan && <span style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{overallPct}% totale</span>}
            </div>

            {hasPlan ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {plan!.modules.map((m, idx) => (
                  <ModuleRow
                    key={m.id}
                    module={m}
                    index={idx}
                    isEditor={isEditor}
                    onToggle={() => toggleModule(m)}
                    onLink={() => setLinkEd(m)}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
                <p style={{ margin: 0, fontSize: 14, color: 'rgb(var(--color-tertiary))', lineHeight: 1.5 }}>
                  Nessun percorso inizializzato. {isEditor ? 'Inizializza il piano con la sequenza ufficiale dei moduli CPTS.' : 'Solo un editor può inizializzare il percorso.'}
                </p>
                {isEditor && (
                  <Button size="sm" variant="primary" onClick={() => setResetOpen(true)}>
                    <RotateCcw size={15} style={{ marginRight: 6 }} />Inizializza percorso
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Obsidian link sheet ── */}
      <Sheet
        open={!!linkEd}
        onClose={() => setLinkEd(null)}
        title="Link Obsidian"
        subtitle={linkEd?.title}
        maxWidth={460}
      >
        {linkEd && (
          <LinkForm
            key={linkEd.id}
            initial={linkEd.obsidian_link ?? ''}
            onSubmit={saveLink}
            onCancel={() => setLinkEd(null)}
          />
        )}
      </Sheet>

      {/* ── Reset confirm sheet ── */}
      <Sheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset percorso CPTS"
        subtitle="Reinizializza il piano alla sequenza ufficiale dei moduli"
        maxWidth={440}
      >
        <ResetForm
          key={resetOpen ? 'r' : 'c'}
          defaultStart={plan?.start_date ?? DEFAULT_START}
          hasPlan={hasPlan}
          onSubmit={doReset}
          onCancel={() => setResetOpen(false)}
        />
      </Sheet>
    </div>
  );
}

/* ── HTB stats panel (connected) vs CTA (not connected) ── */
function HTBPanel({ htb }: { htb: HTBProfile | null }) {
  // Loading: neutral placeholder card (no fabricated stats).
  if (htb === null) {
    return (
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, padding: '26px 28px', minHeight: 170 }}>
        <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600 }}>Hack The Box</div>
        <p style={{ margin: '14px 0 0', fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>Caricamento…</p>
      </div>
    );
  }

  if (!htb.connected) {
    return (
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, padding: '26px 28px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 14, minHeight: 170 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Plug size={18} style={{ color: 'rgb(var(--color-tertiary))' }} />
          <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600 }}>Hack The Box</div>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: 'rgb(var(--color-tertiary))', lineHeight: 1.5 }}>
          {htb.detail ? htb.detail : 'HTB non collegato.'} Aggiungi il tuo App Token per vedere rank, punti e box risolte reali.
        </p>
        <Link href="/dashboard/settings">
          <Button size="sm" variant="secondary">Collega HTB nelle Impostazioni</Button>
        </Link>
      </div>
    );
  }

  // Connected — real stats only; any field HTB omitted is hidden, not faked.
  const stats: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (htb.points != null) stats.push({ icon: <Trophy size={15} />, label: 'Punti', value: String(htb.points) });
  if (htb.user_owns != null) stats.push({ icon: <Cpu size={15} />, label: 'User owns', value: String(htb.user_owns) });
  if (htb.system_owns != null) stats.push({ icon: <Server size={15} />, label: 'System owns', value: String(htb.system_owns) });
  if (htb.ranking != null) stats.push({ icon: <Award size={15} />, label: 'Ranking', value: `#${htb.ranking}` });

  return (
    <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, background: 'rgb(99 102 241)', borderRadius: 18, padding: '26px 28px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 170 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .8, fontWeight: 600 }}>Hack The Box</div>
          {htb.rank && <span style={{ fontFamily: mono, fontSize: 11, background: 'rgb(255 255 255 / 0.18)', padding: '4px 10px', borderRadius: 8 }}>{htb.rank}</span>}
        </div>
        <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1, marginTop: 12 }}>{htb.name ?? 'Profilo HTB'}</div>
        {htb.country && <div style={{ fontSize: 12.5, opacity: .85, marginTop: 4 }}>{htb.country}</div>}
      </div>
      {stats.length > 0 ? (
        <div style={{ display: 'flex', gap: 22, marginTop: 22, flexWrap: 'wrap' }}>
          {stats.map((s) => (
            <div key={s.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: .85 }}>{s.icon}<span style={{ fontSize: 11 }}>{s.label}</span></div>
              <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ margin: '22px 0 0', fontSize: 12.5, opacity: .85 }}>Collegato. Statistiche dettagliate non disponibili dall&apos;API.</p>
      )}
    </div>
  );
}

/* ── Single module row ── */
function ModuleRow({
  module: m, index, isEditor, onToggle, onLink,
}: {
  module: StudyModule; index: number; isEditor: boolean; onToggle: () => void; onLink: () => void;
}) {
  const hasLink = !!m.obsidian_link;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: index === 0 ? 'none' : '1px solid rgb(var(--color-border))' }}>
      {/* Completion toggle (editor) or static indicator (guest) */}
      <button
        type="button"
        aria-label={m.completed ? 'Segna come da fare' : 'Segna come completato'}
        onClick={onToggle}
        disabled={!isEditor}
        className={isEditor ? 'sd-press' : undefined}
        style={{ flex: 'none', border: 'none', background: 'transparent', padding: 0, cursor: isEditor ? 'pointer' : 'default', color: m.completed ? 'rgb(16 185 129)' : 'rgb(var(--color-muted))', display: 'flex' }}
      >
        {m.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </button>

      <div style={{ flex: 'none', width: 30, fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-muted))' }}>
        {String(index + 1).padStart(2, '0')}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: m.completed ? 'rgb(var(--color-tertiary))' : 'rgb(var(--color-heading))', textDecoration: m.completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.title}
        </div>
        {hasLink && (
          <div style={{ fontSize: 11.5, color: 'rgb(var(--color-muted))', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: mono }}>{m.obsidian_link}</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 'none' }}>
        {hasLink && (
          <a
            href={m.obsidian_link!}
            className="sd-iconbtn"
            aria-label="Apri nota Obsidian"
            title="Apri nota Obsidian"
          >
            <ExternalLink size={15} />
          </a>
        )}
        {isEditor && (
          <button
            type="button"
            className="sd-iconbtn"
            aria-label={hasLink ? 'Modifica link Obsidian' : 'Aggiungi link Obsidian'}
            title={hasLink ? 'Modifica link Obsidian' : 'Aggiungi link Obsidian'}
            onClick={onLink}
            style={hasLink ? { color: 'rgb(99 102 241)' } : undefined}
          >
            <Link2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Obsidian link form ── */
function LinkForm({ initial, onSubmit, onCancel }: { initial: string; onSubmit: (v: string) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      await onSubmit(value.trim());
    } catch {
      setError('Salvataggio non riuscito. Riprova.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Field label="URI o percorso vault" hint="Incolla un URI obsidian:// oppure il percorso della nota nel vault. Il vault è su un&apos;altra macchina: qui salviamo solo il riferimento.">
        <input
          className="sd-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="obsidian://open?vault=oscp-vault&file=..."
          autoFocus
        />
      </Field>
      {error && <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'rgb(239 68 68)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6 }}>
        <button
          type="button"
          onClick={() => setValue('')}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'rgb(var(--color-tertiary))', padding: 0 }}
        >
          Rimuovi link
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annulla</Button>
          <Button type="submit" variant="primary" isLoading={submitting}>Salva</Button>
        </div>
      </div>
    </form>
  );
}

/* ── Reset confirm form ── */
function ResetForm({ defaultStart, hasPlan, onSubmit, onCancel }: { defaultStart: string; hasPlan: boolean; onSubmit: (start: string) => Promise<void>; onCancel: () => void }) {
  const [start, setStart] = useState(defaultStart);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!start) { setError('Seleziona una data di inizio.'); return; }
    setSubmitting(true); setError('');
    try {
      await onSubmit(start);
    } catch {
      setError('Reset non riuscito. Riprova.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <p style={{ margin: '0 0 14px', fontSize: 14, color: 'rgb(var(--color-tertiary))', lineHeight: 1.5 }}>
        {hasPlan
          ? 'Tutti i moduli verranno ripristinati alla sequenza ufficiale CPTS, segnati come da fare, e i link Obsidian rimossi. Il percorso riparte dalla settimana 1.'
          : 'Verrà creato il percorso con la sequenza ufficiale dei moduli CPTS. Tutti i moduli partono come da fare.'}
      </p>
      <Field label="Data di inizio">
        <input className="sd-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} autoFocus />
      </Field>
      {error && <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'rgb(239 68 68)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8, paddingTop: 6 }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annulla</Button>
        <Button type="submit" variant="danger" isLoading={submitting}>{hasPlan ? 'Reset' : 'Inizializza'}</Button>
      </div>
    </form>
  );
}
