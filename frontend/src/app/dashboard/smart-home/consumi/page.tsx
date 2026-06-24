'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Zap, Plug, Flame, Cpu, Monitor, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CircularProgress } from '@/components/ui/ProgressBar';
import { StatBlock, Tabs } from '@/components/ui/Surface';
import { getMe } from '@/services/settingsService';
import {
  getShellyDevices, getShellyTimeseries, setShellyRelay,
  type ShellyDevice, type ShellyDevicesResponse, type ShellyTimeseriesResponse,
} from '@/services/smartHomeService';

/* ── Consumi · Smart Home (design Consumi.dc.html — Variante A · Centro di controllo)
   Live energy view wired to real Shelly Cloud data:
   - the ring + big watts + per-plug stack poll the live device status every 5s,
     accumulating a short rolling history client-side ("ultimi minuti");
   - the comparison chart and the day/cost/peak stats come from the hourly
     snapshot timeseries (per-hour kWh deltas, local time);
   - plug toggles drive the real relay control endpoint (editor only).
   No fabricated numbers — empty/in-raccolta states throughout. */

const mono = "'JetBrains Mono',monospace";
const CAP_W = 3300;   // contract power (≈3 kW IT residential) — scales the live ring
const TARIFF = 0.25;  // €/kWh estimate for the cost figures
const POLL_MS = 5000;
const HIST = 44;      // live samples kept (~4 min at POLL_MS)
const TS_DAYS = 7;

const PALETTE = ['99 102 241', '45 212 191', '245 158 11', '236 72 153', '34 197 94', '148 163 184'];
const DAY_PALETTE = ['99 102 241', '45 212 191', '245 158 11'];

const fmtW = (n: number) => Math.round(n).toLocaleString('it-IT');
const fmt2 = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Sample = { total: number; per: Record<string, number> };
type Group = { label: string; vals: Record<string, number> };
type Series = { key: string; name: string; color: string };

function iconFor(name: string) {
  const k = name.toLowerCase();
  if (/scald|boiler|heat|caldai|resisten|termo/.test(k)) return Flame;
  if (/pc|workstation|computer|server|nas/.test(k)) return Cpu;
  if (/monitor|schermo|display|tv/.test(k)) return Monitor;
  return Plug;
}

export default function ConsumiPage() {
  const [resp, setResp] = useState<ShellyDevicesResponse | null>(null);
  const [ts, setTs] = useState<ShellyTimeseriesResponse | null>(null);
  const [history, setHistory] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [dateLabel, setDateLabel] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [cmpMode, setCmpMode] = useState<'giorni' | 'prese'>('giorni');
  const [selDays, setSelDays] = useState<number[]>([]);
  const [selDevs, setSelDevs] = useState<string[]>([]);

  const histRef = useRef<Sample[]>([]);

  useEffect(() => {
    getMe().then((me) => setCanEdit(me.role !== 'guest')).catch(() => setCanEdit(false));
    setDateLabel(
      new Date().toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })
        .replace(/^./, (c) => c.toUpperCase()),
    );
  }, []);

  // Live poll: device status drives the ring, stack and plug list.
  const poll = useCallback(async (first: boolean) => {
    try {
      const r = await getShellyDevices();
      setResp(r);
      if (r.connected && !r.error) {
        const sample: Sample = {
          total: r.total_power_w,
          per: Object.fromEntries(r.devices.map((d) => [d.device_id, d.power_w])),
        };
        const next = [...histRef.current, sample].slice(-HIST);
        histRef.current = next;
        setHistory(next);
      }
    } catch {
      if (first) setResp({ connected: false, devices: [], total_power_w: 0, total_kwh: 0 });
    } finally {
      if (first) setLoading(false);
    }
  }, []);

  useEffect(() => {
    poll(true);
    const id = setInterval(() => poll(false), POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const loadTs = useCallback(() => {
    getShellyTimeseries(TS_DAYS).then(setTs).catch(() => setTs(null));
  }, []);
  useEffect(() => { loadTs(); }, [loadTs]);

  const connected = !!resp?.connected;
  const devices = useMemo(() => resp?.devices ?? [], [resp]);

  // Stable device → colour map (sorted by name from the API).
  const colorMap = useMemo(() => {
    const m: Record<string, string> = {};
    devices.forEach((d, i) => { m[d.device_id] = PALETTE[i % PALETTE.length]; });
    return m;
  }, [devices]);

  // Default comparison selections once data is available.
  useEffect(() => {
    if (ts && ts.days > 0 && selDays.length === 0) {
      setSelDays([ts.days - 1, ts.days - 2].filter((i) => i >= 0));
    }
  }, [ts, selDays.length]);
  useEffect(() => {
    if (selDevs.length === 0 && devices.length) setSelDevs(devices.slice(0, 3).map((d) => d.device_id));
  }, [devices, selDevs.length]);

  // ── live derived ──
  const liveW = resp?.total_power_w ?? 0;
  const ringPct = Math.min(100, Math.round((liveW / CAP_W) * 100));
  const ringVariant: 'primary' | 'warning' | 'danger' = ringPct < 55 ? 'primary' : ringPct < 82 ? 'warning' : 'danger';
  const liveKw = (liveW / 1000).toFixed(2);
  const liveCostHour = ((liveW / 1000) * TARIFF).toFixed(2);
  const onCount = devices.filter((d) => d.output).length;

  // ── timeseries derived (local time) ──
  const todayHours = ts && ts.household_hourly.length ? ts.household_hourly[ts.days - 1] : null;
  const todayKwh = todayHours ? todayHours.reduce((s, v) => s + v, 0) : 0;
  const todayCost = todayKwh * TARIFF;
  const peakKw = todayHours && todayHours.length ? Math.max(...todayHours) : 0;
  const tsThin = !ts || ts.samples < 2;

  const dayLabel = (i: number) => {
    if (!ts) return '';
    if (i === ts.days - 1) return 'Oggi';
    const d = new Date(ts.dates[i] + 'T00:00:00');
    return d.toLocaleDateString('it-IT', { weekday: 'short' }).replace(/^./, (c) => c.toUpperCase());
  };

  const toggleDay = (i: number) => setSelDays((c) => {
    if (c.includes(i)) return c.length > 1 ? c.filter((x) => x !== i) : c;
    return c.length < 3 ? [...c, i] : [...c.slice(1), i];
  });
  const togglePresa = (id: string) => setSelDevs((c) => {
    if (c.includes(id)) return c.length > 1 ? c.filter((x) => x !== id) : c;
    return [...c, id];
  });

  // Build comparison groups (24 hours) + series for the active mode.
  const { groups, series } = useMemo<{ groups: Group[]; series: Series[] }>(() => {
    if (!ts) return { groups: [], series: [] };
    const hours = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
    if (cmpMode === 'giorni') {
      const ser: Series[] = selDays.map((di, idx) => ({ key: 'd' + di, name: dayLabel(di), color: DAY_PALETTE[idx % DAY_PALETTE.length] }));
      const grp: Group[] = hours.map((label, h) => {
        const vals: Record<string, number> = {};
        selDays.forEach((di) => { vals['d' + di] = ts.household_hourly[di]?.[h] ?? 0; });
        return { label, vals };
      });
      return { groups: grp, series: ser };
    }
    const ser: Series[] = selDevs.map((id) => {
      const d = ts.devices_today.find((x) => x.device_id === id);
      return { key: id, name: d?.name ?? id, color: colorMap[id] ?? PALETTE[0] };
    });
    const grp: Group[] = hours.map((label, h) => {
      const vals: Record<string, number> = {};
      selDevs.forEach((id) => { vals[id] = ts.devices_today.find((x) => x.device_id === id)?.hours[h] ?? 0; });
      return { label, vals };
    });
    return { groups: grp, series: ser };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ts, cmpMode, selDays, selDevs, colorMap]);

  /* ── plug control ── */
  const onToggle = async (dev: ShellyDevice) => {
    if (!canEdit) return;
    setTogglingId(dev.device_id);
    setResp((r) => r && { ...r, devices: r.devices.map((d) => d.device_id === dev.device_id ? { ...d, output: !d.output } : d) });
    try {
      const updated = await setShellyRelay(dev.device_id, !dev.output);
      setResp((r) => r && { ...r, devices: r.devices.map((d) => d.device_id === updated.device_id ? updated : d) });
    } catch {
      await poll(false); // reconcile with real state
    } finally {
      setTogglingId(null);
    }
  };

  /* ── render ── */
  return (
    <div>
      <style>{'@keyframes sdLive{0%,100%{opacity:1}50%{opacity:.35}}'}</style>

      {/* Header */}
      <header className="sd-reveal" style={{ ['--i' as string]: 0, marginBottom: 22 }}>
        <Link href="/dashboard/smart-home" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgb(var(--color-tertiary))', textDecoration: 'none', marginBottom: 14 }}>
          <ArrowLeft size={15} /> Smart Home
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgb(99 102 241)', fontFamily: mono, marginBottom: 8, fontWeight: 600 }}>Smart Home · Energia</div>
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.05, letterSpacing: '-.01em', color: 'rgb(var(--color-heading))', fontWeight: 700 }}>Consumi</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {connected && !resp?.error && <LivePill />}
            {dateLabel && <span style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))' }}>{dateLabel}</span>}
            <button className="sd-iconbtn" aria-label="Aggiorna" onClick={() => { poll(false); loadTs(); }}><RefreshCw size={15} /></button>
          </div>
        </div>
      </header>

      {loading ? (
        <Card pad="22px 24px"><p style={muted}>Caricamento consumi…</p></Card>
      ) : !connected ? (
        <NotConnected />
      ) : resp?.error ? (
        <Card pad="22px 24px" style={{ borderColor: 'rgb(245 158 11 / 0.4)' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'rgb(180 83 9)', marginBottom: 5 }}>Dati live non disponibili</div>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'rgb(var(--color-tertiary))', wordBreak: 'break-word' }}>{resp.error}</p>
          <Button size="sm" variant="secondary" onClick={() => poll(false)}><RefreshCw size={15} style={{ marginRight: 6 }} />Riprova</Button>
        </Card>
      ) : devices.length === 0 ? (
        <Card pad="22px 24px"><p style={muted}>Nessun dispositivo nell&apos;account Shelly.</p></Card>
      ) : (
        <div className="sd-consumi-cols">
          {/* ── LEFT ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card pad="18px">
              <Row>
                <Eyebrow>Consumo ora</Eyebrow>
                <span style={{ fontSize: 11, color: 'rgb(var(--color-muted))' }}>capacità {(CAP_W / 1000).toFixed(1)} kW</span>
              </Row>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 14 }}>
                <CircularProgress value={ringPct} size="lg" variant={ringVariant} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: mono, fontSize: 40, fontWeight: 600, color: 'rgb(var(--color-heading))', lineHeight: 1 }}>{fmtW(liveW)}</span>
                    <span style={{ fontSize: 16, color: 'rgb(var(--color-tertiary))' }}>W</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'rgb(var(--color-tertiary))', marginTop: 5 }}>{liveKw} kW · ≈ {liveCostHour} €/h</div>
                </div>
              </div>

              <div style={{ ...microLabel, margin: '16px 0 6px' }}>Consumo per presa · ultimi minuti</div>
              <LiveStack history={history} devices={devices.map((d) => ({ id: d.device_id, color: colorMap[d.device_id] }))} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '9px 16px', marginTop: 14 }}>
                {devices.map((d) => (
                  <div key={d.device_id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, flex: 'none', background: `rgb(${colorMap[d.device_id]})`, opacity: d.output ? 1 : 0.3 }} />
                    <span style={{ fontSize: 11, color: 'rgb(var(--color-tertiary))' }}>{d.name}</span>
                    <span style={{ fontFamily: mono, fontSize: 12, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap' }}>{fmtW(d.power_w)} W</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card pad="18px">
              <Row>
                <Eyebrow>Prese &amp; dispositivi</Eyebrow>
                <span style={{ fontSize: 11, color: 'rgb(var(--color-muted))' }}>{onCount} di {devices.length} attive</span>
              </Row>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                {devices.map((d) => {
                  const Icon = iconFor(d.name);
                  return (
                    <div key={d.device_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 11, background: 'rgb(var(--color-card-inner))', border: '1px solid rgb(var(--color-border))', opacity: d.online ? 1 : 0.55 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 9, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: d.output ? `rgb(${colorMap[d.device_id]}/0.16)` : 'rgb(var(--color-card))' }}>
                        <Icon size={16} style={{ color: d.output ? `rgb(${colorMap[d.device_id]})` : 'rgb(var(--color-muted))' }} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: 'rgb(var(--color-muted))' }}>{d.online ? `${fmt2(d.total_kwh)} kWh totali` : 'offline'}</div>
                      </div>
                      <div style={{ textAlign: 'right', marginRight: 4 }}>
                        <div style={{ fontFamily: mono, fontSize: 14, color: 'rgb(var(--color-heading))', whiteSpace: 'nowrap' }}>{fmtW(d.power_w)} W</div>
                        <div style={{ fontSize: 10, color: 'rgb(var(--color-muted))' }}>{d.output ? 'attiva' : 'spenta'}</div>
                      </div>
                      {canEdit
                        ? <PlugToggle on={d.output} disabled={!d.online || togglingId === d.device_id} onClick={() => onToggle(d)} />
                        : <span style={{ fontSize: 11, fontFamily: mono, color: d.output ? 'rgb(16 185 129)' : 'rgb(var(--color-muted))' }}>{d.output ? 'ON' : 'OFF'}</span>}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* ── RIGHT ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card pad="20px">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'rgb(var(--color-heading))' }}>Confronto</div>
                  <div style={{ fontSize: 12, color: 'rgb(var(--color-tertiary))', marginTop: 2 }}>{cmpMode === 'giorni' ? 'Consumo per ora · kWh' : 'Per presa · oggi · kWh'}</div>
                </div>
                <Tabs
                  options={[{ value: 'giorni', label: 'Giorni' }, { value: 'prese', label: 'Prese' }]}
                  value={cmpMode}
                  onChange={(v) => setCmpMode(v)}
                />
              </div>

              <div style={{ margin: '16px 0 18px' }}>
                <div style={{ ...microLabel, marginBottom: 9 }}>{cmpMode === 'giorni' ? 'Giorni a confronto · max 3' : 'Prese a confronto'}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {cmpMode === 'giorni'
                    ? (ts?.dates ?? []).map((_, i) => {
                        const sel = selDays.indexOf(i);
                        return <Chip key={i} label={dayLabel(i)} active={sel >= 0} color={sel >= 0 ? DAY_PALETTE[sel % DAY_PALETTE.length] : null} onClick={() => toggleDay(i)} />;
                      })
                    : devices.map((d) => (
                        <Chip key={d.device_id} label={d.name} active={selDevs.includes(d.device_id)} color={selDevs.includes(d.device_id) ? colorMap[d.device_id] : null} onClick={() => togglePresa(d.device_id)} />
                      ))}
                </div>
              </div>

              <CompareBars groups={groups} series={series} thin={tsThin} dataSince={ts?.data_since ?? null} />
            </Card>

            <Card pad="18px 20px">
              <div className="sd-consumi-stats">
                <StatBlock label="CONSUMO ORA" value={fmtW(liveW)} unit="W" />
                <StatBlock label="OGGI" value={fmt2(todayKwh)} unit="kWh" />
                <StatBlock label="COSTO OGGI" value={fmt2(todayCost)} unit="€" />
                <StatBlock label="PICCO" value={peakKw > 0 ? fmt2(peakKw) : '—'} unit={peakKw > 0 ? 'kW' : ''} />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════ pieces ════════════════ */
const muted: React.CSSProperties = { margin: 0, fontSize: 14, color: 'rgb(var(--color-tertiary))' };
const microLabel: React.CSSProperties = { fontSize: 11, color: 'rgb(var(--color-muted))' };
const cardBase: React.CSSProperties = { background: 'rgb(var(--color-card))', border: '1px solid rgb(var(--color-border))', borderRadius: 14, boxShadow: '0 1px 2px rgba(17,17,26,.04)' };
const eyebrowStyle: React.CSSProperties = { fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgb(var(--color-tertiary))', fontWeight: 600 };

function Card({ pad, style, children }: { pad: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return <div className="sd-reveal sd-shadow" style={{ ...cardBase, padding: pad, ...style }}>{children}</div>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{children}</div>;
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div style={eyebrowStyle}>{children}</div>;
}
function LivePill() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgb(16 185 129/0.1)', border: '1px solid rgb(16 185 129/0.25)', borderRadius: 999, padding: '6px 12px' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(16 185 129)', display: 'inline-block', animation: 'sdLive 1.4s ease-in-out infinite' }} />
      <span style={{ fontSize: 12, color: 'rgb(16 185 129)', fontWeight: 600 }}>In diretta</span>
    </div>
  );
}

function PlugToggle({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={on ? 'Spegni' : 'Accendi'}
      disabled={disabled} onClick={onClick}
      style={{ flex: 'none', width: 42, height: 24, borderRadius: 999, border: 'none', padding: 3, cursor: disabled ? 'not-allowed' : 'pointer', background: on ? 'rgb(99 102 241/0.95)' : 'rgb(var(--color-card-inner))', opacity: disabled ? 0.5 : 1, transition: 'background .2s' }}
    >
      <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(18px)' : 'translateX(0)', transition: 'transform .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
    </button>
  );
}

function Chip({ label, active, color, onClick }: { label: string; active: boolean; color: string | null; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick} className="sd-press"
      style={{
        padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
        ...(active && color
          ? { background: `rgb(${color})`, color: '#0b0b10', border: `1px solid rgb(${color})` }
          : { background: 'rgb(var(--color-card-inner))', color: 'rgb(var(--color-tertiary))', border: '1px solid rgb(var(--color-border))' }),
      }}
    >{label}</button>
  );
}

/* Stacked-area sparkline of the live per-plug history. */
function LiveStack({ history, devices }: { history: Sample[]; devices: { id: string; color: string }[] }) {
  const W = 360, H = 72;
  if (history.length < 2) {
    return <div style={{ height: H, display: 'flex', alignItems: 'center', fontSize: 12, color: 'rgb(var(--color-muted))' }}>Raccolta in corso…</div>;
  }
  const n = history.length;
  const maxT = Math.max(1, ...history.map((s) => s.total)) * 1.15;
  const X = (i: number) => (i / (n - 1)) * W;
  const Y = (v: number) => H - (v / maxT) * (H - 2) - 1;
  const lower = new Array(n).fill(0);
  const bands = devices.map((d) => {
    const upper = history.map((s, i) => lower[i] + (s.per[d.id] || 0));
    const top = upper.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
    const bot = lower.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).reverse();
    const path = `M${top.join(' L')} L${bot.join(' L')} Z`;
    for (let i = 0; i < n; i++) lower[i] = upper[i];
    return <path key={d.id} d={path} fill={`rgb(${d.color})`} fillOpacity={0.72} />;
  });
  const totalPts = history.map((s, i) => `${X(i).toFixed(1)},${Y(s.total).toFixed(1)}`);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {bands}
      <path d={`M${totalPts.join(' L')}`} fill="none" stroke="rgb(var(--color-heading))" strokeOpacity={0.5} strokeWidth={1.2} />
    </svg>
  );
}

/* Grouped vertical bars across 24 hours, with a hover readout. */
function CompareBars({ groups, series, thin, dataSince }: { groups: Group[]; series: Series[]; thin: boolean; dataSince: string | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...groups.flatMap((g) => series.map((s) => g.vals[s.key] || 0)));

  if (thin || max <= 0) {
    const since = dataSince ? new Date(dataSince).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : null;
    return (
      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgb(var(--color-muted))', lineHeight: 1.5 }}>
        Storico orario in raccolta — il confronto si popola man mano (snapshot ogni ora){since ? ` · dati dal ${since}` : ''}.
      </p>
    );
  }

  const H = 200;
  const hv = hover ?? groups.length - 1;
  const g = groups[hv] || groups[0];
  const showLbl = (i: number) => i % 3 === 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {series.map((s) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: `rgb(${s.color})` }} />
              <span style={{ fontSize: 12, color: 'rgb(var(--color-body))' }}>{s.name}</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'rgb(var(--color-tertiary))', letterSpacing: '.05em' }}>ORE {g.label}</div>
          <div style={{ fontSize: 13, fontFamily: mono, color: 'rgb(var(--color-heading))', marginTop: 2 }}>
            {series.map((s) => <span key={s.key} style={{ color: `rgb(${s.color})`, marginLeft: 8 }}>{(g.vals[s.key] || 0).toFixed(2)}</span>)}
            <span style={{ color: 'rgb(var(--color-muted))', marginLeft: 6 }}>kWh</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: H }}>
        {groups.map((gr, i) => (
          <div
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ flex: '1 1 0', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, cursor: 'pointer', borderRadius: 4, background: i === hv ? 'rgb(var(--color-card-inner))' : 'transparent' }}
          >
            {series.map((s) => {
              const hp = Math.max(2, ((gr.vals[s.key] || 0) / max) * 100);
              return <div key={s.key} style={{ width: series.length > 2 ? 5 : 7, height: `${hp}%`, borderRadius: '3px 3px 0 0', background: `rgb(${s.color})` }} />;
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 1, marginTop: 8, borderTop: '1px solid rgb(var(--color-border))', paddingTop: 6 }}>
        {groups.map((gr, i) => (
          <div key={i} style={{ flex: '1 1 0', textAlign: 'center', fontSize: 10, color: 'rgb(var(--color-muted))', fontFamily: mono, overflow: 'hidden', whiteSpace: 'nowrap' }}>{showLbl(i) ? gr.label : ''}</div>
        ))}
      </div>
    </div>
  );
}

function NotConnected() {
  return (
    <div className="sd-shadow" style={{ ...cardBase, padding: '30px 28px', display: 'flex', alignItems: 'flex-start', gap: 18 }}>
      <span style={{ width: 48, height: 48, borderRadius: 13, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgb(var(--color-card-inner))' }}><Zap size={22} style={{ color: 'rgb(var(--color-muted))' }} /></span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'rgb(var(--color-heading))', marginBottom: 5 }}>Shelly non collegato</div>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'rgb(var(--color-tertiary))', lineHeight: 1.5 }}>Inserisci auth key e server Shelly Cloud nelle Impostazioni per vedere consumi in tempo reale, storico e controllo prese.</p>
        <Link href="/dashboard/impostazioni" style={{ textDecoration: 'none' }}>
          <Button size="sm" variant="secondary"><SettingsIcon size={15} style={{ marginRight: 6 }} />Vai alle Impostazioni</Button>
        </Link>
      </div>
    </div>
  );
}
