'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Moon, ChevronLeft, ChevronRight, Clock, BedDouble, Sunrise,
  TrendingUp, Zap, Brain, Eye, Activity, Timer, ArrowLeft,
  Plus, Trash2, Sparkles, BarChart3, CalendarDays, Coffee,
} from 'lucide-react'
import sleepService, {
  SleepSession,
  SleepMorningReport,
  SleepWeekSummary,
  SleepSessionCreate,
} from '@/services/sleepService'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

/* ═══════════════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

const PHASES = {
  deep:  { color: '#6366F1', darkColor: '#818CF8', label: 'Profondo', icon: Brain },
  rem:   { color: '#A78BFA', darkColor: '#C4B5FD', label: 'REM',       icon: Eye },
  light: { color: '#38BDF8', darkColor: '#7DD3FC', label: 'Leggero',   icon: Sparkles },
  awake: { color: '#F59E0B', darkColor: '#FBBF24', label: 'Sveglio',   icon: Coffee },
} as const

type Phase = keyof typeof PHASES

function fmt(min: number): string {
  if (!min || min <= 0) return '0m'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  } catch { return '--:--' }
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
  } catch { return '' }
}

/** Restituisce la "notte" di una sessione (= data di wake-up) */
function nightKey(s: SleepSession): string {
  const end = new Date(s.sleep_end)
  return end.toISOString().slice(0, 10)
}

/** Raggruppa sessioni per notte */
function groupByNight(sessions: SleepSession[]): Map<string, SleepSession[]> {
  const map = new Map<string, SleepSession[]>()
  for (const s of sessions) {
    const key = nightKey(s)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  }
  // Ordina ogni gruppo per durata desc (sessione principale prima)
  for (const [, list] of map) {
    list.sort((a, b) => b.duration_minutes - a.duration_minutes)
  }
  return map
}

/** Genera fasi sintetiche per l'ipnogramma quando non ci sono dati reali */
function synthPhases(s: SleepSession): Array<{ phase: Phase; startMin: number; endMin: number }> {
  const total = s.time_in_bed_minutes || s.duration_minutes + (s.awake_minutes || 0)
  if (total <= 0) return []

  const deep = s.deep_minutes || 0
  const rem = s.rem_minutes || 0
  const light = s.light_minutes || 0
  const awake = s.awake_minutes || 0

  const numCycles = Math.max(1, Math.round(total / 90))
  const segments: Array<{ phase: Phase; startMin: number; endMin: number }> = []
  let pos = 0

  // Addormentamento iniziale
  const fallAsleep = Math.min(awake * 0.3, 15)
  if (fallAsleep > 1) {
    segments.push({ phase: 'awake', startMin: pos, endMin: pos + fallAsleep })
    pos += fallAsleep
  }

  const remainAwake = awake - fallAsleep
  const awakePerCycle = numCycles > 0 ? remainAwake / numCycles : 0

  for (let i = 0; i < numCycles; i++) {
    const cycleProgress = i / numCycles
    const deepFrac = deep > 0 ? (1 - cycleProgress * 0.7) : 0
    const remFrac = rem > 0 ? (0.3 + cycleProgress * 0.7) : 0
    const lightFrac = 1.0

    const cycleLen = (total - fallAsleep) / numCycles
    const totalFrac = deepFrac + remFrac + lightFrac + (awakePerCycle > 0 ? 0.2 : 0)

    const dLight1 = Math.round(cycleLen * (lightFrac * 0.4) / totalFrac)
    const dDeep = Math.round(cycleLen * deepFrac / totalFrac)
    const dLight2 = Math.round(cycleLen * (lightFrac * 0.6) / totalFrac)
    const dRem = Math.round(cycleLen * remFrac / totalFrac)
    const dAwake = Math.round(awakePerCycle)

    if (dLight1 > 0) { segments.push({ phase: 'light', startMin: pos, endMin: pos + dLight1 }); pos += dLight1 }
    if (dDeep > 0) { segments.push({ phase: 'deep', startMin: pos, endMin: pos + dDeep }); pos += dDeep }
    if (dLight2 > 0) { segments.push({ phase: 'light', startMin: pos, endMin: pos + dLight2 }); pos += dLight2 }
    if (dRem > 0) { segments.push({ phase: 'rem', startMin: pos, endMin: pos + dRem }); pos += dRem }
    if (dAwake > 1 && i < numCycles - 1) {
      segments.push({ phase: 'awake', startMin: pos, endMin: pos + dAwake }); pos += dAwake
    }
  }

  return segments
}

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════════════════ */

/** Anello qualità SVG */
function QualityRing({ score, size = 130 }: { score: number; size?: number }) {
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, score)) / 100
  const offset = circ * (1 - pct)

  const gradId = `qring-${size}`
  let color1 = '#6366F1'
  let color2 = '#A78BFA'
  if (score >= 85) { color1 = '#10B981'; color2 = '#34D399' }
  else if (score >= 70) { color1 = '#3B82F6'; color2 = '#60A5FA' }
  else if (score >= 50) { color1 = '#F59E0B'; color2 = '#FBBF24' }
  else { color1 = '#EF4444'; color2 = '#F87171' }

  return (
    <svg width={size} height={size} className="drop-shadow-lg flex-shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r}
        fill="none" strokeWidth={8}
        className="stroke-[rgb(var(--border-color))] opacity-30" />
      <circle cx={size/2} cy={size/2} r={r}
        fill="none" strokeWidth={8}
        stroke={`url(#${gradId})`}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
      <text x={size/2} y={size/2 - 8} textAnchor="middle" dominantBaseline="auto"
        className="fill-[rgb(var(--text-primary))]" style={{ fontSize: size * 0.24, fontWeight: 700 }}>
        {score}
      </text>
      <text x={size/2} y={size/2 + 14} textAnchor="middle" dominantBaseline="auto"
        className="fill-[rgb(var(--text-tertiary))]" style={{ fontSize: size * 0.1 }}>
        Qualità
      </text>
    </svg>
  )
}

/** Ipnogramma dettagliato */
function Hypnogram({ session }: { session: SleepSession }) {
  const phases = session.phases && session.phases.length > 0
    ? session.phases.map(p => ({
        phase: p.phase as Phase,
        startMin: (new Date(p.start_time).getTime() - new Date(session.sleep_start).getTime()) / 60000,
        endMin: (new Date(p.end_time).getTime() - new Date(session.sleep_start).getTime()) / 60000,
      }))
    : synthPhases(session)

  if (phases.length === 0) return null

  const totalMin = Math.max(...phases.map(p => p.endMin), 1)
  const W = 800
  const H = 180
  const PAD = { top: 20, bottom: 30, left: 65, right: 20 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const yLevel: Record<Phase, number> = { awake: 0, rem: 1, light: 2, deep: 3 }
  const yPos = (phase: Phase) => PAD.top + (yLevel[phase] / 3) * plotH
  const xPos = (min: number) => PAD.left + (min / totalMin) * plotW

  // Time labels
  const startTime = new Date(session.sleep_start)
  const timeLabels: Array<{ min: number; label: string }> = []
  const step = totalMin <= 180 ? 30 : totalMin <= 360 ? 60 : 90
  for (let m = 0; m <= totalMin; m += step) {
    const t = new Date(startTime.getTime() + m * 60000)
    timeLabels.push({ min: m, label: t.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) })
  }

  const phaseLabels: Array<{ phase: Phase; label: string }> = [
    { phase: 'awake', label: 'Sveglio' },
    { phase: 'rem', label: 'REM' },
    { phase: 'light', label: 'Leggero' },
    { phase: 'deep', label: 'Profondo' },
  ]

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[500px]" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {phaseLabels.map(({ phase }) => (
          <line key={phase}
            x1={PAD.left} x2={W - PAD.right}
            y1={yPos(phase)} y2={yPos(phase)}
            className="stroke-[rgb(var(--border-color))]" strokeWidth={0.5} opacity={0.3} />
        ))}

        {/* Filled areas */}
        {phases.map((seg, i) => {
          const x1 = xPos(seg.startMin)
          const x2 = xPos(seg.endMin)
          const y = yPos(seg.phase)
          const yBottom = PAD.top + plotH
          return (
            <rect key={i}
              x={x1} y={y}
              width={Math.max(0, x2 - x1)} height={yBottom - y}
              fill={PHASES[seg.phase].color}
              opacity={0.12} />
          )
        })}

        {/* Segmenti colorati */}
        {phases.map((seg, i) => {
          const x1 = xPos(seg.startMin)
          const x2 = xPos(seg.endMin)
          const y = yPos(seg.phase)
          const prevY = i > 0 ? yPos(phases[i-1].phase) : y
          return (
            <g key={`seg-${i}`}>
              {i > 0 && (
                <line x1={x1} y1={prevY} x2={x1} y2={y}
                  stroke={PHASES[seg.phase].color} strokeWidth={2.5} />
              )}
              <line x1={x1} y1={y} x2={x2} y2={y}
                stroke={PHASES[seg.phase].color} strokeWidth={2.5}
                strokeLinecap="round" />
            </g>
          )
        })}

        {/* Y-axis labels */}
        {phaseLabels.map(({ phase, label }) => (
          <text key={phase}
            x={PAD.left - 8} y={yPos(phase) + 4}
            textAnchor="end"
            className="fill-[rgb(var(--text-tertiary))]" style={{ fontSize: 11 }}>
            {label}
          </text>
        ))}

        {/* X-axis time labels */}
        {timeLabels.map(({ min, label }) => (
          <text key={min}
            x={xPos(min)} y={H - 5}
            textAnchor="middle"
            className="fill-[rgb(var(--text-muted))]" style={{ fontSize: 10 }}>
            {label}
          </text>
        ))}
      </svg>
    </div>
  )
}

/** Barra orizzontale delle fasi */
function PhaseBar({ session }: { session: SleepSession }) {
  const total = (session.deep_minutes || 0) + (session.rem_minutes || 0) +
                (session.light_minutes || 0) + (session.awake_minutes || 0)
  if (total <= 0) return null

  const pcts = {
    deep: ((session.deep_minutes || 0) / total) * 100,
    rem: ((session.rem_minutes || 0) / total) * 100,
    light: ((session.light_minutes || 0) / total) * 100,
    awake: ((session.awake_minutes || 0) / total) * 100,
  }

  return (
    <div className="flex h-3 w-full rounded-full overflow-hidden gap-[2px]">
      {(['deep', 'rem', 'light', 'awake'] as Phase[]).map(p => (
        pcts[p] > 0 ? (
          <div key={p}
            style={{ width: `${pcts[p]}%`, backgroundColor: PHASES[p].color }}
            className="rounded-full transition-all duration-500" />
        ) : null
      ))}
    </div>
  )
}

/** Card statistica */
function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: typeof Moon; label: string; value: string; sub?: string; accent?: string
}) {
  return (
    <div className="bg-card rounded-2xl p-4 flex flex-col gap-1 border border-border-default">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} style={{ color: accent || 'rgb(var(--text-tertiary))' }} />
        <span className="text-xs text-tertiary font-medium">{label}</span>
      </div>
      <span className="text-heading text-xl font-bold">{value}</span>
      {sub && <span className="text-muted text-xs">{sub}</span>}
    </div>
  )
}

/** Dettaglio singola fase */
function PhaseDetail({ phase, minutes, total }: { phase: Phase; minutes: number; total: number }) {
  const { color, label, icon: Icon } = PHASES[phase]
  const pct = total > 0 ? Math.round((minutes / total) * 100) : 0

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}20` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-body text-sm font-medium">{label}</span>
          <span className="text-heading text-sm font-semibold">{fmt(minutes)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-[rgb(var(--bg-input))] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
      <span className="text-muted text-xs w-10 text-right font-medium">{pct}%</span>
    </div>
  )
}

/** Grafico trend settimanale */
function WeekTrend({ sessions }: { sessions: SleepSession[] }) {
  const data = useMemo(() => {
    const last7 = new Map<string, { deep: number; rem: number; light: number; awake: number; total: number }>()
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      last7.set(key, { deep: 0, rem: 0, light: 0, awake: 0, total: 0 })
    }

    for (const s of sessions) {
      const key = nightKey(s)
      if (last7.has(key)) {
        const entry = last7.get(key)!
        if (s.duration_minutes > entry.total) {
          entry.deep = s.deep_minutes || 0
          entry.rem = s.rem_minutes || 0
          entry.light = s.light_minutes || 0
          entry.awake = s.awake_minutes || 0
          entry.total = s.duration_minutes
        }
      }
    }

    return Array.from(last7.entries()).map(([date, vals]) => {
      const d = new Date(date + 'T12:00:00')
      return {
        name: d.toLocaleDateString('it-IT', { weekday: 'short' }),
        date,
        ...vals,
      }
    })
  }, [sessions])

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="20%">
          <XAxis dataKey="name"
            tick={{ fontSize: 11, fill: 'rgb(var(--text-muted))' }}
            axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgb(var(--bg-card-solid))',
              border: '1px solid rgb(var(--border-color))',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'rgb(var(--text-primary))',
            }}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = { deep: 'Profondo', rem: 'REM', light: 'Leggero', awake: 'Sveglio' }
              return [fmt(value), labels[name] || name]
            }}
            cursor={{ fill: 'rgb(var(--bg-surface-hover))', radius: 8 }}
          />
          <Bar dataKey="deep" stackId="a" fill={PHASES.deep.color} radius={[0, 0, 0, 0]} />
          <Bar dataKey="rem" stackId="a" fill={PHASES.rem.color} />
          <Bar dataKey="light" stackId="a" fill={PHASES.light.color} />
          <Bar dataKey="awake" stackId="a" fill={PHASES.awake.color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Card sessione storico */
function SessionHistoryCard({ session, onClick }: {
  session: SleepSession; onClick: () => void
}) {
  const score = session.quality_score || 0
  let scoreBg = 'bg-red-500/20 text-red-400'
  if (score >= 85) scoreBg = 'bg-emerald-500/20 text-emerald-400'
  else if (score >= 70) scoreBg = 'bg-blue-500/20 text-blue-400'
  else if (score >= 50) scoreBg = 'bg-amber-500/20 text-amber-400'

  return (
    <button onClick={onClick}
      className="w-full text-left bg-card rounded-2xl p-4 border border-border-default
        hover:border-[rgb(var(--border-hover))] transition-all duration-200 group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-body">
            <span className="font-semibold text-sm">{fmtDate(session.sleep_end)}</span>
            <span className="text-muted text-xs ml-2">
              {fmtTime(session.sleep_start)} → {fmtTime(session.sleep_end)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${scoreBg}`}>
            {score}
          </span>
          <ChevronRight size={16} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <PhaseBar session={session} />

      <div className="flex items-center gap-4 mt-3 text-xs text-tertiary">
        <span className="flex items-center gap-1">
          <Clock size={12} /> {fmt(session.duration_minutes)}
        </span>
        <span className="flex items-center gap-1">
          <Brain size={12} /> {fmt(session.deep_minutes || 0)} prof.
        </span>
        <span className="flex items-center gap-1">
          <Eye size={12} /> {fmt(session.rem_minutes || 0)} REM
        </span>
        {session.source && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-[rgb(var(--bg-input))] text-muted">
            {session.source === 'apple_watch' ? '⌚ Watch' :
             session.source === 'sleep_cycle' ? '🌙 SC' :
             session.source === 'health_auto_export' ? 'HAE' : session.source}
          </span>
        )}
      </div>
    </button>
  )
}

/** Tab per sessioni multiple nella stessa notte */
function SessionTabs({ sessions, activeIdx, onChange }: {
  sessions: SleepSession[]; activeIdx: number; onChange: (i: number) => void
}) {
  if (sessions.length <= 1) return null

  return (
    <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
      {sessions.map((s, i) => (
        <button key={s.id} onClick={() => onChange(i)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap
            ${i === activeIdx
              ? 'bg-[#6366F1] text-white shadow-lg shadow-indigo-500/20'
              : 'bg-card border border-border-default text-tertiary hover:text-body'
            }`}>
          {i === 0 ? 'Principale' : sessions.length === 2 ? 'Pisolino' : `Sessione ${i + 1}`}
          <span className="ml-1.5 opacity-70">{fmt(s.duration_minutes)}</span>
        </button>
      ))}
    </div>
  )
}

/** Modale form inserimento manuale */
function SleepFormModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (data: SleepSessionCreate) => Promise<void>
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [sleepTime, setSleepTime] = useState('23:00')
  const [wakeTime, setWakeTime] = useState('07:00')
  const [quality, setQuality] = useState(70)
  const [deep, setDeep] = useState(60)
  const [rem, setRem] = useState(90)
  const [light, setLight] = useState(180)
  const [awake, setAwake] = useState(15)
  const [mood, setMood] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const sleepStart = new Date(`${date}T${sleepTime}:00`)
      let wakeDate = new Date(`${date}T${wakeTime}:00`)
      if (wakeDate <= sleepStart) wakeDate.setDate(wakeDate.getDate() + 1)
      const duration = Math.round((wakeDate.getTime() - sleepStart.getTime()) / 60000)

      await onSave({
        sleep_start: sleepStart.toISOString(),
        sleep_end: wakeDate.toISOString(),
        duration_minutes: duration,
        quality_score: quality,
        deep_minutes: deep,
        rem_minutes: rem,
        light_minutes: light,
        awake_minutes: awake,
        mood_on_wake: mood || undefined,
        notes: notes || undefined,
      })
      onClose()
    } finally { setSaving(false) }
  }

  const moods = [
    { val: 'great', emoji: '😊' },
    { val: 'good', emoji: '🙂' },
    { val: 'okay', emoji: '😐' },
    { val: 'bad', emoji: '😟' },
    { val: 'terrible', emoji: '😩' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-card-solid rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-border-default shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <h3 className="text-heading text-lg font-bold mb-5">Nuova sessione sonno</h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-tertiary font-medium mb-1 block">Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-input rounded-xl px-3 py-2.5 text-body border border-border-default text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-tertiary font-medium mb-1 block">Coricato</label>
              <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)}
                className="w-full bg-input rounded-xl px-3 py-2.5 text-body border border-border-default text-sm" />
            </div>
            <div>
              <label className="text-xs text-tertiary font-medium mb-1 block">Svegliato</label>
              <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)}
                className="w-full bg-input rounded-xl px-3 py-2.5 text-body border border-border-default text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs text-tertiary font-medium mb-1 block">Qualità: {quality}</label>
            <input type="range" min={0} max={100} value={quality} onChange={e => setQuality(+e.target.value)}
              className="w-full accent-indigo-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Profondo (min)', val: deep, set: setDeep },
              { label: 'REM (min)', val: rem, set: setRem },
              { label: 'Leggero (min)', val: light, set: setLight },
              { label: 'Sveglio (min)', val: awake, set: setAwake },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="text-xs text-tertiary font-medium mb-1 block">{label}</label>
                <input type="number" min={0} value={val} onChange={e => set(+e.target.value)}
                  className="w-full bg-input rounded-xl px-3 py-2.5 text-body border border-border-default text-sm" />
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs text-tertiary font-medium mb-1 block">Umore al risveglio</label>
            <div className="flex gap-2">
              {moods.map(m => (
                <button key={m.val} onClick={() => setMood(mood === m.val ? '' : m.val)}
                  className={`text-2xl p-2 rounded-xl transition-all
                    ${mood === m.val ? 'bg-indigo-500/20 ring-2 ring-indigo-500' : 'hover:bg-[rgb(var(--bg-surface-hover))]'}`}>
                  {m.emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-tertiary font-medium mb-1 block">Note</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Come ti sei sentito..."
              className="w-full bg-input rounded-xl px-3 py-2.5 text-body border border-border-default text-sm resize-none" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border-default text-body font-medium text-sm
              hover:bg-[rgb(var(--bg-surface-hover))] transition-colors">
            Annulla
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white font-medium text-sm
              hover:bg-indigo-600 transition-colors disabled:opacity-50">
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Modale conferma */
function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}>
      <div className="bg-card-solid rounded-2xl p-6 w-full max-w-sm border border-border-default shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <p className="text-body text-sm mb-5">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-border-default text-body font-medium text-sm">
            Annulla
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2 rounded-xl bg-red-500 text-white font-medium text-sm">
            Elimina
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════ */

export default function SleepPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SleepSession[]>([])
  const [weekSummary, setWeekSummary] = useState<SleepWeekSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [activeSessionIdx, setActiveSessionIdx] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, w] = await Promise.all([
        sleepService.list(14),
        sleepService.getWeekSummary(),
      ])
      setSessions(s)
      setWeekSummary(w)
    } catch (e: any) {
      setError(e?.message || 'Errore nel caricamento dati')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const nightMap = useMemo(() => groupByNight(sessions), [sessions])
  const sortedDates = useMemo(() =>
    Array.from(nightMap.keys()).sort((a, b) => b.localeCompare(a)), [nightMap])

  const currentSessions = nightMap.get(selectedDate) || []
  const currentSession = currentSessions[activeSessionIdx] || currentSessions[0] || null

  useEffect(() => { setActiveSessionIdx(0) }, [selectedDate])

  const dateIdx = sortedDates.indexOf(selectedDate)
  const canPrev = dateIdx < sortedDates.length - 1
  const canNext = dateIdx > 0
  const goToDate = (dir: number) => {
    const newIdx = dateIdx - dir
    if (newIdx >= 0 && newIdx < sortedDates.length) {
      setSelectedDate(sortedDates[newIdx])
    }
  }

  // Auto-select most recent date with data
  useEffect(() => {
    if (!loading && currentSessions.length === 0 && sortedDates.length > 0) {
      setSelectedDate(sortedDates[0])
    }
  }, [loading, sortedDates]) // eslint-disable-line

  const handleCreate = async (data: SleepSessionCreate) => {
    await sleepService.create(data)
    await fetchData()
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await sleepService.delete(deleteId)
      setDeleteId(null)
      await fetchData()
    } catch (e: any) {
      setError(e?.message || 'Errore durante eliminazione')
    }
  }

  const totalPhases = currentSession
    ? (currentSession.deep_minutes || 0) + (currentSession.rem_minutes || 0) +
      (currentSession.light_minutes || 0) + (currentSession.awake_minutes || 0)
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Moon size={40} className="text-indigo-400 animate-pulse" />
          <span className="text-tertiary text-sm">Caricamento dati sonno...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto pb-20">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')}
            className="p-2 rounded-xl hover:bg-[rgb(var(--bg-surface-hover))] transition-colors">
            <ArrowLeft size={20} className="text-body" />
          </button>
          <h1 className="text-heading text-2xl font-bold flex items-center gap-2">
            <Moon size={24} className="text-indigo-400" /> Sonno
          </h1>
        </div>
        <button onClick={() => setShowForm(true)}
          className="p-2.5 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20">
          <Plus size={20} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-2">✕</button>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="text-center py-20">
          <Moon size={48} className="text-muted mx-auto mb-4 opacity-30" />
          <p className="text-tertiary">Nessuna sessione di sonno registrata</p>
          <p className="text-muted text-sm mt-1">Usa lo Shortcut iOS o aggiungi manualmente</p>
        </div>
      ) : (
        <>
          {/* ── Date navigator ── */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button onClick={() => goToDate(-1)} disabled={!canPrev}
              className="p-2 rounded-xl hover:bg-[rgb(var(--bg-surface-hover))] transition-colors disabled:opacity-20">
              <ChevronLeft size={20} className="text-body" />
            </button>
            <div className="text-center min-w-[180px]">
              <div className="text-heading font-semibold capitalize">
                {selectedDate === new Date().toISOString().slice(0, 10)
                  ? 'Oggi'
                  : (() => {
                      const y = new Date(); y.setDate(y.getDate() - 1)
                      return selectedDate === y.toISOString().slice(0, 10) ? 'Ieri' : ''
                    })() ||
                    new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', {
                      weekday: 'long', day: 'numeric', month: 'long'
                    })
                }
              </div>
              {currentSessions.length > 1 && (
                <div className="text-indigo-400 text-xs font-medium mt-0.5">
                  {currentSessions.length} sessioni
                </div>
              )}
            </div>
            <button onClick={() => goToDate(1)} disabled={!canNext}
              className="p-2 rounded-xl hover:bg-[rgb(var(--bg-surface-hover))] transition-colors disabled:opacity-20">
              <ChevronRight size={20} className="text-body" />
            </button>
          </div>

          {/* ── Tab sessioni multiple ── */}
          <SessionTabs sessions={currentSessions}
            activeIdx={activeSessionIdx} onChange={setActiveSessionIdx} />

          {currentSession && (
            <>
              {/* ── Hero card ── */}
              <div className="bg-card rounded-3xl border border-border-default overflow-hidden mb-4">
                <div className="p-6 flex items-start gap-5">
                  <QualityRing score={currentSession.quality_score || 0} />
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="text-heading text-3xl font-bold mb-1">
                      {fmt(currentSession.duration_minutes)}
                    </div>
                    <div className="flex items-center gap-2 text-tertiary text-sm mb-3">
                      <BedDouble size={14} />
                      <span>{fmtTime(currentSession.sleep_start)}</span>
                      <span className="text-muted">→</span>
                      <Sunrise size={14} />
                      <span>{fmtTime(currentSession.sleep_end)}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {currentSession.source && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400">
                          {currentSession.source === 'apple_watch' ? '⌚ Apple Watch' :
                           currentSession.source === 'sleep_cycle' ? '🌙 Sleep Cycle' :
                           currentSession.source === 'health_auto_export' ? '📱 HAE' :
                           currentSession.source === 'manual' ? '✏️ Manuale' : currentSession.source}
                        </span>
                      )}
                      {currentSession.sc_quality_score != null && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400">
                          SC: {currentSession.sc_quality_score}%
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setDeleteId(currentSession.id)}
                    className="p-2 rounded-xl text-muted hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="px-6 pb-3">
                  <PhaseBar session={currentSession} />
                </div>

                <div className="px-3 pb-4">
                  <Hypnogram session={currentSession} />
                </div>
              </div>

              {/* ── Fasi dettagliate ── */}
              <div className="bg-card rounded-2xl border border-border-default p-5 mb-4">
                <h3 className="text-heading text-sm font-semibold mb-2 flex items-center gap-2">
                  <BarChart3 size={16} className="text-indigo-400" /> Fasi del sonno
                </h3>
                <div className="divide-y divide-[rgb(var(--border-color)_/_0.3)]">
                  <PhaseDetail phase="deep" minutes={currentSession.deep_minutes || 0} total={totalPhases} />
                  <PhaseDetail phase="rem" minutes={currentSession.rem_minutes || 0} total={totalPhases} />
                  <PhaseDetail phase="light" minutes={currentSession.light_minutes || 0} total={totalPhases} />
                  <PhaseDetail phase="awake" minutes={currentSession.awake_minutes || 0} total={totalPhases} />
                </div>
              </div>

              {/* ── Stats grid ── */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <StatCard icon={Timer} label="A letto"
                  value={fmt(currentSession.time_in_bed_minutes || currentSession.duration_minutes)}
                  accent={PHASES.light.color} />
                <StatCard icon={Activity} label="Efficienza"
                  value={`${currentSession.sleep_efficiency?.toFixed(0) || '--'}%`}
                  sub={currentSession.sleep_efficiency && currentSession.sleep_efficiency >= 85 ? 'Ottima' :
                       currentSession.sleep_efficiency && currentSession.sleep_efficiency >= 75 ? 'Buona' : 'Da migliorare'}
                  accent={PHASES.rem.color} />
                <StatCard icon={BedDouble} label="Coricato"
                  value={fmtTime(currentSession.sleep_start)}
                  accent={PHASES.deep.color} />
                <StatCard icon={Sunrise} label="Svegliato"
                  value={fmtTime(currentSession.sleep_end)}
                  accent={PHASES.awake.color} />
              </div>

              {/* ── Extra Sleep Cycle ── */}
              {(currentSession.sc_quality_score != null || currentSession.snoring_minutes != null ||
                currentSession.heart_rate_lowest != null || currentSession.regularity_score != null) && (
                <div className="bg-card rounded-2xl border border-border-default p-5 mb-4">
                  <h3 className="text-heading text-sm font-semibold mb-3">🌙 Dati Sleep Cycle</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {currentSession.sc_quality_score != null && (
                      <div>
                        <span className="text-muted block text-xs">Qualità SC</span>
                        <span className="text-heading font-semibold">{currentSession.sc_quality_score}%</span>
                      </div>
                    )}
                    {currentSession.snoring_minutes != null && (
                      <div>
                        <span className="text-muted block text-xs">Russamento</span>
                        <span className="text-heading font-semibold">{fmt(currentSession.snoring_minutes)}</span>
                      </div>
                    )}
                    {currentSession.heart_rate_lowest != null && (
                      <div>
                        <span className="text-muted block text-xs">FC minima</span>
                        <span className="text-heading font-semibold">{currentSession.heart_rate_lowest} bpm</span>
                      </div>
                    )}
                    {currentSession.regularity_score != null && (
                      <div>
                        <span className="text-muted block text-xs">Regolarità</span>
                        <span className="text-heading font-semibold">{currentSession.regularity_score}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentSession.notes && (
                <div className="bg-card rounded-2xl border border-border-default p-5 mb-4">
                  <p className="text-body text-sm italic">{currentSession.notes}</p>
                </div>
              )}
            </>
          )}

          {/* ── Trend settimanale ── */}
          <div className="bg-card rounded-2xl border border-border-default p-5 mb-4">
            <h3 className="text-heading text-sm font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-400" /> Trend settimanale
            </h3>
            <WeekTrend sessions={sessions} />
            {weekSummary && (
              <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-[rgb(var(--border-color)_/_0.2)]">
                <div className="text-center">
                  <div className="text-heading font-bold text-sm">{fmt(weekSummary.avg_duration_minutes)}</div>
                  <div className="text-muted text-xs">Media</div>
                </div>
                <div className="text-center">
                  <div className="text-heading font-bold text-sm">{Math.round(weekSummary.avg_quality)}</div>
                  <div className="text-muted text-xs">Qualità</div>
                </div>
                <div className="text-center">
                  <div className="text-heading font-bold text-sm">{Math.round(weekSummary.avg_deep_pct)}%</div>
                  <div className="text-muted text-xs">Profondo</div>
                </div>
                <div className="text-center">
                  <div className="text-heading font-bold text-sm">{Math.round(weekSummary.avg_rem_pct)}%</div>
                  <div className="text-muted text-xs">REM</div>
                </div>
              </div>
            )}
          </div>

          {/* ── Storico sessioni ── */}
          <div className="mb-4">
            <h3 className="text-heading text-sm font-semibold mb-3 flex items-center gap-2">
              <CalendarDays size={16} className="text-indigo-400" /> Storico
            </h3>
            <div className="space-y-2">
              {sortedDates.map(date => {
                const daySessions = nightMap.get(date)!
                return daySessions.map((s, i) => (
                  <SessionHistoryCard key={s.id} session={s}
                    onClick={() => {
                      setSelectedDate(date)
                      setActiveSessionIdx(i)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }} />
                ))
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {showForm && <SleepFormModal onClose={() => setShowForm(false)} onSave={handleCreate} />}
      {deleteId && (
        <ConfirmModal
          message="Vuoi davvero eliminare questa sessione di sonno?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)} />
      )}
    </div>
  )
}
