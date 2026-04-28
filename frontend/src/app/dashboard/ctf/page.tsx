'use client';
import { Shield, Flag } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { Surface, EmptyState } from '@/components/ui/Surface';

export default function Page() {
  return (
    <PageShell title="CTF Tracker" eyebrow="Capture the flag" icon={Shield} iconColor="text-rose-400" width="md">
      <Surface variant="accent" padding="lg">
        <EmptyState
          icon={Flag}
          title="CTF Tracker"
          description="Traccia challenge HackTheBox, TryHackMe, RootMe e write-up. In costruzione."
        />
      </Surface>
      <p className="mt-8 text-[11px] text-muted font-mono-display text-center opacity-70">
        <span className="text-accent">// </span>
        $ ctf list --status=open
      </p>
    </PageShell>
  );
}
