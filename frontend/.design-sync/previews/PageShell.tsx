import { PageShell, Surface, SectionHeader, Button } from 'giuseppe-dashboard';
import { BookOpen } from 'lucide-react';

export const Studio = () => (
  <PageShell
    title="Studio"
    eyebrow="Sessione · Crittografia"
    width="md"
    actions={<Button variant="primary" size="sm">Nuovo Pomodoro</Button>}
  >
    <Surface variant="default" className="mb-4">
      <SectionHeader icon={BookOpen} label="In corso" hint="Capitolo 4 · RSA" />
      <p className="text-body text-sm leading-relaxed">
        Rivedi gli appunti su scambio di chiavi e firme digitali, poi completa gli
        esercizi del set 4 prima del blocco delle 18:00.
      </p>
    </Surface>
    <Surface variant="flat">
      <p className="text-heading text-sm font-medium mb-1.5">Prossimo modulo</p>
      <p className="text-tertiary text-xs leading-relaxed">
        Active Directory · enumerazione e attacchi Kerberos. Stimati 3 giorni.
      </p>
    </Surface>
  </PageShell>
);

export const Salute = () => (
  <PageShell title="Salute" eyebrow="Riepilogo settimanale" width="lg">
    <div className="grid grid-cols-2 gap-4">
      <Surface variant="default">
        <p className="text-[11px] text-muted mb-1.5 tracking-uppercase">Sonno medio</p>
        <p className="text-2xl font-semibold leading-none font-mono-display text-heading">
          7.2<span className="text-base text-tertiary font-normal ml-1">h</span>
        </p>
      </Surface>
      <Surface variant="default">
        <p className="text-[11px] text-muted mb-1.5 tracking-uppercase">Acqua</p>
        <p className="text-2xl font-semibold leading-none font-mono-display text-heading">
          1.8<span className="text-base text-tertiary font-normal ml-1">L</span>
        </p>
      </Surface>
    </div>
  </PageShell>
);
