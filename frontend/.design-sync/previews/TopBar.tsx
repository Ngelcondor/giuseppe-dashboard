import { TopBar, Button } from 'giuseppe-dashboard';

// TopBar is a sticky page header; render it on the app's page background.
const page: React.CSSProperties = { background: 'rgb(8 8 10)', borderRadius: 16, overflow: 'hidden' };

export const Logo = () => (
  <div style={page}>
    <TopBar />
    <div style={{ height: 80 }} />
  </div>
);

export const WithTitle = () => (
  <div style={page}>
    <TopBar title="Sessione Pomodoro" subtitle="STUDIO" back="/dashboard" />
    <div style={{ height: 80 }} />
  </div>
);

export const WithActions = () => (
  <div style={page}>
    <TopBar
      title="Calendario"
      subtitle="GIUGNO 2026"
      actions={<Button variant="primary" size="sm">Nuovo evento</Button>}
    />
    <div style={{ height: 80 }} />
  </div>
);
