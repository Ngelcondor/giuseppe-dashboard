import React from 'react';
import { cn } from '@/lib/utils';

interface ToggleProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
}

export const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  (
    {
      label,
      description,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const toggleId = id || `toggle-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div className="flex items-center gap-3">
        <label
          htmlFor={toggleId}
          className="flex items-center cursor-pointer"
        >
          <div className="relative">
            <input
              ref={ref}
              id={toggleId}
              type="checkbox"
              className={cn(
                'sr-only',
                className
              )}
              {...props}
            />
            <div className="w-11 h-6 bg-slate-700 rounded-full shadow-inner transition-colors duration-200
                          peer-checked:bg-blue-600 prefers-reduced-motion:!transition-none" />
            <div className="absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full shadow-md
                          transition-transform duration-200 pointer-events-none
                          peer-checked:translate-x-5 prefers-reduced-motion:!transition-none" />
          </div>
        </label>
        {label && (
          <div>
            <label
              htmlFor={toggleId}
              className="text-sm font-medium text-slate-300 cursor-pointer"
            >
              {label}
            </label>
            {description && (
              <p className="text-xs text-slate-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Toggle.displayName = 'Toggle';

// Styled checkbox version
interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          className={cn(
            'w-4 h-4 rounded border-slate-600 bg-slate-700',
            'text-blue-600 focus:ring-2 focus:ring-blue-500/50',
            'cursor-pointer transition-colors duration-200',
            'prefers-reduced-motion:!transition-none',
            className
          )}
          {...props}
        />
        {label && (
          <label
            htmlFor={checkboxId}
            className="text-sm text-slate-300 cursor-pointer select-none"
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
