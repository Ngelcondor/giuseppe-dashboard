import { CompactWidget, Button } from 'giuseppe-dashboard';
import { TrendingUp, Heart } from 'lucide-react';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Default = () => (
  <div style={stage}>
    <div style={{ width: 320, height: 180 }}>
      <CompactWidget
        title="Budget del mese"
        icon={<TrendingUp size={16} />}
        action={<Button variant="ghost" size="sm">Dettagli</Button>}
      >
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-heading text-2xl font-bold">€ 642</span>
            <span className="text-tertiary text-xs">su € 900</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-body">Affitto Barcellona</span>
            <span className="text-tertiary">€ 420</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-body">Spesa</span>
            <span className="text-tertiary">€ 222</span>
          </div>
        </div>
      </CompactWidget>
    </div>
  </div>
);

export const Health = () => (
  <div style={stage}>
    <div style={{ width: 320, height: 180 }}>
      <CompactWidget title="Salute" icon={<Heart size={16} />}>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-body">Passi</span>
            <span className="text-heading font-medium">8.240</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-body">Sonno</span>
            <span className="text-heading font-medium">7h 10m</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-body">Idratazione</span>
            <span className="text-heading font-medium">1,8 L</span>
          </div>
        </div>
      </CompactWidget>
    </div>
  </div>
);
