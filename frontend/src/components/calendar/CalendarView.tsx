'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Link2,
} from 'lucide-react';
import { CalendarEvent } from '@/types';
import { calendarEvents, calendarConnections, CalendarConnection, CalendarEventDTO } from '@/services/calendarService';
import { COLORS } from '@/lib/constants';
import EventModal from './EventModal';
import ConnectionSetup from './ConnectionSetup';

interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

const DAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

// Map the API DTO onto the richer CalendarEvent shape used in the UI.
function dtoToCalendarEvent(dto: CalendarEventDTO): CalendarEvent {
  return {
    id: dto.id,
    userId: dto.userId,
    title: dto.title,
    description: dto.description ?? undefined,
    startTime: dto.startTime,
    endTime: dto.endTime,
    location: dto.location ?? undefined,
    color: dto.color,
    calendar: dto.source ?? 'manual',
    reminders: [],
    createdAt: dto.startTime,
  };
}

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showConnectionSetup, setShowConnectionSetup] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // ─── Data Fetching ────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    try {
      const data = await calendarEvents.list();
      setEvents(data.map(dtoToCalendarEvent));
    } catch (err) {
      console.error('Errore nel caricamento eventi:', err);
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const data = await calendarConnections.list();
      setConnections(data);
    } catch (err) {
      console.error('Errore nel caricamento connessioni:', err);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchConnections();
  }, [fetchEvents, fetchConnections]);

  // ─── Sync ─────────────────────────────────────────────────────────────

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const activeConnections = connections.filter((c) => c.is_active);
      for (const conn of activeConnections) {
        await calendarConnections.sync(conn.id);
      }
      await fetchEvents();
    } catch (err) {
      console.error('Errore nella sincronizzazione:', err);
    } finally {
      setSyncing(false);
    }
  };

  // ─── Navigation ───────────────────────────────────────────────────────

  const navigateMonth = (direction: number) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + direction);
      return next;
    });
  };

  const goToToday = () => setCurrentDate(new Date());

  // ─── Calendar Grid ────────────────────────────────────────────────────

  const calendarDays: DayCell[] = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of month (adjust for Monday start)
    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6; // Sunday -> 6

    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Build grid
    const days: DayCell[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Previous month padding
    const prevMonth = new Date(year, month, 0);
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonth.getDate() - i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        events: getEventsForDate(date),
      });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateNoTime = new Date(date);
      dateNoTime.setHours(0, 0, 0, 0);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: dateNoTime.getTime() === today.getTime(),
        events: getEventsForDate(date),
      });
    }

    // Next month padding (fill to 42 cells for 6 rows)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        events: getEventsForDate(date),
      });
    }

    return days;
  }, [currentDate, events]);

  function getEventsForDate(date: Date): CalendarEvent[] {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter((e) => {
      const eventDate = new Date(e.startTime).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  }

  // ─── Event Handlers ───────────────────────────────────────────────────

  const handleDayClick = (day: DayCell) => {
    setSelectedDate(day.date);
    if (day.events.length === 0) {
      setSelectedEvent(null);
      setShowEventModal(true);
    }
  };

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const handleEventSaved = () => {
    setShowEventModal(false);
    setSelectedEvent(null);
    fetchEvents();
  };

  const handleConnectionSaved = () => {
    setShowConnectionSetup(false);
    fetchConnections();
    handleSyncAll();
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="calendar-view">
      {/* Header */}
      <div className="calendar-header">
        <div className="calendar-header-left">
          <CalendarIcon size={22} />
          <h2 className="calendar-title">
            {MONTHS_IT[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
        </div>

        <div className="calendar-header-center">
          <button onClick={() => navigateMonth(-1)} className="nav-btn" aria-label="Mese precedente">
            <ChevronLeft size={18} />
          </button>
          <button onClick={goToToday} className="today-btn">
            Oggi
          </button>
          <button onClick={() => navigateMonth(1)} className="nav-btn" aria-label="Mese successivo">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="calendar-header-right">
          {connections.length > 0 && (
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              className="sync-btn"
              title="Sincronizza calendari"
            >
              <RefreshCw size={16} className={syncing ? 'spinning' : ''} />
              {syncing ? 'Sync...' : 'Sync'}
            </button>
          )}
          <button onClick={() => setShowConnectionSetup(true)} className="connect-btn">
            <Link2 size={16} />
            {connections.length === 0 ? 'Collega Calendario' : 'Connessioni'}
          </button>
          <button
            onClick={() => {
              setSelectedEvent(null);
              setSelectedDate(new Date());
              setShowEventModal(true);
            }}
            className="add-btn"
          >
            <Plus size={16} />
            Nuovo
          </button>
        </div>
      </div>

      {/* Connection status banner */}
      {connections.length > 0 && (
        <div className="connection-status">
          {connections.map((conn) => (
            <span key={conn.id} className={`connection-badge ${conn.is_active ? 'active' : 'inactive'}`}>
              {conn.provider === 'apple' ? '🍎' : '📅'} {conn.display_name}
              {conn.last_sync_at && (
                <span className="sync-time">
                  {' '}· sincronizzato {new Date(conn.last_sync_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {/* Day headers */}
        {DAYS_IT.map((day) => (
          <div key={day} className="day-header">
            {day}
          </div>
        ))}

        {/* Day cells */}
        {calendarDays.map((day, idx) => (
          <div
            key={idx}
            className={`day-cell ${!day.isCurrentMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''}`}
            onClick={() => handleDayClick(day)}
          >
            <span className={`day-number ${day.isToday ? 'today-number' : ''}`}>
              {day.date.getDate()}
            </span>

            <div className="day-events">
              {day.events.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="event-pill"
                  style={{ backgroundColor: event.color || COLORS.primary }}
                  onClick={(e) => handleEventClick(event, e)}
                  title={event.title}
                >
                  <span className="event-pill-text">{event.title}</span>
                </div>
              ))}
              {day.events.length > 3 && (
                <span className="more-events">+{day.events.length - 3} altri</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Today's events sidebar */}
      <TodayEvents
        events={events.filter((e) => {
          const today = new Date().toISOString().split('T')[0];
          return new Date(e.startTime).toISOString().split('T')[0] === today;
        })}
        onEventClick={(event) => {
          setSelectedEvent(event);
          setShowEventModal(true);
        }}
      />

      {/* Modals */}
      {showEventModal && (
        <EventModal
          event={selectedEvent}
          defaultDate={selectedDate}
          onClose={() => {
            setShowEventModal(false);
            setSelectedEvent(null);
          }}
          onSave={handleEventSaved}
        />
      )}

      {showConnectionSetup && (
        <ConnectionSetup
          connections={connections}
          onClose={() => setShowConnectionSetup(false)}
          onSave={handleConnectionSaved}
        />
      )}

      <style jsx>{`
        .calendar-view {
          background: ${COLORS.bg.secondary};
          border-radius: 16px;
          padding: 24px;
          color: ${COLORS.text.primary};
        }

        .calendar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .calendar-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .calendar-title {
          font-size: 1.3rem;
          font-weight: 600;
          margin: 0;
        }

        .calendar-header-center {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-btn {
          background: ${COLORS.bg.tertiary};
          border: none;
          color: ${COLORS.text.primary};
          border-radius: 8px;
          padding: 6px 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: background 0.2s;
        }
        .nav-btn:hover {
          background: ${COLORS.primary};
        }

        .today-btn {
          background: transparent;
          border: 1px solid ${COLORS.bg.tertiary};
          color: ${COLORS.text.secondary};
          border-radius: 8px;
          padding: 6px 14px;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
        }
        .today-btn:hover {
          border-color: ${COLORS.primary};
          color: ${COLORS.primary};
        }

        .calendar-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sync-btn,
        .connect-btn,
        .add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 8px;
          border: none;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .sync-btn {
          background: ${COLORS.bg.tertiary};
          color: ${COLORS.text.secondary};
        }
        .sync-btn:hover {
          background: ${COLORS.info};
          color: white;
        }
        .sync-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .connect-btn {
          background: ${COLORS.bg.tertiary};
          color: ${COLORS.text.secondary};
        }
        .connect-btn:hover {
          background: ${COLORS.secondary};
          color: white;
        }

        .add-btn {
          background: ${COLORS.primary};
          color: white;
        }
        .add-btn:hover {
          filter: brightness(1.1);
        }

        .connection-status {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }

        .connection-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          background: ${COLORS.bg.tertiary};
          color: ${COLORS.text.secondary};
        }
        .connection-badge.active {
          background: rgba(16, 185, 129, 0.15);
          color: ${COLORS.secondary};
        }
        .connection-badge.inactive {
          opacity: 0.5;
        }
        .sync-time {
          color: ${COLORS.text.tertiary};
          font-size: 0.7rem;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background: ${COLORS.bg.tertiary};
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 20px;
        }

        .day-header {
          padding: 10px;
          text-align: center;
          font-size: 0.8rem;
          font-weight: 600;
          color: ${COLORS.text.tertiary};
          background: ${COLORS.bg.secondary};
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .day-cell {
          min-height: 90px;
          padding: 6px;
          background: ${COLORS.bg.secondary};
          cursor: pointer;
          transition: background 0.15s;
          position: relative;
        }
        .day-cell:hover {
          background: ${COLORS.bg.primary};
        }
        .day-cell.other-month {
          opacity: 0.35;
        }
        .day-cell.today {
          background: rgba(59, 130, 246, 0.08);
        }

        .day-number {
          display: inline-block;
          font-size: 0.85rem;
          font-weight: 500;
          color: ${COLORS.text.secondary};
          margin-bottom: 4px;
        }
        .today-number {
          background: ${COLORS.primary};
          color: white;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
        }

        .day-events {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .event-pill {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.7rem;
          color: white;
          cursor: pointer;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          transition: filter 0.15s;
        }
        .event-pill:hover {
          filter: brightness(1.2);
        }
        .event-pill-text {
          font-weight: 500;
        }

        .more-events {
          font-size: 0.7rem;
          color: ${COLORS.text.tertiary};
          padding: 0 4px;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinning {
          animation: spin 1s linear infinite;
        }

        @media (max-width: 768px) {
          .calendar-view {
            padding: 12px;
          }
          .calendar-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .day-cell {
            min-height: 60px;
            padding: 4px;
          }
          .day-number {
            font-size: 0.75rem;
          }
          .event-pill {
            font-size: 0.6rem;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-component: Today's Events ──────────────────────────────────────────

function TodayEvents({
  events,
  onEventClick,
}: {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="today-events">
        <h3 className="today-title">Oggi</h3>
        <p className="no-events">Nessun evento per oggi</p>
        <style jsx>{`
          .today-events {
            padding: 16px 0;
          }
          .today-title {
            font-size: 1rem;
            font-weight: 600;
            color: ${COLORS.text.primary};
            margin: 0 0 12px 0;
          }
          .no-events {
            color: ${COLORS.text.tertiary};
            font-size: 0.85rem;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="today-events">
      <h3 className="today-title">Oggi · {events.length} eventi</h3>
      <div className="today-list">
        {events.map((event) => (
          <div
            key={event.id}
            className="today-event-card"
            onClick={() => onEventClick(event)}
          >
            <div className="event-color-bar" style={{ backgroundColor: event.color }} />
            <div className="event-info">
              <span className="event-title">{event.title}</span>
              <div className="event-meta">
                <Clock size={12} />
                <span>
                  {new Date(event.startTime).toLocaleTimeString('it-IT', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' - '}
                  {new Date(event.endTime).toLocaleTimeString('it-IT', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {event.location && (
                  <>
                    <MapPin size={12} />
                    <span>{event.location}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <style jsx>{`
        .today-events {
          padding: 16px 0;
        }
        .today-title {
          font-size: 1rem;
          font-weight: 600;
          color: ${COLORS.text.primary};
          margin: 0 0 12px 0;
        }
        .today-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .today-event-card {
          display: flex;
          align-items: stretch;
          background: ${COLORS.bg.tertiary};
          border-radius: 10px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .today-event-card:hover {
          transform: translateX(4px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        .event-color-bar {
          width: 4px;
          flex-shrink: 0;
        }
        .event-info {
          padding: 10px 14px;
          flex: 1;
          min-width: 0;
        }
        .event-title {
          font-size: 0.9rem;
          font-weight: 500;
          color: ${COLORS.text.primary};
          display: block;
          margin-bottom: 4px;
        }
        .event-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          color: ${COLORS.text.tertiary};
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  );
}
