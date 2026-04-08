import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  className,
  showLabel = true,
  variant = 'primary',
  animated = true,
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  const variants = {
    primary: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    danger: 'bg-red-600',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-body">Progresso</span>
        {showLabel && (
          <span className="text-sm text-body">{Math.round(percentage)}%</span>
        )}
      </div>
      <div className="w-full h-2 bg-input rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            variants[variant],
            animated && 'animate-pulse-slow',
            'prefers-reduced-motion:!animate-none prefers-reduced-motion:!transition-none'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max = 100,
  size = 'md',
  variant = 'primary',
  showLabel = true,
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  const sizes = {
    sm: { container: 'w-12 h-12', text: 'text-xs' },
    md: { container: 'w-16 h-16', text: 'text-sm' },
    lg: { container: 'w-24 h-24', text: 'text-lg' },
  };

  const colors = {
    primary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
  };

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const sizeConfig = sizes[size];

  return (
    <div className={cn('flex items-center justify-center', sizeConfig.container)}>
      <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgb(71 85 105)"
          strokeWidth="3"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={colors[variant]}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300 prefers-reduced-motion:!transition-none"
        />
      </svg>
      {showLabel && (
        <div className="absolute flex flex-col items-center justify-center">
          <span className={cn('font-semibold text-heading', sizeConfig.text)}>
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
};

interface StepperProps {
  steps: Array<{
    id: string;
    label: string;
    completed: boolean;
  }>;
  currentStep: number;
  orientation?: 'horizontal' | 'vertical';
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  orientation = 'horizontal',
}) => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={cn(
        'flex',
        isHorizontal ? 'flex-row gap-4' : 'flex-col gap-6'
      )}
    >
      {steps.map((step, index) => {
        const isCompleted = step.completed;
        const isCurrent = index === currentStep;
        const isUpcoming = index > currentStep;

        return (
          <div
            key={step.id}
            className={cn(
              'flex items-center',
              isHorizontal ? 'flex-row gap-3' : 'flex-col gap-2'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full',
                'font-semibold text-sm transition-all duration-200',
                'prefers-reduced-motion:!transition-none',
                isCompleted && 'bg-green-600 text-white',
                isCurrent && 'bg-blue-600 text-white ring-2 ring-blue-400',
                isUpcoming && 'bg-input text-body'
              )}
            >
              {isCompleted ? '✓' : index + 1}
            </div>
            <span
              className={cn(
                'text-sm font-medium',
                isCompleted || isCurrent ? 'text-heading' : 'text-body'
              )}
            >
              {step.label}
            </span>
            {!isHorizontal && index < steps.length - 1 && (
              <div
                className={cn(
                  'w-0.5 h-6 ml-4',
                  isCompleted ? 'bg-green-600' : 'bg-input'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
