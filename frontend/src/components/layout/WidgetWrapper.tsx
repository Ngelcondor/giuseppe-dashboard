'use client';

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WidgetWrapperProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onRemove?: () => void;
  onSettings?: () => void;
  defaultCollapsed?: boolean;
}

export const WidgetWrapper: React.FC<WidgetWrapperProps> = ({
  id,
  title,
  icon,
  children,
  onRemove,
  onSettings,
  defaultCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className="flex flex-col h-full bg-slate-800 border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900/50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && <span className="flex-shrink-0 text-blue-400">{icon}</span>}
          <h3 className="text-sm font-semibold text-slate-100 truncate">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onSettings && (
            <button
              onClick={onSettings}
              className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-200"
              title="Impostazioni"
            >
              <Settings size={16} />
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-200"
            title={isCollapsed ? 'Espandi' : 'Collassa'}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 hover:bg-red-900/20 rounded transition-colors text-slate-400 hover:text-red-400"
              title="Rimuovi"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      )}
    </div>
  );
};

// Compact widget wrapper for dashboard
interface CompactWidgetProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export const CompactWidget: React.FC<CompactWidgetProps> = ({
  title,
  icon,
  children,
  action,
}) => {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon && <span className="text-blue-400">{icon}</span>}
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        </div>
        {action && action}
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};
