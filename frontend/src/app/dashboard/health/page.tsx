'use client';

import Link from 'next/link';
import { ArrowLeft, Heart, Pill, Moon, Activity, Watch } from 'lucide-react';

const sections = [
  {
    id: 'medications',
    label: 'Farmaci',
    description: 'Gestisci terapia, registra assunzioni e PRN',
    icon: <Pill size={22} />,
    href: '/dashboard/health/medications',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
    ready: true,
  },
  {
    id: 'sleep',
    label: 'Sonno',
    description: 'Fasi del sonno, Sleep Cycle e report mattutino',
    icon: <Moon size={22} />,
    href: '/dashboard/health/sleep',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    ready: true,
  },
  {
    id: 'metrics',
    label: 'Metriche',
    description: 'Frequenza cardiaca, passi, peso e altro',
    icon: <Activity size={22} />,
    href: '/dashboard/health/metrics',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    ready: false,
  },
  {
    id: 'apple-health',
    label: 'Apple Health',
    description: 'Importa dati da Apple Watch / Health',
    icon: <Watch size={22} />,
    href: '/dashboard/health/apple',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10 border-pink-500/20',
    ready: false,
  },
];

export default function HealthPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100">
      <header className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Heart size={18} className="text-red-400" />
        <h1 className="text-base font-semibold">Salute</h1>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8">
        <div className="grid gap-3">
          {sections.map((s) => {
            const Wrapper = s.ready ? Link : 'div';
            return (
              <Wrapper
                key={s.id}
                href={s.ready ? s.href : '#'}
                className={`flex items-center gap-4 px-5 py-4 rounded-xl border transition-all duration-200 ${
                  s.ready
                    ? `${s.bg} hover:scale-[1.01] cursor-pointer`
                    : 'bg-white/[0.02] border-white/5 opacity-50 cursor-default'
                }`}
              >
                <div className={`flex-shrink-0 ${s.color}`}>{s.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{s.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>
                </div>
                {!s.ready && (
                  <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">
                    Presto
                  </span>
                )}
              </Wrapper>
            );
          })}
        </div>
      </main>
    </div>
  );
}
