'use client';

import React from 'react';
import { Bell, Settings, Menu, X } from 'lucide-react';
import { formatDate, getGreeting } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface HeaderProps {
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onMenuToggle,
  isMenuOpen = false,
}) => {
  const user = useAuthStore((state) => state.user);
  const { toggleLowStim, lowStim } = useThemeStore();
  const now = new Date();

  return (
    <header className="sticky top-0 z-40 bg-slate-800 border-b border-slate-700 backdrop-blur-sm">
      <div className="max-w-full mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Menu and Greeting */}
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuToggle}
              className="md:hidden p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="hidden md:block">
              <h1 className="text-lg font-semibold text-slate-100">
                {user ? getGreeting(user.name) : 'Ciao!'}
              </h1>
              <p className="text-sm text-slate-400">
                {formatDate(now, 'EEEE d MMMM yyyy')}
              </p>
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLowStim}
              className={`p-2 rounded-lg transition-colors ${
                lowStim
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'hover:bg-slate-700 text-slate-400'
              }`}
              title={lowStim ? 'Disattiva modalità a bassa stimolazione' : 'Attiva modalità a bassa stimolazione'}
            >
              ✨
            </button>
            <Link href="/notifications">
              <button className="relative p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
            </Link>
            <Link href="/settings">
              <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400">
                <Settings size={20} />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
