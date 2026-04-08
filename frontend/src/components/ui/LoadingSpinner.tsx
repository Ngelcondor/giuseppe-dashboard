import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className,
  fullScreen = false,
}) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const spinner = (
    <div
      className={cn(
        'animate-spin rounded-full border-4 border-input border-t-blue-500',
        'prefers-reduced-motion:!animate-none',
        sizes[size],
        className
      )}
    />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-page/80 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

interface SkeletonProps {
  className?: string;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  count = 1,
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'bg-gradient-to-r from-input to-surface-hover rounded',
            'animate-pulse',
            'prefers-reduced-motion:!animate-none opacity-50',
            className
          )}
        />
      ))}
    </>
  );
};

interface SkeletonBlockProps {
  lines?: number;
  className?: string;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  lines = 3,
  className,
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 && 'w-3/4'
          )}
        />
      ))}
    </div>
  );
};
