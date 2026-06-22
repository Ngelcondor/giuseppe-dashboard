import { Skeleton } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };
const panel: React.CSSProperties = { background: 'rgb(64 64 72)', padding: 20, borderRadius: 12 };

export const Lines = () => (
  <div style={{ ...stage, maxWidth: 380 }}>
    <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-64" count={2} />
      <Skeleton className="h-4 w-32" />
    </div>
  </div>
);

export const CardPlaceholder = () => (
  <div style={{ ...stage, maxWidth: 380 }}>
    <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" count={2} />
    </div>
  </div>
);
