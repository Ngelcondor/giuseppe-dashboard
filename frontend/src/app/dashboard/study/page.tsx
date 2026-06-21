'use client';

import React, { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/Toggle';
import { getStudyPlanState } from '@/services/studyService';
import {
  getTodayDay,
  getPhaseProgress,
  getOverallProgress,
  todayISO,
  type StudyPlanState,
  type StudyPhase,
  type StudyWeek,
  type StudyDay,
} from '@/lib/studyPlanState';

const mono = "'JetBrains Mono',monospace";

// ── Derived (REAL) view models ───────────────────────────────────────────────

interface TodayView {
  label: string;
  isRest: boolean;
  tasks: { id: string; label: string; completed: boolean }[];
  done: number;
  total: number;
}

interface CurrentModuleView {
  label: string;
  description: string;
  pct: number;
  index: number; // 1-based position of the phase in the plan
  totalPhases: number;
}

interface WeekView {
  current: number | null; // 1-based sequential week number containing today
  total: number;
}

interface ModuleView {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  pct: number;
  isCurrent: boolean;
}

interface StudyView {
  week: WeekView;
  currentModule: CurrentModuleView | null;
  today: TodayView | null;
  modules: ModuleView[];
  overallPct: number;
}

// Sequential week index across all phases (the plan numbers weeks 1..N).
function flatWeeks(state: StudyPlanState): StudyWeek[] {
  return state.phases.flatMap((p) => p.weeks);
}

function findPhaseOfDay(state: StudyPlanState, date: string): StudyPhase | null {
  for (const phase of state.phases) {
    for (const week of phase.weeks) {
      if (week.days.some((d) => d.date === date)) return phase;
    }
  }
  return null;
}

function findWeekNumberOfDay(state: StudyPlanState, date: string): number | null {
  const weeks = flatWeeks(state);
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].days.some((d) => d.date === date)) return i + 1;
  }
  return null;
}

function buildView(state: StudyPlanState): StudyView {
  const date = todayISO();
  const today: StudyDay | undefined = getTodayDay(state);
  const phase = findPhaseOfDay(state, date);
  const weekNumber = findWeekNumberOfDay(state, date);
  const totalWeeks = flatWeeks(state).length;
  const overall = getOverallProgress(state);

  const todayView: TodayView | null = today
    ? {
        label: today.label,
        isRest: today.isRest,
        tasks: today.tasks.map((t) => ({ id: t.id, label: t.text, completed: t.completed })),
        done: today.tasks.filter((t) => t.completed).length,
        total: today.tasks.length,
      }
    : null;

  const currentModule: CurrentModuleView | null = phase
    ? {
        label: phase.label,
        description: phase.description,
        pct: getPhaseProgress(phase).pct,
        index: state.phases.findIndex((p) => p.id === phase.id) + 1,
        totalPhases: state.phases.length,
      }
    : null;

  const modules: ModuleView[] = state.phases.map((p) => ({
    id: p.id,
    label: p.label,
    shortLabel: p.shortLabel,
    description: p.description,
    pct: getPhaseProgress(p).pct,
    isCurrent: phase ? p.id === phase.id : false,
  }));

  return {
    week: { current: weekNumber, total: totalWeeks },
    currentModule,
    today: todayView,
    modules,
    overallPct: overall.pct,
  };
}

export default function StudyPage() {
  const [view, setView] = useState<StudyView | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let active = true;
    getStudyPlanState()
      .then((state) => {
        if (!active) return;
        setView(buildView(state));
      })
      .catch(() => {
        if (!active) return;
        setErrored(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Subtitle is derived from the plan; pieces that can't be derived are omitted.
  const subtitleParts: string[] = [];
  if (view?.week.current && view.week.total) {
    subtitleParts.push(`Settimana ${view.week.current} di ${view.week.total}`);
  }
  subtitleParts.push('esame 31 luglio');
  subtitleParts.push('Hack The Box');
  const subtitle = subtitleParts.join(' · ');

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>Certificazioni · HTB</div>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>Percorso <span style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>CPTS</span></h1>
        <p style={{ margin: '11px 0 0', fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>{subtitle}</p>
      </header>

      {errored && (
        <div className="sd-reveal" style={{ ['--i' as string]: 1, background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', borderRadius: 16, padding: '20px 24px', color: 'rgb(var(--color-tertiary))', fontSize: 14 }}>
          Impossibile caricare il piano di studio. Riprova più tardi.
        </div>
      )}

      {!errored && (
        <>
          {/* Modulo corrente + Task di studio di oggi */}
          <div className="sd-twocol" style={{ marginBottom: 18 }}>
            {/* Modulo corrente (REAL: phase containing today + its progress) */}
            <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, background: 'rgb(99 102 241)', borderRadius: 18, padding: '26px 28px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              {view?.currentModule ? (
                <>
                  <div>
                    <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .8, fontWeight: 600, marginBottom: 12 }}>Modulo corrente</div>
                    <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1 }}>{view.currentModule.label}</div>
                    <p style={{ margin: '10px 0 0', fontSize: 13, opacity: .85, lineHeight: 1.5, maxWidth: 360 }}>{view.currentModule.description}</p>
                  </div>
                  <div style={{ marginTop: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontFamily: mono, marginBottom: 8 }}>
                      <span style={{ opacity: .85, whiteSpace: 'nowrap' }}>Modulo {view.currentModule.index} di {view.currentModule.totalPhases}</span>
                      <span>{view.currentModule.pct}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 8, background: 'rgb(255 255 255 / 0.22)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${view.currentModule.pct}%`, background: '#fff', borderRadius: 8, transition: 'width .4s ease' }} /></div>
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .8, fontWeight: 600, marginBottom: 12 }}>Modulo corrente</div>
                  <div style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.3, opacity: .9 }}>Oggi non rientra in nessun modulo del percorso.</div>
                </div>
              )}
            </div>

            {/* Task di studio di oggi (REAL) */}
            <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 2, background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', borderRadius: 16, boxShadow: '0 1px 2px rgba(17,17,26,.04)', padding: '22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Task di studio di oggi</h3>
                {view?.today && !view.today.isRest && view.today.total > 0 && (
                  <span style={{ fontFamily: mono, fontSize: 12, color: 'rgb(16 185 129)' }}>{view.today.done} / {view.today.total}</span>
                )}
              </div>
              {view && view.today && !view.today.isRest && view.today.total > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {view.today.tasks.map((t) => (
                    <Checkbox key={t.id} label={t.label} defaultChecked={t.completed} />
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: 'rgb(var(--color-tertiary))', lineHeight: 1.5 }}>
                  {view?.today?.isRest
                    ? 'Oggi è riposo.'
                    : 'Nessun task per oggi.'}
                </p>
              )}
            </div>
          </div>

          {/* Moduli del percorso (REAL: phases + per-phase progress) */}
          <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 3, background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', borderRadius: 16, boxShadow: '0 1px 2px rgba(17,17,26,.04)', padding: '24px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Moduli del percorso</h3>
              {view && <span style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{view.overallPct}% totale</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(view?.modules ?? []).map((m, idx) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderTop: idx === 0 ? 'none' : '1px solid rgb(var(--color-border))' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{m.label}</span>
                      {m.isCurrent && <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgb(99 102 241)', background: 'rgb(99 102 241 / 0.1)', padding: '2px 7px', borderRadius: 6 }}>in corso</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.shortLabel}</div>
                  </div>
                  <div style={{ width: 120, flex: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 6, background: 'rgb(var(--color-border))', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${m.pct}%`, background: m.isCurrent ? 'rgb(99 102 241)' : 'rgb(16 185 129)', borderRadius: 6, transition: 'width .4s ease' }} />
                    </div>
                    <span style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-body))', width: 34, textAlign: 'right' }}>{m.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
