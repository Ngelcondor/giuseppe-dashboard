'use client';
import { Rss } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { Surface, EmptyState } from '@/components/ui/Surface';

export default function Page() {
  return (
    <PageShell title="Cyber Feed" eyebrow="News & threat intel" icon={Rss} iconColor="text-indigo-400" width="md">
      <Surface variant="accent" padding="lg">
        <EmptyState
          icon={Rss}
          title="Cyber Feed"
          description="Aggregatore di feed RSS da Krebs, Bleeping Computer, The Hacker News, HN. In costruzione."
        />
      </Surface>
      <p className="mt-8 text-[11px] text-muted font-mono-display text-center opacity-70">
        <span className="text-accent">// </span>
        $ rss-fetch --sources=cybersec
      </p>
    </PageShell>
  );
}
