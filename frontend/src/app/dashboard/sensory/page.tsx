'use client';
import { Zap } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { Surface, EmptyState } from '@/components/ui/Surface';

export default function Page() {
  return (
    <PageShell title="Sensoriale" eyebrow="Carico & regolazione" icon={Zap} iconColor="text-amber-400" width="md">
      <Surface variant="accent" padding="lg">
        <EmptyState
          icon={Zap}
          title="Log sensoriale"
          description="Traccia carico sensoriale, overload e strategie di regolazione. In costruzione."
        />
      </Surface>
    </PageShell>
  );
}
