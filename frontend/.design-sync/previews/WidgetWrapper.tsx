import { WidgetWrapper } from 'giuseppe-dashboard';
import { Zap, Target } from 'lucide-react';

const stage: React.CSSProperties = { background: 'rgb(8 8 10)', padding: 28, borderRadius: 16 };

export const Default = () => (
  <div style={stage}>
    <div style={{ width: 360, height: 220 }}>
      <WidgetWrapper
        id="focus"
        title="Focus di oggi"
        icon={<Zap size={16} />}
        onSettings={() => {}}
        onRemove={() => {}}
      >
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-heading text-2xl font-bold">3h 25m</span>
            <span className="text-tertiary text-xs">obiettivo 4h</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-body">Crittografia</span>
              <span className="text-tertiary">5 Pomodoro</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-body">CTF · Active Directory</span>
              <span className="text-tertiary">3 Pomodoro</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-body">Ripasso reti</span>
              <span className="text-tertiary">2 Pomodoro</span>
            </div>
          </div>
        </div>
      </WidgetWrapper>
    </div>
  </div>
);

export const Collapsed = () => (
  <div style={stage}>
    <div style={{ width: 360 }}>
      <WidgetWrapper
        id="habits"
        title="Abitudini settimanali"
        icon={<Target size={16} />}
        defaultCollapsed
        onSettings={() => {}}
        onRemove={() => {}}
      >
        <p className="text-body text-sm">Contenuto nascosto quando collassato.</p>
      </WidgetWrapper>
    </div>
  </div>
);
