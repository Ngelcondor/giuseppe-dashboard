'use client';

import React from 'react';
import {
  Pill,
  Play,
  PlusCircle,
  Smile,
  TrendingUp,
  Target,
} from 'lucide-react';
import { CompactWidget } from '@/components/layout/WidgetWrapper';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
  disabled?: boolean;
}

interface QuickActionsProps {
  actions?: QuickAction[];
  onDefaultActionClick?: (actionId: string) => void;
}

const defaultActions: QuickAction[] = [
  {
    id: 'mood',
    label: 'Umore',
    icon: <Smile size={20} />,
    color: 'bg-pink-600 hover:bg-pink-700',
  },
  {
    id: 'medication',
    label: 'Medicina',
    icon: <Pill size={20} />,
    color: 'bg-green-600 hover:bg-green-700',
  },
  {
    id: 'pomodoro',
    label: 'Pomodoro',
    icon: <Play size={20} />,
    color: 'bg-red-600 hover:bg-red-700',
  },
  {
    id: 'expense',
    label: 'Spesa',
    icon: <TrendingUp size={20} />,
    color: 'bg-cyan-600 hover:bg-cyan-700',
  },
  {
    id: 'meal',
    label: 'Pasto',
    icon: <PlusCircle size={20} />,
    color: 'bg-orange-600 hover:bg-orange-700',
  },
  {
    id: 'check-habit',
    label: 'Abitudine',
    icon: <Target size={20} />,
    color: 'bg-purple-600 hover:bg-purple-700',
  },
];

export const QuickActions: React.FC<QuickActionsProps> = ({
  actions,
  onDefaultActionClick,
}) => {
  const actionsToShow = actions || defaultActions;

  const handleClick = (actionId: string) => {
    if (onDefaultActionClick) {
      onDefaultActionClick(actionId);
    }
  };

  return (
    <CompactWidget title="⚡ Azioni rapide">
      <div className="grid grid-cols-3 gap-2">
        {actionsToShow.map((action) => (
          <button
            key={action.id}
            onClick={() => handleClick(action.id)}
            disabled={action.disabled}
            className={cn(
              'flex flex-col items-center justify-center p-3 rounded-lg',
              'text-white font-medium text-xs transition-all duration-200',
              'active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
              'prefers-reduced-motion:!transition-none prefers-reduced-motion:active:!scale-100',
              action.color
            )}
          >
            <span className="mb-1 flex-shrink-0">
              {typeof action.icon === 'string' ? (
                <span>{action.icon}</span>
              ) : (
                action.icon
              )}
            </span>
            <span className="text-center leading-tight">{action.label}</span>
          </button>
        ))}
      </div>
    </CompactWidget>
  );
};
