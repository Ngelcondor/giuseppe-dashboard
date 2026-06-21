import { Select } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Default = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 380 }}>
    <Select
      label="Materia"
      defaultValue="crypto"
      options={[
        { value: 'crypto', label: 'Crittografia' },
        { value: 'net', label: 'Reti' },
        { value: 'web', label: 'Sicurezza Web' },
        { value: 'ad', label: 'Active Directory' },
      ]}
    />
    <Select
      label="Difficoltà box HTB"
      defaultValue="medium"
      helperText="Filtra i box per livello di difficoltà."
      options={[
        { value: 'easy', label: 'Facile' },
        { value: 'medium', label: 'Media' },
        { value: 'hard', label: 'Difficile' },
        { value: 'insane', label: 'Insane' },
      ]}
    />
  </div>
);

export const States = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 380 }}>
    <Select
      label="Durata Pomodoro"
      defaultValue="25"
      options={[
        { value: '15', label: '15 minuti' },
        { value: '25', label: '25 minuti' },
        { value: '50', label: '50 minuti' },
      ]}
    />
    <Select
      label="Stato sonno"
      error="Seleziona un valore valido."
      defaultValue=""
      options={[
        { value: '', label: 'Seleziona...' },
        { value: 'ottimo', label: 'Ottimo' },
        { value: 'scarso', label: 'Scarso' },
      ]}
    />
  </div>
);
