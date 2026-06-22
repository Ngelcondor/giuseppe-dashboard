import { CopyPromptButton } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Chip = () => (
  <div style={stage}>
    <CopyPromptButton
      variant="chip"
      prompt="Spiegami il flusso di AS-REP roasting con un esempio pratico e i comandi impacket."
    />
  </div>
);

export const Icona = () => (
  <div style={{ ...stage, display: 'flex', alignItems: 'center', gap: 16 }}>
    <CopyPromptButton
      variant="icon"
      prompt="Riassumi il capitolo 4 di crittografia in 5 punti chiave."
    />
    <span className="text-tertiary text-sm">Copia prompt per Claude</span>
  </div>
);

export const InLista = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380 }}>
    <div className="flex items-center justify-between">
      <span className="text-body text-sm">Ripassa Kerberos delegation</span>
      <CopyPromptButton variant="icon" prompt="Spiegami la constrained delegation in Active Directory." />
    </div>
    <div className="flex items-center justify-between">
      <span className="text-body text-sm">Esercizi RSA — set 4</span>
      <CopyPromptButton variant="chip" prompt="Genera 3 esercizi su RSA con soluzioni passo-passo." />
    </div>
  </div>
);
