'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Check, Link2, ShieldCheck, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet, Field } from '@/components/sd/FormSheet';
import {
  getMe, getSettings, updateSetting, listUsers, createGuest, deleteUser,
  type Me, type SettingsMap, type UserSummary,
} from '@/services/settingsService';

const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};
const mono = "'JetBrains Mono',monospace";
const errStyle: React.CSSProperties = { margin: '2px 0 0', fontSize: 12.5, color: 'rgb(239 68 68)' };
const eyebrow: React.CSSProperties = { fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600, marginBottom: 8 };

const has = (v: unknown) => v != null && typeof v === 'object' && Object.keys(v as object).length > 0;

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600,
      padding: '3px 10px', borderRadius: 20, fontFamily: mono,
      background: connected ? 'rgb(16 185 129 / 0.12)' : 'rgb(0 0 0 / 0.05)',
      color: connected ? 'rgb(16 185 129)' : 'rgb(var(--color-tertiary))',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'rgb(16 185 129)' : 'rgb(var(--color-muted))' }} />
      {connected ? 'Connesso' : 'Non connesso'}
    </span>
  );
}

type FieldDef = { name: string; label: string; placeholder?: string; type?: string };

const INTEGRATIONS: { key: string; title: string; desc: string; fields: FieldDef[] }[] = [
  { key: 'htb', title: 'Hack The Box', desc: 'API token per progressi CPTS e box.', fields: [{ name: 'api_token', label: 'API token', placeholder: 'eyJ0eXAiOiJKV1Qi…' }] },
  { key: 'hue', title: 'Philips Hue', desc: 'Bridge locale per le luci.', fields: [{ name: 'bridge_ip', label: 'Bridge IP', placeholder: '192.168.1.20' }, { name: 'app_key', label: 'App key', placeholder: 'xxxxxxxx…' }] },
  { key: 'shelly', title: 'Shelly', desc: 'Cloud auth key + server per i consumi.', fields: [{ name: 'auth_key', label: 'Auth key', placeholder: 'MWE…' }, { name: 'server', label: 'Server', placeholder: 'shelly-12-eu.shelly.cloud' }] },
  { key: 'openbanking', title: 'Open Banking', desc: 'Provider per saldo e transazioni.', fields: [{ name: 'provider', label: 'Provider', placeholder: 'gocardless / enablebanking' }] },
];

export default function ImpostazioniPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [users, setUsers] = useState<UserSummary[]>([]);
  const isEditor = me?.role === 'admin';

  const loadSettings = useCallback(async () => {
    try { setSettings(await getSettings()); } catch { /* keep */ }
  }, []);
  const loadUsers = useCallback(async () => {
    try { setUsers(await listUsers()); } catch { /* guest gets 403 — keep empty */ }
  }, []);
  const loadMe = useCallback(async () => {
    try { setMe(await getMe()); } catch { /* keep */ }
  }, []);

  useEffect(() => { loadMe(); loadSettings(); }, [loadMe, loadSettings]);
  useEffect(() => { if (isEditor) loadUsers(); }, [isEditor, loadUsers]);

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>Sistema</div>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>
          Impo<span style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>stazioni</span>
        </h1>
        <p style={{ margin: '11px 0 0', fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>Integrazioni, aspetto e account.{!isEditor && me ? ' · Account in sola lettura' : ''}</p>
      </header>

      {/* API / Integrazioni */}
      <Section i={1} title="API e integrazioni" hint="Le credenziali restano sul tuo account.">
        <div className="sd-grid2">
          {INTEGRATIONS.map((it, idx) => (
            <IntegrationCard key={it.key} i={2 + idx} def={it} value={settings[it.key]} editor={isEditor} onSaved={loadSettings} />
          ))}
          <GoogleCalendarCard i={6} value={settings['google_calendar']} editor={isEditor} onSaved={loadSettings} />
        </div>
      </Section>

      {/* Style */}
      <Section i={7} title="Aspetto">
        <StyleCard value={settings['style']} editor={isEditor} onSaved={loadSettings} />
      </Section>

      {/* Account */}
      <Section i={8} title="Account">
        <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 9, ...card, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 42, height: 42, borderRadius: 12, background: 'rgb(99 102 241 / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><UserIcon size={20} color="rgb(99 102 241)" /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{me?.full_name || '—'}</div>
            <div style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))', fontFamily: mono }}>{me?.email || '…'}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, padding: '4px 11px', borderRadius: 20, fontFamily: mono, background: isEditor ? 'rgb(99 102 241 / 0.12)' : 'rgb(0 0 0 / 0.05)', color: isEditor ? 'rgb(99 102 241)' : 'rgb(var(--color-tertiary))' }}>
            <ShieldCheck size={13} />{me?.role ?? '—'}
          </span>
        </div>
      </Section>

      {/* Privacy & Accounts (editor only) */}
      {isEditor && (
        <Section i={10} title="Privacy e accessi" hint="Crea account ospite in sola lettura per condividere la dashboard.">
          <AccountsCard i={11} users={users} onChange={loadUsers} />
        </Section>
      )}
    </div>
  );
}

function Section({ i, title, hint, children }: { i: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div className="sd-reveal" style={{ ['--i' as string]: i, margin: '0 0 14px' }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{title}</h3>
        {hint && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgb(var(--color-tertiary))' }}>{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/* ── Integration cards ── */

function IntegrationCard({ i, def, value, editor, onSaved }: {
  i: number; def: typeof INTEGRATIONS[number]; value?: Record<string, unknown>; editor: boolean; onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const connected = has(value);
  return (
    <div className="sd-reveal sd-lift" style={{ ['--i' as string]: i, ...card, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>{def.title}</div>
          <div style={{ fontSize: 12.5, color: 'rgb(var(--color-tertiary))', marginTop: 3 }}>{def.desc}</div>
        </div>
        <StatusPill connected={connected} />
      </div>
      {editor && (
        <div>
          <Button size="sm" variant={connected ? 'secondary' : 'primary'} onClick={() => setOpen(true)}>
            {connected ? 'Modifica' : 'Configura'}
          </Button>
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={def.title} subtitle="Credenziali integrazione" maxWidth={440}>
        <CredentialsForm
          key={open ? 'o' : 'c'}
          fields={def.fields}
          initial={value}
          onCancel={() => setOpen(false)}
          onSubmit={async (payload) => { await updateSetting(def.key, payload); setOpen(false); await onSaved(); }}
        />
      </Sheet>
    </div>
  );
}

function CredentialsForm({ fields, initial, onSubmit, onCancel }: {
  fields: FieldDef[]; initial?: Record<string, unknown>; onSubmit: (v: Record<string, unknown>) => Promise<void>; onCancel: () => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>(
    () => Object.fromEntries(fields.map((f) => [f.name, String(initial?.[f.name] ?? '')])),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fields.every((f) => !vals[f.name].trim())) { setError('Inserisci almeno un valore.'); return; }
    setSubmitting(true); setError('');
    try {
      const payload: Record<string, unknown> = {};
      for (const f of fields) payload[f.name] = vals[f.name].trim();
      await onSubmit(payload);
    } catch { setError('Salvataggio non riuscito. Riprova.'); setSubmitting(false); }
  };

  return (
    <form onSubmit={submit}>
      {fields.map((f, idx) => (
        <Field key={f.name} label={f.label}>
          <input className="sd-input" type={f.type ?? 'text'} value={vals[f.name]} placeholder={f.placeholder} autoFocus={idx === 0}
            onChange={(e) => setVals((v) => ({ ...v, [f.name]: e.target.value }))} />
        </Field>
      ))}
      {error && <p style={errStyle}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annulla</Button>
        <Button type="submit" variant="primary" isLoading={submitting}>Salva</Button>
      </div>
    </form>
  );
}

function GoogleCalendarCard({ i, value, editor, onSaved }: {
  i: number; value?: Record<string, unknown>; editor: boolean; onSaved: () => Promise<void>;
}) {
  const connected = Boolean(value?.['connected']);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    try { await updateSetting('google_calendar', { connected: true }); await onSaved(); }
    finally { setBusy(false); }
  };
  const disconnect = async () => {
    setBusy(true);
    try { await updateSetting('google_calendar', { connected: false }); await onSaved(); }
    finally { setBusy(false); }
  };

  return (
    <div className="sd-reveal sd-lift" style={{ ['--i' as string]: i, ...card, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))' }}>Google Calendar</div>
          <div style={{ fontSize: 12.5, color: 'rgb(var(--color-tertiary))', marginTop: 3 }}>Sincronizza eventi accademici e sessioni.</div>
        </div>
        <StatusPill connected={connected} />
      </div>
      {editor && (
        <div>
          {connected
            ? <Button size="sm" variant="secondary" isLoading={busy} onClick={disconnect}>Disconnetti</Button>
            : <Button size="sm" variant="primary" isLoading={busy} onClick={connect}><Link2 size={15} style={{ marginRight: 6 }} />Connetti</Button>}
        </div>
      )}
    </div>
  );
}

/* ── Style ── */

function StyleCard({ value, editor, onSaved }: { value?: Record<string, unknown>; editor: boolean; onSaved: () => Promise<void> }) {
  const [theme, setTheme] = useState<string>(String(value?.['theme'] ?? 'light'));
  const [lowStim, setLowStim] = useState<boolean>(Boolean(value?.['low_stim']));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTheme(String(value?.['theme'] ?? 'light'));
    setLowStim(Boolean(value?.['low_stim']));
  }, [value]);

  const save = async (next: { theme: string; low_stim: boolean }) => {
    setSaving(true); setSaved(false);
    try {
      await updateSetting('style', next);
      // Mirror low-stim to the layout's local preference so it applies live.
      try { localStorage.setItem('sd-lowstim', next.low_stim ? '1' : '0'); } catch { /* ignore */ }
      await onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } finally { setSaving(false); }
  };

  return (
    <div className="sd-reveal sd-shadow" style={{ ...card, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={eyebrow}>Tema</div>
        <select className="sd-select" value={theme} disabled={!editor || saving} style={{ maxWidth: 260 }}
          onChange={(e) => { const t = e.target.value; setTheme(t); save({ theme: t, low_stim: lowStim }); }}>
          <option value="light">Chiaro</option>
          <option value="dark">Scuro</option>
          <option value="low-stim">Low-stim</option>
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderTop: '1px solid rgb(var(--color-border))', paddingTop: 18 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>Modalità low-stim</div>
          <div style={{ fontSize: 12.5, color: 'rgb(var(--color-tertiary))' }}>Niente movimento, colori desaturati.</div>
        </div>
        <button type="button" disabled={!editor || saving} onClick={() => { const v = !lowStim; setLowStim(v); save({ theme, low_stim: v }); }}
          style={{ position: 'relative', width: 44, height: 26, borderRadius: 20, flex: 'none', border: 'none', cursor: editor ? 'pointer' : 'not-allowed', background: lowStim ? 'rgb(16 185 129)' : 'rgb(0 0 0 / 0.14)', transition: 'background .2s ease' }}>
          <span style={{ position: 'absolute', top: 2, left: 2, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transform: lowStim ? 'translateX(18px)' : 'translateX(0)', transition: 'transform .2s ease' }} />
        </button>
      </div>
      {saved && <div style={{ fontSize: 12.5, color: 'rgb(16 185 129)', display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} />Salvato</div>}
      {!editor && <p style={{ margin: 0, fontSize: 12.5, color: 'rgb(var(--color-tertiary))' }}>Account in sola lettura: l&apos;aspetto non è modificabile.</p>}
    </div>
  );
}

/* ── Accounts (editor only) ── */

function AccountsCard({ i, users, onChange }: { i: number; users: UserSummary[]; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<UserSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    if (!del) return;
    setBusy(true);
    try { await deleteUser(del.id); setDel(null); await onChange(); }
    finally { setBusy(false); }
  };

  return (
    <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: i, ...card, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', fontFamily: mono }}>{users.length} {users.length === 1 ? 'account' : 'account'}</span>
        <Button size="sm" variant="primary" onClick={() => setOpen(true)}><Plus size={15} style={{ marginRight: 6 }} />Account ospite</Button>
      </div>
      {users.length === 0 ? (
        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>Nessun account ancora.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {users.map((u, idx) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: idx === users.length - 1 ? '13px 0 2px' : '13px 0', borderTop: '1px solid rgb(var(--color-border))' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--color-heading))' }}>{u.full_name || u.email}</div>
                <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', fontFamily: mono }}>{u.email}</div>
              </div>
              <span style={{ fontSize: 11, fontFamily: mono, fontWeight: 600, padding: '3px 9px', borderRadius: 20, flex: 'none', background: u.role === 'admin' ? 'rgb(99 102 241 / 0.12)' : 'rgb(0 0 0 / 0.05)', color: u.role === 'admin' ? 'rgb(99 102 241)' : 'rgb(var(--color-tertiary))' }}>{u.role}</span>
              {u.role !== 'admin' && (
                <button className="sd-iconbtn" aria-label="Elimina account" onClick={() => setDel(u)} style={{ flex: 'none' }}><Trash2 size={15} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Nuovo account ospite" subtitle="Accesso in sola lettura" maxWidth={440}>
        <GuestForm key={open ? 'o' : 'c'} onCancel={() => setOpen(false)} onSubmit={async (b) => { await createGuest(b); setOpen(false); await onChange(); }} />
      </Sheet>

      <Sheet open={!!del} onClose={() => setDel(null)} title="Eliminare l'account?" subtitle={del?.email} maxWidth={400}>
        <p style={{ margin: '0 0 4px', fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>L&apos;accesso verrà revocato definitivamente.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <Button variant="secondary" onClick={() => setDel(null)} disabled={busy}>Annulla</Button>
          <Button variant="danger" isLoading={busy} onClick={confirmDelete}>Elimina</Button>
        </div>
      </Sheet>
    </div>
  );
}

function GuestForm({ onSubmit, onCancel }: { onSubmit: (b: { email: string; password: string; full_name: string }) => Promise<void>; onCancel: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Email e password sono obbligatori.'); return; }
    if (password.length < 8) { setError('La password deve avere almeno 8 caratteri.'); return; }
    setSubmitting(true); setError('');
    try {
      await onSubmit({ email: email.trim(), password, full_name: fullName.trim() });
    } catch { setError('Creazione non riuscita. Email già in uso?'); setSubmitting(false); }
  };

  return (
    <form onSubmit={submit}>
      <Field label="Nome"><input className="sd-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Famiglia · ospite" autoFocus /></Field>
      <Field label="Email"><input className="sd-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ospite@example.com" /></Field>
      <Field label="Password" hint="Almeno 8 caratteri."><input className="sd-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></Field>
      {error && <p style={errStyle}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annulla</Button>
        <Button type="submit" variant="primary" isLoading={submitting}>Crea account</Button>
      </div>
    </form>
  );
}
