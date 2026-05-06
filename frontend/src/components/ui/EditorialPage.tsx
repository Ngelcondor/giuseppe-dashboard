'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BottomDock } from './AppShell';
import { cn } from '@/lib/utils';

interface EditorialPageProps {
  /** Small uppercase mono label above the title (e.g. "MISSION CPTS") */
  eyebrow?: string;
  /** The page title — rendered as a big editorial display */
  title: string;
  /** Optional accent (italic-serif fragment) appended to the title */
  titleAccent?: string;
  /** Optional muted subtitle/description below */
  description?: React.ReactNode;
  /** Optional actions (chips/buttons) shown right of the title */
  actions?: React.ReactNode;
  /** Where the back button goes; default to dashboard root */
  back?: string;
  /** Container width */
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Hide the bottom dock (e.g. for fullscreen pomodoro mode) */
  hideDock?: boolean;
  children: React.ReactNode;
}

const WIDTH: Record<NonNullable<EditorialPageProps['width']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-none',
};

/**
 * Standard chrome for every sub-page.
 *
 * Layout:
 *   [Brand bar]                                         [Settings]
 *   [Back] · [Eyebrow]
 *   <Editorial display title>          <Actions>
 *   <Description>
 *
 *   <Children>
 *
 *   [Bottom dock]
 *
 * Typography mirrors the main dashboard hero — Inter Tight extrabold for
 * the main title, Fraunces italic for the optional accent fragment.
 */
export function EditorialPage({
  eyebrow,
  title,
  titleAccent,
  description,
  actions,
  back = '/dashboard',
  width = 'lg',
  hideDock = false,
  children,
}: EditorialPageProps) {
  return (
    <div className="min-h-screen bg-page text-heading">
      {/* Slim brand bar (matches dashboard) */}
      <header className="px-5 sm:px-10 py-4 flex items-center justify-between border-b border-border-default">
        <Link href="/dashboard" className="font-serif italic text-[15px] text-heading">
          giuseppe<span className="text-accent">.</span>dashboard
        </Link>
        <Link
          href="/dashboard/settings"
          className="text-[13px] text-tertiary hover:text-heading transition-colors"
        >
          impostazioni
        </Link>
      </header>

      <div className={cn('mx-auto px-5 sm:px-10 pb-32', WIDTH[width])}>
        {/* Editorial hero block */}
        <header className="pt-10 pb-8 sm:pt-16 sm:pb-12">
          <div className="flex items-center gap-4 mb-5">
            <Link
              href={back}
              className="flex items-center justify-center w-9 h-9 rounded-full text-tertiary hover:text-heading hover:bg-surface-hover transition-colors"
              aria-label="Indietro"
            >
              <ArrowLeft size={15} />
            </Link>
            {eyebrow && (
              <p className="font-mono-display text-[11px] tracking-[0.18em] uppercase text-tertiary">
                {eyebrow}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="font-display font-extrabold text-[clamp(2rem,5vw,3.75rem)] leading-[0.98] tracking-[-0.035em] text-heading max-w-3xl">
              {title}
              {titleAccent && (
                <>
                  {' '}
                  <span className="font-serif italic font-medium text-accent">{titleAccent}</span>
                </>
              )}
              <span className="text-accent">.</span>
            </h1>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>

          {description && (
            <div className="mt-5 max-w-2xl text-[15px] sm:text-[17px] leading-relaxed text-tertiary">
              {description}
            </div>
          )}
        </header>

        {children}
      </div>

      {!hideDock && <BottomDock />}
    </div>
  );
}
