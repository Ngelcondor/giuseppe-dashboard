'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Link2, ExternalLink, RotateCcw, Trophy, Award, Server, Cpu, Plug,
  CheckCircle2, Circle, ChevronDown, ChevronRight, ArrowRight, BookOpen, Pencil, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet, Field } from '@/components/sd/FormSheet';
import {
  getStudyPlan, resetStudyPlan, updateStudyModule, updateStudySection,
  getHTBProfile, getIsEditor,
  type StudyPlan, type StudyModule, type StudyModuleSection, type HTBProfile,
} from '@/services/studyService';

/* ── Percorso CPTS · Studio ────────────────────────────────────────────────────
   Companion di studio per la certificazione HTB CPTS, costruito attorno al
   workflow reale: apri → vedi dove sei arrivato ("Continua da qui") → clicchi il
   link HTB della sezione → studi → incolli su Claude → riassunto → nota Obsidian.
   Curriculum (moduli, sottocapitoli, brief, link HTB) pre-caricato dal path CPTS
   ufficiale e interamente editabile. Avanzamento per sottocapitolo. */

const mono = "'JetBrains Mono',monospace";
const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};
const DEFAULT_START = '2026-06-22';
// Obsidian desktop deep-link. Opens the app on this vault; change the name if
// your vault is registered under a different label in Obsidian.
const OBSIDIAN_VAULT = 'oscp-vault';
const OBSIDIAN_APP = `obsidian://open?vault=${encodeURIComponent(OBSIDIAN_VAULT)}`;
const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

type LinkEdit =
  | { kind: 'module-obsidian'; module: StudyModule }
  | { kind: 'module-htb'; module: StudyModule }
  | { kind: 'section-obsidian'; section: StudyModuleSection; moduleTitle: string };

export default function StudyPage() {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [htb, setHtb] = useState<HTBProfile | null>(null);
  const [isEditor, setIsEditor] = useState(false);
  const [errored, setErrored] = useState(false);

  const [edit, setEdit] = useState<LinkEdit | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadPlan = useCallback(async () => {
    try { setPlan(await getStudyPlan()); }
    catch { setErrored(true); }
  }, []);

  useEffect(() => {
    let active = true;
    loadPlan();
    getHTBProfile().then((d) => active && setHtb(d)).catch(() => active && setHtb({ connected: false }));
    getIsEditor().then((v) => active && setIsEditor(v)).catch(() => active && setIsEditor(false));
    return () => { active = false; };
  }, [loadPlan]);

  const hasPlan = !!plan && plan.total_count > 0;
  const needsUpgrade = hasPlan && plan!.sections_total === 0; // old plan without subchapters
  const overallPct = plan && plan.sections_total > 0
    ? Math.round((plan.sections_done / plan.sections_total) * 100)
    : plan && plan.total_count > 0
      ? Math.round((plan.completed_count / plan.total_count) * 100)
      : 0;

  // The module you're currently on = first not fully completed.
  const currentModule = useMemo(
    () => plan?.modules.find((m) => !m.completed) ?? null,
    [plan],
  );

  // Auto-expand the current module on first load.
  useEffect(() => {
    if (currentModule) setExpanded((s) => (s.size === 0 ? new Set([currentModule.id]) : s));
  }, [currentModule]);

  const subtitle = [plan ? `Settimana ${plan.current_week} di ${plan.total_weeks}` : null, 'Hack The Box']
    .filter(Boolean).join(' · ');

  /* ── state helpers ── */
  const recompute = (prev: StudyPlan, modules: StudyModule[]): StudyPlan => ({
    ...prev,
    modules,
    completed_count: modules.filter((m) => m.completed).length,
    sections_done: modules.reduce((s, m) => s + m.sections_done, 0),
    sections_total: modules.reduce((s, m) => s + m.sections_total, 0),
  });
  const applyModule = (updated: StudyModule) =>
    setPlan((prev) => (prev ? recompute(prev, prev.modules.map((m) => (m.id === updated.id ? updated : m))) : prev));

  const optimisticSection = (moduleId: string, sectionId: string, completed: boolean) =>
    setPlan((prev) => {
      if (!prev) return prev;
      const modules = prev.modules.map((m) => {
        if (m.id !== moduleId) return m;
        const sections = m.sections.map((s) => (s.id === sectionId ? { ...s, completed } : s));
        const done = sections.filter((s) => s.completed).length;
        return { ...m, sections, sections_done: done, completed: sections.length > 0 && done === sections.length };
      });
      return recompute(prev, modules);
    });

  /* ── actions ── */
  const toggleSection = async (m: StudyModule, s: StudyModuleSection) => {
    if (!isEditor) return;
    optimisticSection(m.id, s.id, !s.completed);
    try { applyModule(await updateStudySection(s.id, { completed: !s.completed })); }
    catch { await loadPlan(); }
  };
  const toggleModule = async (m: StudyModule) => {
    if (!isEditor) return;
    const next = !m.completed;
    setPlan((prev) => prev && recompute(prev, prev.modules.map((x) => x.id === m.id
      ? { ...x, completed: next, sections: x.sections.map((s) => ({ ...s, completed: next })), sections_done: next ? x.sections_total : 0 }
      : x)));
    try { applyModule(await updateStudyModule(m.id, { completed: next })); }
    catch { await loadPlan(); }
  };
  const saveLink = async (value: string) => {
    if (!edit) return;
    if (edit.kind === 'module-obsidian') applyModule(await updateStudyModule(edit.module.id, { obsidian_link: value }));
    else if (edit.kind === 'module-htb') applyModule(await updateStudyModule(edit.module.id, { htb_url: value }));
    else applyModule(await updateStudySection(edit.section.id, { obsidian_link: value }));
    setEdit(null);
  };
  const doReset = async (startDate: string) => {
    setPlan(await resetStudyPlan(startDate));
    setExpanded(new Set());
    setResetOpen(false);
  };
  const toggleExpand = (id: string) =>
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>Certificazioni · HTB</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(28px, 7vw, 38px)', lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>Percorso <span style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>CPTS</span></h1>
          <p style={{ margin: '11px 0 0', fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <a href={OBSIDIAN_APP} style={{ textDecoration: 'none' }}>
            <Button size="sm" variant="secondary"><FileText size={15} style={{ marginRight: 6 }} />Apri Obsidian</Button>
          </a>
          {isEditor && hasPlan && (
            <Button size="sm" variant="secondary" onClick={() => setResetOpen(true)}>
              <RotateCcw size={15} style={{ marginRight: 6 }} />Reset percorso
            </Button>
          )}
        </div>
      </header>

      {errored && (
        <div className="sd-reveal" style={{ ['--i' as string]: 1, ...card, padding: '20px 24px', color: 'rgb(var(--color-tertiary))', fontSize: 14 }}>
          Impossibile caricare il piano di studio. Riprova più tardi.
        </div>
      )}

      {needsUpgrade && isEditor && (
        <div className="sd-reveal" style={{ ['--i' as string]: 1, ...card, padding: '16px 20px', marginBottom: 18, borderColor: 'rgb(99 102 241/0.4)', background: 'rgb(99 102 241/0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13.5, color: 'rgb(var(--color-body))', lineHeight: 1.5 }}>
            Il curriculum è stato aggiornato con <strong>sottocapitoli, brief e link HTB</strong>. Reinizializza per caricarli (l&apos;avanzamento attuale verrà azzerato).
          </div>
          <Button size="sm" variant="primary" onClick={() => setResetOpen(true)}><RotateCcw size={14} style={{ marginRight: 6 }} />Aggiorna curriculum</Button>
        </div>
      )}

      {!errored && hasPlan && (
        <>
          {/* ── Continua da qui (anchor del workflow) ── */}
          <ContinueCard
            module={currentModule}
            overallPct={overallPct}
            sectionsDone={plan!.sections_done}
            sectionsTotal={plan!.sections_total}
            onOpenObsidian={(sec, title) => setEdit({ kind: 'section-obsidian', section: sec, moduleTitle: title })}
            onJump={(id) => { setExpanded((s) => new Set(s).add(id)); document.getElementById(`mod-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            isEditor={isEditor}
          />

          {/* ── HTB profile + avanzamento ── */}
          <div className="sd-twocol" style={{ margin: '18px 0' }}>
            <HTBPanel htb={htb} />
            <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 3, ...card, padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600, marginBottom: 12 }}>Avanzamento percorso</div>
                <div style={{ fontFamily: mono, fontSize: 30, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>
                  {plan!.sections_done} <span style={{ color: 'rgb(var(--color-muted))', fontSize: 20 }}>/ {plan!.sections_total}</span>
                </div>
                <div style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))', marginTop: 4 }}>sottocapitoli · {plan!.completed_count}/{plan!.total_count} moduli completi</div>
              </div>
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontFamily: mono, marginBottom: 8, color: 'rgb(var(--color-tertiary))' }}>
                  <span>Inizio {fmtDate(plan!.start_date)}</span><span>{overallPct}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 8, background: 'rgb(var(--color-border))', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${overallPct}%`, background: 'rgb(99 102 241)', borderRadius: 8, transition: 'width .4s ease' }} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Moduli (accordion con sottocapitoli) ── */}
          <div className="sd-reveal" style={{ ['--i' as string]: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 2px 14px', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Moduli CPTS</h3>
            <span style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{overallPct}% totale</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plan!.modules.map((m, idx) => (
              <ModuleCard
                key={m.id}
                module={m}
                index={idx}
                isCurrent={currentModule?.id === m.id}
                expanded={expanded.has(m.id)}
                isEditor={isEditor}
                onExpand={() => toggleExpand(m.id)}
                onToggleModule={() => toggleModule(m)}
                onToggleSection={(s) => toggleSection(m, s)}
                onEditModuleHtb={() => setEdit({ kind: 'module-htb', module: m })}
                onEditModuleObsidian={() => setEdit({ kind: 'module-obsidian', module: m })}
                onEditSectionObsidian={(s) => setEdit({ kind: 'section-obsidian', section: s, moduleTitle: m.title })}
              />
            ))}
          </div>
        </>
      )}

      {!errored && !hasPlan && (
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, padding: '30px 28px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 14.5, color: 'rgb(var(--color-tertiary))', lineHeight: 1.55, maxWidth: 560 }}>
            Nessun percorso inizializzato. {isEditor ? 'Carica il curriculum CPTS ufficiale: 27 moduli con sottocapitoli, brief e link HTB diretti.' : 'Solo un editor può inizializzare il percorso.'}
          </p>
          {isEditor && <Button size="sm" variant="primary" onClick={() => setResetOpen(true)}><RotateCcw size={15} style={{ marginRight: 6 }} />Inizializza percorso</Button>}
        </div>
      )}

      {/* ── Edit-link sheet (Obsidian per modulo/sezione + HTB per modulo) ── */}
      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.kind === 'module-htb' ? 'Link HTB Academy' : 'Link Obsidian'}
        subtitle={edit?.kind === 'section-obsidian' ? `${edit.moduleTitle} · ${edit.section.title}` : edit?.kind ? edit.module.title : undefined}
        maxWidth={480}
      >
        {edit && (
          <LinkForm
            key={edit.kind === 'section-obsidian' ? edit.section.id : edit.module.id + edit.kind}
            initial={
              edit.kind === 'module-htb' ? (edit.module.htb_url ?? '')
                : edit.kind === 'module-obsidian' ? (edit.module.obsidian_link ?? '')
                  : (edit.section.obsidian_link ?? '')
            }
            mode={edit.kind === 'module-htb' ? 'htb' : 'obsidian'}
            onSubmit={saveLink}
            onCancel={() => setEdit(null)}
          />
        )}
      </Sheet>

      {/* ── Reset confirm sheet ── */}
      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title="Reset percorso CPTS" subtitle="Reinizializza il piano al curriculum ufficiale" maxWidth={440}>
        <ResetForm key={resetOpen ? 'r' : 'c'} defaultStart={plan?.start_date ?? DEFAULT_START} hasPlan={hasPlan} onSubmit={doReset} onCancel={() => setResetOpen(false)} />
      </Sheet>
    </div>
  );
}

/* ── Continua da qui ── */
function ContinueCard({
  module: m, overallPct, sectionsDone, sectionsTotal, onOpenObsidian, onJump, isEditor,
}: {
  module: StudyModule | null; overallPct: number; sectionsDone: number; sectionsTotal: number;
  onOpenObsidian: (s: StudyModuleSection, title: string) => void; onJump: (id: string) => void; isEditor: boolean;
}) {
  if (!m) {
    return (
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 2, background: 'rgb(16 185 129)', borderRadius: 18, padding: '26px 28px', color: '#fff' }}>
        <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .85, fontWeight: 600 }}>Percorso CPTS</div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>Tutti i moduli completati 🎉</div>
        <p style={{ margin: '8px 0 0', fontSize: 14, opacity: .9 }}>Hai chiuso tutti i {sectionsTotal} sottocapitoli. Prossimo step: mock exam e prep finale.</p>
      </div>
    );
  }
  const nextSection = m.sections.find((s) => !s.completed) ?? null;
  return (
    <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 2, ...card, padding: '24px 26px', borderColor: 'rgb(99 102 241/0.45)', background: 'rgb(99 102 241/0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontWeight: 700, fontFamily: mono }}>▸ Continua da qui</div>
        <span style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{sectionsDone}/{sectionsTotal} · {overallPct}%</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: mono, fontSize: 13, color: 'rgb(var(--color-muted))' }}>{String(m.order_index + 1).padStart(2, '0')}</span>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'rgb(var(--color-heading))' }}>{m.title}</h2>
      </div>
      {m.brief && <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgb(var(--color-tertiary))', lineHeight: 1.55, maxWidth: 680 }}>{m.brief}</p>}

      {nextSection && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '11px 14px', borderRadius: 12, background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))' }}>
          <Circle size={16} style={{ color: 'rgb(99 102 241)', flex: 'none' }} />
          <span style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgb(var(--color-muted))', fontWeight: 600, flex: 'none' }}>Prossima</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'rgb(var(--color-heading))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextSection.title}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        {m.htb_url
          ? <a href={m.htb_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}><Button variant="primary"><BookOpen size={16} style={{ marginRight: 7 }} />Apri lezione HTB<ArrowRight size={15} style={{ marginLeft: 7 }} /></Button></a>
          : <Button variant="secondary" disabled>Link HTB non impostato</Button>}
        {nextSection && nextSection.obsidian_link
          ? <a href={nextSection.obsidian_link} style={{ textDecoration: 'none' }}><Button variant="secondary"><ExternalLink size={15} style={{ marginRight: 6 }} />Nota Obsidian</Button></a>
          : nextSection && isEditor
            ? <Button variant="secondary" onClick={() => onOpenObsidian(nextSection, m.title)}><Link2 size={15} style={{ marginRight: 6 }} />Aggiungi nota</Button>
            : null}
        <button onClick={() => onJump(m.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'rgb(var(--color-tertiary))', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          Vedi sottocapitoli <ChevronDown size={15} />
        </button>
      </div>
    </div>
  );
}

/* ── Module accordion card ── */
function ModuleCard({
  module: m, index, isCurrent, expanded, isEditor,
  onExpand, onToggleModule, onToggleSection, onEditModuleHtb, onEditModuleObsidian, onEditSectionObsidian,
}: {
  module: StudyModule; index: number; isCurrent: boolean; expanded: boolean; isEditor: boolean;
  onExpand: () => void; onToggleModule: () => void; onToggleSection: (s: StudyModuleSection) => void;
  onEditModuleHtb: () => void; onEditModuleObsidian: () => void; onEditSectionObsidian: (s: StudyModuleSection) => void;
}) {
  const pct = m.sections_total > 0 ? Math.round((m.sections_done / m.sections_total) * 100) : (m.completed ? 100 : 0);
  return (
    <div id={`mod-${m.id}`} className="sd-shadow" style={{ ...card, borderColor: isCurrent ? 'rgb(99 102 241/0.4)' : 'rgb(var(--color-border))', overflow: 'hidden' }}>
      {/* header */}
      <div
        role="button" tabIndex={0} onClick={onExpand}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand(); } }}
        style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 18px', cursor: 'pointer' }}
      >
        <button
          type="button" aria-label={m.completed ? 'Segna modulo da fare' : 'Segna modulo completato'}
          onClick={(e) => { e.stopPropagation(); onToggleModule(); }} disabled={!isEditor}
          className={isEditor ? 'sd-press sd-checkbtn' : 'sd-checkbtn'}
          style={{ flex: 'none', border: 'none', background: 'transparent', padding: 0, cursor: isEditor ? 'pointer' : 'default', color: m.completed ? 'rgb(16 185 129)' : 'rgb(var(--color-muted))', display: 'flex' }}
        >
          {m.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </button>
        <div className="sd-m-hide" style={{ flex: 'none', width: 26, fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-muted))' }}>{String(index + 1).padStart(2, '0')}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: m.completed ? 'rgb(var(--color-tertiary))' : 'rgb(var(--color-heading))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
            {isCurrent && <span style={{ flex: 'none', fontSize: 10, fontFamily: mono, fontWeight: 700, color: 'rgb(99 102 241)', background: 'rgb(99 102 241/0.14)', border: '1px solid rgb(99 102 241/0.4)', borderRadius: 6, padding: '1px 6px' }}>ORA</span>}
          </div>
          {m.brief && <div style={{ fontSize: 12, color: 'rgb(var(--color-muted))', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.brief}</div>}
        </div>
        <span style={{ flex: 'none', fontFamily: mono, fontSize: 11.5, color: 'rgb(var(--color-tertiary))' }}>{m.sections_done}/{m.sections_total}</span>
        <div className="sd-m-hide" style={{ flex: 'none', width: 54, height: 5, borderRadius: 5, background: 'rgb(var(--color-card-inner))', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: m.completed ? 'rgb(16 185 129)' : 'rgb(99 102 241)', borderRadius: 5 }} />
        </div>
        {m.htb_url && (
          <a href={m.htb_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="sd-iconbtn" aria-label="Apri modulo su HTB Academy" title="Apri modulo su HTB Academy"><BookOpen size={15} /></a>
        )}
        <span style={{ flex: 'none', color: 'rgb(var(--color-muted))', display: 'flex' }}>{expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</span>
      </div>

      {/* sections */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgb(var(--color-border))', padding: '6px 18px 14px 18px' }}>
          {m.sections.length === 0 ? (
            <p style={{ margin: '12px 0 6px', fontSize: 13, color: 'rgb(var(--color-muted))' }}>Nessun sottocapitolo. Reinizializza il percorso per caricare il curriculum aggiornato.</p>
          ) : (
            m.sections.map((s, i) => (
              <SectionRow key={s.id} section={s} index={i} htbUrl={m.htb_url} isEditor={isEditor}
                onToggle={() => onToggleSection(s)} onEditObsidian={() => onEditSectionObsidian(s)} />
            ))
          )}
          {isEditor && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgb(var(--color-border))' }}>
              <button onClick={onEditModuleHtb} style={editLinkBtn}><Pencil size={12} style={{ marginRight: 5 }} />Modifica link HTB</button>
              <button onClick={onEditModuleObsidian} style={editLinkBtn}><Link2 size={12} style={{ marginRight: 5 }} />{m.obsidian_link ? 'Nota modulo' : 'Aggiungi nota modulo'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// padding + margin negativo: hit area ~30px senza spostare il layout desktop
const editLinkBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'rgb(var(--color-tertiary))', padding: '8px 0', margin: '-8px 0', fontFamily: 'inherit' };

/* ── Single subchapter row ── */
function SectionRow({
  section: s, index, htbUrl, isEditor, onToggle, onEditObsidian,
}: {
  section: StudyModuleSection; index: number; htbUrl: string | null; isEditor: boolean;
  onToggle: () => void; onEditObsidian: () => void;
}) {
  const hasNote = !!s.obsidian_link;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderTop: index === 0 ? 'none' : '1px solid rgb(var(--color-border))' }}>
      <button
        type="button" aria-label={s.completed ? 'Segna da fare' : 'Segna completato'} onClick={onToggle} disabled={!isEditor}
        className={isEditor ? 'sd-press sd-checkbtn' : 'sd-checkbtn'}
        style={{ flex: 'none', border: 'none', background: 'transparent', padding: 0, cursor: isEditor ? 'pointer' : 'default', color: s.completed ? 'rgb(16 185 129)' : 'rgb(var(--color-muted))', display: 'flex' }}
      >
        {s.completed ? <CheckCircle2 size={17} /> : <Circle size={17} />}
      </button>

      {/* The subchapter title links straight to the HTB module (the lesson). */}
      {htbUrl ? (
        <a href={htbUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }} className="sd-section-link">
          <span style={{ fontSize: 13.5, color: s.completed ? 'rgb(var(--color-tertiary))' : 'rgb(var(--color-body))', textDecoration: s.completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
          <ExternalLink size={12} style={{ flex: 'none', color: 'rgb(var(--color-muted))' }} />
        </a>
      ) : (
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'rgb(var(--color-body))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
      )}

      {hasNote && (
        <a href={s.obsidian_link!} className="sd-iconbtn" aria-label="Apri nota Obsidian" title="Apri nota Obsidian" style={{ color: 'rgb(99 102 241)' }}><ExternalLink size={14} /></a>
      )}
      {isEditor && (
        <button type="button" className="sd-iconbtn" aria-label={hasNote ? 'Modifica nota Obsidian' : 'Aggiungi nota Obsidian'} title={hasNote ? 'Modifica nota Obsidian' : 'Aggiungi nota Obsidian'} onClick={onEditObsidian} style={hasNote ? { color: 'rgb(99 102 241)' } : undefined}>
          <Link2 size={13} />
        </button>
      )}
    </div>
  );
}

/* ── HTB stats panel ── */
function HTBPanel({ htb }: { htb: HTBProfile | null }) {
  if (htb === null) {
    return (
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 3, ...card, padding: '26px 28px', minHeight: 170 }}>
        <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600 }}>Hack The Box</div>
        <p style={{ margin: '14px 0 0', fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>Caricamento…</p>
      </div>
    );
  }
  if (!htb.connected) {
    return (
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 3, ...card, padding: '26px 28px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 14, minHeight: 170 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Plug size={18} style={{ color: 'rgb(var(--color-tertiary))' }} />
          <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600 }}>Hack The Box</div>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: 'rgb(var(--color-tertiary))', lineHeight: 1.5 }}>
          {htb.detail ? htb.detail : 'HTB non collegato.'} Aggiungi il tuo App Token per vedere rank, punti e box risolte reali.
        </p>
        <Link href="/dashboard/settings"><Button size="sm" variant="secondary">Collega HTB nelle Impostazioni</Button></Link>
      </div>
    );
  }
  const stats: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (htb.points != null) stats.push({ icon: <Trophy size={15} />, label: 'Punti', value: String(htb.points) });
  if (htb.user_owns != null) stats.push({ icon: <Cpu size={15} />, label: 'User owns', value: String(htb.user_owns) });
  if (htb.system_owns != null) stats.push({ icon: <Server size={15} />, label: 'System owns', value: String(htb.system_owns) });
  if (htb.ranking != null) stats.push({ icon: <Award size={15} />, label: 'Ranking', value: `#${htb.ranking}` });
  return (
    <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 3, background: 'rgb(99 102 241)', borderRadius: 18, padding: '26px 28px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 170 }}>
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

/* ── Link form (Obsidian or HTB) ── */
function LinkForm({ initial, mode, onSubmit, onCancel }: { initial: string; mode: 'obsidian' | 'htb'; onSubmit: (v: string) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try { await onSubmit(value.trim()); }
    catch { setError('Salvataggio non riuscito. Riprova.'); setSubmitting(false); }
  };
  return (
    <form onSubmit={submit}>
      <Field
        label={mode === 'htb' ? 'URL modulo HTB Academy' : 'URI o percorso vault'}
        hint={mode === 'htb'
          ? 'Apri il modulo su academy.hackthebox.com e incolla l’URL. Pre-caricato dal curriculum; correggilo se non combacia.'
          : 'Incolla un URI obsidian:// oppure il percorso della nota. Il vault è su un’altra macchina: qui salviamo solo il riferimento.'}
      >
        <input className="sd-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={mode === 'htb' ? 'https://academy.hackthebox.com/module/details/19' : 'obsidian://open?vault=oscp-vault&file=...'} autoFocus />
      </Field>
      {error && <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'rgb(239 68 68)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6 }}>
        <button type="button" onClick={() => setValue('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'rgb(var(--color-tertiary))', padding: 0 }}>Svuota</button>
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
    try { await onSubmit(start); }
    catch { setError('Reset non riuscito. Riprova.'); setSubmitting(false); }
  };
  return (
    <form onSubmit={submit}>
      <p style={{ margin: '0 0 14px', fontSize: 14, color: 'rgb(var(--color-tertiary))', lineHeight: 1.5 }}>
        {hasPlan
          ? 'I 27 moduli e i loro sottocapitoli verranno ripristinati al curriculum CPTS ufficiale, segnati come da fare, e i link Obsidian rimossi. Il percorso riparte dalla settimana 1.'
          : 'Verrà creato il percorso con i 27 moduli CPTS, sottocapitoli, brief e link HTB. Tutto parte come da fare.'}
      </p>
      <Field label="Data di inizio"><input className="sd-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} autoFocus /></Field>
      {error && <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'rgb(239 68 68)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8, paddingTop: 6 }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annulla</Button>
        <Button type="submit" variant="danger" isLoading={submitting}>{hasPlan ? 'Reset' : 'Inizializza'}</Button>
      </div>
    </form>
  );
}
