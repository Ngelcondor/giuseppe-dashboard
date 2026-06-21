'use client';

import React, { useState } from 'react';
import {
  X,
  Link2,
  Check,
  AlertCircle,
  Trash2,
  RefreshCw,
  Shield,
} from 'lucide-react';
import {
  calendarConnections,
  CalendarConnection,
  CreateConnectionPayload,
} from '@/services/calendarService';
import { COLORS } from '@/lib/constants';

interface ConnectionSetupProps {
  connections: CalendarConnection[];
  onClose: () => void;
  onSave: () => void;
}

const PROVIDERS = [
  {
    id: 'apple',
    name: 'Apple Calendar (iCloud)',
    icon: '🍎',
    url: 'https://caldav.icloud.com',
    description: 'Sincronizza con il tuo calendario iCloud',
    helpText: 'Usa il tuo Apple ID come username e una App-Specific Password (generala su appleid.apple.com → Accesso e sicurezza → Password per le app).',
  },
  {
    id: 'google',
    name: 'Google Calendar',
    icon: '📅',
    url: 'https://apidata.googleusercontent.com/caldav/v2',
    description: 'Sincronizza con Google Calendar',
    helpText: 'Usa la tua email Google come username e una App Password (generala su myaccount.google.com → Sicurezza → Password per le app).',
  },
  {
    id: 'nextcloud',
    name: 'Nextcloud',
    icon: '☁️',
    url: '',
    description: 'Sincronizza con la tua istanza Nextcloud',
    helpText: 'Inserisci l\'URL CalDAV del tuo server Nextcloud (es. https://tuo-server.com/remote.php/dav).',
  },
];

export default function ConnectionSetup({ connections, onClose, onSave }: ConnectionSetupProps) {
  const [showNewForm, setShowNewForm] = useState(connections.length === 0);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedProviderInfo = PROVIDERS.find((p) => p.id === selectedProvider);

  const handleCreate = async () => {
    if (!selectedProvider || !username || !appPassword) {
      setError('Compila tutti i campi obbligatori.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload: CreateConnectionPayload = {
        provider: selectedProvider,
        display_name: displayName || selectedProviderInfo?.name || selectedProvider,
        username,
        app_password: appPassword,
      };

      // Use custom URL for providers that need it
      if (selectedProvider === 'nextcloud' || customUrl) {
        payload.caldav_url = customUrl;
      }

      await calendarConnections.create(payload);
      onSave();
    } catch (err: any) {
      const detail = err?.data?.detail || err?.message || 'Errore nella connessione.';
      setError(detail);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await calendarConnections.delete(id);
      onSave();
    } catch (err) {
      console.error('Errore nella cancellazione:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-left">
            <Link2 size={18} />
            <h3>Connessioni Calendario</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Existing connections */}
          {connections.length > 0 && (
            <div className="connections-list">
              {connections.map((conn) => (
                <div key={conn.id} className="connection-card">
                  <div className="connection-info">
                    <span className="connection-icon">
                      {conn.provider === 'apple' ? '🍎' : conn.provider === 'google' ? '📅' : '☁️'}
                    </span>
                    <div>
                      <span className="connection-name">{conn.display_name}</span>
                      <span className="connection-user">{conn.username}</span>
                      {conn.last_sync_at && (
                        <span className="connection-sync">
                          {conn.last_sync_status === 'success' ? (
                            <Check size={12} className="success-icon" />
                          ) : (
                            <AlertCircle size={12} className="error-icon" />
                          )}
                          Ultimo sync: {new Date(conn.last_sync_at).toLocaleString('it-IT')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="delete-connection-btn"
                    onClick={() => handleDelete(conn.id)}
                    disabled={deletingId === conn.id}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* New connection form */}
          {showNewForm ? (
            <div className="new-connection-form">
              <h4>Nuova Connessione</h4>

              {/* Provider selection */}
              <div className="provider-grid">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    className={`provider-card ${selectedProvider === provider.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedProvider(provider.id);
                      setDisplayName(provider.name);
                      setError('');
                    }}
                  >
                    <span className="provider-icon">{provider.icon}</span>
                    <span className="provider-name">{provider.name}</span>
                  </button>
                ))}
              </div>

              {/* Provider-specific form */}
              {selectedProviderInfo && (
                <>
                  <div className="help-banner">
                    <Shield size={14} />
                    <p>{selectedProviderInfo.helpText}</p>
                  </div>

                  <div className="form-group">
                    <label>Nome visualizzato</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Es. Il mio calendario Apple"
                    />
                  </div>

                  <div className="form-group">
                    <label>Username / Email</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={
                        selectedProvider === 'apple'
                          ? 'tuoid@icloud.com'
                          : selectedProvider === 'google'
                          ? 'tuoid@gmail.com'
                          : 'username'
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>App-Specific Password</label>
                    <input
                      type="password"
                      value={appPassword}
                      onChange={(e) => setAppPassword(e.target.value)}
                      placeholder="xxxx-xxxx-xxxx-xxxx"
                    />
                  </div>

                  {selectedProvider === 'nextcloud' && (
                    <div className="form-group">
                      <label>URL CalDAV</label>
                      <input
                        type="url"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="https://tuo-server.com/remote.php/dav"
                      />
                    </div>
                  )}

                  {error && (
                    <div className="error-message">
                      <AlertCircle size={14} />
                      {error}
                    </div>
                  )}

                  <button
                    className="connect-action-btn"
                    onClick={handleCreate}
                    disabled={saving || !username || !appPassword}
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={14} className="spinning" />
                        Connessione in corso...
                      </>
                    ) : (
                      <>
                        <Link2 size={14} />
                        Connetti Calendario
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          ) : (
            <button className="add-connection-btn" onClick={() => setShowNewForm(true)}>
              + Aggiungi connessione
            </button>
          )}
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
          max-width: 560px;
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
        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          color: ${COLORS.text.primary};
        }
        .header-left h3 {
          margin: 0;
          font-size: 1.1rem;
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

        .modal-body {
          padding: 12px 24px 24px;
        }

        /* Existing connections */
        .connections-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }
        .connection-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: ${COLORS.bg.primary};
          border-radius: 10px;
          padding: 14px 16px;
          border: 1px solid ${COLORS.bg.tertiary};
        }
        .connection-info {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .connection-icon {
          font-size: 1.4rem;
          margin-top: 2px;
        }
        .connection-name {
          display: block;
          font-weight: 500;
          color: ${COLORS.text.primary};
          font-size: 0.9rem;
        }
        .connection-user {
          display: block;
          color: ${COLORS.text.tertiary};
          font-size: 0.8rem;
        }
        .connection-sync {
          display: flex;
          align-items: center;
          gap: 4px;
          color: ${COLORS.text.tertiary};
          font-size: 0.75rem;
          margin-top: 2px;
        }
        .delete-connection-btn {
          background: none;
          border: none;
          color: ${COLORS.text.tertiary};
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .delete-connection-btn:hover {
          color: ${COLORS.danger};
          background: rgba(239, 68, 68, 0.1);
        }

        /* New connection form */
        .new-connection-form h4 {
          font-size: 0.95rem;
          color: ${COLORS.text.primary};
          margin: 0 0 16px 0;
        }

        .provider-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .provider-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 10px;
          background: ${COLORS.bg.primary};
          border: 2px solid ${COLORS.bg.tertiary};
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .provider-card:hover {
          border-color: ${COLORS.primary};
        }
        .provider-card.selected {
          border-color: ${COLORS.primary};
          background: rgba(59, 130, 246, 0.08);
        }
        .provider-icon {
          font-size: 1.6rem;
        }
        .provider-name {
          font-size: 0.75rem;
          color: ${COLORS.text.secondary};
          text-align: center;
          font-weight: 500;
        }

        .help-banner {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          background: rgba(59, 130, 246, 0.08);
          border-radius: 10px;
          margin-bottom: 16px;
          border: 1px solid rgba(59, 130, 246, 0.15);
        }
        .help-banner p {
          margin: 0;
          font-size: 0.8rem;
          color: ${COLORS.text.secondary};
          line-height: 1.4;
        }

        .form-group {
          margin-bottom: 14px;
        }
        .form-group label {
          display: block;
          font-size: 0.8rem;
          font-weight: 500;
          color: ${COLORS.text.tertiary};
          margin-bottom: 6px;
        }
        .form-group input {
          width: 100%;
          background: ${COLORS.bg.primary};
          border: 1px solid ${COLORS.bg.tertiary};
          border-radius: 8px;
          padding: 10px 14px;
          color: ${COLORS.text.primary};
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .form-group input:focus {
          border-color: ${COLORS.primary};
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 8px;
          color: ${COLORS.danger};
          font-size: 0.8rem;
          margin-bottom: 16px;
        }

        .connect-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px;
          background: ${COLORS.primary};
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: filter 0.2s;
        }
        .connect-action-btn:hover {
          filter: brightness(1.1);
        }
        .connect-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .add-connection-btn {
          width: 100%;
          padding: 14px;
          background: transparent;
          border: 2px dashed ${COLORS.bg.tertiary};
          border-radius: 10px;
          color: ${COLORS.text.tertiary};
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .add-connection-btn:hover {
          border-color: ${COLORS.primary};
          color: ${COLORS.primary};
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinning {
          animation: spin 1s linear infinite;
        }

        @media (max-width: 480px) {
          .provider-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
