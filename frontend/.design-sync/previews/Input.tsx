import { Input, Textarea, Select } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Fields = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 380 }}>
    <Input label="Nome attività" placeholder="es. Ripasso crittografia" defaultValue="Ripasso RSA" />
    <Input
      label="Email"
      type="email"
      placeholder="tu@esempio.it"
      helperText="Useremo questa email solo per i promemoria."
    />
    <Input
      label="Password"
      type="password"
      defaultValue="hunter2"
      error="La password deve avere almeno 12 caratteri."
    />
  </div>
);

export const MultilineAndSelect = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 380 }}>
    <Textarea
      label="Note sessione"
      defaultValue="Concetti chiave: chiavi pubbliche/private, padding OAEP, attacchi su esponenti piccoli."
      helperText="Markdown supportato."
    />
    <Select
      label="Materia"
      defaultValue="crypto"
      options={[
        { value: 'crypto', label: 'Crittografia' },
        { value: 'net', label: 'Reti' },
        { value: 'web', label: 'Sicurezza Web' },
      ]}
    />
  </div>
);
