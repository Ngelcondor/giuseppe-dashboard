import api from '@/lib/api';

export interface UniProfilo {
  corso_laurea: string;
  semestre: string;
  cfu_totali: number;
  cfu_superati: number;
  cfu_in_corso: number;
}
export interface UniCorso {
  id: string;
  codice: string;
  nome: string;
  cfu: number;
  docente: string;
  semestre: string;
  progress: number;
  stato: 'in_corso' | 'in_esame' | 'consegna' | 'completato';
  prossimo: string;
  ordine: number;
}
export interface UniEvento {
  id: string;
  tipo: 'esame' | 'consegna';
  corso: string;
  titolo: string;
  descrizione: string;
  data: string; // ISO date
  ora: string;
  aula: string;
  cfu: number | null;
  stato: 'da_fare' | 'in_corso' | 'fatto';
}
export interface UniDashboard {
  profilo: UniProfilo;
  corsi: UniCorso[];
  prossimo_esame: UniEvento | null;
  consegne: UniEvento[];
}

export async function getUniversitaDashboard(): Promise<UniDashboard> {
  const { data } = await api.get<UniDashboard>('/university/dashboard');
  return data;
}

export async function getScadenzeAccademiche(): Promise<UniEvento[]> {
  const { data } = await api.get<UniEvento[]>('/university/scadenze');
  return data;
}
