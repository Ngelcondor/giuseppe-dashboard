'use client';

import React, { useEffect, useState } from 'react';
import { calendarEvents, type CalendarEventDTO } from '@/services/calendarService';

const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};
const mono = "'JetBrains Mono',monospace";

type DotColor = 'green' | 'amber' | 'indigo';

type Day = {
  n: number;
  muted?: boolean;
  today?: boolean;
  dot?: DotColor;
  highlight?: 'amber';
};

// Grid skeleton for Giugno 2026 (which days are muted / today). Dots are
// overlaid from event data; the FALLBACK dots below reproduce the seed exactly.
const baseDays: Omit<Day, 'dot'>[] = [
  { n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 },
  { n: 6, muted: true }, { n: 7, muted: true },
  { n: 8 }, { n: 9 }, { n: 10 }, { n: 11 }, { n: 12 },
  { n: 13, muted: true }, { n: 14, muted: true },
  { n: 15 }, { n: 16 }, { n: 17 }, { n: 18 }, { n: 19 },
  { n: 20, muted: true },
  { n: 21, today: true },
  { n: 22 },
  { n: 23 },
  { n: 24 },
  { n: 25 },
  { n: 26, highlight: 'amber' },
  { n: 27, muted: true },
  { n: 28, muted: true },
  { n: 29 }, { n: 30 },
];

// dayNumber -> dot color, matching the approved static design / DB seed.
const FALLBACK_DOTS: Record<number, DotColor> = {
  23: 'green',
  25: 'green',
  26: 'amber',
  27: 'green',
  28: 'indigo',
};

type UpcomingEvent = { id: string; dot: string; title: string; sub: string; date: string };

const FALLBACK_UPCOMING: UpcomingEvent[] = [
  { id: 'f1', dot: 'rgb(245 158 11)', title: 'PEC2 · Basi di Dati', sub: 'Consegna', date: '26 giu' },
  { id: 'f2', dot: 'rgb(16 185 129)', title: 'Ripasso SO · scheduling', sub: 'Sessione · 2h', date: '27 giu' },
  { id: 'f3', dot: 'rgb(99 102 241)', title: 'Esame · Sistemi Operativi', sub: 'Aula 3.1 · 09:00', date: '8 lug' },
  { id: 'f4', dot: 'rgb(99 102 241)', title: 'Esame · CPTS', sub: 'Hack The Box', date: '31 lug' },
];

const dotColor: Record<DotColor, string> = {
  green: 'rgb(16 185 129)',
  amber: 'rgb(245 158 11)',
  indigo: 'rgb(99 102 241)',
};

// Map a backend hex color to the design's dot palette.
const hexToDot = (hex: string): DotColor =>
  hex.toUpperCase() === '#10B981' ? 'green'
  : hex.toUpperCase() === '#F59E0B' ? 'amber'
  : 'indigo';

const hexToRgb = (hex: string): string => dotColor[hexToDot(hex)];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

const weekdays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function DayCell({ day }: { day: Day }) {
  const base: React.CSSProperties = {
    minHeight: 52, borderRadius: 10, padding: '7px 8px',
    border: '1px solid rgb(var(--color-border))',
    display: 'flex', flexDirection: 'column',
  };

  if (day.today) {
    return (
      <div style={{ ...base, border: '1px solid rgb(99 102 241 / 0.35)', background: 'rgb(99 102 241 / 0.10)' }}>
        <span style={{ fontSize: 12, color: 'rgb(99 102 241)', fontWeight: 700, fontFamily: mono }}>{day.n}</span>
        <span style={{ fontSize: 9, color: 'rgb(99 102 241)', marginTop: 'auto', fontWeight: 600 }}>Oggi</span>
      </div>
    );
  }

  if (day.highlight === 'amber') {
    return (
      <div style={{ ...base, border: '1px solid rgb(245 158 11 / 0.35)', background: 'rgb(245 158 11 / 0.08)' }}>
        <span style={{ fontSize: 12, color: 'rgb(var(--color-heading))', fontWeight: 600, fontFamily: mono }}>{day.n}</span>
        {day.dot && (
          <span style={{ display: 'flex', gap: 3, marginTop: 'auto' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor[day.dot] }} />
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={base}>
      <span style={{ fontSize: 12, color: day.muted ? 'rgb(var(--color-muted))' : 'rgb(var(--color-body))', fontFamily: mono }}>{day.n}</span>
      {day.dot && (
        <span style={{ display: 'flex', gap: 3, marginTop: 'auto' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor[day.dot] }} />
        </span>
      )}
    </div>
  );
}

function EventRow({ dot, title, sub, date, last }: { dot: string; title: string; sub: string; date: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: last ? '13px 0 4px' : '13px 0', borderTop: '1px solid rgb(var(--color-border))' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot, flex: 'none' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{sub}</div>
      </div>
      <div style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}>{date}</div>
    </div>
  );
}

// Today (2026-06-21 in this environment). Used to split upcoming events.
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

export default function CalendarPage() {
  const [dots, setDots] = useState<Record<number, DotColor>>(FALLBACK_DOTS);
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>(FALLBACK_UPCOMING);

  useEffect(() => {
    let alive = true;
    calendarEvents.list().then((events: CalendarEventDTO[]) => {
      if (!alive) return;

      // Month-grid dots: events that fall in June 2026.
      const nextDots: Record<number, DotColor> = {};
      for (const e of events) {
        const d = new Date(e.startTime);
        if (d.getFullYear() === 2026 && d.getMonth() === 5) {
          nextDots[d.getDate()] = hexToDot(e.color);
        }
      }
      if (Object.keys(nextDots).length) setDots(nextDots);

      // "Prossimi eventi": future events excluding plain study sessions
      // (description === 'Sessione'), sorted by date — matches the design.
      const today = startOfToday();
      const next = events
        .filter((e) => new Date(e.startTime) >= today && (e.description || '') !== 'Sessione')
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .map((e) => ({
          id: e.id,
          dot: hexToRgb(e.color),
          title: e.title,
          sub: e.description || '',
          date: fmtDate(e.startTime),
        }));
      if (next.length) setUpcoming(next);
    }).catch(() => {/* keep fallback */});
    return () => { alive = false; };
  }, []);

  const days: Day[] = baseDays.map((d) => ({ ...d, dot: dots[d.n] }));

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>Giugno – Luglio 2026</div>
          <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>Calendario</h1>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgb(99 102 241)' }} />Esami</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgb(245 158 11)' }} />Consegne</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgb(var(--color-tertiary))' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgb(16 185 129)' }} />Sessioni</span>
        </div>
      </header>

      <div className="sd-twocol">
        {/* Month grid */}
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 1, ...card, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap' }}>Giugno <span style={{ color: 'rgb(var(--color-muted))', fontWeight: 400, fontFamily: mono }}>2026</span></div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid rgb(var(--color-border))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(var(--color-tertiary))', fontSize: 14 }}>‹</span>
              <span style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid rgb(var(--color-border))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(var(--color-tertiary))', fontSize: 14 }}>›</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
            {weekdays.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
            {days.map((day) => (
              <DayCell key={day.n} day={day} />
            ))}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`trail-${i}`} style={{ minHeight: 52, borderRadius: 10, opacity: 0.4, border: '1px dashed rgb(var(--color-border))' }} />
            ))}
          </div>
        </div>

        {/* Prossimi eventi */}
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 2, ...card, padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Prossimi eventi</h3>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {upcoming.map((e, idx) => (
              <EventRow key={e.id} dot={e.dot} title={e.title} sub={e.sub} date={e.date} last={idx === upcoming.length - 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
