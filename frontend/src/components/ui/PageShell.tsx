'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { EditorialPage } from './EditorialPage';

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
 * Backward-compat wrapper. All pages migrated through PageShell get the
 * editorial chrome automatically. Icon prop is intentionally unused now —
 * the new design relies on typography hierarchy, not iconography.
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
    <EditorialPage
      title={title}
      eyebrow={eyebrow}
      back={back || '/dashboard'}
      actions={actions}
      width={WIDTH_MAP[width]}
    >
      {children}
    </EditorialPage>
  );
}
