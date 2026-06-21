'use client';

import React, { useEffect, useState } from 'react';
import { StatBlock } from '@/components/ui/Surface';
import { Stepper } from '@/components/ui/ProgressBar';
import { Checkbox } from '@/components/ui/Toggle';
import { StatusBadge } from '@/components/ui/Badge';
import { getStudyOverview, type StudyTodayTask } from '@/services/studyService';

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

const cptsSteps = [
  { id: 'recon', label: 'Information Gathering', completed: true },
  { id: 'enum', label: 'Enumeration & Footprinting', completed: true },
  { id: 'expl', label: 'Exploitation & Shells', completed: true },
  { id: 'ad', label: 'Active Directory', completed: false },
  { id: 'post', label: 'Post-Exploitation & Pivoting', completed: false },
  { id: 'report', label: 'Documentation & Reporting', completed: false },
];

// FALLBACK — verbatim static design content. The page renders this exactly
// until/unless the authenticated study plan provides meaningful data to map.
interface TodayTaskView { id: string; label: string; completed: boolean; }
const FALLBACK_TODAY_TASKS: TodayTaskView[] = [
  { id: 'fb-0', label: 'Enumerazione AD con BloodHound', completed: true },
  { id: 'fb-1', label: 'Kerberoasting · estrazione TGS', completed: true },
  { id: 'fb-2', label: 'Lateral movement · Pass-the-Hash', completed: false },
  { id: 'fb-3', label: 'DCSync · dump degli hash', completed: false },
  { id: 'fb-4', label: 'Aggiorna writeup nel vault Obsidian', completed: false },
];
const FALLBACK_TODAY_DONE = 2;
const FALLBACK_TODAY_TOTAL = 5;

export default function StudyPage() {
  const [todayTasks, setTodayTasks] = useState<TodayTaskView[]>(FALLBACK_TODAY_TASKS);
  const [todayDone, setTodayDone] = useState<number>(FALLBACK_TODAY_DONE);
  const [todayTotal, setTodayTotal] = useState<number>(FALLBACK_TODAY_TOTAL);

  useEffect(() => {
    let active = true;
    getStudyOverview()
      .then((overview) => {
        if (!active) return;
        const today = overview.today;
        // Only override the today card when the plan provides a real, non-rest
        // day with tasks — otherwise keep the approved static design intact.
        if (today && !today.isRest && today.tasks.length > 0) {
          setTodayTasks(
            today.tasks.map((t: StudyTodayTask) => ({
              id: t.id,
              label: t.text,
              completed: t.completed,
            }))
          );
          setTodayDone(today.done);
          setTodayTotal(today.total);
        }
      })
      .catch(() => {
        // keep FALLBACK so the screen is never blank
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>Certificazioni · HTB</div>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>Percorso <span style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>CPTS</span></h1>
        <p style={{ margin: '11px 0 0', fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>Settimana 8 di 12 · esame 31 luglio · Hack The Box</p>
      </header>

      {/* Modulo corrente + Hack The Box */}
      <div className="sd-twocol" style={{ marginBottom: 18 }}>
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, background: 'rgb(99 102 241)', borderRadius: 18, padding: '26px 28px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .8, fontWeight: 600, marginBottom: 12 }}>Modulo corrente</div>
            <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1 }}>Active Directory</div>
            <p style={{ margin: '10px 0 0', fontSize: 13, opacity: .85, lineHeight: 1.5, maxWidth: 340 }}>Enumerazione, Kerberoasting e lateral movement. È il modulo che pesa di più all&apos;esame.</p>
          </div>
          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontFamily: mono, marginBottom: 8 }}><span style={{ opacity: .85, whiteSpace: 'nowrap' }}>Modulo 4 di 6</span><span>67%</span></div>
            <div style={{ height: 8, borderRadius: 8, background: 'rgb(255 255 255 / 0.22)', overflow: 'hidden' }}><div style={{ height: '100%', width: '67%', background: '#fff', borderRadius: 8 }} /></div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <span style={{ background: 'rgb(255 255 255 / 0.18)', padding: '6px 12px', borderRadius: 9, fontFamily: mono, fontSize: 12, whiteSpace: 'nowrap' }}>Esame · 31 lug · 40 gg</span>
            </div>
          </div>
        </div>

        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 2, background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', borderRadius: 18, boxShadow: '0 1px 2px rgba(17,17,26,.04)', padding: '24px 26px' }}>
          <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600, marginBottom: 18 }}>Hack The Box</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px 16px' }}>
            <StatBlock label="BOX RISOLTI" value="34" mono />
            <StatBlock label="STREAK" value="12" unit="gg" mono />
            <StatBlock label="ORE LAB" value="96" unit="h" mono />
            <StatBlock label="RANK" value="Hacker" />
          </div>
        </div>
      </div>

      {/* Moduli del percorso */}
      <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 3, background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', borderRadius: 16, boxShadow: '0 1px 2px rgba(17,17,26,.04)', padding: '24px 26px', marginBottom: 18 }}>
        <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Moduli del percorso</h3>
        <Stepper steps={cptsSteps} currentStep={3} orientation="vertical" />
      </div>

      {/* Task di studio + Laboratori */}
      <div className="sd-twocol">
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 4, background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', borderRadius: 16, boxShadow: '0 1px 2px rgba(17,17,26,.04)', padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Task di studio di oggi</h3>
            <span style={{ fontFamily: mono, fontSize: 12, color: 'rgb(16 185 129)' }}>{todayDone} / {todayTotal}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {todayTasks.map((t) => (
              <Checkbox key={t.id} label={t.label} defaultChecked={t.completed} />
            ))}
          </div>
        </div>

        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 5, background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', borderRadius: 16, boxShadow: '0 1px 2px rgba(17,17,26,.04)', padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Laboratori</h3>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: '1px solid rgb(var(--color-border))' }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>Forest</div><div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>Active Directory · easy</div></div>
              <StatusBadge status="active" style={{ flex: 'none', width: 'max-content' }}>In esecuzione</StatusBadge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: '1px solid rgb(var(--color-border))' }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>Cascade</div><div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>LDAP · recupero credenziali</div></div>
              <StatusBadge status="pending" style={{ flex: 'none', width: 'max-content' }}>In coda</StatusBadge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0 4px', borderTop: '1px solid rgb(var(--color-border))' }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>Sauna</div><div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>AS-REP Roasting</div></div>
              <StatusBadge status="completed" style={{ flex: 'none', width: 'max-content' }}>Completato</StatusBadge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
