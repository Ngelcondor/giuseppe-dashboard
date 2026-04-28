'use client';
import { Utensils } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { Surface, EmptyState } from '@/components/ui/Surface';

export default function Page() {
  return (
    <PageShell title="Pasti" eyebrow="Meal planner" icon={Utensils} iconColor="text-amber-400" width="md">
      <Surface variant="accent" padding="lg">
        <EmptyState
          icon={Utensils}
          title="Meal Planner"
          description="Pianifica pasti, traccia macro e crea liste della spesa. In costruzione."
        />
      </Surface>
    </PageShell>
  );
}
