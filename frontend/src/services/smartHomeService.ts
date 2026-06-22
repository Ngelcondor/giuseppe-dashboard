import api from '@/lib/api';

// ── Status ──
export interface SmartHomeStatus {
  hue_connected: boolean;
  shelly_connected: boolean;
}

// ── Hue ──
export interface HueLight {
  id: string;
  name: string;
  on: boolean;
  bri: number; // 1–254 (Hue brightness scale)
  reachable: boolean;
}
export interface HueLightsResponse {
  connected: boolean;
  lights: HueLight[];
  error?: string | null;
}

// ── Shelly ──
export interface ShellyDevice {
  device_id: string;
  name: string;
  power_w: number;   // live active power
  total_kwh: number; // cumulative energy counter
  output: boolean;   // relay on/off
  online: boolean;
}
export interface ShellyDevicesResponse {
  connected: boolean;
  devices: ShellyDevice[];
  total_power_w: number;
  total_kwh: number;
  error?: string | null;
}

// ── Calls ──
export async function getSmartHomeStatus(): Promise<SmartHomeStatus> {
  const { data } = await api.get<SmartHomeStatus>('/smarthome/status');
  return data;
}

export async function getHueLights(): Promise<HueLightsResponse> {
  const { data } = await api.get<HueLightsResponse>('/smarthome/hue/lights');
  return data;
}

export async function setHueLight(
  id: string,
  body: { on?: boolean; bri?: number },
): Promise<HueLight> {
  const { data } = await api.put<HueLight>(`/smarthome/hue/lights/${id}`, body);
  return data;
}

export async function getShellyDevices(): Promise<ShellyDevicesResponse> {
  const { data } = await api.get<ShellyDevicesResponse>('/smarthome/shelly/devices');
  return data;
}

// ── Shelly consumption history (per-period, from hourly snapshots) ──
export type ShellyPeriod = 'day' | 'week' | 'month';
export interface ShellyConsumptionDevice {
  device_id: string;
  name: string;
  consumption_kwh: number;
}
export interface ShellyConsumptionResponse {
  connected: boolean;
  period: ShellyPeriod;
  total_kwh: number;
  devices: ShellyConsumptionDevice[];
  data_since?: string | null;
  samples: number;
  error?: string | null;
}
export async function getShellyConsumption(period: ShellyPeriod): Promise<ShellyConsumptionResponse> {
  const { data } = await api.get<ShellyConsumptionResponse>('/smarthome/shelly/consumption', {
    params: { period },
  });
  return data;
}
