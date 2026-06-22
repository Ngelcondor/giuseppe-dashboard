import { Progress } from 'giuseppe-dashboard';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };
const column: React.CSSProperties = { ...stage, display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 380 };

export const Labeled = () => (
  <div style={column}>
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-tertiary text-xs">Crittografia · Cap. 4</span>
        <span className="text-tertiary text-xs">72%</span>
      </div>
      <Progress value={72} />
    </div>
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-tertiary text-xs">Reti · Modulo 2</span>
        <span className="text-tertiary text-xs">40%</span>
      </div>
      <Progress value={40} color="#10B981" />
    </div>
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-tertiary text-xs">Budget mensile</span>
        <span className="text-tertiary text-xs">91%</span>
      </div>
      <Progress value={91} color="#F59E0B" />
    </div>
  </div>
);

export const Heights = () => (
  <div style={column}>
    <div>
      <span className="text-tertiary text-xs mb-2 block">height="sm"</span>
      <Progress value={60} height="sm" />
    </div>
    <div>
      <span className="text-tertiary text-xs mb-2 block">height="md"</span>
      <Progress value={60} height="md" />
    </div>
  </div>
);
