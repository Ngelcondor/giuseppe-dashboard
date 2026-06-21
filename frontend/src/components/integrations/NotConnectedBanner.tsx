'use client';

import React from 'react';
import Link from 'next/link';
import { PlugZap } from 'lucide-react';

// Light, honest "non connesso" banner for integration surfaces (Calendario,
// Budget, …). Renders nothing when `connected` is true, so callers can drop it
// at the top of a header unconditionally. Uses existing CSS color tokens — no
// additions to globals.css.

interface NotConnectedBannerProps {
  connected: boolean;
  /** Italian copy explaining what is not connected. */
  message: string;
  /** Optional link to the relevant Impostazioni section. */
  settingsHref?: string;
  /** Optional CTA label (defaults to "Apri Impostazioni"). */
  actionLabel?: string;
}

export function NotConnectedBanner({
  connected,
  message,
  settingsHref = '/dashboard/impostazioni',
  actionLabel = 'Apri Impostazioni',
}: NotConnectedBannerProps) {
  if (connected) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 12,
        background: 'rgb(var(--color-card-inner))',
        border: '1px solid rgb(var(--color-border))',
        fontSize: 13,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 8,
          color: 'rgb(245 158 11)',
          background: 'rgba(245, 158, 11, 0.12)',
          flexShrink: 0,
        }}
        aria-hidden
      >
        <PlugZap size={15} />
      </span>
      <span style={{ color: 'rgb(var(--text-tertiary))', lineHeight: 1.4, flex: 1 }}>
        {message}
      </span>
      {settingsHref && (
        <Link
          href={settingsHref}
          style={{
            color: 'rgb(245 158 11)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            textDecoration: 'none',
          }}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export default NotConnectedBanner;
