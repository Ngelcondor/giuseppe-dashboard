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
});

const deadlineToItem = (d: Deadline): ScadenzaItem => ({
  id: d.id,
  data: d.due_date,
  titolo: d.title,
  sottotitolo: d.description ?? '',
  kind: d.category === 'certification' ? 'certification' : d.category === 'ctf' ? 'ctf' : 'altro',
});

// Aggregates academic scadenze (from /university) with certification / CTF
// deadlines (from /deadlines), merged and sorted ascending by date.
export async function getScadenze(): Promise<ScadenzaItem[]> {
  const [academic, deadlines] = await Promise.all([getScadenzeAccademiche(), getDeadlines()]);
  return [...academic.map(academicToItem), ...deadlines.map(deadlineToItem)].sort(
    (a, b) => a.data.localeCompare(b.data),
  );
}
