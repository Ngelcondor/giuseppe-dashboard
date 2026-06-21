import { AppShell, Surface, SectionHeader, Badge, Button } from 'giuseppe-dashboard';
import { Activity, Flame } from 'lucide-react';

export const Dashboard = () => (
  <AppShell
    title="Routine"
    subtitle="Lunedì · 21 giugno"
    width="lg"
    actions={<Button variant="primary" size="sm">Aggiungi</Button>}
  >
    <Surface variant="default" className="mb-4">
      <SectionHeader icon={Activity} label="Attività di oggi" hint="4 di 6 fatte" />
      <div className="flex items-center justify-between py-2 border-t border-border-default">
        <span className="text-body text-sm">Sessione di studio · CPTS</span>
        <Badge variant="success" size="sm">Fatto</Badge>
      </div>
      <div className="flex items-center justify-between py-2 border-t border-border-default">
        <span className="text-body text-sm">Macchina HTB · easy</span>
        <Badge variant="warning" size="sm">In corso</Badge>
      </div>
      <div className="flex items-center justify-between py-2 border-t border-border-default">
        <span className="text-body text-sm">Allenamento serale</span>
        <Badge variant="secondary" size="sm">Da fare</Badge>
      </div>
    </Surface>
    <Surface variant="accent">
      <SectionHeader icon={Flame} label="Streak abitudini" />
      <p className="text-2xl font-semibold leading-none font-mono-display text-heading">
        14<span className="text-base text-tertiary font-normal ml-1">giorni</span>
      </p>
    </Surface>
  </AppShell>
);

export const Focus = () => (
  <AppShell title="Focus" subtitle="Pomodoro" back="/dashboard" width="md">
    <Surface variant="default" className="text-center">
      <p className="text-[11px] text-muted mb-3 tracking-uppercase">Blocco corrente</p>
      <p className="text-5xl font-semibold leading-none font-mono-display text-heading">24:36</p>
      <p className="text-tertiary text-xs mt-4">Active Directory · enumerazione Kerberos</p>
      <div className="flex justify-center gap-2 mt-6">
        <Button variant="ghost" size="sm">Pausa</Button>
        <Button variant="primary" size="sm">Completa</Button>
      </div>
    </Surface>
  </AppShell>
);
