'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Surface (refined card) ─────────────────────────────────────────────── */

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'accent' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING: Record<NonNullable<SurfaceProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
};

export function Surface({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: SurfaceProps) {
  const base = 'rounded-2xl';
  const variants: Record<string, string> = {
    default: 'card-glass',
    accent: 'card-accent',
    flat: 'bg-card-inner border border-border-default',
  };
  return (
    <div className={cn(base, variants[variant], PADDING[padding], className)} {...props}>
      {children}
    </div>
  );
}

/* ─── Section header ─────────────────────────────────────────────────────── */

interface SectionHeaderProps {
  icon?: LucideIcon;
  iconColor?: string;
  label: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ icon: Icon, iconColor = 'text-tertiary', label, hint, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon size={14} className={cn('shrink-0', iconColor)} />}
        <span className="section-label">{label}</span>
        {hint && <span className="text-[11px] text-muted">· {hint}</span>}
      </div>
      {action}
    </div>
  );
}

/* ─── Stat block ─────────────────────────────────────────────────────────── */

interface StatBlockProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  color?: string;
  mono?: boolean;
}

export function StatBlock({ label, value, unit, color, mono = true }: StatBlockProps) {
  return (
    <div>
      <p className="text-[11px] text-muted mb-1.5 tracking-uppercase">{label}</p>
      <p
        className={cn('text-2xl font-semibold leading-none', mono && 'font-mono-display')}
        style={color ? { color } : undefined}
      >
        {value}
        {unit && <span className="text-base text-tertiary font-normal ml-1">{unit}</span>}
      </p>
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────── */

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={cn('text-center', compact ? 'py-8' : 'py-14')}>
      {Icon && (
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-card-inner border border-border-default text-tertiary mb-4">
          <Icon size={20} />
        </div>
      )}
      <p className="text-sm font-medium text-heading">{title}</p>
      {description && <p className="text-xs text-tertiary mt-1.5 max-w-xs mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ─── Status indicator ───────────────────────────────────────────────────── */

interface StatusDotProps {
  active?: boolean;
  className?: string;
}

export function StatusDot({ active = true, className }: StatusDotProps) {
  if (!active) {
    return <span className={cn('inline-block w-1.5 h-1.5 rounded-full bg-muted', className)} />;
  }
  return <span className={cn('inline-block status-dot', className)} />;
}

/* ─── Progress bar ───────────────────────────────────────────────────────── */

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: 'sm' | 'md';
}

export function Progress({ value, max = 100, color, height = 'sm' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const bg = color || 'rgb(var(--accent-primary))';
  return (
    <div
      className={cn(
        'w-full rounded-full bg-card-inner overflow-hidden border border-border-default',
        height === 'sm' ? 'h-1.5' : 'h-2.5',
      )}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: bg }}
      />
    </div>
  );
}

/* ─── Page subtitle / hero block ────────────────────────────────────────── */

interface HeroProps {
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}

export function Hero({ title, subtitle, meta, actions }: HeroProps) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {meta && <div className="mb-2">{meta}</div>}
        <h1 className="text-2xl sm:text-3xl font-semibold text-heading tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-tertiary mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─── Tab buttons ────────────────────────────────────────────────────────── */

interface TabsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ options, value, onChange, className }: TabsProps<T>) {
  return (
    <div className={cn('inline-flex gap-1 p-1 rounded-xl bg-card-inner border border-border-default', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all',
              active ? 'bg-surface-hover text-heading shadow-sm' : 'text-tertiary hover:text-body',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
