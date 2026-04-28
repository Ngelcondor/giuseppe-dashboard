'use client';

import React, { useState } from 'react';
import { Copy, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  prompt: string;
  /** "icon" — small icon-only button (good for dense lists). "chip" — labeled pill. */
  variant?: 'icon' | 'chip';
  className?: string;
}

/**
 * Copies a Claude-ready study prompt to the clipboard. Renders as either
 * a tiny icon (for inline use in task lists) or a labeled chip.
 *
 * Stops click/key propagation so it works inside parent buttons/links
 * without triggering their handlers (e.g. when nested inside a task
 * checkbox row).
 */
export function CopyPromptButton({ prompt, variant = 'icon', className }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for older browsers / insecure context
      const ta = document.createElement('textarea');
      ta.value = prompt;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
      document.body.removeChild(ta);
    }
  };

  if (variant === 'chip') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title="Copia prompt per Claude"
        aria-label="Copia prompt per Claude"
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium',
          'border transition-colors',
          copied
            ? 'border-accent-soft bg-accent-soft text-accent'
            : 'border-border-default bg-card-inner text-tertiary hover:border-border-hover hover:text-body',
          className,
        )}
      >
        {copied ? <Check size={11} /> : <Sparkles size={11} />}
        {copied ? 'Copiato' : 'Claude'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Copia prompt per Claude"
      aria-label="Copia prompt per Claude"
      className={cn(
        'shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md',
        'text-muted hover:text-accent hover:bg-accent-soft transition-colors',
        copied && 'text-accent bg-accent-soft',
        className,
      )}
    >
      {copied ? <Check size={13} /> : <Sparkles size={13} />}
    </button>
  );
}
