import { Checkbox } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Default = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 380 }}>
    <Checkbox label="Completare il modulo CPTS sulla privilege escalation" defaultChecked />
    <Checkbox label="Risolvere il box HTB della settimana" defaultChecked />
    <Checkbox label="Aggiornare il vault Obsidian con i writeup" />
    <Checkbox label="Ripassare appunti di crittografia per l'esame UOC" />
  </div>
);

export const Habits = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 380 }}>
    <Checkbox label="Bere 2 litri d'acqua" defaultChecked />
    <Checkbox label="30 minuti di lettura tecnica" defaultChecked />
    <Checkbox label="Sessione di mobility serale" />
    <Checkbox label="A letto entro le 23:30" />
  </div>
);
