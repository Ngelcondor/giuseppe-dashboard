import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary: 'bg-blue-900/50 text-blue-100 border border-blue-700',
      secondary: 'bg-slate-700 text-slate-100 border border-slate-600',
      success: 'bg-green-900/50 text-green-100 border border-green-700',
      warning: 'bg-yellow-900/50 text-yellow-100 border border-yellow-700',
      danger: 'bg-red-900/50 text-red-100 border border-red-700',
      info: 'bg-cyan-900/50 text-cyan-100 border border-cyan-700',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-3 py-1 text-sm',
      lg: 'px-4 py-1.5 text-base',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center',
          'rounded-full font-medium',
          'transition-colors duration-200',
          'prefers-reduced-motion:!transition-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Badge.displayName = 'Badge';

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: 'active' | 'inactive' | 'pending' | 'completed' | 'overdue';
  children?: React.ReactNode;
}

export const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  (
    {
      status,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const statusConfigs = {
      active: {
        bg: 'bg-green-900/50 border-green-700',
        text: 'text-green-100',
        label: 'Attivo',
      },
      inactive: {
        bg: 'bg-slate-700 border-slate-600',
        text: 'text-slate-300',
        label: 'Inattivo',
      },
      pending: {
        bg: 'bg-yellow-900/50 border-yellow-700',
        text: 'text-yellow-100',
        label: 'In sospeso',
      },
      completed: {
        bg: 'bg-green-900/50 border-green-700',
        text: 'text-green-100',
        label: 'Completato',
      },
      overdue: {
        bg: 'bg-red-900/50 border-red-700',
        text: 'text-red-100',
        label: 'Scaduto',
      },
    };

    const config = statusConfigs[status];

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1 text-sm rounded-full',
          'border font-medium',
          config.bg,
          config.text,
          'transition-colors duration-200',
          'prefers-reduced-motion:!transition-none',
          className
        )}
        {...props}
      >
        <div className="w-2 h-2 rounded-full bg-current" />
        {children || config.label}
      </div>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';
