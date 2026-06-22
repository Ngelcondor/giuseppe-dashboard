import { Button } from 'giuseppe-dashboard';

// The DS is dark-first (:root holds the dark tokens). Stage each story on the
// app's page background so light-on-dark components read correctly.
const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Variants = () => (
  <div style={stage}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
      <Button variant="primary">Salva sessione</Button>
      <Button variant="secondary">Annulla</Button>
      <Button variant="ghost">Dettagli</Button>
      <Button variant="success">Completa</Button>
      <Button variant="danger">Elimina</Button>
    </div>
  </div>
);

export const Sizes = () => (
  <div style={stage}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Button size="sm">Piccolo</Button>
      <Button size="md">Medio</Button>
      <Button size="lg">Grande</Button>
    </div>
  </div>
);

export const States = () => (
  <div style={stage}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Button variant="primary">Avvia Pomodoro</Button>
      <Button variant="primary" isLoading>Avvia Pomodoro</Button>
      <Button variant="primary" disabled>Avvia Pomodoro</Button>
    </div>
  </div>
);
