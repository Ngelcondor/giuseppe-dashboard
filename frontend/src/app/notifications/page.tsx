'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  AlertTriangle,
  X,
  Pill,
  Clock,
  Moon,
  Calendar,
  Info,
} from 'lucide-react';
import notificationService, { NotificationItem } from '@/services/notificationService';

function typeIcon(type: string) {
  switch (type) {
    case 'medication': return <Pill size={16} className="text-indigo-400" />;
    case 'routine': return <Clock size={16} className="text-green-400" />;
    case 'sleep': return <Moon size={16} className="text-blue-400" />;
    case 'deadline': return <Calendar size={16} className="text-orange-400" />;
    case 'warning': return <AlertTriangle size={16} className="text-amber-400" />;
    case 'success': return <Check size={16} className="text-emerald-400" />;
    default: return <Info size={16} className="text-body" />;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'adesso';
  if (mins < 60) return `${mins}m fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  return `${days}g fa`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await notificationService.list(filter === 'unread');
      setNotifications(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Errore nel caricamento delle notifiche');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-page text-heading">
      <header className="px-6 py-5 border-b border-border-default flex items-center gap-3">
        <Link href="/dashboard" className="text-tertiary hover:text-body transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Bell size={18} className="text-blue-400" />
        <h1 className="text-base font-semibold flex-1">Notifiche</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <CheckCheck size={14} /> Segna tutte come lette
          </button>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400"><X size={16} /></button>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-1 p-1 bg-card rounded-xl border border-border-default">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                filter === f ? 'bg-blue-600/30 text-blue-300' : 'text-tertiary hover:text-body'
              }`}
            >
              {f === 'all' ? 'Tutte' : `Non lette (${unreadCount})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <BellOff size={28} className="text-muted mx-auto mb-3" />
            <p className="text-sm text-tertiary">
              {filter === 'unread' ? 'Nessuna notifica non letta' : 'Nessuna notifica'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${
                  notif.is_read
                    ? 'bg-card border-border-default opacity-60'
                    : 'bg-card border-border-default'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {notif.icon ? (
                    <span className="text-lg">{notif.icon}</span>
                  ) : (
                    typeIcon(notif.notification_type)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-heading">{notif.title}</p>
                    {!notif.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-body mt-0.5">{notif.message}</p>
                  <p className="text-[10px] text-muted mt-1">{timeAgo(notif.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkRead(notif.id)}
                      className="p-1 rounded-lg hover:bg-surface-hover text-tertiary hover:text-emerald-400 transition-colors"
                      title="Segna come letta"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notif.id)}
                    className="p-1 rounded-lg hover:bg-red-600/10 text-muted hover:text-red-400 transition-colors"
                    title="Elimina"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
