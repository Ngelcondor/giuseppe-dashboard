'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, X, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '@/lib/constants';

type Tipo = 'Uscita' | 'Entrata' | 'Abbonamento' | 'Rata' | 'Ricorrente';

interface Scadenza {
  id: string;
  desc: string;
  mese: string;
  scadenza_gg_mm: string;
  importo: number;
  tipo: Tipo;
  note: string;
  pagato: boolean;
}

const API = `${API_BASE_URL}/scadenze`;
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const MESI_NUM: Record<string,number> = {Gennaio:1,Febbraio:2,Marzo:3,Aprile:4,Maggio:5,Giugno:6,Luglio:7,Agosto:8,Settembre:9,Ottobre:10,Novembre:11,Dicembre:12};

const TIPO_DOT: Record<string, string> = {
  Uscita: '#f87171', Entrata: '#4ade80', Abbonamento: '#60a5fa',
  Rata: '#fb923c', Ricorrente: '#a78bfa',
};

function parseDay(sc: string): number { return parseInt(sc.split('/')[0]) || 0; }
function getMeseNome(d: Date): string { return MESI[d.getMonth()]; }
function fmtEur(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2).replace('.', ',') + ' €';
}

export default function DeadlinesPage() {
  const [data, setData] = useState<Scadenza[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'oggi' | 'mese' | 'aggiungi'>('oggi');
  const [selectedMese, setSelectedMese] = useState('');
  const [form, setForm] = useState({ desc: '', importo: '', tipo: 'Uscita' as Tipo, mese: '', scadenza_gg_mm: '', note: '' });
  const [msg, setMsg] = useState('');

  const fetchData = useCallback(async () => {
    try { setLoading(true); setError('');
      const res = await fetch(API);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch { setError('Backend non raggiungibile.'); } finally { setLoading(false); }
  }, []);

  const seedData = async () => {
    try { await fetch(`${API}/seed`, { method: 'POST' }); await fetchData(); } catch { setError('Errore seed.'); }
  };

  useEffect(() => {
    const now = new Date();
    setSelectedMese(getMeseNome(now));
    setForm(f => ({ ...f, mese: getMeseNome(now) }));
    fetchData();
  }, [fetchData]);

  const togglePagato = async (id: string, current: boolean) => {
    setData(prev => prev.map(x => x.id === id ? { ...x, pagato: !current } : x));
    try {
      await fetch(`${API}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pagato: !current }) });
    } catch { setData(prev => prev.map(x => x.id === id ? { ...x, pagato: current } : x)); }
  };

  const elimina = async (id: string) => {
    setData(prev => prev.filter(x => x.id !== id));
    try { await fetch(`${API}/${id}`, { method: 'DELETE' }); } catch { await fetchData(); }
  };

  const aggiungi = async () => {
    const importo = parseFloat(form.importo.replace(',', '.'));
    if (!form.desc || isNaN(importo) || !form.scadenza_gg_mm) { setMsg('Compila tutti i campi obbligatori'); return; }
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desc: form.desc, mese: form.mese, scadenza_gg_mm: form.scadenza_gg_mm, importo, tipo: form.tipo, note: form.note }) });
      if (!res.ok) throw new Error();
      const newItem = await res.json();
      setData(prev => [...prev, newItem]);
      setForm(f => ({ ...f, desc: '', importo: '', scadenza_gg_mm: '', note: '' }));
      setMsg('Aggiunto'); setTimeout(() => setMsg(''), 2000);
    } catch { setMsg('Errore salvataggio'); }
  };

  const now = new Date();
  const today = now.getDate();
  const todayMon = now.getMonth() + 1;
  const meseNome = getMeseNome(now);

  const todayItems = data.filter(x => parseDay(x.scadenza_gg_mm) === today && (MESI_NUM[x.mese] || 0) === todayMon);
  const upcoming = data
    .filter(x => { const d = new Date(2026, (MESI_NUM[x.mese]||1)-1, parseDay(x.scadenza_gg_mm)); const diff = (d.getTime()-now.getTime())/86400000; return diff > 0 && diff <= 7 && !x.pagato && x.importo < 0; })
    .sort((a,b) => (MESI_NUM[a.mese]*100+parseDay(a.scadenza_gg_mm))-(MESI_NUM[b.mese]*100+parseDay(b.scadenza_gg_mm)));
  const meseItems = data.filter(x => x.mese === selectedMese).sort((a,b) => parseDay(a.scadenza_gg_mm)-parseDay(b.scadenza_gg_mm));

  const calcStats = (items: Scadenza[]) => ({
    uscite: items.filter(x => x.importo < 0).reduce((a,x) => a+x.importo, 0),
    entrate: items.filter(x => x.importo > 0).reduce((a,x) => a+x.importo, 0),
    saldo: items.reduce((a,x) => a+x.importo, 0),
    dapagare: items.filter(x => x.importo < 0 && !x.pagato).reduce((a,x) => a+x.importo, 0),
  });

  // ── Sub-components ──────────────────────────────────────────────────────────
  const ItemRow = ({ x, showDelete = false }: { x: Scadenza; showDelete?: boolean }) => (
    <div className={`flex items-center justify-between px-4 py-3.5 transition-all ${x.pagato ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-3.5 min-w-0">
        {x.importo < 0 ? (
          <button onClick={() => togglePagato(x.id, x.pagato)} className="shrink-0 transition-all">
            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${x.pagato ? 'border-emerald-500 bg-emerald-500' : 'border-white/15 hover:border-white/30'}`}>
              {x.pagato && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4l2 2 3-3" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </button>
        ) : (
          <div className="w-4 shrink-0" />
        )}
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TIPO_DOT[x.tipo] }} />
        <div className="min-w-0">
          <p className={`text-sm truncate ${x.pagato ? 'line-through text-muted' : 'text-heading'}`}>{x.desc}</p>
          <p className="text-[11px] text-muted mt-0.5">{x.tipo} · {x.scadenza_gg_mm}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-3">
        <span className={`text-sm font-medium tabular-nums ${x.importo < 0 ? 'text-red-400' : 'text-emerald-400'} ${x.pagato ? 'opacity-50' : ''}`}>
          {fmtEur(x.importo)}
        </span>
        {showDelete && (
          <button onClick={() => elimina(x.id)} className="text-muted hover:text-red-500 transition-colors">
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );

  const StatsRow = ({ items }: { items: Scadenza[] }) => {
    const s = calcStats(items);
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Uscite', value: Math.abs(s.uscite).toFixed(2).replace('.', ',') + ' €', color: '#f87171' },
          { label: 'Entrate', value: s.entrate.toFixed(2).replace('.', ',') + ' €', color: '#4ade80' },
          { label: 'Saldo', value: fmtEur(s.saldo), color: s.saldo >= 0 ? '#4ade80' : '#f87171' },
          { label: 'Da pagare', value: Math.abs(s.dapagare).toFixed(2).replace('.', ',') + ' €', color: '#fbbf24' },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-4 rounded-xl bg-card border border-border-default">
            <p className="text-[11px] text-muted mb-1">{label}</p>
            <p className="text-base font-semibold tabular-nums" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>
    );
  };

  const Section = ({ title, items, del = false }: { title: string; items: Scadenza[]; del?: boolean }) => (
    <div>
      <p className="text-xs font-medium text-body uppercase tracking-widest mb-3">{title}</p>
      {items.length === 0
        ? <p className="text-xs text-muted py-4 text-center">Nessuna voce</p>
        : (
          <div className="rounded-2xl bg-card border border-border-default divide-y divide-border-default overflow-hidden">
            {items.map(x => <ItemRow key={x.id} x={x} showDelete={del} />)}
          </div>
        )}
    </div>
  );

  return (
    <div className="min-h-screen bg-page text-heading">

      {/* Header */}
      <header className="sticky top-0 z-30 px-6 py-4 border-b border-border-default bg-page/85 backdrop-blur-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center justify-center w-8 h-8 rounded-lg border border-border-default text-tertiary hover:text-heading hover:border-border-hover transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div>
              <p className="section-label leading-none mb-0.5">Time-sensitive</p>
              <h1 className="text-[15px] font-semibold tracking-tight">Scadenze</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={fetchData} className="p-2 text-tertiary hover:text-body transition-colors rounded-lg hover:bg-card-inner">
              <RefreshCw size={14} />
            </button>
            <div className="flex gap-0.5 p-1 rounded-xl bg-card-inner border border-border-default">
              {(['oggi', 'mese', 'aggiungi'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === v ? 'bg-surface-hover text-heading' : 'text-tertiary hover:text-body'}`}>
                  {v === 'oggi' ? 'Oggi' : v === 'mese' ? 'Mese' : <span className="flex items-center gap-1"><Plus size={11} />Nuova</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Error */}
        {error && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-sm">
            <span>{error}</span>
            <button onClick={seedData} className="ml-4 text-xs px-3 py-1.5 rounded-lg bg-card hover:bg-surface-hover text-heading whitespace-nowrap">
              Importa dati
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-card border-t-heading rounded-full animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && !error && data.length === 0 && (
          <div className="text-center py-16">
            <p className="text-tertiary text-sm mb-5">Nessun dato nel database.</p>
            <button onClick={seedData} className="px-4 py-2 rounded-xl text-sm bg-card hover:bg-surface-hover text-heading border border-border-default">
              Importa Budget 2026
            </button>
          </div>
        )}

        {/* Views */}
        {!loading && data.length > 0 && (
          <>
            {/* OGGI */}
            {view === 'oggi' && (
              <>
                <StatsRow items={data.filter(x => x.mese === meseNome)} />
                <Section
                  title={`Oggi · ${String(today).padStart(2,'0')}/${String(todayMon).padStart(2,'0')}`}
                  items={todayItems} del
                />
                {upcoming.length > 0 && (
                  <Section title="Prossimi 7 giorni" items={upcoming} />
                )}
              </>
            )}

            {/* MESE */}
            {view === 'mese' && (
              <>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { const i = MESI.indexOf(selectedMese); if (i > 0) setSelectedMese(MESI[i-1]); }}
                    disabled={MESI.indexOf(selectedMese) === 0}
                    className="p-2 text-tertiary hover:text-body disabled:opacity-20 transition-colors rounded-lg hover:bg-card"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <p className="text-sm font-semibold">{selectedMese} 2026</p>
                  <button
                    onClick={() => { const i = MESI.indexOf(selectedMese); if (i < MESI.length-1) setSelectedMese(MESI[i+1]); }}
                    disabled={MESI.indexOf(selectedMese) === MESI.length-1}
                    className="p-2 text-tertiary hover:text-body disabled:opacity-20 transition-colors rounded-lg hover:bg-card"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <StatsRow items={meseItems} />
                <Section title={selectedMese} items={meseItems} del />
              </>
            )}

            {/* AGGIUNGI */}
            {view === 'aggiungi' && (
              <div className="rounded-2xl bg-card border border-border-default p-6 max-w-md mx-auto">
                <p className="text-xs font-medium text-tertiary uppercase tracking-widest mb-5">Nuova scadenza</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] text-muted mb-1.5 block uppercase tracking-widest">Descrizione</label>
                    <input value={form.desc} onChange={e => setForm(f => ({...f, desc: e.target.value}))} placeholder="es. Netflix"
                      className="w-full bg-transparent border border-border-hover rounded-xl px-4 py-2.5 text-sm placeholder-muted focus:outline-none focus:border-border-hover transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-muted mb-1.5 block uppercase tracking-widest">Importo (€)</label>
                      <input value={form.importo} onChange={e => setForm(f => ({...f, importo: e.target.value}))} placeholder="-9.99"
                        className="w-full bg-transparent border border-border-hover rounded-xl px-4 py-2.5 text-sm placeholder-muted focus:outline-none focus:border-border-hover transition-colors" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted mb-1.5 block uppercase tracking-widest">Giorno/Mese</label>
                      <input value={form.scadenza_gg_mm} onChange={e => setForm(f => ({...f, scadenza_gg_mm: e.target.value}))} placeholder="01/04"
                        className="w-full bg-transparent border border-border-hover rounded-xl px-4 py-2.5 text-sm placeholder-muted focus:outline-none focus:border-border-hover transition-colors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-muted mb-1.5 block uppercase tracking-widest">Tipo</label>
                      <select value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value as Tipo}))}
                        className="w-full bg-input border border-border-hover rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-border-hover transition-colors text-heading">
                        {['Uscita','Entrata','Abbonamento','Rata','Ricorrente'].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted mb-1.5 block uppercase tracking-widest">Mese</label>
                      <select value={form.mese} onChange={e => setForm(f => ({...f, mese: e.target.value}))}
                        className="w-full bg-input border border-border-hover rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-border-hover transition-colors text-heading">
                        {MESI.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={aggiungi}
                    className="w-full py-2.5 rounded-xl bg-card hover:bg-surface-hover border border-border-hover text-heading text-sm font-medium transition-colors mt-2">
                    Aggiungi
                  </button>
                  {msg && <p className="text-center text-xs text-emerald-400">{msg}</p>}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
