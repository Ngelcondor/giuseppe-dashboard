import { SkeletonBlock } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };
const panel: React.CSSProperties = { background: 'rgb(64 64 72)', padding: 20, borderRadius: 12 };

export const ThreeLines = () => (
  <div style={{ ...stage, maxWidth: 380 }}>
    <div style={panel}>
      <SkeletonBlock lines={3} />
    </div>
  </div>
);

export const Paragraph = () => (
  <div style={{ ...stage, maxWidth: 380 }}>
    <div style={panel}>
      <SkeletonBlock lines={5} />
    </div>
  </div>
);
