'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { calendarEvents, type CalendarEventDTO } from '@/services/calendarService';

const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};
const mono = "'JetBrains Mono',monospace";

// Map a backend hex color to the design's dot palette (green / amber / indigo).
const dotForHex = (hex: string): string => {
  const h = (hex || '').toUpperCase();
  if (h === '#10B981') return 'rgb(16 185 129)';
  if (h === '#F59E0B') return 'rgb(245 158 11)';
  return 'rgb(99 102 241)';
};

const weekdays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

type Cell = { n: number | null; today?: boolean; dots?: string[] };

function DayCell({ cell }: { cell: Cell }) {
  if (cell.n === null) {
    return <div style={{ minHeight: 52, borderRadius: 10, opacity: 0.4, border: '1px dashed rgb(var(--color-border))' }} />;
  }
  const base: React.CSSProperties = {
    minHeight: 52, borderRadius: 10, padding: 'clamp(5px,1.3vw,7px) clamp(3px,1.5vw,8px)',
    border: '1px solid rgb(var(--color-border))', display: 'flex', flexDirection: 'column',
    ...(cell.today ? { border: '1px solid rgb(99 102 241 / 0.35)', background: 'rgb(99 102 241 / 0.10)' } : null),
  };
  return (
    <div style={base}>
      <span style={{ fontSize: 12, fontWeight: cell.today ? 700 : 400, color: cell.today ? 'rgb(99 102 241)' : 'rgb(var(--color-body))', fontFamily: mono }}>{cell.n}</span>
      {cell.today && <span style={{ fontSize: 9, color: 'rgb(99 102 241)', marginTop: 'auto', fontWeight: 600 }}>Oggi</span>}
      {!cell.today && cell.dots && cell.dots.length > 0 && (
        <span style={{ display: 'flex', gap: 'clamp(2px,0.5vw,3px)', marginTop: 'auto' }}>
          {cell.dots.slice(0, 3).map((c, i) => <span key={i} style={{ width: 'clamp(5px,1.3vw,6px)', height: 'clamp(5px,1.3vw,6px)', borderRadius: '50%', background: c }} />)}
        </span>
      )}
    </div>
  );
}

function EventRow({ dot, title, sub, date, last }: { dot: string; title: string; sub: string; date: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: last ? '13px 0 4px' : '13px 0', borderTop: '1px solid rgb(var(--color-border))' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot, flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{sub}</div>}
      </div>
      <div style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-tertiary))', whiteSpace: 'nowrap' }}>{date}</div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  minWidth: 38, minHeight: 38, borderRadius: 9, border: '1px solid rgb(var(--color-border))',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(var(--color-tertiary))',
  fontSize: 14, background: 'transparent', cursor: 'pointer',
};

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEventDTO[]>([]);
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  useEffect(() => {
    let alive = true;
    calendarEvents.list()
      .then((evs) => { if (alive) setEvents(Array.isArray(evs) ? evs : []); })
      .catch(() => {/* keep empty */});
    return () => { alive = false; };
  }, []);

  // Month grid for the displayed cursor month (Monday-first, real alignment).
  const cells = useMemo<Cell[]>(() => {
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const startWeekday = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7; // Mon=0

    // Dots per day from real events that fall in the displayed month.
    const dotsByDay: Record<number, string[]> = {};
    for (const e of events) {
      const d = new Date(e.startTime);
      if (d.getFullYear() === cursor.y && d.getMonth() === cursor.m) {
        const c = dotForHex(e.color);
        const arr = (dotsByDay[d.getDate()] ??= []);
        if (!arr.includes(c)) arr.push(c);
      }
    }
    const isCurrentMonth = cursor.y === today.getFullYear() && cursor.m === today.getMonth();

    const out: Cell[] = [];
    for (let i = 0; i < startWeekday; i++) out.push({ n: null });
    for (let n = 1; n <= daysInMonth; n++) {
      out.push({ n, today: isCurrentMonth && n === today.getDate(), dots: dotsByDay[n] });
    }
    while (out.length % 7 !== 0) out.push({ n: null });
    return out;
  }, [cursor, events, today]);

  // "Prossimi eventi": all future events (excluding plain study sessions), sorted.
  const upcoming = useMemo(() =>
    events
      .filter((e) => new Date(e.startTime) >= today && (e.description || '') !== 'Sessione')
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .map((e) => ({ id: e.id, dot: dotForHex(e.color), title: e.title, sub: e.description || e.calendarName || '', date: fmtDate(e.startTime) })),
  [events, today]);

  const monthLabel = cap(new Date(cursor.y, cursor.m, 1).toLocaleDateString('it-IT', { month: 'long' }));
  const goPrev = () => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }));
  const goNext = () => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }));
  const goToday = () => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); };

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>{monthLabel} {cursor.y}</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(30px, 8vw, 38px)', lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>Calendario</h1>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgb(99 102 241)' }} />Esami</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgb(245 158 11)' }} />Consegne</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgb(16 185 129)' }} />Sessioni</span>
        </div>
      </header>

      <div className="sd-twocol">
        {/* Month grid */}
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, padding: 'clamp(12px,3vw,22px) clamp(12px,3vw,24px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap' }}>{monthLabel} <span style={{ color: 'rgb(var(--color-muted))', fontWeight: 400, fontFamily: mono }}>{cursor.y}</span></div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button type="button" onClick={goToday} className="sd-press" style={{ ...navBtn, width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 600 }}>Oggi</button>
              <button type="button" onClick={goPrev} aria-label="Mese precedente" className="sd-press" style={navBtn}>‹</button>
              <button type="button" onClick={goNext} aria-label="Mese successivo" className="sd-press" style={navBtn}>›</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
            {weekdays.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
            {cells.map((cell, i) => <DayCell key={i} cell={cell} />)}
          </div>
        </div>

        {/* Prossimi eventi */}
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 2, ...card, padding: 'clamp(12px,3vw,22px) clamp(12px,3vw,24px)' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Prossimi eventi</h3>
          {upcoming.length === 0 ? (
            <div style={{ padding: '16px 0 6px', fontSize: 13, color: 'rgb(var(--color-muted))' }}>Nessun evento in calendario. Collega un calendario dalle Impostazioni.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {upcoming.slice(0, 12).map((e, idx, arr) => (
                <EventRow key={e.id} dot={e.dot} title={e.title} sub={e.sub} date={e.date} last={idx === arr.length - 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
