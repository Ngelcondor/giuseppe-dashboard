'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageShellProps {
  title: string;
  icon?: LucideIcon;
  iconColor?: string;
  back?: string;
  actions?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  /** Optional uppercase eyebrow above the title */
  eyebrow?: string;
}

const WIDTHS: Record<NonNullable<PageShellProps['width']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

/**
 * Standard page chrome: header with back-button, optional icon, title, actions.
 * Use this for all sub-pages so the layout stays consistent.
 */
export function PageShell({
  title,
  icon: Icon,
  iconColor = 'text-accent',
  back = '/dashboard',
  actions,
  width = 'md',
  children,
  eyebrow,
}: PageShellProps) {
  return (
    <div className="min-h-screen bg-page text-heading">
      <header className="sticky top-0 z-30 px-6 py-4 border-b border-border-default bg-page/85 backdrop-blur-md">
        <div className={cn('mx-auto flex items-center justify-between gap-4', WIDTHS[width])}>
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={back}
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-border-default text-tertiary hover:text-heading hover:border-border-hover transition-colors"
              aria-label="Indietro"
            >
              <ArrowLeft size={15} />
            </Link>
            <div className="flex items-center gap-2.5 min-w-0">
              {Icon && <Icon size={16} className={cn('shrink-0', iconColor)} />}
              <div className="min-w-0">
                {eyebrow && (
                  <p className="section-label leading-none mb-0.5">{eyebrow}</p>
                )}
                <h1 className="text-[15px] font-semibold tracking-tight truncate">{title}</h1>
              </div>
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </header>

      <main className={cn('mx-auto px-6 py-8', WIDTHS[width])}>{children}</main>
    </div>
  );
}
