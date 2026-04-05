'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, AlignLeft, Trash2, Save } from 'lucide-react';
import { CalendarEvent } from '@/types';
import { calendarEvents } from '@/services/calendarService';
import { COLORS } from '@/lib/constants';

interface EventModalProps {
  event: CalendarEvent | null;
  defaultDate: Date | null;
  onClose: () => void;
  onSave: () => void;
}

const EVENT_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
];

export default function EventModal({ event, defaultDate, onClose, onSave }: EventModalProps) {
  const isEditing = !!event;
  const isExternal = event?.calendar && event.calendar !== 'manual';

  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState(event?.location || '');
  const [color, setColor] = useState(event?.color || '#3B82F6');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (event) {
      setStartTime(formatDateTimeLocal(new Date(event.startTime)));
      setEndTime(formatDateTimeLocal(new Date(event.endTime)));
    } else if (defaultDate) {
      const start = new Date(defaultDate);
      start.setHours(9, 0, 0, 0);
      const end = new Date(defaultDate);
      end.setHours(10, 0, 0, 0);
      setStartTime(formatDateTimeLocal(start));
      setEndTime(formatDateTimeLocal(end));
    }
  }, [event, defaultDate]);

  function formatDateTimeLocal(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  const handleSave = async () => {
    if (!title.trim() || !startTime || !endTime) return;

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        location: location.trim() || undefined,
        color,
        source: 'manual',
      };

      if (isEditing && event) {
        await calendarEvents.update(event.id, payload as any);
      } else {
        await calendarEvents.create(payload as any);
      }
      onSave();
    } catch (err) {
      console.error('Errore nel salvataggio evento:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    setDeleting(true);
    try {
      await calendarEvents.delete(event.id);
      onSave();
    } catch (err) {
      console.error('Errore nella cancellazione evento:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3>{isEditing ? 'Dettaglio Evento' : 'Nuovo Evento'}</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* External event notice */}
        {isExternal && (
          <div className="external-notice">
            Evento sincronizzato da {event?.calendar}. Le modifiche vanno fatte sul calendario originale.
          </div>
        )}

        {/* Form */}
        <div className="modal-body">
          <div className="form-group">
            <label>
              <Calendar size={14} />
              Titolo
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nome dell'evento"
              disabled={!!isExternal}
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                <Clock size={14} />
                Inizio
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={!!isExternal}
              />
            </div>
            <div className="form-group">
              <label>
                <Clock size={14} />
                Fine
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={!!isExternal}
              />
            </div>
          </div>

          <div className="form-group">
            <label>
              <MapPin size={14} />
              Luogo
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Dove?"
              disabled={!!isExternal}
            />
          </div>

          <div className="form-group">
            <label>
              <AlignLeft size={14} />
              Descrizione
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Note sull'evento..."
              rows={3}
              disabled={!!isExternal}
            />
          </div>

          {/* Color picker */}
          {!isExternal && (
            <div className="form-group">
              <label>Colore</label>
              <div className="color-picker">
                {EVENT_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`color-dot ${color === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    type="button"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {isEditing && !isExternal && (
            <button className="delete-btn" onClick={handleDelete} disabled={deleting}>
              <Trash2 size={14} />
              {deleting ? 'Elimino...' : 'Elimina'}
            </button>
          )}
          <div className="footer-right">
            <button className="cancel-btn" onClick={onClose}>
              Annulla
            </button>
            {!isExternal && (
              <button
                className="save-btn"
                onClick={handleSave}
                disabled={saving || !title.trim()}
              >
                <Save size={14} />
                {saving ? 'Salvo...' : 'Salva'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .modal-content {
          background: ${COLORS.bg.secondary};
          border-radius: 16px;
          width: 90%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          border: 1px solid ${COLORS.bg.tertiary};
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 12px;
        }
        .modal-header h3 {
          margin: 0;
          font-size: 1.1rem;
          color: ${COLORS.text.primary};
        }
        .close-btn {
          background: none;
          border: none;
          color: ${COLORS.text.tertiary};
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
        }
        .close-btn:hover {
          color: ${COLORS.text.primary};
          background: ${COLORS.bg.tertiary};
        }

        .external-notice {
          margin: 0 24px 12px;
          padding: 10px 14px;
          background: rgba(245, 158, 11, 0.1);
          border-radius: 8px;
          font-size: 0.8rem;
          color: ${COLORS.warning};
          border: 1px solid rgba(245, 158, 11, 0.2);
        }

        .modal-body {
          padding: 12px 24px;
        }

        .form-group {
          margin-bottom: 16px;
        }
        .form-group label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          font-weight: 500;
          color: ${COLORS.text.tertiary};
          margin-bottom: 6px;
        }
        .form-group input,
        .form-group textarea {
          width: 100%;
          background: ${COLORS.bg.primary};
          border: 1px solid ${COLORS.bg.tertiary};
          border-radius: 8px;
          padding: 10px 14px;
          color: ${COLORS.text.primary};
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
          box-sizing: border-box;
        }
        .form-group input:focus,
        .form-group textarea:focus {
          border-color: ${COLORS.primary};
        }
        .form-group input:disabled,
        .form-group textarea:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .color-picker {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .color-dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid transparent;
          cursor: pointer;
          transition: transform 0.15s, border-color 0.15s;
        }
        .color-dot:hover {
          transform: scale(1.15);
        }
        .color-dot.selected {
          border-color: ${COLORS.text.primary};
          transform: scale(1.15);
        }

        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px 20px;
          border-top: 1px solid ${COLORS.bg.tertiary};
        }
        .footer-right {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }

        .delete-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 8px;
          border: none;
          background: rgba(239, 68, 68, 0.1);
          color: ${COLORS.danger};
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .delete-btn:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .cancel-btn {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid ${COLORS.bg.tertiary};
          background: transparent;
          color: ${COLORS.text.secondary};
          font-size: 0.85rem;
          cursor: pointer;
        }
        .cancel-btn:hover {
          background: ${COLORS.bg.tertiary};
        }

        .save-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 8px;
          border: none;
          background: ${COLORS.primary};
          color: white;
          font-size: 0.85rem;
          cursor: pointer;
          transition: filter 0.2s;
        }
        .save-btn:hover {
          filter: brightness(1.1);
        }
        .save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
