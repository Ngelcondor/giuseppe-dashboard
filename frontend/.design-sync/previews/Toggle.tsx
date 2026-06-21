import { Toggle } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Default = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 380 }}>
    <Toggle
      label="Promemoria studio"
      description="Notifica giornaliera alle 18:00 per la sessione di ripasso."
      defaultChecked
    />
    <Toggle
      label="Modalità Focus"
      description="Blocca le notifiche durante i cicli Pomodoro."
    />
  </div>
);

export const Settings = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 380 }}>
    <Toggle
      label="Sincronizza con il calendario"
      description="Aggiunge le sessioni CTF agli eventi del calendario."
      defaultChecked
    />
    <Toggle
      label="Traccia ore di sonno"
      description="Registra automaticamente l'orario di andata a letto."
    />
    <Toggle label="Modalità notturna" />
  </div>
);
