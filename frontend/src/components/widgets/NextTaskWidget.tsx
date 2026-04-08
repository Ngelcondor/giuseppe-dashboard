'use client';

import React from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { CompactWidget } from '@/components/layout/WidgetWrapper';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
}

interface NextTaskWidgetProps {
  task: Task | null;
  isLoading?: boolean;
  onTaskClick?: () => void;
}

export const NextTaskWidget: React.FC<NextTaskWidgetProps> = ({
  task,
  isLoading = false,
  onTaskClick,
}) => {
  const priorityColors = {
    low: 'bg-green-900/20 text-green-100 border-green-700',
    medium: 'bg-blue-900/20 text-blue-100 border-blue-700',
    high: 'bg-yellow-900/20 text-yellow-100 border-yellow-700',
    critical: 'bg-red-900/20 text-red-100 border-red-700',
  };

  const priorityLabels = {
    low: 'Bassa',
    medium: 'Media',
    high: 'Alta',
    critical: 'Critica',
  };

  if (isLoading) {
    return (
      <CompactWidget title="Prossimo compito">
        <div className="space-y-3">
          <div className="h-4 bg-slate-700 rounded animate-pulse" />
          <div className="h-12 bg-slate-700 rounded animate-pulse" />
        </div>
      </CompactWidget>
    );
  }

  if (!task) {
    return (
      <CompactWidget title="Prossimo compito">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Check size={32} className="text-green-500 mb-2" />
          <p className="text-slate-300 text-sm">Tutti i compiti completati!</p>
        </div>
      </CompactWidget>
    );
  }

  return (
    <CompactWidget title="🎯 Prossimo compito">
      <button
        onClick={onTaskClick}
        className={cn(
          'w-full p-4 rounded-lg border-2 transition-all',
          'hover:shadow-lg hover:scale-105 active:scale-95',
          'prefers-reduced-motion:!transition-none prefers-reduced-motion:hover:!scale-100',
          task.priority === 'critical' && 'border-red-600 bg-red-900/20 hover:bg-red-900/30',
          task.priority === 'high' && 'border-yellow-600 bg-yellow-900/20 hover:bg-yellow-900/30',
          task.priority === 'medium' && 'border-blue-600 bg-blue-900/20 hover:bg-blue-900/30',
          task.priority === 'low' && 'border-green-600 bg-green-900/20 hover:bg-green-900/30'
        )}
      >
        <div className="text-left">
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-lg font-bold text-slate-100 flex-1">
              {task.title}
            </h4>
            {task.priority === 'critical' && (
              <AlertCircle size={20} className="text-red-400 flex-shrink-0 ml-2" />
            )}
          </div>
          {task.description && (
            <p className="text-sm text-slate-300 mb-3">
              {task.description}
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className={cn(
              'text-xs px-2 py-1 rounded border',
              priorityColors[task.priority]
            )}>
              Priorità: {priorityLabels[task.priority]}
            </span>
            {task.dueDate && (
              <span className="text-xs text-slate-400">
                Scadenza: {new Date(task.dueDate).toLocaleDateString('it-IT')}
              </span>
            )}
          </div>
        </div>
      </button>
    </CompactWidget>
  );
};
