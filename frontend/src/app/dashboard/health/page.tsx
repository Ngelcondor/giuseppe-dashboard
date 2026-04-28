'use client';

import Link from 'next/link';
import { Heart, Pill, Moon, Activity, Watch, Dumbbell, ChevronRight } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';

const sections = [
  {
    id: 'medications',
    label: 'Farmaci',
    description: 'Gestisci terapia, registra assunzioni e PRN',
    icon: Pill,
    href: '/dashboard/health/medications',
    accent: 'text-indigo-400',
    bg: 'bg-indigo-500/8 border-indigo-500/20',
  },
  {
    id: 'sleep',
    label: 'Sonno',
    description: 'Fasi del sonno, Sleep Cycle e report mattutino',
    icon: Moon,
    href: '/dashboard/health/sleep',
    accent: 'text-blue-400',
    bg: 'bg-blue-500/8 border-blue-500/20',
  },
  {
    id: 'metrics',
    label: 'Metriche',
    description: 'Frequenza cardiaca, passi, peso, calorie e altro',
    icon: Activity,
    href: '/dashboard/health/metrics',
    accent: 'text-emerald-400',
    bg: 'bg-emerald-500/8 border-emerald-500/20',
  },
  {
    id: 'workouts',
    label: 'Allenamenti',
    description: 'Traccia tipo, durata, calorie e intensità',
    icon: Dumbbell,
    href: '/dashboard/health/workouts',
    accent: 'text-violet-400',
    bg: 'bg-violet-500/8 border-violet-500/20',
  },
  {
    id: 'apple-health',
    label: 'Apple Health',
    description: 'Importa dati da Apple Watch / Health',
    icon: Watch,
    href: '/dashboard/health/apple',
    accent: 'text-pink-400',
    bg: 'bg-pink-500/8 border-pink-500/20',
  },
];

export default function HealthPage() {
  return (
    <PageShell title="Salute" eyebrow="Body & Mind" icon={Heart} iconColor="text-rose-400" width="md">
      <div className="space-y-3">
        {sections.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className={`group flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-200 ${s.bg} hover:bg-card-solid`}
          >
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-card-solid border border-border-default flex items-center justify-center ${s.accent}`}>
              <s.icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-heading">{s.label}</p>
              <p className="text-xs text-tertiary mt-0.5">{s.description}</p>
            </div>
            <ChevronRight size={16} className="text-muted group-hover:text-tertiary group-hover:translate-x-0.5 transition-all" />
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
