'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Heart,
  Calendar,
  CheckSquare,
  Clock,
  Zap,
  Target,
  Smile,
  TrendingUp,
  Utensils,
  Tv,
  Gamepad2,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

const navItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, href: '/dashboard', color: 'text-blue-400' },
  { id: 'health', label: 'Salute', icon: <Heart size={20} />, href: '/dashboard/health', color: 'text-red-400' },
  { id: 'calendar', label: 'Calendario', icon: <Calendar size={20} />, href: '/dashboard/calendar', color: 'text-purple-400' },
  { id: 'deadlines', label: 'Scadenze', icon: <CheckSquare size={20} />, href: '/dashboard/deadlines', color: 'text-orange-400' },
  { id: 'routines', label: 'Routine', icon: <Clock size={20} />, href: '/dashboard/routines', color: 'text-green-400' },
  { id: 'focus', label: 'Focus', icon: <Zap size={20} />, href: '/dashboard/focus', color: 'text-yellow-400' },
  { id: 'habits', label: 'Abitudini', icon: <Target size={20} />, href: '/dashboard/habits', color: 'text-cyan-400' },
  { id: 'mood', label: 'Umore', icon: <Smile size={20} />, href: '/dashboard/mood', color: 'text-pink-400' },
  { id: 'budget', label: 'Budget', icon: <TrendingUp size={20} />, href: '/dashboard/budget', color: 'text-emerald-400' },
  { id: 'meals', label: 'Pasti', icon: <Utensils size={20} />, href: '/dashboard/meals', color: 'text-amber-400' },
  { id: 'feed', label: 'Feed', icon: <Tv size={20} />, href: '/dashboard/feed', color: 'text-indigo-400' },
  { id: 'ctf', label: 'CTF', icon: <Gamepad2 size={20} />, href: '/dashboard/ctf', color: 'text-rose-400' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const { logout } = useAuthStore();

  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));

  const handleLogout = () => {
    logout();
    window.location.href = '/auth';
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:sticky top-0 left-0 h-screen z-40 transition-all duration-300',
          'bg-slate-800 border-r border-slate-700',
          'prefers-reduced-motion:!transition-none',
          isCollapsed ? 'w-20' : 'w-64',
          !isOpen && '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            {!isCollapsed && (
              <Link href="/dashboard" className="font-semibold text-lg text-blue-400">
                GD
              </Link>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 hover:bg-slate-700 rounded transition-colors hidden md:block"
              title={isCollapsed ? 'Espandi' : 'Collassa'}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg',
                  'transition-colors duration-200',
                  'prefers-reduced-motion:!transition-none',
                  'group relative',
                  isActive(item.href)
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
                )}
              >
                <span className={cn('flex-shrink-0', item.color)}>
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <span className="text-sm font-medium whitespace-nowrap">
                    {item.label}
                  </span>
                )}
                {isCollapsed && (
                  <span className="absolute left-full ml-2 bg-slate-700 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {item.label}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-700 space-y-2">
            <Link
              href="/dashboard/settings"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg',
                'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100',
                'transition-colors duration-200',
                'prefers-reduced-motion:!transition-none',
                'group relative'
              )}
            >
              <Settings size={20} />
              {!isCollapsed && <span className="text-sm font-medium">Impostazioni</span>}
              {isCollapsed && (
                <span className="absolute left-full ml-2 bg-slate-700 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Impostazioni
                </span>
              )}
            </Link>
            <button
              onClick={handleLogout}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg',
                'text-slate-400 hover:bg-red-900/20 hover:text-red-400',
                'transition-colors duration-200',
                'prefers-reduced-motion:!transition-none',
                'group relative'
              )}
            >
              <LogOut size={20} />
              {!isCollapsed && <span className="text-sm font-medium">Esci</span>}
              {isCollapsed && (
                <span className="absolute left-full ml-2 bg-slate-700 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Esci
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
