import { Textarea } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Default = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 380 }}>
    <Textarea
      label="Note sessione di studio"
      defaultValue="Capitolo 4 reti: subnetting VLSM, ARP spoofing in lab, ripassare three-way handshake TCP."
      helperText="Le note vengono salvate ogni 30 secondi."
    />
  </div>
);

export const WithError = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 380 }}>
    <Textarea
      label="Riepilogo writeup CTF"
      defaultValue="..."
      error="Il riepilogo deve contenere almeno 50 caratteri."
    />
    <Textarea
      label="Riflessione serale"
      placeholder="Com'è andata la giornata di studio?"
    />
  </div>
);
