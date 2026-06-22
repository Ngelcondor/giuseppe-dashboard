import { StatusBadge } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Stati = () => (
  <div style={{ ...stage, display: 'flex', flexWrap: 'wrap', gap: 10, maxWidth: 380 }}>
    <StatusBadge status="active" />
    <StatusBadge status="inactive" />
    <StatusBadge status="pending" />
    <StatusBadge status="completed" />
    <StatusBadge status="overdue" />
  </div>
);

export const EtichetteCustom = () => (
  <div style={{ ...stage, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380 }}>
    <div className="flex items-center justify-between">
      <span className="text-body text-sm">Lab HTB — Forest</span>
      <StatusBadge status="active">In esecuzione</StatusBadge>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-body text-sm">Consegna progetto UOC</span>
      <StatusBadge status="overdue">In ritardo</StatusBadge>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-body text-sm">Revisione appunti</span>
      <StatusBadge status="pending">Da fare</StatusBadge>
    </div>
  </div>
);
