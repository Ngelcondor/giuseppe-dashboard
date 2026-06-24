'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  BookOpen,
  Heart,
  Activity,
  Settings,
  Menu,
  X,
  Calendar,
  AlertTriangle,
  Flame,
  TrendingUp,
  Brain,
  Shield,
  Rss,
  Wallet,
  Utensils,
  Zap,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DockItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const PRIMARY_DOCK: DockItem[] = [
  { label: 'Home',     href: '/dashboard',           icon: Home },
  { label: 'Studio',   href: '/dashboard/study',     icon: BookOpen },
  { label: 'Salute',   href: '/dashboard/health',    icon: Heart },
  { label: 'Routine',  href: '/dashboard/routines',  icon: Activity },
  { label: 'Tutto',    href: '#more',                icon: Menu },
];

const ALL_SECTIONS: DockItem[] = [
  { label: 'Home',         href: '/dashboard',           icon: Home },
  { label: 'Studio',       href: '/dashboard/study',     icon: BookOpen },
  { label: 'Salute',       href: '/dashboard/health',    icon: Heart },
  { label: 'Focus',        href: '/dashboard/focus',     icon: Brain },
  { label: 'Routine',      href: '/dashboard/routines',  icon: Activity },
  { label: 'Abitudini',    href: '/dashboard/habits',    icon: Flame },
  { label: 'Umore',        href: '/dashboard/mood',      icon: TrendingUp },
  { label: 'Scadenze',     href: '/dashboard/deadlines', icon: AlertTriangle },
  { label: 'Calendario',   href: '/dashboard/calendar',  icon: Calendar },
  { label: 'CTF',          href: '/dashboard/ctf',       icon: Shield },
  { label: 'Cyber Feed',   href: '/dashboard/feed',      icon: Rss },
  { label: 'Finanze',      href: '/dashboard/budget',    icon: Wallet },
  { label: 'Pasti',        href: '/dashboard/meals',     icon: Utensils },
  { label: 'Sensoriale',   href: '/dashboard/sensory',   icon: Zap },
  { label: 'Impostazioni', href: '/dashboard/settings',  icon: Settings },
];

/**
 * Floating bottom dock — primary navigation.
 * 4 main destinations + a "more" trigger that opens the full drawer.
 */
export function BottomDock() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <nav className="dock" aria-label="Navigazione principale">
        {PRIMARY_DOCK.map((item) => {
          if (item.href === '#more') {
            return (
              <button
                key={item.label}
                onClick={() => setDrawerOpen(true)}
                className="dock-item"
                aria-label="Tutte le sezioni"
                title="Tutte le sezioni"
              >
                <item.icon size={20} strokeWidth={2.2} />
              </button>
            );
          }
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn('dock-item', active && 'dock-item-active')}
              aria-label={item.label}
              title={item.label}
            >
              <item.icon size={20} strokeWidth={2.2} />
            </Link>
          );
        })}
      </nav>

      {drawerOpen && <DrawerOverlay onClose={() => setDrawerOpen(false)} />}
    </>
  );
}

/**
 * Full-screen drawer with all sections.
 * Triggered from the dock's "more" button.
 */
function DrawerOverlay({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-2xl bg-card-solid border-t sm:border border-border-default sm:rounded-3xl p-6 sm:p-8 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="eyebrow mb-1">Tutte le sezioni</p>
            <h2 className="text-xl font-semibold text-heading">Vai a…</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-card-inner text-tertiary hover:text-heading transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {ALL_SECTIONS.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-150',
                  active
                    ? 'bg-accent-soft border-accent-soft text-accent'
                    : 'bg-card-inner border-border-default text-body hover:border-border-hover hover:bg-surface-hover'
                )}
              >
                <item.icon size={20} strokeWidth={1.8} />
                <span className="text-[12px] font-medium text-center leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Slim top bar — used on every page.
 * Just a logo, optional title slot, and a profile/settings link.
 */
export function TopBar({
  title,
  subtitle,
  back,
  actions,
}: {
  title?: string;
  subtitle?: string;
  back?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 bg-page/80 backdrop-blur-md border-b border-border-default">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3.5 flex items-center gap-4">
        {back ? (
          <Link
            href={back}
            className="flex items-center justify-center w-9 h-9 rounded-full text-tertiary hover:text-heading hover:bg-surface-hover transition-colors"
            aria-label="Indietro"
          >
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : (
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <span className="text-[15px] font-semibold text-heading">giuseppe</span>
            <span className="text-[15px] text-tertiary">.dashboard</span>
          </Link>
        )}
        {title && (
          <div className="flex-1 min-w-0">
            {subtitle && <p className="eyebrow leading-none mb-1">{subtitle}</p>}
            <p className="text-[15px] font-semibold text-heading truncate">{title}</p>
          </div>
        )}
        {!title && <div className="flex-1" />}
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {!actions && (
            <Link
              href="/dashboard/settings"
              className="flex items-center justify-center w-9 h-9 rounded-full text-tertiary hover:text-heading hover:bg-surface-hover transition-colors"
              aria-label="Impostazioni"
            >
              <Settings size={15} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Full app shell — wraps any page with topbar + dock + content area.
 * Use this for both the main dashboard and sub-pages.
 */
interface AppShellProps {
  title?: string;
  subtitle?: string;
  back?: string;
  actions?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Hide the top bar (e.g. for the main dashboard which has a hero header instead) */
  hideTopBar?: boolean;
  /** Hide the bottom dock (e.g. for full-screen modes like pomodoro) */
  hideDock?: boolean;
  children: React.ReactNode;
}

const WIDTHS: Record<NonNullable<AppShellProps['width']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-none',
};

export function AppShell({
  title,
  subtitle,
  back,
  actions,
  width = 'lg',
  hideTopBar = false,
  hideDock = false,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-page text-heading">
      {!hideTopBar && <TopBar title={title} subtitle={subtitle} back={back} actions={actions} />}
      <main className={cn('mx-auto px-5 sm:px-8 py-6 sm:py-8 pb-32', WIDTHS[width])}>
        {children}
      </main>
      {!hideDock && <BottomDock />}
    </div>
  );
}
