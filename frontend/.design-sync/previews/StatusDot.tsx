import { StatusDot } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const States = () => (
  <div style={stage}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
      <span className="inline-flex items-center gap-2">
        <StatusDot active />
        <span className="text-body text-sm">Online</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <StatusDot active={false} />
        <span className="text-tertiary text-sm">Offline</span>
      </span>
    </div>
  </div>
);

export const InList = () => (
  <div style={stage}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 280 }}>
      <span className="inline-flex items-center gap-2">
        <StatusDot active />
        <span className="text-body text-sm">VPN HTB · connessa</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <StatusDot active />
        <span className="text-body text-sm">Sessione Pomodoro · attiva</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <StatusDot active={false} />
        <span className="text-tertiary text-sm">Sync Obsidian · in pausa</span>
      </span>
    </div>
  </div>
);
