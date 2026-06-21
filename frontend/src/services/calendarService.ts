import api from '@/lib/api';
import { CalendarEvent } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalDAVCalendarInfo {
  calendar_id: string;
  name: string;
  color?: string;
  description?: string;
}

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  display_name: string;
  caldav_url: string;
  username: string;
  is_active: boolean;
  last_sync_at?: string;
  last_sync_status?: string;
  last_sync_error?: string;
  sync_interval_minutes: string;
  calendars_filter?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateConnectionPayload {
  provider: string;
  display_name: string;
  caldav_url?: string;
  username: string;
  app_password: string;
  sync_interval_minutes?: string;
}

export interface SyncResult {
  success: boolean;
  events_synced: number;
  events_created: number;
  events_updated: number;
  events_deleted: number;
  error?: string;
  sync_range?: { start: string; end: string };
}

export interface ConnectionTestResult {
  success: boolean;
  calendars_count?: number;
  calendars?: CalDAVCalendarInfo[];
  error?: string;
  message?: string;
}

// ─── Events API ─────────────────────────────────────────────────────────────

// Raw event shape as returned by the backend (camelCase via response_model_by_alias).
export interface CalendarEventDTO {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  location?: string | null;
  color: string;
  isAllDay?: boolean;
  source?: string | null;
  calendarName?: string | null;
}

export const calendarEvents = {
  list: async (): Promise<CalendarEventDTO[]> => {
    const { data } = await api.get('/calendar/events');
    return data;
  },

  getUpcoming: async () => {
    const { data } = await api.get('/calendar/upcoming');
    return data;
  },

  create: async (event: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const { data } = await api.post('/calendar/events', event);
    return data;
  },

  update: async (id: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const { data } = await api.put(`/calendar/events/${id}`, event);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/calendar/events/${id}`);
  },
};

// ─── Connections API ────────────────────────────────────────────────────────

export const calendarConnections = {
  list: async (): Promise<CalendarConnection[]> => {
    const { data } = await api.get('/calendar/connections');
    return data;
  },

  create: async (payload: CreateConnectionPayload): Promise<CalendarConnection> => {
    const { data } = await api.post('/calendar/connections', payload);
    return data;
  },

  get: async (id: string): Promise<CalendarConnection> => {
    const { data } = await api.get(`/calendar/connections/${id}`);
    return data;
  },

  update: async (id: string, payload: Partial<CalendarConnection>): Promise<CalendarConnection> => {
    const { data } = await api.patch(`/calendar/connections/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/calendar/connections/${id}`);
  },

  test: async (id: string): Promise<ConnectionTestResult> => {
    const { data } = await api.post(`/calendar/connections/${id}/test`);
    return data;
  },

  listRemoteCalendars: async (id: string): Promise<CalDAVCalendarInfo[]> => {
    const { data } = await api.get(`/calendar/connections/${id}/calendars`);
    return data;
  },

  sync: async (id: string, options?: {
    calendar_ids?: string[];
    days_back?: number;
    days_forward?: number;
  }): Promise<SyncResult> => {
    const { data } = await api.post(`/calendar/connections/${id}/sync`, options || {});
    return data;
  },
};
