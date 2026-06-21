import { LoadingSpinner } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Sizes = () => (
  <div style={{ ...stage, display: 'flex', alignItems: 'center', gap: 32 }}>
    <LoadingSpinner size="sm" />
    <LoadingSpinner size="md" />
    <LoadingSpinner size="lg" />
  </div>
);

export const InContext = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 380 }}>
    <LoadingSpinner size="lg" />
    <p className="text-body">Caricamento delle statistiche di studio...</p>
    <p className="text-muted text-sm">Sincronizzazione con Hack The Box in corso</p>
  </div>
);
