'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { AppShell } from './AppShell';

interface PageShellProps {
  title: string;
  icon?: LucideIcon;
  iconColor?: string;
  back?: string;
  actions?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  eyebrow?: string;
}

const WIDTH_MAP = {
  sm: 'sm' as const,
  md: 'lg' as const,
  lg: 'xl' as const,
  xl: 'xl' as const,
};

/**
 * Backward-compat wrapper around AppShell for existing pages.
 * The icon and iconColor props are no longer rendered visually
 * (the new design uses an editorial title hierarchy instead),
 * but the props are kept so existing call-sites still work.
 */
export function PageShell({
  title,
  back,
  actions,
  width = 'md',
  children,
  eyebrow,
}: PageShellProps) {
  return (
    <AppShell
      title={title}
      subtitle={eyebrow}
      back={back || '/dashboard'}
      actions={actions}
      width={WIDTH_MAP[width]}
    >
      {children}
    </AppShell>
  );
}
