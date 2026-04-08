'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Settings,
  Bell,
  Moon,
  Sun,
  Monitor,
  Zap,
  Clock,
  Pill,
  Check,
  X,
  AlertTriangle,
  ExternalLink,
  Shield,
  Lock,
  Eye,
  EyeOff,
  User,
  ChevronRight,
  KeyRound,
  Webhook,
  Plus,
  Trash2,
  Copy,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import notificationService from '@/services/notificationService';
import apiTokenService, { APIToken, APITokenCreated, WebhookSecretInfo } from '@/services/apiTokenService';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';

// ─── Setting Section ─────────────────────────────────────────────────────────

function SettingSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-card border border-border-default overflow-hidden">
      <div className="px-5 py-4 border-b border-border-default flex items-center gap-3">
        <div className="text-tertiary">{icon}</div>
        <div>
          <h3 className="text-sm font-semibold text-heading">{title}</h3>
          {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

// ─── Setting Row ─────────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-body">{label}</p>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// ─── Toggle Component ────────────────────────────────────────────────────────

function Toggle({
  enabled,
  onToggle,
  color = 'bg-blue-600',
  disabled = false,
}: {
  enabled: boolean;
  onToggle: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
        enabled ? color : 'bg-slate-600 dark:bg-slate-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ─── Password Change Modal ──────────────────────────────────────────────────

function PasswordChangeModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = passwordStrength(newPassword);
  const strengthLabel = ['', 'Debole', 'Debole', 'Media', 'Forte', 'Molto forte'][strength] || '';
  const strengthColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'][strength] || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Le password non coincidono');
      return;
    }

    if (newPassword.length < 8) {
      setError('La password deve essere di almeno 8 caratteri');
      return;
    }

    try {
      setLoading(true);
      await api.put('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Errore nel cambio password');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border-default p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <KeyRound size={20} className="text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-heading">Cambia Password</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-body transition-colors">
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check size={24} className="text-emerald-400" />
            </div>
            <p className="text-sm text-emerald-400 font-medium">Password aggiornata!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-900/20 border border-red-700/30 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-tertiary">Password attuale</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg bg-input border border-border-default text-body text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-colors"
                  placeholder="Inserisci password attuale"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-body transition-colors"
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-tertiary">Nuova password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg bg-input border border-border-default text-body text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-colors"
                  placeholder="Inserisci nuova password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-body transition-colors"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {newPassword && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
                      style={{ width: `${(strength / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted">{strengthLabel}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-tertiary">Conferma nuova password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg bg-input border text-body text-sm focus:ring-1 outline-none transition-colors ${
                  confirmPassword && confirmPassword !== newPassword
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30'
                    : 'border-border-default focus:border-blue-500 focus:ring-blue-500/30'
                }`}
                placeholder="Ripeti nuova password"
                required
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-[10px] text-red-400">Le password non coincidono</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Aggiornamento...' : 'Aggiorna Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Create Token Modal ────────────────────────────────────────────────────

function CreateTokenModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (token: APITokenCreated) => void;
}) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState('webhook');
  const [description, setDescription] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      const result = await apiTokenService.create({
        name,
        scope,
        description: description || undefined,
        expires_in_days: expiresInDays ? parseInt(expiresInDays) : undefined,
      });
      onCreated(result);
      setName('');
      setScope('webhook');
      setDescription('');
      setExpiresInDays('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Errore nella creazione del token');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border-default p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <KeyRound size={20} className="text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-heading">Nuovo Token API</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-body transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-900/20 border border-red-700/30 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-tertiary">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-input border border-border-default text-body text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-colors"
              placeholder="es. Health Auto Export"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-tertiary">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'webhook', label: 'Webhook' },
                { value: 'api', label: 'API' },
                { value: 'full', label: 'Completo' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setScope(opt.value)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    scope === opt.value
                      ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                      : 'border-border-default bg-card-inner text-muted hover:text-body'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-tertiary">Scadenza (giorni, opzionale)</label>
            <input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-input border border-border-default text-body text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-colors"
              placeholder="Lascia vuoto per nessuna scadenza"
              min="1"
              max="365"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-tertiary">Descrizione (opzionale)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-input border border-border-default text-body text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-colors"
              placeholder="es. Token per sincronizzazione Apple Watch"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name}
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Creazione...' : 'Genera Token'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Token Created Banner ──────────────────────────────────────────────────

function TokenCreatedBanner({
  token,
  onDismiss,
}: {
  token: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="px-4 py-3 rounded-xl bg-violet-900/20 border border-violet-700/30 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-violet-300">Token creato! Copialo ora, non sara piu visibile.</p>
        <button onClick={onDismiss} className="text-violet-400 hover:text-violet-300">
          <X size={16} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 rounded-lg bg-black/30 text-xs text-violet-200 font-mono break-all select-all">
          {token}
        </code>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copiato!' : 'Copia'}
        </button>
      </div>
    </div>
  );
}

// ─── API Token Section ─────────────────────────────────────────────────────

function APITokenSection() {
  const [tokens, setTokens] = useState<APIToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [webhookSecret, setWebhookSecret] = useState<WebhookSecretInfo | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  useEffect(() => {
    loadTokens();
    loadWebhookSecret();
  }, []);

  const loadTokens = async () => {
    try {
      const data = await apiTokenService.list();
      setTokens(data.tokens);
    } catch (err) {
      console.error('Error loading tokens:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadWebhookSecret = async () => {
    try {
      const data = await apiTokenService.getWebhookSecret();
      setWebhookSecret(data);
    } catch (err) {
      console.error('Error loading webhook secret:', err);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    if (!confirm('Sei sicuro di voler revocare questo token?')) return;
    try {
      await apiTokenService.revoke(tokenId);
      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
    } catch (err) {
      console.error('Error revoking token:', err);
    }
  };

  const handleToggle = async (tokenId: string) => {
    try {
      const updated = await apiTokenService.toggle(tokenId);
      setTokens((prev) => prev.map((t) => (t.id === tokenId ? updated : t)));
    } catch (err) {
      console.error('Error toggling token:', err);
    }
  };

  const handleRevealSecret = async () => {
    try {
      const secret = await apiTokenService.revealWebhookSecret();
      setRevealedSecret(secret);
    } catch (err) {
      console.error('Error revealing secret:', err);
    }
  };

  const handleCopySecret = async () => {
    if (!revealedSecret) return;
    await navigator.clipboard.writeText(revealedSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <>
      <SettingSection
        icon={<Webhook size={18} />}
        title="API & Webhook"
        description="Gestisci i token per integrazioni esterne e Health Auto Export"
      >
        {/* Webhook Secret (Apple Health) */}
        <div className="px-4 py-3 rounded-xl bg-card-inner border border-border-default space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-body font-medium">Webhook Apple Health</p>
              <p className="text-xs text-muted mt-0.5">
                {webhookSecret?.is_configured
                  ? `Token configurato: ${webhookSecret.secret_preview}`
                  : 'Non configurato'}
              </p>
            </div>
            <div className={`w-2 h-2 rounded-full ${webhookSecret?.is_configured ? 'bg-emerald-400' : 'bg-red-400'}`} />
          </div>

          {webhookSecret?.is_configured && (
            <div className="flex items-center gap-2">
              {revealedSecret ? (
                <>
                  <code className="flex-1 px-3 py-2 rounded-lg bg-black/30 text-xs text-body font-mono break-all select-all">
                    {revealedSecret}
                  </code>
                  <button
                    onClick={handleCopySecret}
                    className="flex-shrink-0 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    {secretCopied ? <Check size={14} /> : <Copy size={14} />}
                    {secretCopied ? 'Copiato!' : 'Copia'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleRevealSecret}
                  className="px-3 py-2 rounded-lg bg-card border border-border-default hover:border-border-hover text-xs text-body font-medium transition-all flex items-center gap-1.5"
                >
                  <Eye size={14} />
                  Mostra token completo
                </button>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted">
            Usa questo token come Bearer in Health Auto Export su iPhone.
            Endpoint: <code className="text-violet-400">/api/v1/health/apple/webhook</code>
          </p>
        </div>

        {/* Newly Created Token Banner */}
        {newlyCreatedToken && (
          <TokenCreatedBanner
            token={newlyCreatedToken}
            onDismiss={() => setNewlyCreatedToken(null)}
          />
        )}

        {/* Token List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-body font-medium">Token API</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Plus size={14} />
              Nuovo
            </button>
          </div>

          {loading ? (
            <div className="py-6 text-center text-xs text-muted">Caricamento...</div>
          ) : tokens.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted">
              Nessun token API creato. Crea un token per integrazioni esterne.
            </div>
          ) : (
            <div className="space-y-2">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className={`px-4 py-3 rounded-xl border transition-all ${
                    token.is_active
                      ? 'bg-card-inner border-border-default'
                      : 'bg-card-inner/50 border-border-default/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-body font-medium truncate">{token.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          token.scope === 'webhook'
                            ? 'bg-blue-500/10 text-blue-400'
                            : token.scope === 'api'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {token.scope}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <code className="text-[10px] text-muted font-mono">{token.token_prefix}...</code>
                        <span className="text-[10px] text-muted">
                          Creato: {formatDate(token.created_at)}
                        </span>
                        {token.last_used_at && (
                          <span className="text-[10px] text-muted">
                            Ultimo uso: {formatDate(token.last_used_at)}
                          </span>
                        )}
                        {token.expires_at && (
                          <span className="text-[10px] text-amber-400">
                            Scade: {formatDate(token.expires_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3">
                      <button
                        onClick={() => handleToggle(token.id)}
                        className="p-1.5 rounded-lg hover:bg-card transition-colors"
                        title={token.is_active ? 'Disattiva' : 'Attiva'}
                      >
                        {token.is_active ? (
                          <ToggleRight size={18} className="text-emerald-400" />
                        ) : (
                          <ToggleLeft size={18} className="text-muted" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRevoke(token.id)}
                        className="p-1.5 rounded-lg hover:bg-red-900/20 transition-colors"
                        title="Revoca token"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingSection>

      <CreateTokenModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(result) => {
          setNewlyCreatedToken(result.token);
          setTokens((prev) => [result, ...prev]);
          setShowCreateModal(false);
        }}
      />
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [permissionState, setPermissionState] = useState<string>('default');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Theme store
  const { theme, lowStim, setTheme, toggleLowStim } = useThemeStore();
  const { user } = useAuthStore();

  // Notification settings (local for now)
  const [medReminders, setMedReminders] = useState(true);
  const [routineReminders, setRoutineReminders] = useState(true);
  const [sleepReminders, setSleepReminders] = useState(true);
  const [deadlineReminders, setDeadlineReminders] = useState(true);

  useEffect(() => {
    const checkPush = async () => {
      const subscribed = await notificationService.isSubscribed();
      setPushEnabled(subscribed);
      setPermissionState(notificationService.getPermissionState());
    };
    checkPush();
  }, []);

  const handleTogglePush = async () => {
    try {
      setPushLoading(true);
      setError(null);

      if (pushEnabled) {
        await notificationService.unsubscribe();
        setPushEnabled(false);
        setSuccess('Push notification disattivate');
      } else {
        const permission = await notificationService.requestPermission();
        setPermissionState(permission);

        if (permission !== 'granted') {
          setError('Permesso per le notifiche negato. Abilitalo nelle impostazioni del browser.');
          return;
        }

        const ok = await notificationService.registerServiceWorker();
        if (ok) {
          setPushEnabled(true);
          setSuccess('Push notification attivate!');
        } else {
          setError("Errore nell'attivazione delle push notification");
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Errore');
    } finally {
      setPushLoading(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-page text-body">
      <header className="px-6 py-5 border-b border-border-default flex items-center gap-3">
        <Link href="/dashboard" className="text-muted hover:text-body transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Settings size={18} className="text-tertiary" />
        <h1 className="text-base font-semibold text-heading">Pannello di Controllo</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status banners */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400"><X size={16} /></button>
          </div>
        )}
        {success && (
          <div className="px-4 py-3 rounded-lg bg-emerald-900/20 border border-emerald-700/30 flex items-center gap-3">
            <Check size={18} className="text-emerald-400" />
            <p className="text-sm text-emerald-300">{success}</p>
          </div>
        )}

        {/* Appearance */}
        <SettingSection
          icon={<Monitor size={18} />}
          title="Aspetto"
          description="Personalizza il tema e l'aspetto della dashboard"
        >
          {/* Theme selector */}
          <div className="space-y-2">
            <p className="text-sm text-body">Tema</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'dark' as const, label: 'Scuro', icon: <Moon size={16} /> },
                { value: 'light' as const, label: 'Chiaro', icon: <Sun size={16} /> },
                { value: 'system' as const, label: 'Sistema', icon: <Monitor size={16} /> },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-200 ${
                    theme === option.value
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-border-default bg-card-inner hover:border-border-hover text-muted hover:text-body'
                  }`}
                >
                  {option.icon}
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Low stim mode */}
          <SettingRow
            label="Modalita bassa stimolazione"
            description="Riduce animazioni, colori e complessita visiva"
          >
            <Toggle enabled={lowStim} onToggle={toggleLowStim} color="bg-violet-600" />
          </SettingRow>
        </SettingSection>

        {/* Security */}
        <SettingSection
          icon={<Shield size={18} />}
          title="Sicurezza"
          description="Gestisci la sicurezza del tuo account"
        >
          {/* Change Password */}
          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-card-inner border border-border-default hover:border-border-hover transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Lock size={16} className="text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-sm text-body font-medium">Cambia password</p>
                <p className="text-xs text-muted">Aggiorna la password del tuo account</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-muted group-hover:text-body transition-colors" />
          </button>

          {/* Account Management */}
          <button
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-card-inner border border-border-default hover:border-border-hover transition-all group"
            onClick={() => {/* TODO: Account management */}}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <User size={16} className="text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="text-sm text-body font-medium">Gestione account</p>
                <p className="text-xs text-muted">Email, username e impostazioni profilo</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-muted group-hover:text-body transition-colors" />
          </button>

          {/* 2FA - Predisposto per il futuro */}
          <button
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-card-inner border border-border-default hover:border-border-hover transition-all group"
            onClick={() => {/* TODO: 2FA setup */}}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <KeyRound size={16} className="text-amber-400" />
              </div>
              <div className="text-left">
                <p className="text-sm text-body font-medium">Autenticazione a due fattori</p>
                <p className="text-xs text-muted">Aggiungi un ulteriore livello di protezione</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-muted group-hover:text-body transition-colors" />
          </button>
        </SettingSection>

        {/* API & Webhook */}
        <APITokenSection />

        {/* Push Notifications */}
        <SettingSection
          icon={<Bell size={18} />}
          title="Notifiche Push"
          description="Ricevi notifiche sul dispositivo per farmaci, routine e scadenze"
        >
          <SettingRow
            label="Attiva push notification"
            description={
              permissionState === 'denied'
                ? 'Permesso negato — abilitalo nelle impostazioni del browser'
                : permissionState === 'unsupported'
                ? 'Non supportato su questo browser'
                : pushEnabled
                ? 'Le notifiche push sono attive'
                : 'Le notifiche push sono disattivate'
            }
          >
            <Toggle
              enabled={pushEnabled}
              onToggle={handleTogglePush}
              color="bg-emerald-600"
              disabled={pushLoading || permissionState === 'unsupported'}
            />
          </SettingRow>

          <SettingRow label="Promemoria farmaci" description="Notifica agli orari programmati">
            <Toggle enabled={medReminders} onToggle={() => setMedReminders(!medReminders)} color="bg-indigo-600" />
          </SettingRow>

          <SettingRow label="Promemoria routine" description="Notifica all'orario della routine">
            <Toggle enabled={routineReminders} onToggle={() => setRoutineReminders(!routineReminders)} color="bg-green-600" />
          </SettingRow>

          <SettingRow label="Report mattutino sonno" description="Buongiorno con dati del sonno">
            <Toggle enabled={sleepReminders} onToggle={() => setSleepReminders(!sleepReminders)} color="bg-blue-600" />
          </SettingRow>

          <SettingRow label="Scadenze" description="Notifica per deadline in scadenza">
            <Toggle enabled={deadlineReminders} onToggle={() => setDeadlineReminders(!deadlineReminders)} color="bg-orange-600" />
          </SettingRow>
        </SettingSection>

        {/* Quick Links */}
        <SettingSection
          icon={<Zap size={18} />}
          title="Accesso rapido"
        >
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Notifiche', href: '/notifications', icon: <Bell size={16} />, color: 'text-blue-400' },
              { label: 'Farmaci', href: '/dashboard/health/medications', icon: <Pill size={16} />, color: 'text-indigo-400' },
              { label: 'Sonno', href: '/dashboard/health/sleep', icon: <Moon size={16} />, color: 'text-blue-400' },
              { label: 'Routine', href: '/dashboard/routines', icon: <Clock size={16} />, color: 'text-green-400' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card-inner border border-border-default hover:border-border-hover transition-all"
              >
                <span className={item.color}>{item.icon}</span>
                <span className="text-sm text-body">{item.label}</span>
                <ExternalLink size={12} className="text-muted ml-auto" />
              </Link>
            ))}
          </div>
        </SettingSection>

        {/* Info */}
        <div className="text-center pt-4 pb-8">
          <p className="text-[10px] text-muted">Giuseppe Dashboard v1.0.0</p>
          <p className="text-[10px] text-muted/50 mt-1">FastAPI + Next.js + PostgreSQL</p>
        </div>
      </main>

      {/* Password Modal */}
      <PasswordChangeModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
}
