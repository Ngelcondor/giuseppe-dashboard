'use client';

import { Calendar } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { CalendarView } from '@/components/calendar';

export default function CalendarPage() {
  return (
    <PageShell title="Calendario" eyebrow="Eventi & impegni" icon={Calendar} iconColor="text-violet-400" width="xl">
      <CalendarView />
    </PageShell>
  );
}
