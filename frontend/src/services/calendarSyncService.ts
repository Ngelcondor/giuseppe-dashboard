import api from '@/lib/api';

// Google Calendar integration (honest status). Routes under /calendar/sync to
// avoid colliding with local events (/calendar/events) and CalDAV
// (/calendar/connections). OAuth fetch is not implemented yet — the backend
// returns an explicit not-connected / pending state, never fabricated events.

export interface CalendarSyncStatus {
  provider: 'google_calendar';
  connected: boolean;
  status: 'connected' | 'not_connected';
  detail: string | null;
}

export interface CalendarSyncEvent {
  id: string;
  title: string;
  start: string; // ISO datetime
  end: string; // ISO datetime
  location?: string | null;
}

export interface CalendarSyncEventsResponse {
  connected: boolean;
  status: 'connected' | 'not_connected' | 'pending_oauth';
  events: CalendarSyncEvent[];
  detail: string | null;
}

export async function getCalendarSyncStatus(): Promise<CalendarSyncStatus> {
  const { data } = await api.get<CalendarSyncStatus>('/calendar/sync/status');
  return data;
}

export async function getCalendarSyncEvents(): Promise<CalendarSyncEventsResponse> {
  const { data } = await api.get<CalendarSyncEventsResponse>('/calendar/sync/events');
  return data;
}
