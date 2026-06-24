'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ── Study Desk shell ──────────────────────────────────────────────────────
   Dark-glass dashboard frame aligned to the Login: ambient 3D gyroscope +
   glows behind glass cards, sticky sidebar + main, staggered play-in on route
   change, low-stim toggle (kills motion + desaturates), and a Scuro/Chiaro
   theme switch (persisted in localStorage 'sd-theme', dark by default).
   Requires the dark-glass CSS block appended to globals.css — see
   handoff/globals-additions.css. */

type NavItem = { label: string; href: string; dot: string };

const NAV: NavItem[] = [
  { label: 'Home', href: '/dashboard', dot: 'rgb(99 102 241)' },
  { label: 'Università', href: '/dashboard/universita', dot: 'rgb(99 102 241)' },
  { label: 'Studio', href: '/dashboard/study', dot: 'rgb(99 102 241)' },
  { label: 'Calendario', href: '/dashboard/calendar', dot: 'rgb(99 102 241)' },
  { label: 'Finanze', href: '/dashboard/budget', dot: 'rgb(16 185 129)' },
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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  // 'idle' = no anim classes (content visible — the safe default, also SSR).
  // 'in' = hidden, 'lit' = revealing. JS drives in→lit→idle so content is
  // never stuck invisible if JS is slow or fails.
  const [phase, setPhase] = useState<'idle' | 'in' | 'lit'>('idle');

  // Restore preferences.
  useEffect(() => {
    setLowStim(localStorage.getItem('sd-lowstim') === '1');
    const t = localStorage.getItem('sd-theme');
    if (t === 'light' || t === 'dark') setTheme(t);
  }, []);
  useEffect(() => { localStorage.setItem('sd-lowstim', lowStim ? '1' : '0'); }, [lowStim]);
  useEffect(() => { localStorage.setItem('sd-theme', theme); }, [theme]);

  // Apply theme/low-stim changes made elsewhere (Impostazioni → Aspetto) live.
  useEffect(() => {
    const sync = () => {
      try {
        const t = localStorage.getItem('sd-theme');
        if (t === 'light' || t === 'dark') setTheme(t);
        setLowStim(localStorage.getItem('sd-lowstim') === '1');
      } catch { /* ignore */ }
    };
    window.addEventListener('sd-prefs', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('sd-prefs', sync); window.removeEventListener('storage', sync); };
  }, []);

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
      data-theme={theme}
      data-stim={lowStim ? 'on' : 'off'}
      style={{ minHeight: '100vh', color: 'rgb(var(--color-body))' }}
    >
      {/* ── ambient background: grid + glows + 3D gyroscope (the Login signature) ── */}
      <div className="sd-bgfx" aria-hidden="true">
        <div className="sd-bggrid" />
        <div className="sd-bgglow a" />
        <div className="sd-bgglow b" />
        <div className="sd-gyro-wrap">
          <div className="sd-gyro">
            <div className="sd-gring r2" />
            <div className="sd-gring r3" />
            <div className="sd-gring r4" />
            <div className="sd-gring r5" />
            <div className="sd-gdot" />
            <div className="sd-gdot d2" />
          </div>
        </div>
        <div className="sd-bgvig" />
      </div>

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
                <span className="sd-markglow" style={{ width: 30, height: 30, borderRadius: 9, background: 'rgb(99 102 241)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontSize: 17, fontWeight: 600, flex: 'none' }}>S</span>
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
            {/* Theme switch — Scuro / Chiaro */}
            <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, border: '1px solid rgb(var(--color-border))', background: 'rgb(var(--color-card-inner))', marginBottom: 14 }}>
              <button
                className="sd-press"
                onClick={() => setTheme('dark')}
                style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '8px 6px', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'rgb(var(--color-heading))' }}
              >
                {theme === 'dark' && <span style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'rgb(var(--lg-accent)/0.16)', border: '1px solid rgb(var(--lg-accent)/0.4)' }} />}
                <span style={{ position: 'relative', width: 9, height: 9, borderRadius: '50%', background: 'rgb(var(--lg-accent))', boxShadow: '0 0 8px rgb(var(--lg-accent)/0.8)' }} />
                <span style={{ position: 'relative' }}>Scuro</span>
              </button>
              <button
                className="sd-press"
                onClick={() => setTheme('light')}
                style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '8px 6px', background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'rgb(var(--color-heading))' }}
              >
                {theme === 'light' && <span style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'rgb(245 158 11/0.16)', border: '1px solid rgb(245 158 11/0.42)' }} />}
                <span style={{ position: 'relative', width: 9, height: 9, borderRadius: '50%', background: 'rgb(245 158 11)', boxShadow: '0 0 8px rgb(245 158 11/0.7)' }} />
                <span style={{ position: 'relative' }}>Chiaro</span>
              </button>
            </div>

            <button
              className="sd-press"
              onClick={() => setLowStim((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', background: 'transparent', border: 'none', padding: '8px 6px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
            >
              <span className="sd-toggle-track" style={{ position: 'relative', width: 38, height: 22, borderRadius: 20, flex: 'none', transition: 'background .2s ease', background: lowStim ? 'rgb(16 185 129)' : undefined }}>
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
