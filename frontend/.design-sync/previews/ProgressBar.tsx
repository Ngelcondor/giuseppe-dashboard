import { ProgressBar } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };
const column: React.CSSProperties = { ...stage, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 380 };

export const Variants = () => (
  <div style={column}>
    <ProgressBar value={72} variant="primary" />
    <ProgressBar value={100} variant="success" />
    <ProgressBar value={58} variant="warning" />
    <ProgressBar value={23} variant="danger" />
  </div>
);

export const Values = () => (
  <div style={column}>
    <ProgressBar value={15} variant="primary" />
    <ProgressBar value={45} variant="primary" />
    <ProgressBar value={88} variant="primary" />
  </div>
);

export const NoLabel = () => (
  <div style={column}>
    <ProgressBar value={64} variant="success" showLabel={false} />
  </div>
);
