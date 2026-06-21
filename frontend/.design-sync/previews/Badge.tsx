import { Badge } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Varianti = () => (
  <div style={{ ...stage, display: 'flex', flexWrap: 'wrap', gap: 10, maxWidth: 380 }}>
    <Badge variant="primary">In corso</Badge>
    <Badge variant="secondary">Bozza</Badge>
    <Badge variant="success">Completato</Badge>
    <Badge variant="warning">In scadenza</Badge>
    <Badge variant="danger">Scaduto</Badge>
    <Badge variant="info">Nuovo</Badge>
  </div>
);

export const Dimensioni = () => (
  <div style={{ ...stage, display: 'flex', alignItems: 'center', gap: 12 }}>
    <Badge variant="primary" size="sm">CPTS</Badge>
    <Badge variant="primary" size="md">OSCP</Badge>
    <Badge variant="primary" size="lg">CRTE</Badge>
  </div>
);

export const InContesto = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380 }}>
    <div className="flex items-center justify-between">
      <span className="text-body text-sm">Sessione Pomodoro</span>
      <Badge variant="success" size="sm">Completato</Badge>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-body text-sm">Esame Reti — UOC</span>
      <Badge variant="warning" size="sm">3 giorni</Badge>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-body text-sm">Budget mensile</span>
      <Badge variant="danger" size="sm">Sforato</Badge>
    </div>
  </div>
);
