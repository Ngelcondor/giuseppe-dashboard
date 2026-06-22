import { StatBlock } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Row = () => (
  <div style={stage}>
    <div style={{ display: 'flex', gap: 40 }}>
      <StatBlock label="ORE STUDIO" value="4.5" unit="h" />
      <StatBlock label="CTF RISOLTI" value={12} />
      <StatBlock label="STREAK" value={7} unit="giorni" />
    </div>
  </div>
);

export const Colored = () => (
  <div style={stage}>
    <div style={{ display: 'flex', gap: 40 }}>
      <StatBlock label="OBIETTIVO" value="92" unit="%" color="#10B981" />
      <StatBlock label="BUDGET" value="-340" unit="€" color="#EF4444" />
      <StatBlock label="POMODORI" value={6} color="#3B82F6" />
    </div>
  </div>
);
