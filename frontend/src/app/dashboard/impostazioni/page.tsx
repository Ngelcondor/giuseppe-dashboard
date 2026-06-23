'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Check, ShieldCheck, User as UserIcon, RefreshCw, CalendarDays, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet, Field } from '@/components/sd/FormSheet';
import {
  getMe, getSettings, updateSetting, listUsers, createGuest, deleteUser,
  type Me, type SettingsMap, type UserSummary,
} from '@/services/settingsService';
import {
  calendarConnections, type CalendarConnection, type CreateConnectionPayload, type CalDAVCalendarInfo,
} from '@/services/calendarService';

const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};
const mono = "'JetBrains Mono',monospace";
const errStyle: React.CSSProperties = { margin: '2px 0 0', fontSize: 12.5, color: 'rgb(239 68 68)' };
const eyebrow: React.CSSProperties = { fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600, marginBottom: 8 };
// Action bar pinned to the bottom of a scrollable Sheet body (so it stays
// reachable on short viewports). Negative margins span the body's 24px padding.
const stickyBar: React.CSSProperties = {
  position: 'sticky', bottom: 0, display: 'flex', gap: 10, justifyContent: 'flex-end',
  marginTop: 10, marginLeft: -24, marginRight: -24, padding: '12px 24px 4px',
  background: 'rgb(var(--color-card))', borderTop: '1px solid rgb(var(--color-border))',
};

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
        </div>
      </Section>

      {/* Calendari (CalDAV) */}
      <Section i={6} title="Calendari" hint="Collega più calendari (iCloud, Google, Nextcloud, CalDAV) e scegli quali importare. Sync automatico ogni 15 min.">
        <CalendarConnectionsCard editor={isEditor} />
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

/* ── Calendari (CalDAV connections) ── */

const CAL_PROVIDERS: { id: string; name: string; icon: string; url: string; help: string; userPh: string }[] = [
  { id: 'apple', name: 'Apple iCloud', icon: '🍎', url: 'https://caldav.icloud.com', userPh: 'tuoid@icloud.com', help: 'Apple ID come username + App-Specific Password (appleid.apple.com → Accesso e sicurezza → Password per le app).' },
  { id: 'google', name: 'Google', icon: '📅', url: 'https://apidata.googleusercontent.com/caldav/v2', userPh: 'tuoid@gmail.com', help: 'Email Google + App Password (myaccount.google.com → Sicurezza → Password per le app).' },
  { id: 'nextcloud', name: 'Nextcloud', icon: '☁️', url: '', userPh: 'username', help: 'Inserisci l\'URL CalDAV del server (es. https://server/remote.php/dav).' },
  { id: 'custom', name: 'CalDAV', icon: '🗓️', url: '', userPh: 'username', help: 'Server CalDAV generico: URL completo + username + password.' },
];
const provIcon = (p: string) => CAL_PROVIDERS.find((x) => x.id === p)?.icon ?? '🗓️';

function syncLine(c: CalendarConnection): { text: string; color: string } {
  if (c.last_sync_status === 'success' && c.last_sync_at)
    return { text: `Sincronizzato ${new Date(c.last_sync_at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, color: 'rgb(16 185 129)' };
  if (c.last_sync_status === 'error')
    return { text: c.last_sync_error ? `Errore: ${c.last_sync_error.slice(0, 80)}` : 'Errore di sincronizzazione', color: 'rgb(239 68 68)' };
  return { text: 'Mai sincronizzato', color: 'rgb(var(--color-tertiary))' };
}

function CalendarConnectionsCard({ editor }: { editor: boolean }) {
  const [conns, setConns] = useState<CalendarConnection[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [picker, setPicker] = useState<CalendarConnection | null>(null);
  const [del, setDel] = useState<CalendarConnection | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const load = useCallback(async () => {
    try { setConns(await calendarConnections.list()); } catch { /* keep */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const doSync = async (c: CalendarConnection) => {
    setBusyId(c.id);
    try { await calendarConnections.sync(c.id, { days_back: 30, days_forward: 365 }); await load(); }
    catch { /* surfaced via last_sync_status on reload */ await load(); }
    finally { setBusyId(null); }
  };
  const confirmDelete = async () => {
    if (!del) return;
    setDelBusy(true);
    try { await calendarConnections.delete(del.id); setDel(null); await load(); }
    finally { setDelBusy(false); }
  };

  return (
    <div className="sd-reveal sd-shadow" style={{ ['--i' as string]: 6, ...card, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: conns.length ? 6 : 0 }}>
        <span style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', fontFamily: mono }}>{conns.length} {conns.length === 1 ? 'calendario' : 'calendari'}</span>
        {editor && <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}><Plus size={15} style={{ marginRight: 6 }} />Aggiungi calendario</Button>}
      </div>

      {conns.length === 0 ? (
        <p style={{ margin: '10px 0 0', fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>
          <CalendarDays size={15} style={{ verticalAlign: '-2px', marginRight: 6, opacity: 0.7 }} />
          Nessun calendario collegato. {editor ? 'Aggiungine uno per importare i tuoi eventi.' : ''}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {conns.map((c, idx) => {
            const s = syncLine(c);
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: idx === conns.length - 1 ? '14px 0 2px' : '14px 0', borderTop: '1px solid rgb(var(--color-border))' }}>
                <span style={{ fontSize: 22, flex: 'none', lineHeight: 1 }} aria-hidden>{provIcon(c.provider)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.display_name}</div>
                  <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', fontFamily: mono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.username}</div>
                  <div style={{ fontSize: 11.5, color: s.color, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.text}</div>
                </div>
                {editor && (
                  <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                    <button className="sd-iconbtn sd-press" aria-label="Scegli calendari" title="Scegli quali calendari importare" onClick={() => setPicker(c)}><ListChecks size={15} /></button>
                    <button className="sd-iconbtn sd-press" aria-label="Sincronizza ora" title="Sincronizza ora" onClick={() => doSync(c)} disabled={busyId === c.id}>
                      <RefreshCw size={15} className={busyId === c.id ? 'sd-spin' : undefined} />
                    </button>
                    <button className="sd-iconbtn sd-press" aria-label="Elimina connessione" title="Elimina" onClick={() => setDel(c)}><Trash2 size={15} /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add connection */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Aggiungi calendario" subtitle="Connessione CalDAV (sola lettura)" maxWidth={460}>
        <ConnectionForm
          key={addOpen ? 'o' : 'c'}
          onCancel={() => setAddOpen(false)}
          onCreated={(conn) => { setAddOpen(false); load(); setPicker(conn); }}
        />
      </Sheet>

      {/* Pick which remote calendars to import */}
      <Sheet open={!!picker} onClose={() => setPicker(null)} title="Calendari da importare" subtitle={picker?.display_name} maxWidth={460}>
        {picker && (
          <CalendarPicker
            key={picker.id}
            conn={picker}
            onCancel={() => setPicker(null)}
            onSaved={() => { setPicker(null); load(); }}
          />
        )}
      </Sheet>

      {/* Delete */}
      <Sheet open={!!del} onClose={() => setDel(null)} title="Eliminare il calendario?" subtitle={del?.display_name} maxWidth={400}>
        <p style={{ margin: '0 0 4px', fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>Verranno rimossi anche gli eventi importati da questa connessione.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <Button variant="secondary" onClick={() => setDel(null)} disabled={delBusy}>Annulla</Button>
          <Button variant="danger" isLoading={delBusy} onClick={confirmDelete}>Elimina</Button>
        </div>
      </Sheet>
    </div>
  );
}

function ConnectionForm({ onCreated, onCancel }: { onCreated: (c: CalendarConnection) => void; onCancel: () => void }) {
  const [provider, setProvider] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const info = CAL_PROVIDERS.find((p) => p.id === provider);
  const needsUrl = provider === 'nextcloud' || provider === 'custom';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider) { setError('Scegli un provider.'); return; }
    if (!username.trim() || !appPassword) { setError('Username e password sono obbligatori.'); return; }
    if (needsUrl && !customUrl.trim()) { setError('Inserisci l\'URL CalDAV.'); return; }
    setSaving(true); setError('');
    try {
      const payload: CreateConnectionPayload = {
        provider,
        display_name: displayName.trim() || info?.name || provider,
        username: username.trim(),
        app_password: appPassword,
      };
      if (needsUrl) payload.caldav_url = customUrl.trim();
      else if (info?.url) payload.caldav_url = info.url;
      const conn = await calendarConnections.create(payload);
      onCreated(conn);
    } catch (err) {
      const e2 = err as { data?: { detail?: string }; message?: string };
      setError(e2?.data?.detail || e2?.message || 'Connessione fallita. Controlla URL e credenziali.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
        {CAL_PROVIDERS.map((p) => {
          const on = provider === p.id;
          return (
            <button
              key={p.id} type="button"
              onClick={() => { setProvider(p.id); if (!displayName) setDisplayName(p.name); setError(''); }}
              className="sd-press"
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px', borderRadius: 11, cursor: 'pointer',
                background: on ? 'rgb(99 102 241 / 0.09)' : 'rgb(var(--color-card-inner))',
                border: `1px solid ${on ? 'rgb(99 102 241 / 0.45)' : 'rgb(var(--color-border))'}`,
                color: 'rgb(var(--color-heading))', fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>{p.icon}</span>{p.name}
            </button>
          );
        })}
      </div>

      {info && (
        <>
          <p style={{ margin: '0 0 16px', fontSize: 12, lineHeight: 1.5, color: 'rgb(var(--color-tertiary))', background: 'rgb(99 102 241 / 0.06)', border: '1px solid rgb(99 102 241 / 0.16)', borderRadius: 10, padding: '10px 12px' }}>{info.help}</p>
          <Field label="Nome visualizzato"><input className="sd-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={info.name} /></Field>
          <Field label="Username / Email"><input className="sd-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={info.userPh} autoComplete="off" /></Field>
          <Field label="App-Specific Password"><input className="sd-input" type="password" value={appPassword} onChange={(e) => setAppPassword(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" autoComplete="new-password" /></Field>
          {needsUrl && <Field label="URL CalDAV"><input className="sd-input" type="url" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://server/remote.php/dav" /></Field>}
        </>
      )}
      {error && <p style={errStyle}>{error}</p>}
      <div style={stickyBar}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Annulla</Button>
        <Button type="submit" variant="primary" isLoading={saving} disabled={!provider}>Connetti</Button>
      </div>
    </form>
  );
}

function CalendarPicker({ conn, onSaved, onCancel }: { conn: CalendarConnection; onSaved: () => void; onCancel: () => void }) {
  const [cals, setCals] = useState<CalDAVCalendarInfo[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    calendarConnections.listRemoteCalendars(conn.id).then((list) => {
      if (!alive) return;
      setCals(list);
      let init: Set<string>;
      try {
        const f = conn.calendars_filter ? JSON.parse(conn.calendars_filter) : null;
        init = Array.isArray(f) && f.length ? new Set<string>(f) : new Set(list.map((c) => c.calendar_id));
      } catch { init = new Set(list.map((c) => c.calendar_id)); }
      setSel(init);
    }).catch((err) => {
      if (!alive) return;
      const e2 = err as { data?: { detail?: string }; message?: string };
      setError(e2?.data?.detail || e2?.message || 'Impossibile leggere i calendari. Controlla le credenziali.');
    });
    return () => { alive = false; };
  }, [conn.id, conn.calendars_filter]);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const save = async () => {
    setSaving(true); setError('');
    try {
      await calendarConnections.update(conn.id, { calendars_filter: JSON.stringify([...sel]) });
      await calendarConnections.sync(conn.id, { days_back: 30, days_forward: 365 });
      onSaved();
    } catch (err) {
      const e2 = err as { data?: { detail?: string }; message?: string };
      setError(e2?.data?.detail || e2?.message || 'Salvataggio non riuscito.');
      setSaving(false);
    }
  };

  return (
    <div>
      {cals === null && !error && <p style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))', padding: '4px 0' }}>Carico i calendari…</p>}
      {error && <p style={errStyle}>{error}</p>}
      {cals && cals.length === 0 && !error && <p style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))' }}>Nessun calendario trovato su questo account.</p>}
      {cals && cals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
          {cals.map((c) => (
            <label key={c.calendar_id} className="sd-press" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 10px', borderRadius: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={sel.has(c.calendar_id)} onChange={() => toggle(c.calendar_id)} style={{ width: 17, height: 17, accentColor: 'rgb(99 102 241)', flex: 'none' }} />
              {c.color && <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, flex: 'none' }} />}
              <span style={{ fontSize: 14, color: 'rgb(var(--color-heading))', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
            </label>
          ))}
        </div>
      )}
      <div style={stickyBar}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Annulla</Button>
        <Button type="button" variant="primary" isLoading={saving} disabled={!cals || cals.length === 0} onClick={save}>Importa e sincronizza</Button>
      </div>
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
