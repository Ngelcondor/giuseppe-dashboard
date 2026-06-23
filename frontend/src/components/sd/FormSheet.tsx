'use client';

import React, { useEffect } from 'react';

/* Apple-style modal sheet + labelled form fields, built on the Study Desk
   design tokens. Reusable across CRUD screens (Università, Budget, …). */

export function Sheet({
  open, onClose, title, subtitle, children, footer, maxWidth = 460,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sd-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 90, padding: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(17,17,26,0.32)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="sd-sheet"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: 'rgb(var(--color-card))',
          borderRadius: 22, border: '1px solid rgb(var(--color-border))',
          boxShadow: '0 24px 64px rgba(17,17,26,.22), 0 2px 8px rgba(17,17,26,.08)',
        }}
      >
        <div style={{ padding: '22px 24px 0', flex: 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-.01em', color: 'rgb(var(--color-heading))' }}>{title}</h2>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgb(var(--color-tertiary))' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Chiudi" type="button" className="sd-iconbtn sd-press" style={{ flex: 'none', marginTop: -2 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ padding: '18px 24px 8px', flex: '1 1 auto', overflowY: 'auto', minHeight: 0 }}>{children}</div>
        {footer && <div style={{ padding: '12px 24px 18px', flex: 'none', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid rgb(var(--color-border))' }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'rgb(var(--color-tertiary))', marginBottom: 6 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 11.5, color: 'rgb(var(--color-muted))', marginTop: 5 }}>{hint}</span>}
    </label>
  );
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
}
