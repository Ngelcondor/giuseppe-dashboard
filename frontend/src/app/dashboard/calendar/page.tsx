'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CalendarView } from '@/components/calendar';

export default function CalendarPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100">
      <header className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-base font-semibold">Calendario</h1>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-6">
        <CalendarView />
      </main>
    </div>
  );
}
