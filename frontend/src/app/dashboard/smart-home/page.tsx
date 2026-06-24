'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Lightbulb, Zap, Settings as SettingsIcon, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getMe } from '@/services/settingsService';
import {
  getHueLights, setHueLight,
  getShellyDevices, getShellyConsumption,
  type HueLight, type HueLightsResponse,
  type ShellyDevicesResponse,
  type ShellyConsumptionResponse, type ShellyPeriod,
} from '@/services/smartHomeService';

const card: React.CSSProperties = {
  background: 'rgb(var(--color-card))',
  border: '1px solid rgb(var(--color-border))',
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(17,17,26,.04)',
};
const mono = "'JetBrains Mono',monospace";

const briPct = (bri: number) => Math.round((Math.max(1, Math.min(254, bri)) / 254) * 100);
const fmtKwh = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: n < 10 ? 2 : 1, maximumFractionDigits: 2 });
const fmtW = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });
const PERIOD_LABEL: Record<ShellyPeriod, string> = { day: 'Oggi', week: 'Settimana', month: 'Mese' };

export default function SmartHomePage() {
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    getMe().then((me) => setCanEdit(me.role !== 'guest')).catch(() => setCanEdit(false));
  }, []);

  return (
    <div>
      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontFamily: mono, marginBottom: 12, fontWeight: 600 }}>Casa · Domotica</div>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: '-.02em', color: 'rgb(var(--color-heading))', fontWeight: 600 }}>
          Smart <span style={{ fontFamily: "'Fraunces',serif", fontStyle: 'italic', fontWeight: 500 }}>Home</span>
        </h1>
        <p style={{ margin: '11px 0 0', fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>Luci Philips Hue e consumi Shelly · controllo dei tuoi dispositivi</p>
      </header>

      <HueSection canEdit={canEdit} />
      <ShellySection />
    </div>
  );
}

/* ── Hue lights ── */

function HueSection({ canEdit }: { canEdit: boolean }) {
  const [resp, setResp] = useState<HueLightsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setResp(await getHueLights()); }
    catch { setResp({ connected: false, lights: [] }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onToggle = async (light: HueLight) => {
    // Optimistic update, reconcile with server response.
    setResp((r) => r && { ...r, lights: r.lights.map((l) => l.id === light.id ? { ...l, on: !l.on } : l) });
    try {
      const updated = await setHueLight(light.id, { on: !light.on });
      setResp((r) => r && { ...r, lights: r.lights.map((l) => l.id === updated.id ? updated : l) });
    } catch { await load(); }
  };
  const onBri = async (light: HueLight, bri: number) => {
    try {
      const updated = await setHueLight(light.id, { bri, on: true });
      setResp((r) => r && { ...r, lights: r.lights.map((l) => l.id === updated.id ? updated : l) });
    } catch { await load(); }
  };

  return (
    <section className="sd-reveal" style={{ ['--i' as string]: 1, marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 14px', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'rgb(var(--color-heading))', display: 'flex', alignItems: 'center', gap: 9 }}>
          <Lightbulb size={18} style={{ color: 'rgb(245 158 11)' }} /> Luci · Philips Hue
        </h3>
        {resp?.connected && (
          <button className="sd-iconbtn" aria-label="Aggiorna" onClick={load}><RefreshCw size={15} /></button>
        )}
      </div>

      {!resp || loading ? (
        <SkeletonCard text="Caricamento luci…" />
      ) : !resp.connected ? (
        <NotConnected
          icon={<Lightbulb size={22} style={{ color: 'rgb(var(--color-muted))' }} />}
          title="Philips Hue non collegato"
          body="Collega il bridge Philips Hue nelle Impostazioni (bridge IP + app key) per controllare le luci da qui."
        />
      ) : resp.error ? (
        <ErrorCard message={resp.error} onRetry={load} />
      ) : resp.lights.length === 0 ? (
        <SkeletonCard text="Nessuna luce trovata sul bridge." />
      ) : (
        <div className="sd-grid2">
          {resp.lights.map((l, idx) => (
            <LightCard key={l.id} i={2 + idx} light={l} canEdit={canEdit} onToggle={() => onToggle(l)} onBri={(b) => onBri(l, b)} />
          ))}
        </div>
      )}
    </section>
  );
}

function LightCard({ i, light, canEdit, onToggle, onBri }: { i: number; light: HueLight; canEdit: boolean; onToggle: () => void; onBri: (bri: number) => void }) {
  const [localBri, setLocalBri] = useState(light.bri);
  useEffect(() => { setLocalBri(light.bri); }, [light.bri]);

  const dimmed = !light.on || !light.reachable;
  return (
    <div className="sd-reveal sd-lift" style={{ ['--i' as string]: i, ...card, padding: 20, opacity: light.reachable ? 1 : 0.55 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: light.on ? 'rgb(245 158 11 / 0.15)' : 'rgb(0 0 0 / 0.04)' }}>
            <Lightbulb size={19} style={{ color: light.on ? 'rgb(245 158 11)' : 'rgb(var(--color-muted))' }} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{light.name}</div>
            <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', fontFamily: mono }}>
              {!light.reachable ? 'non raggiungibile' : light.on ? `${briPct(localBri)}%` : 'spenta'}
            </div>
          </div>
        </div>
        {canEdit ? (
          <Toggle on={light.on} disabled={!light.reachable} onClick={onToggle} />
        ) : (
          <span style={{ fontSize: 12, fontFamily: mono, color: light.on ? 'rgb(16 185 129)' : 'rgb(var(--color-muted))' }}>{light.on ? 'ON' : 'OFF'}</span>
        )}
      </div>

      <input
        type="range" min={1} max={254} value={localBri}
        disabled={!canEdit || dimmed}
        onChange={(e) => setLocalBri(Number(e.target.value))}
        onMouseUp={(e) => onBri(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => onBri(Number((e.target as HTMLInputElement).value))}
        aria-label={`Luminosità ${light.name}`}
        style={{ width: '100%', accentColor: 'rgb(245 158 11)', cursor: (!canEdit || dimmed) ? 'not-allowed' : 'pointer', opacity: dimmed ? 0.45 : 1 }}
      />
    </div>
  );
}

function Toggle({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={on ? 'Spegni' : 'Accendi'}
      disabled={disabled} onClick={onClick}
      style={{
        width: 46, height: 27, borderRadius: 99, border: 'none', flex: 'none', position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        background: on ? 'rgb(16 185 129)' : 'rgb(var(--color-card-inner))', opacity: disabled ? 0.5 : 1,
        transition: 'background .18s ease',
      }}
    >
      <span style={{ position: 'absolute', top: 3, left: on ? 22 : 3, width: 21, height: 21, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .18s ease' }} />
    </button>
  );
}

/* ── Shelly devices (live power + cumulative energy) ── */

function ShellySection() {
  const [resp, setResp] = useState<ShellyDevicesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setResp(await getShellyDevices()); }
    catch { setResp({ connected: false, devices: [], total_power_w: 0, total_kwh: 0 }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const maxW = resp ? Math.max(0, ...resp.devices.map((d) => d.power_w)) : 0;

  return (
    <section className="sd-reveal" style={{ ['--i' as string]: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 14px', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'rgb(var(--color-heading))', display: 'flex', alignItems: 'center', gap: 9 }}>
          <Zap size={18} style={{ color: 'rgb(99 102 241)' }} /> Consumi · Shelly
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/dashboard/smart-home/consumi" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 500, color: 'rgb(99 102 241)', textDecoration: 'none' }}>
            Consumi live <ArrowRight size={14} />
          </Link>
          {resp?.connected && !resp.error && (
            <button className="sd-iconbtn" aria-label="Aggiorna" onClick={load}><RefreshCw size={15} /></button>
          )}
        </div>
      </div>

      {!resp || loading ? (
        <SkeletonCard text="Caricamento dispositivi…" />
      ) : !resp.connected ? (
        <NotConnected
          icon={<Zap size={22} style={{ color: 'rgb(var(--color-muted))' }} />}
          title="Shelly non collegato"
          body="Inserisci auth key e server Shelly Cloud nelle Impostazioni per vedere potenza e consumi reali dei tuoi dispositivi."
        />
      ) : (
        <div className="sd-shadow" style={{ ...card, padding: '24px 26px' }}>
          {resp.error ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <p style={{ margin: 0, fontSize: 13, color: 'rgb(180 83 9)', wordBreak: 'break-word' }}>Dati live non disponibili: {resp.error}</p>
              <Button size="sm" variant="secondary" onClick={load}><RefreshCw size={14} style={{ marginRight: 6 }} />Riprova</Button>
            </div>
          ) : resp.devices.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>Nessun dispositivo nell&apos;account Shelly.</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 36, marginBottom: 24, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600, marginBottom: 6 }}>Potenza ora</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                    <span style={{ fontFamily: mono, fontSize: 38, fontWeight: 700, color: 'rgb(var(--color-heading))' }}>{fmtW(resp.total_power_w)}</span>
                    <span style={{ fontSize: 15, color: 'rgb(var(--color-tertiary))' }}>W</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600, marginBottom: 6 }}>Energia totale</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                    <span style={{ fontFamily: mono, fontSize: 26, fontWeight: 700, color: 'rgb(var(--color-heading))' }}>{fmtKwh(resp.total_kwh)}</span>
                    <span style={{ fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>kWh</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {resp.devices.map((d) => (
                  <div key={d.device_id} style={{ opacity: d.online ? 1 : 0.5 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7, gap: 10 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: d.output ? 'rgb(16 185 129)' : 'rgb(var(--color-muted))' }} />
                        {d.name}{!d.online && <span style={{ fontSize: 11, color: 'rgb(var(--color-muted))' }}>· offline</span>}
                      </span>
                      <span style={{ fontFamily: mono, fontSize: 13, color: 'rgb(var(--color-tertiary))', flex: 'none' }}>{fmtW(d.power_w)} W · {fmtKwh(d.total_kwh)} kWh</span>
                    </div>
                    <div style={{ height: 9, borderRadius: 8, background: 'rgb(var(--color-card-inner))', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${maxW > 0 ? Math.round((d.power_w / maxW) * 100) : 0}%`, minWidth: d.power_w > 0 ? 4 : 0, borderRadius: 8, background: 'rgb(99 102 241)', transition: 'width .3s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <ConsumptionBlock />
        </div>
      )}
    </section>
  );
}

/* ── Shelly consumption history (per-period, from snapshots) ── */

function ConsumptionBlock() {
  const [period, setPeriod] = useState<ShellyPeriod>('day');
  const [resp, setResp] = useState<ShellyConsumptionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getShellyConsumption(period)
      .then((r) => { if (alive) setResp(r); })
      .catch(() => { if (alive) setResp(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [period]);

  const maxKwh = resp ? Math.max(0, ...resp.devices.map((d) => d.consumption_kwh)) : 0;
  const since = resp?.data_since ? new Date(resp.data_since).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : null;
  const thin = !!resp && resp.samples < 2;

  return (
    <div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid rgb(var(--color-border))' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600 }}>Consumi nel periodo</span>
        <div style={{ display: 'inline-flex', background: 'rgb(var(--color-card-inner))', borderRadius: 10, padding: 3, gap: 2 }}>
          {(['day', 'week', 'month'] as ShellyPeriod[]).map((p) => (
            <button
              key={p} onClick={() => setPeriod(p)}
              style={{
                border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 500,
                background: period === p ? 'rgb(var(--color-card))' : 'transparent',
                color: period === p ? 'rgb(var(--color-heading))' : 'rgb(var(--color-tertiary))',
                boxShadow: period === p ? '0 1px 2px rgba(17,17,26,.08)' : 'none',
              }}
            >{PERIOD_LABEL[p]}</button>
          ))}
        </div>
      </div>

      {loading || !resp ? (
        <p style={{ margin: 0, fontSize: 13, color: 'rgb(var(--color-tertiary))' }}>Caricamento…</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: resp.devices.length ? 18 : 6 }}>
            <span style={{ fontFamily: mono, fontSize: 30, fontWeight: 700, color: 'rgb(var(--color-heading))' }}>{fmtKwh(resp.total_kwh)}</span>
            <span style={{ fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>kWh · {PERIOD_LABEL[period].toLowerCase()}</span>
          </div>

          {resp.devices.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {resp.devices.map((d) => (
                <div key={d.device_id}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, gap: 10 }}>
                    <span style={{ fontSize: 13, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                    <span style={{ fontFamily: mono, fontSize: 12.5, color: 'rgb(var(--color-tertiary))', flex: 'none' }}>{fmtKwh(d.consumption_kwh)} kWh</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 8, background: 'rgb(var(--color-card-inner))', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${maxKwh > 0 ? Math.round((d.consumption_kwh / maxKwh) * 100) : 0}%`, minWidth: d.consumption_kwh > 0 ? 4 : 0, borderRadius: 8, background: 'rgb(16 185 129)', transition: 'width .3s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <p style={{ margin: '16px 0 0', fontSize: 12, color: 'rgb(var(--color-muted))', lineHeight: 1.5 }}>
            {thin
              ? 'Storico in raccolta — i consumi per periodo si popolano man mano (snapshot ogni ora).'
              : since
                ? `Calcolato dagli snapshot orari · storico dal ${since}.`
                : 'Snapshot orari del contatore energia.'}
          </p>
        </>
      )}
    </div>
  );
}

/* ── Shared states ── */

function NotConnected({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="sd-shadow" style={{ ...card, padding: '30px 28px', display: 'flex', alignItems: 'flex-start', gap: 18 }}>
      <span style={{ width: 48, height: 48, borderRadius: 13, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgb(var(--color-card-inner))' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))', marginBottom: 5 }}>{title}</div>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'rgb(var(--color-tertiary))', lineHeight: 1.5 }}>{body}</p>
        <a href="/dashboard/impostazioni" style={{ textDecoration: 'none' }}>
          <Button size="sm" variant="secondary"><SettingsIcon size={15} style={{ marginRight: 6 }} />Vai alle Impostazioni</Button>
        </a>
      </div>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="sd-shadow" style={{ ...card, padding: '22px 24px', borderColor: 'rgb(245 158 11 / 0.4)' }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: 'rgb(180 83 9)', marginBottom: 5 }}>Connessione non riuscita</div>
      <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'rgb(var(--color-tertiary))', wordBreak: 'break-word' }}>{message}</p>
      <Button size="sm" variant="secondary" onClick={onRetry}><RefreshCw size={15} style={{ marginRight: 6 }} />Riprova</Button>
    </div>
  );
}

function SkeletonCard({ text }: { text: string }) {
  return (
    <div className="sd-shadow" style={{ ...card, padding: '22px 24px' }}>
      <p style={{ margin: 0, fontSize: 14, color: 'rgb(var(--color-tertiary))' }}>{text}</p>
    </div>
  );
}
