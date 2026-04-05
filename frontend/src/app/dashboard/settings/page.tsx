'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Settings,
  Bell,
  Moon,
  Monitor,
  Zap,
  Clock,
  Pill,
  Check,
  X,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import notificationService from '@/services/notificationService';

// ─── Setting Section ─────────────────────────────────────────────────────────

function SettingSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
        <div className="text-slate-400">{icon}</div>
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

// ─── Setting Row ─────────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-300">{label}</p>
        {description && <p className="text-xs text-slate-600 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [permissionState, setPermissionState] = useState<string>('default');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Settings state (local for now, can be persisted later)
  const [lowStimMode, setLowStimMode] = useState(false);
  const [medReminders, setMedReminders] = useState(true);
  const [routineReminders, setRoutineReminders] = useState(true);
  const [sleepReminders, setSleepReminders] = useState(true);
  const [deadlineReminders, setDeadlineReminders] = useState(true);

  useEffect(() => {
    // Check push subscription status
    const checkPush = async () => {
      const subscribed = await notificationService.isSubscribed();
      setPushEnabled(subscribed);
      setPermissionState(notificationService.getPermissionState());
    };
    checkPush();
  }, []);

  const handleTogglePush = async () => {
    try {
      setPushLoading(true);
      setError(null);

      if (pushEnabled) {
        await notificationService.unsubscribe();
        setPushEnabled(false);
        setSuccess('Push notification disattivate');
      } else {
        // Request permission first
        const permission = await notificationService.requestPermission();
        setPermissionState(permission);

        if (permission !== 'granted') {
          setError('Permesso per le notifiche negato. Abilitalo nelle impostazioni del browser.');
          return;
        }

        const ok = await notificationService.registerServiceWorker();
        if (ok) {
          setPushEnabled(true);
          setSuccess('Push notification attivate!');
        } else {
          setError("Errore nell'attivazione delle push notification");
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Errore');
    } finally {
      setPushLoading(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100">
      <header className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Settings size={18} className="text-slate-400" />
        <h1 className="text-base font-semibold">Pannello di Controllo</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status banners */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400"><X size={16} /></button>
          </div>
        )}
        {success && (
          <div className="px-4 py-3 rounded-lg bg-emerald-900/20 border border-emerald-700/30 flex items-center gap-3">
            <Check size={18} className="text-emerald-400" />
            <p className="text-sm text-emerald-300">{success}</p>
          </div>
        )}

        {/* Push Notifications */}
        <SettingSection
          icon={<Bell size={18} />}
          title="Notifiche Push"
          description="Ricevi notifiche sul dispositivo per farmaci, routine e scadenze"
        >
          <SettingRow
            label="Attiva push notification"
            description={
              permissionState === 'denied'
                ? 'Permesso negato — abilitalo nelle impostazioni del browser'
                : permissionState === 'unsupported'
                ? 'Non supportato su questo browser'
                : pushEnabled
                ? 'Le notifiche push sono attive'
                : 'Le notifiche push sono disattivate'
            }
          >
            <button
              onClick={handleTogglePush}
              disabled={pushLoading || permissionState === 'unsupported'}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                pushEnabled ? 'bg-emerald-600' : 'bg-slate-700'
              } ${pushLoading ? 'opacity-50' : ''}`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  pushEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </SettingRow>

          <SettingRow label="Promemoria farmaci" description="Notifica agli orari programmati">
            <button
              onClick={() => setMedReminders(!medReminders)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                medReminders ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                medReminders ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </SettingRow>

          <SettingRow label="Promemoria routine" description="Notifica all'orario della routine">
            <button
              onClick={() => setRoutineReminders(!routineReminders)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                routineReminders ? 'bg-green-600' : 'bg-slate-700'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                routineReminders ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </SettingRow>

          <SettingRow label="Report mattutino sonno" description="Buongiorno con dati del sonno">
            <button
              onClick={() => setSleepReminders(!sleepReminders)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                sleepReminders ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                sleepReminders ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </SettingRow>

          <SettingRow label="Scadenze" description="Notifica per deadline in scadenza">
            <button
              onClick={() => setDeadlineReminders(!deadlineReminders)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                deadlineReminders ? 'bg-orange-600' : 'bg-slate-700'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                deadlineReminders ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </SettingRow>
        </SettingSection>

        {/* Display */}
        <SettingSection
          icon={<Monitor size={18} />}
          title="Visualizzazione"
          description="Personalizza l'aspetto della dashboard"
        >
          <SettingRow
            label="Modalità bassa stimolazione"
            description="Riduce animazioni, colori e complessità visiva"
          >
            <button
              onClick={() => setLowStimMode(!lowStimMode)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                lowStimMode ? 'bg-violet-600' : 'bg-slate-700'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                lowStimMode ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </SettingRow>
        </SettingSection>

        {/* Quick Links */}
        <SettingSection
          icon={<Zap size={18} />}
          title="Accesso rapido"
        >
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Notifiche', href: '/notifications', icon: <Bell size={16} />, color: 'text-blue-400' },
              { label: 'Farmaci', href: '/dashboard/health/medications', icon: <Pill size={16} />, color: 'text-indigo-400' },
              { label: 'Sonno', href: '/dashboard/health/sleep', icon: <Moon size={16} />, color: 'text-blue-400' },
              { label: 'Routine', href: '/dashboard/routines', icon: <Clock size={16} />, color: 'text-green-400' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
              >
                <span className={item.color}>{item.icon}</span>
                <span className="text-sm text-slate-300">{item.label}</span>
                <ExternalLink size={12} className="text-slate-600 ml-auto" />
              </Link>
            ))}
          </div>
        </SettingSection>

        {/* Info */}
        <div className="text-center pt-4 pb-8">
          <p className="text-[10px] text-slate-700">Giuseppe Dashboard v1.0.0</p>
          <p className="text-[10px] text-slate-800 mt-1">FastAPI + Next.js + PostgreSQL</p>
        </div>
      </main>
    </div>
  );
}
