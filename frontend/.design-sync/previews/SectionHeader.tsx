import { SectionHeader, Surface, Button } from 'giuseppe-dashboard';
import { Activity, Shield, Wallet } from 'lucide-react';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Base = () => (
  <div style={{ ...stage, maxWidth: 420 }}>
    <SectionHeader icon={Activity} label="Routine di oggi" hint="6 attività" />
  </div>
);

export const WithAction = () => (
  <div style={{ ...stage, maxWidth: 420 }}>
    <SectionHeader
      icon={Shield}
      label="Macchine CTF"
      hint="Hack The Box"
      action={<Button variant="ghost" size="sm">Vedi tutto</Button>}
    />
  </div>
);

export const InCard = () => (
  <div style={{ ...stage, maxWidth: 420 }}>
    <Surface variant="default">
      <SectionHeader
        icon={Wallet}
        label="Spese ricorrenti"
        hint="giugno"
        action={<span className="text-[11px] text-tertiary font-mono-display">612 €</span>}
      />
      <div className="flex items-center justify-between py-2 border-t border-border-default">
        <span className="text-body text-sm">Abbonamento HTB</span>
        <span className="text-tertiary text-sm font-mono-display">14 €</span>
      </div>
      <div className="flex items-center justify-between py-2 border-t border-border-default">
        <span className="text-body text-sm">Affitto stanza · Barcellona</span>
        <span className="text-tertiary text-sm font-mono-display">480 €</span>
      </div>
    </Surface>
  </div>
);
