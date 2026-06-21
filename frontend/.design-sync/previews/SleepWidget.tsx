import { SleepWidget } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16, maxWidth: 440 };

export const Predefinito = () => (
  <div style={stage}>
    <SleepWidget />
  </div>
);
