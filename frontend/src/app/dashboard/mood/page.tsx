'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

const API = 'http://localhost:8000/api/v1/mood-api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MoodLog {
  id: string;
  mood: number;
  energy: number;
  anxiety: number;
  stimming: number;
  notes: string | null;
  tags: string[];
  logged_at: string;
  log_date: string;
}

interface HistoryPoint {
  date: string;
  mood: number;
  energy: number;
  anxiety: number;
  stimming: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MOOD_EMOJIS    = ['😫', '😕', '😐', '🙂', '😄'];
const ENERGY_EMOJIS  = ['💤', '😴', '😑', '⚡', '🚀'];
const ANXIETY_EMOJIS = ['😌', '🙂', '😐', '😟', '😰'];
const STIMMING_EMOJIS= ['·', '○', '◎', '●', '⬤'];

const MOOD_COLOR    = '#a78bfa';
const ENERGY_COLOR  = '#34d399';
const ANXIETY_COLOR = '#f87171';
const STIMMING_COLOR= '#fb923c';

const AVAILABLE_TAGS = [
  'Farmaci presi', 'Buon sonno', 'Poco sonno', 'Esercizio',
  'Sovraccarico sensoriale', 'Isolamento', 'Socialità',
  'Stress studio', 'Alimentazione irregolare', "Uscita all'aperto",
  'Mal di testa', 'Caffè / energy',
];

// ── Scale picker ──────────────────────────────────────────────────────────────

function ScalePicker({
  label, value, onChange, emojis, color,
}: {
  label: string; value: number; onChange: (v: number) => void;
  emojis: string[]; color: string;
}) {
  return (
    <div>
      <p className="text-[11px] text-slate-600 uppercase tracking-widest mb-2.5">{label}</p>
      <div className="flex gap-2">
        {emojis.map((e, i) => {
          const v = i + 1;
          const active = value === v;
          return (
            <button
              key={v}
              onClick={() => onChange(v)}
              className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all duration-150"
              style={{
                backgroundColor: active ? color + '18' : 'transparent',
                border: `1px solid ${active ? color + '55' : 'rgba(255,255,255,0.05)'}`,
              }}
            >
              <span className={`text-xl leading-none transition-all ${active ? 'scale-110' : 'opacity-35 scale-90'}`}>{e}</span>
              <span className={`text-[10px] tabular-nums transition-colors ${active ? 'text-slate-300' : 'text-slate-700'}`}>{v}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Line chart (SVG, zero deps) ───────────────────────────────────────────────

function LineChart({ data }: { data: HistoryPoint[] }) {
  if (data.length < 2) return null;

  const W = 600; const H = 130;
  const PAD = { t: 12, b: 28, l: 6, r: 6 };
  const Wc = W - PAD.l - PAD.r;
  const Hc = H - PAD.t - PAD.b;

  const series = [
    { key: 'mood'    as const, color: MOOD_COLOR,     label: 'Umore' },
    { key: 'energy'  as const, color: ENERGY_COLOR,   label: 'Energia' },
    { key: 'anxiety' as const, color: ANXIETY_COLOR,  label: 'Ansia' },
    { key: 'stimming'as const, color: STIMMING_COLOR, label: 'Stimming' },
  ];

  const px = (i: number) => PAD.l + (i / (data.length - 1)) * Wc;
  const py = (v: number) => PAD.t + (1 - (v - 1) / 4) * Hc;

  const fmtDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const labelIdxs = [0, Math.floor((data.length - 1) / 2), data.length - 1];

  return (
    <div>
      <div className="flex gap-5 mb-3 flex-wrap">
        {series.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-[11px] text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }}>
        {/* Grid */}
        {[1, 2, 3, 4, 5].map(v => (
          <line key={v} x1={PAD.l} x2={W - PAD.r} y1={py(v)} y2={py(v)}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}
        {/* Lines & dots */}
        {series.map(s => {
          // Split into continuous segments (skip days with 0)
          const segs: string[][] = [[]];
          data.forEach((d, i) => {
            if (d[s.key] > 0) {
              segs[segs.length - 1].push(`${i === 0 || segs[segs.length - 1].length === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(d[s.key]).toFixed(1)}`);
            } else if (segs[segs.length - 1].length > 0) {
              segs.push([]);
            }
          });
          return (
            <g key={s.key}>
              {segs.filter(sg => sg.length > 0).map((sg, si) => (
                <path key={si} d={sg.join(' ')} fill="none"
                  stroke={s.color} strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
              ))}
              {data.map((d, i) => d[s.key] > 0 ? (
                <circle key={i} cx={px(i)} cy={py(d[s.key])} r="2.5"
                  fill={s.color} opacity="0.9" />
              ) : null)}
            </g>
          );
        })}
        {/* X labels */}
        {labelIdxs.map(i => (
          <text key={i} x={px(i)} y={H - 5}
            textAnchor="middle" fontSize="10" fill="rgba(100,116,139,0.7)">
            {fmtDate(data[i].date)}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Log row ───────────────────────────────────────────────────────────────────

function LogRow({ log, onDelete }: { log: MoodLog; onDelete: (id: string) => void }) {
  const time = new Date(log.logged_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4">
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span title="Umore"    className="text-xl">{MOOD_EMOJIS[log.mood - 1]}</span>
          <span title="Energia"  className="text-xl">{ENERGY_EMOJIS[log.energy - 1]}</span>
          <span title="Ansia"    className="text-xl">{ANXIETY_EMOJIS[log.anxiety - 1]}</span>
          {log.stimming > 1 && (
            <span className="text-[11px] font-medium" style={{ color: STIMMING_COLOR }}>
              stimming {log.stimming}/5
            </span>
          )}
        </div>
        {log.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {log.tags.map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full text-[10px] bg-white/[0.04] border border-white/[0.06] text-slate-500">{t}</span>
            ))}
          </div>
        )}
        {log.notes && (
          <p className="text-xs text-slate-500 italic truncate">"{log.notes}"</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        <span className="text-[11px] text-slate-700">{time}</span>
        <button onClick={() => onDelete(log.id)} className="text-slate-700 hover:text-red-500 transition-colors">
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MoodPage() {
  const [logs, setLogs] = useState<MoodLog[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  const [mood, setMood]       = useState(3);
  const [energy, setEnergy]   = useState(3);
  const [anxiety, setAnxiety] = useState(2);
  const [stimming, setStimming] = useState(1);
  const [notes, setNotes]     = useState('');
  const [selTags, setSelTags] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [lr, hr] = await Promise.all([
        fetch(API),
        fetch(`${API}/history?days=14`),
      ]);
      if (lr.ok) setLogs(await lr.json());
      if (hr.ok) setHistory(await hr.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-open form if nothing logged today
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.log_date === todayStr);

  useEffect(() => {
    if (!loading && todayLogs.length === 0) setShowForm(true);
  }, [loading]); // eslint-disable-line

  const toggleTag = (t: string) =>
    setSelTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, energy, anxiety, stimming, notes: notes || null, tags: selTags }),
      });
      if (!res.ok) return;
      const newLog = await res.json();
      setLogs(prev => [newLog, ...prev]);
      setNotes(''); setSelTags([]); setMood(3); setEnergy(3); setAnxiety(2); setStimming(1);
      setShowForm(false);
      const h = await fetch(`${API}/history?days=14`);
      if (h.ok) setHistory(await h.json());
    } finally { setSaving(false); }
  };

  const deleteLog = async (id: string) => {
    setLogs(prev => prev.filter(l => l.id !== id));
    await fetch(`${API}/${id}`, { method: 'DELETE' });
  };

  // Today's averages
  const avg = (key: 'mood' | 'energy' | 'anxiety' | 'stimming') => {
    if (!todayLogs.length) return null;
    const sum = todayLogs.reduce((a, l) => a + l[key], 0);
    return Math.round((sum / todayLogs.length) * 10) / 10;
  };
  const avgMood     = avg('mood');
  const avgEnergy   = avg('energy');
  const avgAnxiety  = avg('anxiety');
  const avgStimming = avg('stimming');

  const hasHistory = history.some(p => p.mood > 0);

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100">

      {/* Header */}
      <header className="px-6 py-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#0f1117]/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-base font-semibold">Umore</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={load} className="p-2 text-slate-600 hover:text-slate-400 rounded-lg hover:bg-white/5 transition-colors">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-slate-300"
          >
            <Plus size={14} />
            {showForm ? 'Annulla' : 'Nuovo log'}
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8 space-y-6">

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
          </div>
        )}

        {/* Today summary */}
        {!loading && todayLogs.length > 0 && !showForm && (
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5">
            <p className="text-[11px] text-slate-600 uppercase tracking-widest mb-4">Oggi · media</p>
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { label: 'Umore',    val: avgMood,     emoji: MOOD_EMOJIS[Math.round((avgMood??3)-1)],         color: MOOD_COLOR },
                { label: 'Energia',  val: avgEnergy,   emoji: ENERGY_EMOJIS[Math.round((avgEnergy??3)-1)],     color: ENERGY_COLOR },
                { label: 'Ansia',    val: avgAnxiety,  emoji: ANXIETY_EMOJIS[Math.round((avgAnxiety??2)-1)],   color: ANXIETY_COLOR },
                { label: 'Stimming', val: avgStimming, emoji: '🌀',                                             color: STIMMING_COLOR },
              ].map(s => (
                <div key={s.label}>
                  <span className="text-2xl">{s.emoji}</span>
                  <p className="text-lg font-semibold mt-1.5 tabular-nums" style={{ color: s.color }}>
                    {s.val?.toFixed(1) ?? '—'}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            {todayLogs.length > 1 && (
              <p className="text-[11px] text-slate-700 mt-3 text-right">{todayLogs.length} log oggi</p>
            )}
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5 space-y-5">
            <p className="text-[11px] text-slate-500 uppercase tracking-widest">Come stai adesso?</p>

            <ScalePicker label="Umore"    value={mood}     onChange={setMood}     emojis={MOOD_EMOJIS}    color={MOOD_COLOR} />
            <ScalePicker label="Energia"  value={energy}   onChange={setEnergy}   emojis={ENERGY_EMOJIS}  color={ENERGY_COLOR} />
            <ScalePicker label="Ansia"    value={anxiety}  onChange={setAnxiety}  emojis={ANXIETY_EMOJIS} color={ANXIETY_COLOR} />
            <ScalePicker label="Stimming" value={stimming} onChange={setStimming} emojis={STIMMING_EMOJIS} color={STIMMING_COLOR} />

            <div>
              <p className="text-[11px] text-slate-600 uppercase tracking-widest mb-2.5">Fattori</p>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_TAGS.map(t => {
                  const active = selTags.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className="px-2.5 py-1 rounded-full text-[11px] transition-all duration-150"
                      style={{
                        backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}`,
                        color: active ? '#e2e8f0' : '#475569',
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[11px] text-slate-600 uppercase tracking-widest mb-2">Note</p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Cosa è successo oggi? (opzionale)"
                rows={2}
                className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder-slate-700 text-slate-300 focus:outline-none focus:border-white/20 transition-colors resize-none"
              />
            </div>

            <button
              onClick={submit}
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-medium transition-colors disabled:opacity-40"
            >
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        )}

        {/* History chart */}
        {!loading && hasHistory && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4"
            >
              <p className="text-[11px] text-slate-500 uppercase tracking-widest">Ultimi 14 giorni</p>
              {showHistory
                ? <ChevronUp size={14} className="text-slate-600" />
                : <ChevronDown size={14} className="text-slate-600" />}
            </button>
            {showHistory && (
              <div className="px-5 pb-5 border-t border-white/5 pt-4">
                <LineChart data={history} />
              </div>
            )}
          </div>
        )}

        {/* Log list */}
        {!loading && logs.length > 0 && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <p className="text-[11px] text-slate-500 uppercase tracking-widest">Log recenti</p>
            </div>
            <div className="divide-y divide-white/5">
              {logs.slice(0, 20).map(l => (
                <LogRow key={l.id} log={l} onDelete={deleteLog} />
              ))}
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && logs.length === 0 && !showForm && (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm mb-3">Nessun log registrato.</p>
          </div>
        )}

      </main>
    </div>
  );
}
