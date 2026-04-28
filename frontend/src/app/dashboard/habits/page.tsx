'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Flame, Plus, X, RefreshCw, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE_URL } from '@/lib/constants';

const API = `${API_BASE_URL}/habits-api`;

interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  done_today: boolean;
  current_streak: number;
  longest_streak: number;
}

interface HeatmapDay {
  date: string;
  done: boolean;
}

const EMOJI_OPTIONS = ['💊','💧','☀️','🍎','🏃','🔐','🧘','🌿','😴','✍️','🎯','📚','🏋️','🧠','💻','🎨','🎸','🌊','🧩','🫧'];
const COLOR_OPTIONS = ['#10B981','#F59E0B','#8B5CF6','#3B82F6','#EC4899','#EF4444','#14B8A6','#F97316','#6366F1','#84CC16'];

// ── Progress ring ─────────────────────────────────────────────────────────────
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const complete = pct === 1 && total > 0;
  const color = complete ? '#10B981' : '#F59E0B';

  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} stroke="#1e293b" strokeWidth="4" fill="none" />
        <circle
          cx="32" cy="32" r={r}
          stroke={color} strokeWidth="4" fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="absolute text-sm font-semibold" style={{ color }}>
        {done}/{total}
      </span>
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function Heatmap({ habitId, color }: { habitId: string; color: string }) {
  const [days, setDays] = useState<HeatmapDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/${habitId}/heatmap?days=365`)
      .then(r => r.json())
      .then(d => { setDays(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [habitId]);

  if (loading) return <div className="h-12 rounded-lg bg-card-solid animate-pulse" />;
  if (!days.length) return null;

  const weeks: HeatmapDay[][] = [];
  let week: HeatmapDay[] = [];
  const firstDow = new Date(days[0].date).getDay();
  for (let i = 0; i < firstDow; i++) week.push({ date: '', done: false });
  for (const d of days) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) weeks.push(week);

  const doneCount = days.filter(d => d.done).length;

  return (
    <div className="mt-3">
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {w.map((d, di) => (
              <div
                key={di}
                title={d.date || ''}
                className="w-[10px] h-[10px] rounded-[2px]"
                style={{
                  backgroundColor: d.date
                    ? d.done ? color : '#1e293b'
                    : 'transparent',
                  opacity: d.date ? 1 : 0,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted mt-2">{doneCount} completamenti negli ultimi 365 giorni</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', icon: '⭐', color: '#10B981' });
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchHabits = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(API);
      if (!res.ok) throw new Error();
      setHabits(await res.json());
    } catch {
      setError('Backend non raggiungibile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  const seed = async () => {
    await fetch(`${API}/seed`, { method: 'POST' });
    await fetchHabits();
  };

  const toggle = async (id: string) => {
    if (!id || id === 'undefined') return;
    setToggling(id);
    try {
      const res = await fetch(`${API}/${id}/toggle`, { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      setHabits(prev => prev.map(h =>
        h.id === id ? { ...h, done_today: data.done, current_streak: data.current_streak, longest_streak: data.longest_streak } : h
      ));
    } catch {}
    setToggling(null);
  };

  const addHabit = async () => {
    if (!form.name.trim()) return;
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const newH = await res.json();
      setHabits(prev => [...prev, newH]);
      setForm({ name: '', icon: '⭐', color: '#10B981' });
      setShowAdd(false);
    } catch {}
  };

  const deleteHabit = async (id: string) => {
    if (!id || id === 'undefined') return;
    setHabits(prev => prev.filter(h => h.id !== id));
    await fetch(`${API}/${id}`, { method: 'DELETE' });
  };

  const todayDone = habits.filter(h => h.done_today).length;
  const todayTotal = habits.length;

  return (
    <div className="min-h-screen bg-page text-heading">

      {/* Header */}
      <header className="sticky top-0 z-30 px-6 py-4 border-b border-border-default bg-page/85 backdrop-blur-md">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center justify-center w-8 h-8 rounded-lg border border-border-default text-tertiary hover:text-heading hover:border-border-hover transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div>
              <p className="section-label leading-none mb-0.5">Daily ritual</p>
              <h1 className="text-[15px] font-semibold tracking-tight">Abitudini</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchHabits}
              className="p-2 text-tertiary hover:text-body transition-colors rounded-lg hover:bg-card-inner"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setShowAdd(v => !v)}
              className="chip hover:border-border-hover hover:bg-surface-hover"
            >
              <Plus size={12} />
              {showAdd ? 'Annulla' : 'Aggiungi'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8 space-y-5">

        {/* Error */}
        {error && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-sm">
            <span>{error}</span>
            <button
              onClick={seed}
              className="ml-4 text-xs px-3 py-1.5 rounded-lg bg-card hover:bg-surface-hover text-body transition-colors whitespace-nowrap"
            >
              Carica default
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-border-default border-t-slate-400 rounded-full animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && !error && habits.length === 0 && (
          <div className="text-center py-16">
            <p className="text-tertiary text-sm mb-5">Nessuna abitudine configurata.</p>
            <button
              onClick={seed}
              className="px-4 py-2 rounded-xl text-sm bg-card hover:bg-surface-hover text-body border border-border-hover transition-colors"
            >
              Carica abitudini di default
            </button>
          </div>
        )}

        {/* Summary */}
        {!loading && habits.length > 0 && (
          <div className="flex items-center gap-6 p-5 rounded-2xl bg-card border border-border-default">
            <ProgressRing done={todayDone} total={todayTotal} />
            <div>
              <p className="text-sm font-medium text-heading">
                {todayDone === todayTotal && todayTotal > 0
                  ? 'Tutto completato 🎉'
                  : `${todayTotal - todayDone} rimaste oggi`}
              </p>
              <p className="text-xs text-tertiary mt-0.5">
                {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <div className="p-5 rounded-2xl bg-card border border-border-default space-y-4">
            <p className="text-xs font-medium text-body uppercase tracking-widest">Nuova abitudine</p>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome..."
              className="w-full bg-transparent border border-border-hover rounded-xl px-4 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-white/25 transition-colors"
            />
            <div>
              <p className="text-[11px] text-muted mb-2 uppercase tracking-widest">Icona</p>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_OPTIONS.map(e => (
                  <button
                    key={e}
                    onClick={() => setForm(f => ({ ...f, icon: e }))}
                    className={`text-lg p-1.5 rounded-lg transition-all ${form.icon === e ? 'bg-surface-hover ring-1 ring-white/20' : 'hover:bg-card'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted mb-2 uppercase tracking-widest">Colore</p>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="w-5 h-5 rounded-full transition-all"
                    style={{
                      backgroundColor: c,
                      boxShadow: form.color === c ? `0 0 0 2px #0f1117, 0 0 0 4px ${c}` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={addHabit}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-card hover:bg-surface-hover border border-border-hover text-heading transition-colors"
            >
              Aggiungi
            </button>
          </div>
        )}

        {/* Habit list */}
        {!loading && habits.length > 0 && (
          <div className="rounded-2xl bg-card border border-border-default divide-y divide-white/5 overflow-hidden">
            {habits.map(h => (
              <div key={h.id}>
                <div className="flex items-center gap-4 px-5 py-4">

                  {/* Checkbox */}
                  <button
                    onClick={() => toggle(h.id)}
                    disabled={toggling === h.id}
                    className="shrink-0 transition-all duration-150 active:scale-90"
                    aria-label={h.done_today ? 'Segna come non fatto' : 'Segna come fatto'}
                  >
                    <div
                      className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-all"
                      style={{
                        borderColor: h.done_today ? h.color : '#334155',
                        backgroundColor: h.done_today ? h.color : 'transparent',
                      }}
                    >
                      {h.done_today && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Content */}
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base leading-none">{h.icon}</span>
                      <span className={`text-sm font-medium truncate transition-colors ${h.done_today ? 'text-muted line-through' : 'text-heading'}`}>
                        {h.name}
                      </span>
                    </div>
                    {(h.current_streak > 0 || h.longest_streak > 0) && (
                      <div className="flex items-center gap-3 mt-1 ml-[26px]">
                        {h.current_streak > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-tertiary">
                            <Flame size={11} className="text-orange-500/70" />
                            {h.current_streak}d
                          </span>
                        )}
                        {h.longest_streak > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-muted">
                            <Trophy size={11} />
                            {h.longest_streak}d
                          </span>
                        )}
                      </div>
                    )}
                  </button>

                  {/* Expand / delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}
                      className="p-1.5 text-muted hover:text-body transition-colors rounded-lg hover:bg-card"
                    >
                      {expandedId === h.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                      onClick={() => deleteHabit(h.id)}
                      className="p-1.5 text-muted hover:text-red-500 transition-colors rounded-lg hover:bg-card"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Heatmap expanded */}
                {expandedId === h.id && (
                  <div className="px-5 pb-5 border-t border-border-default pt-4">
                    <Heatmap habitId={h.id} color={h.color} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
