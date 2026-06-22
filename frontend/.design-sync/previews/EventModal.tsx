import { EventModal } from 'giuseppe-dashboard';

// EventModal is a position:fixed overlay. The single-card wrapper is a
// transformed containing block — a full-height spacer lets it center.
const fill: React.CSSProperties = { height: '100vh', background: 'rgb(8 8 10)' };

export const NuovoEvento = () => (
  <>
    <div style={fill} />
    <EventModal
      event={null}
      defaultDate={new Date(2026, 5, 21)}
      onClose={() => {}}
      onSave={() => {}}
    />
  </>
);

export const DettaglioEvento = () => (
  <>
    <div style={fill} />
    <EventModal
      event={{
        id: 'ev-1',
        title: 'Lezione UOC: Sicurezza nelle reti',
        description: 'Modulo su protocolli IPSec e VPN site-to-site.',
        startTime: new Date(2026, 5, 21, 18, 0).toISOString(),
        endTime: new Date(2026, 5, 21, 20, 0).toISOString(),
        location: 'Aula virtuale UOC',
        color: '#8B5CF6',
        calendar: 'manual',
      } as any}
      defaultDate={null}
      onClose={() => {}}
      onSave={() => {}}
    />
  </>
);
