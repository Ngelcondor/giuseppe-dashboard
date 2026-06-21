import { Tabs } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Periodo = () => (
  <div style={stage}>
    <Tabs
      options={[
        { value: 'oggi', label: 'Oggi' },
        { value: 'settimana', label: 'Settimana' },
        { value: 'mese', label: 'Mese' },
      ]}
      value="settimana"
      onChange={() => {}}
    />
  </div>
);

export const Sezioni = () => (
  <div style={stage}>
    <Tabs
      options={[
        { value: 'studio', label: 'Studio' },
        { value: 'salute', label: 'Salute' },
        { value: 'budget', label: 'Budget' },
      ]}
      value="studio"
      onChange={() => {}}
    />
  </div>
);

export const Coppia = () => (
  <div style={stage}>
    <Tabs
      options={[
        { value: 'attive', label: 'Attive' },
        { value: 'archiviate', label: 'Archiviate' },
      ]}
      value="attive"
      onChange={() => {}}
    />
  </div>
);
