import { CircularProgress } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Sizes = () => (
  <div style={stage}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <CircularProgress value={68} size="sm" />
      <CircularProgress value={68} size="md" />
      <CircularProgress value={68} size="lg" />
    </div>
  </div>
);

export const Variants = () => (
  <div style={stage}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <CircularProgress value={82} size="md" variant="primary" />
      <CircularProgress value={100} size="md" variant="success" />
      <CircularProgress value={54} size="md" variant="warning" />
      <CircularProgress value={19} size="md" variant="danger" />
    </div>
  </div>
);
