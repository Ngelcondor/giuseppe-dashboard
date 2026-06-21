import { EditorialPage, Surface, SectionHeader, Badge, Button } from 'giuseppe-dashboard';
import { Shield } from 'lucide-react';

export const Mission = () => (
  <EditorialPage
    eyebrow="Missione · CPTS"
    title="Percorso verso"
    titleAccent="la certificazione"
    description="Avanzamento dei moduli Hack The Box, laboratori completati e tempo stimato all'esame finale. Mantieni almeno una sessione al giorno."
    width="lg"
    actions={
      <>
        <Badge variant="success" size="sm">68%</Badge>
        <Button variant="primary" size="sm">Riprendi</Button>
      </>
    }
  >
    <Surface variant="default" className="mb-4">
      <SectionHeader icon={Shield} label="Modulo corrente" hint="Active Directory" />
      <p className="text-body text-sm leading-relaxed">
        Enumerazione con BloodHound e attacchi Kerberos (AS-REP roasting,
        Kerberoasting). 4 sezioni su 7 completate.
      </p>
    </Surface>
    <div className="grid grid-cols-3 gap-4">
      <Surface variant="flat">
        <p className="text-[11px] text-muted mb-1.5 tracking-uppercase">Moduli</p>
        <p className="text-2xl font-semibold leading-none font-mono-display text-heading">19/28</p>
      </Surface>
      <Surface variant="flat">
        <p className="text-[11px] text-muted mb-1.5 tracking-uppercase">Lab</p>
        <p className="text-2xl font-semibold leading-none font-mono-display text-heading">42</p>
      </Surface>
      <Surface variant="flat">
        <p className="text-[11px] text-muted mb-1.5 tracking-uppercase">All'esame</p>
        <p className="text-2xl font-semibold leading-none font-mono-display text-heading">
          21<span className="text-base text-tertiary font-normal ml-1">gg</span>
        </p>
      </Surface>
    </div>
  </EditorialPage>
);

export const FeedCyber = () => (
  <EditorialPage
    eyebrow="Cyber Feed"
    title="Notizie del giorno"
    description="Le ultime vulnerabilità e advisory rilevanti per il tuo percorso."
    width="md"
  >
    <Surface variant="default" className="mb-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-heading text-sm font-medium">CVE-2024-3094 · backdoor xz</p>
          <p className="text-tertiary text-xs mt-1 leading-relaxed">Compromissione della supply chain in liblzma.</p>
        </div>
        <Badge variant="danger" size="sm">Critico</Badge>
      </div>
    </Surface>
    <Surface variant="default">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-heading text-sm font-medium">Nuova tecnica di Kerberoasting</p>
          <p className="text-tertiary text-xs mt-1 leading-relaxed">Writeup utile per il modulo AD del CPTS.</p>
        </div>
        <Badge variant="info" size="sm">Studio</Badge>
      </div>
    </Surface>
  </EditorialPage>
);
