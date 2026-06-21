import { ConnectionSetup } from 'giuseppe-dashboard';

// ConnectionSetup is a position:fixed overlay. The single-card wrapper is a
// transformed containing block — a full-height spacer lets it center.
const fill: React.CSSProperties = { height: '100vh', background: 'rgb(8 8 10)' };

export const ConCalendari = () => (
  <>
    <div style={fill} />
    <ConnectionSetup
      connections={[
        {
          id: 'conn-1',
          user_id: 'u-1',
          provider: 'apple',
          display_name: 'Calendario iCloud',
          caldav_url: 'https://caldav.icloud.com',
          username: 'giuseppe.diana@icloud.com',
          is_active: true,
          last_sync_at: new Date(2026, 5, 21, 8, 30).toISOString(),
          last_sync_status: 'success',
          sync_interval_minutes: '30',
          created_at: new Date(2026, 4, 1).toISOString(),
          updated_at: new Date(2026, 5, 21).toISOString(),
        },
        {
          id: 'conn-2',
          user_id: 'u-1',
          provider: 'google',
          display_name: 'Google Calendar UOC',
          caldav_url: 'https://apidata.googleusercontent.com/caldav/v2',
          username: 'giuseppe.diana@gmail.com',
          is_active: true,
          last_sync_at: new Date(2026, 5, 21, 8, 15).toISOString(),
          last_sync_status: 'error',
          sync_interval_minutes: '60',
          created_at: new Date(2026, 4, 10).toISOString(),
          updated_at: new Date(2026, 5, 21).toISOString(),
        },
      ]}
      onClose={() => {}}
      onSave={() => {}}
    />
  </>
);

export const NuovaConnessione = () => (
  <>
    <div style={fill} />
    <ConnectionSetup connections={[]} onClose={() => {}} onSave={() => {}} />
  </>
);
