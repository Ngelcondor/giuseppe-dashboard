import api from '@/lib/api';

// ── Types ──
export type Role = 'admin' | 'guest';

export interface Me {
  email: string;
  role: Role;
  full_name: string;
}

export interface UserSummary {
  id: string;
  email: string;
  role: Role;
  full_name: string;
  is_active: boolean;
}

// Settings store: { key: value, ... } where each value is an opaque JSON dict.
export type SettingsMap = Record<string, Record<string, unknown>>;

// ── Identity ──
export async function getMe(): Promise<Me> {
  const { data } = await api.get<Me>('/auth/me');
  return data;
}

// ── Integration config store ──
export async function getSettings(): Promise<SettingsMap> {
  const { data } = await api.get<SettingsMap>('/settings');
  return data;
}

export async function updateSetting(
  key: string,
  value: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data } = await api.put<Record<string, Record<string, unknown>>>(
    `/settings/${key}`,
    { value },
  );
  return data[key];
}

// ── Accounts (admin only) ──
export async function listUsers(): Promise<UserSummary[]> {
  const { data } = await api.get<UserSummary[]>('/users');
  return data;
}

export async function createGuest(body: {
  email: string;
  password: string;
  full_name: string;
}): Promise<UserSummary> {
  const { data } = await api.post<UserSummary>('/users', body);
  return data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}
