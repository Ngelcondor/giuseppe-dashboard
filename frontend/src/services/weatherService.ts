import api from '@/lib/api';

// Una città/membro con meteo corrente reale (Open-Meteo, via backend).
// I campi meteo sono nullable: se l'API non risponde il backend torna null e il
// widget mostra un placeholder, mai valori inventati.
export interface FamilyWeather {
  label: string;        // es. "mamma", "papà", "Aurora"
  city: string;         // es. "Bergamo"
  temp: number | null;  // temperatura corrente °C
  code: number | null;  // WMO weather code
  min: number | null;   // minima di oggi °C
  max: number | null;   // massima di oggi °C
}

// Meteo reale per le città dei familiari (default: Bergamo, Siracusa, Barcellona).
export async function getFamilyWeather(): Promise<FamilyWeather[]> {
  const { data } = await api.get<FamilyWeather[]>('/family-weather');
  return data;
}

// ── WMO weather code → descrizione IT + icona ─────────────────────────────────
// Mappa ufficiale Open-Meteo / WMO 4677 (gruppi principali).
const WMO: Record<number, { label: string; icon: string }> = {
  0: { label: 'Sereno', icon: '☀️' },
  1: { label: 'Prevalentemente sereno', icon: '🌤️' },
  2: { label: 'Parzialmente nuvoloso', icon: '⛅' },
  3: { label: 'Nuvoloso', icon: '☁️' },
  45: { label: 'Nebbia', icon: '🌫️' },
  48: { label: 'Nebbia con brina', icon: '🌫️' },
  51: { label: 'Pioviggine leggera', icon: '🌦️' },
  53: { label: 'Pioviggine', icon: '🌦️' },
  55: { label: 'Pioviggine intensa', icon: '🌦️' },
  56: { label: 'Pioviggine gelata', icon: '🌧️' },
  57: { label: 'Pioviggine gelata intensa', icon: '🌧️' },
  61: { label: 'Pioggia leggera', icon: '🌦️' },
  63: { label: 'Pioggia', icon: '🌧️' },
  65: { label: 'Pioggia intensa', icon: '🌧️' },
  66: { label: 'Pioggia gelata', icon: '🌧️' },
  67: { label: 'Pioggia gelata intensa', icon: '🌧️' },
  71: { label: 'Neve leggera', icon: '🌨️' },
  73: { label: 'Neve', icon: '🌨️' },
  75: { label: 'Neve intensa', icon: '❄️' },
  77: { label: 'Granelli di neve', icon: '🌨️' },
  80: { label: 'Rovesci leggeri', icon: '🌦️' },
  81: { label: 'Rovesci', icon: '🌧️' },
  82: { label: 'Rovesci violenti', icon: '⛈️' },
  85: { label: 'Rovesci di neve', icon: '🌨️' },
  86: { label: 'Rovesci di neve intensi', icon: '❄️' },
  95: { label: 'Temporale', icon: '⛈️' },
  96: { label: 'Temporale con grandine', icon: '⛈️' },
  99: { label: 'Temporale con grandine intensa', icon: '⛈️' },
};

export function weatherDescription(code: number | null): string {
  if (code === null || code === undefined) return '—';
  return WMO[code]?.label ?? 'N/D';
}

export function weatherIcon(code: number | null): string {
  if (code === null || code === undefined) return '🌡️';
  return WMO[code]?.icon ?? '🌡️';
}
