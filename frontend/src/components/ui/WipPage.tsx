'use client';

import React from 'react';
import { Construction } from 'lucide-react';

/* ── WIP page shell ────────────────────────────────────────────────────────
   Pagina "in lavorazione": header editoriale allineato alle altre pagine
   Study Desk + pannello WORK IN PROGRESS onesto. Nessun dato finto: elenca
   cosa arriverà, non simula contenuto. */

const mono = "'JetBrains Mono',monospace";

export function WipPage({
  eyebrow,
  title,
  titleAccent,
  description,
  planned,
}: {
  eyebrow: string;
  title: string;
  titleAccent: string;
  description: string;
  planned: string[];
}) {
  return (
    <div>
      <header className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>{eyebrow}</div>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>
          {title}<span style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>{titleAccent}</span>
        </h1>
        <p style={{ margin: '11px 0 0', fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>{description}</p>
      </header>

      <div
        className="sd-reveal"
        style={{
          ['--i' as string]: 1,
          border: '1.5px dashed rgb(245 158 11 / 0.5)',
          borderRadius: 16,
          background: 'rgb(245 158 11 / 0.05)',
          padding: '30px 28px',
          maxWidth: 620,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <span style={{ width: 42, height: 42, borderRadius: 12, background: 'rgb(245 158 11 / 0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <Construction size={21} color="rgb(245 158 11)" />
          </span>
          <div>
            <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: '.18em', color: 'rgb(245 158 11)' }}>WORK IN PROGRESS</div>
            <div style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))', marginTop: 2 }}>Questa sezione è in costruzione — niente dati finti nel frattempo.</div>
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', margin: '18px 0 10px' }}>In arrivo</div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {planned.map((p) => (
            <li key={p} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 14, color: 'rgb(var(--color-body))' }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: 'rgb(245 158 11)', flex: 'none', transform: 'translateY(-2px)' }} />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
