'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ── Study Desk shell ──────────────────────────────────────────────────────
   Light, calm dashboard frame: sticky sidebar + main, staggered play-in
   animation on route change, low-stim toggle (kills motion + desaturates). */

type NavItem = { label: string; href: string; dot: string };

const NAV: NavItem[] = [
  { label: 'Home', href: '/dashboard', dot: 'rgb(99 102 241)' },
  { label: 'Università', href: '/dashboard/universita', dot: 'rgb(99 102 241)' },
  { label: 'Studio', href: '/dashboard/study', dot: 'rgb(99 102 241)' },
  { label: 'Scadenze', href: '/dashboard/deadlines', dot: 'rgb(245 158 11)' },
  { label: 'Calendario', href: '/dashboard/calendar', dot: 'rgb(99 102 241)' },
  { label: 'Budget', href: '/dashboard/budget', dot: 'rgb(16 185 129)' },
  { label: 'Smart Home', href: '/dashboard/smart-home', dot: 'rgb(245 158 11)' },
  { label: 'Impostazioni', href: '/dashboard/impostazioni', dot: 'rgb(100 116 139)' },
];

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/dashboard';
  const [lowStim, setLowStim] = useState(false);
  // 'idle' = no anim classes (content visible — the safe default, also SSR).
  // 'in' = hidden, 'lit' = revealing. JS drives in→lit→idle so content is
  // never stuck invisible if JS is slow or fails.
  const [phase, setPhase] = useState<'idle' | 'in' | 'lit'>('idle');

  // Restore low-stim preference.
  useEffect(() => {
    setLowStim(localStorage.getItem('sd-lowstim') === '1');
  }, []);
  useEffect(() => {
    localStorage.setItem('sd-lowstim', lowStim ? '1' : '0');
  }, [lowStim]);

  // Play-in entrance: re-trigger on each route change. in → lit → idle.
  useEffect(() => {
    setPhase('in');
    const r1 = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('lit')));
    const t1 = setTimeout(() => setPhase('lit'), 160);
    const t2 = setTimeout(() => setPhase('idle'), 1300);
    return () => { cancelAnimationFrame(r1); clearTimeout(t1); clearTimeout(t2); };
  }, [pathname]);

  const animClass = phase === 'in' ? ' sd-anim' : phase === 'lit' ? ' sd-anim sd-lit' : '';

  return (
    <div
      className={`sd-root${animClass}`}
      data-theme="light"
      data-stim={lowStim ? 'on' : 'off'}
      style={{ background: '#FAFAFC', minHeight: '100vh', color: 'rgb(var(--color-body))' }}
    >
      <div className="sd-shell">

        {/* ── Sidebar ── */}
        <aside
          className="sd-side"
          style={{
            background: 'rgb(var(--color-card))',
            borderRight: '1px solid rgb(var(--color-border))',
            padding: '26px 18px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="sd-sideflow">
            <div style={{ padding: '0 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgb(99 102 241)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontSize: 17, fontWeight: 600, flex: 'none' }}>S</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'rgb(var(--color-heading))', letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>Study Desk</div>
                  <div style={{ fontSize: 11, color: 'rgb(var(--color-tertiary))', whiteSpace: 'nowrap' }}>Giuseppe · UOC</div>
                </div>
              </div>
            </div>

            <nav className="sd-nav" style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 26 }}>
              {NAV.map((item) => {
                const on = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="sd-nav-item sd-press"
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '11px 13px', borderRadius: 11, cursor: 'pointer', color: 'rgb(var(--color-heading))', fontSize: 14.5, fontWeight: 500, textDecoration: 'none' }}
                  >
                    {on && <span style={{ position: 'absolute', inset: 0, borderRadius: 11, background: 'rgb(99 102 241 / 0.09)' }} />}
                    {on && <span style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 3, background: 'rgb(99 102 241)' }} />}
                    <span style={{ position: 'relative', width: 7, height: 7, borderRadius: 2, background: item.dot }} />
                    <span style={{ position: 'relative' }}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="sd-sidefoot" style={{ marginTop: 'auto', paddingTop: 18, borderTop: '1px solid rgb(var(--color-border))' }}>
            <button
              className="sd-press"
              onClick={() => setLowStim((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', background: 'transparent', border: 'none', padding: '8px 6px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
            >
              <span style={{ position: 'relative', width: 38, height: 22, borderRadius: 20, flex: 'none', background: lowStim ? 'rgb(16 185 129)' : 'rgb(0 0 0 / 0.14)', transition: 'background .2s ease' }}>
                <span style={{ position: 'absolute', top: 2, left: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transform: lowStim ? 'translateX(16px)' : 'translateX(0px)', transition: 'transform .2s ease' }} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap' }}>Modalità low-stim</span>
                <span style={{ display: 'block', fontSize: 11, color: 'rgb(var(--color-tertiary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lowStim ? 'Attiva · niente movimento' : 'Calma · zero distrazioni'}</span>
              </span>
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <main style={{ padding: '38px 44px 64px' }}>
          <div className="sd-main-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
