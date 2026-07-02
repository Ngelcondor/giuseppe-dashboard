import api from '@/lib/api';

// ── Types ──
export type Role = 'admin' | 'guest';

// Sezioni concedibili a un ospite — chiavi allineate a core/sections.py.
export const SECTIONS: { key: string; label: string }[] = [
  { key: 'universita', label: 'Università' },
  { key: 'studio', label: 'Studio (CPTS/CTF)' },
  { key: 'calendario', label: 'Calendario' },
  { key: 'finanze', label: 'Finanze e scadenze' },
  { key: 'salute', label: 'Salute (metriche, farmaci, diario)' },
  { key: 'sonno', label: 'Sonno' },
  { key: 'smart_home', label: 'Smart Home' },
  { key: 'feed', label: 'Cyber Feed' },
  { key: 'famiglia', label: 'Famiglia (meteo in Home)' },
];

export interface Me {
  email: string;
  role: Role;
  full_name: string;
  // null = tutte le sezioni (admin o ospite storico)
  sections: string[] | null;
}

export interface UserSummary {
  id: string;
  email: string;
  role: Role;
  full_name: string;
  is_active: boolean;
  sections: string[] | null;
}

// true se l'utente può vedere la sezione (admin/null = tutto).
export function canSee(me: Me | null, section: string): boolean {
  if (!me || me.role === 'admin' || me.sections === null) return true;
  return me.sections.includes(section);
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
  sections: string[];
}): Promise<UserSummary> {
  const { data } = await api.post<UserSummary>('/users', body);
  return data;
}

export async function updateUserSections(id: string, sections: string[]): Promise<UserSummary> {
  const { data } = await api.patch<UserSummary>(`/users/${id}/sections`, { sections });
  return data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}
