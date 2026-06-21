import api from '@/lib/api';
import { getScadenzeAccademiche, type UniEvento } from '@/services/universitaService';

// A non-academic deadline (certifications / CTF) coming from /deadlines.
export interface Deadline {
  id: string;
  title: string;
  description: string | null;
  due_date: string; // ISO date
  category: string; // e.g. 'ctf' | 'certification'
  priority: string; // e.g. 'high' | 'medium' | 'low'
  is_completed: boolean;
}

// Unified item rendered by the Scadenze page (academic + certifications).
export interface ScadenzaItem {
  id: string;
  data: string; // ISO date
  titolo: string;
  sottotitolo: string;
  // 'esame' / 'consegna' (academic) or 'ctf' / 'certification' (deadlines)
  kind: 'esame' | 'consegna' | 'ctf' | 'certification' | 'altro';
  // 'academic' (read-only here, managed in Università) or 'deadline' (editable here).
  source: 'academic' | 'deadline';
  // Original deadline, carried so an edit form can prefill its fields.
  raw?: Deadline;
}

async function getDeadlines(): Promise<Deadline[]> {
  const { data } = await api.get<Deadline[]>('/deadlines');
  return data;
}

// Compose the academic subtitle in the design's format:
//   "Esame · UOC · {aula}"  /  "Consegna · UOC[ · {dettaglio}]"
// The design shows a short dettaglio only for some items; we surface the API
// aula for esami and otherwise keep the canonical "{Tipo} · UOC".
const academicSubtitle = (e: UniEvento): string => {
  const tipo = e.tipo === 'esame' ? 'Esame' : 'Consegna';
  const extra = e.tipo === 'esame' ? e.aula : '';
  return ['Esame', 'Consegna'].includes(tipo) && extra
    ? `${tipo} · UOC · ${extra}`
    : `${tipo} · UOC`;
};

const academicToItem = (e: UniEvento): ScadenzaItem => ({
  id: e.id,
  data: e.data,
  titolo: e.titolo,
  sottotitolo: academicSubtitle(e),
  kind: e.tipo,
  source: 'academic',
});

const deadlineToItem = (d: Deadline): ScadenzaItem => ({
  id: d.id,
  data: d.due_date,
  titolo: d.title,
  sottotitolo: d.description ?? '',
  kind: d.category === 'certification' ? 'certification' : d.category === 'ctf' ? 'ctf' : 'altro',
  source: 'deadline',
  raw: d,
});

// Aggregates academic scadenze (from /university) with certification / CTF
// deadlines (from /deadlines), merged and sorted ascending by date.
export async function getScadenze(): Promise<ScadenzaItem[]> {
  const [academic, deadlines] = await Promise.all([getScadenzeAccademiche(), getDeadlines()]);
  return [...academic.map(academicToItem), ...deadlines.map(deadlineToItem)].sort(
    (a, b) => a.data.localeCompare(b.data),
  );
}

// ── Deadline mutations (only the editable, non-academic items) ──
export interface DeadlineInput {
  title: string;
  description?: string;
  due_date: string;
  category: string;
  priority: string;
}

export async function createDeadline(b: DeadlineInput): Promise<Deadline> {
  const { data } = await api.post('/deadlines', b);
  return data;
}
export async function updateDeadline(id: string, b: Partial<DeadlineInput>): Promise<Deadline> {
  const { data } = await api.put(`/deadlines/${id}`, b);
  return data;
}
export async function deleteDeadline(id: string): Promise<void> {
  await api.delete(`/deadlines/${id}`);
}
