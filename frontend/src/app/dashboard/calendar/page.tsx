'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CalendarView } from '@/components/calendar';

export default function CalendarPage() {
  return (
    <div className="min-h-screen bg-page text-heading">
      <header className="px-6 py-5 border-b border-border-default flex items-center gap-3">
        <Link href="/dashboard" className="text-tertiary hover:text-body transition-colors">
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
