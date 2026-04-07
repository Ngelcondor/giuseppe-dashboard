/**
 * Apple Health Import API Service
 * Gestisce l'import dati da Apple Health.
 */
import api from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppleHealthImportResponse {
  metrics_imported: number;
  workouts_imported: number;
  sleep_sessions_imported: number;
  errors: string[];
}

export interface AppleHealthStatus {
  connected: boolean;
  total_records: number;
  by_type: Record<string, { count: number; latest: string | null }>;
  last_shortcut_sync?: string | null;
}

export interface WebhookSyncResult {
  ok: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  synced_at: string;
}

// ─── API Methods ─────────────────────────────────────────────────────────────

const appleHealthService = {
  /** Upload XML export file */
  async importXml(file: File): Promise<AppleHealthImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/health/apple/import/xml', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 minutes for large files
    });
    return data;
  },

  /** Import CSV data */
  async importCsv(csvData: string): Promise<AppleHealthImportResponse> {
    const { data } = await api.post('/health/apple/import/csv', csvData, {
      headers: { 'Content-Type': 'text/plain' },
    });
    return data;
  },

  /** Get import status */
  async getStatus(): Promise<AppleHealthStatus> {
    const { data } = await api.get('/health/apple/status');
    return data;
  },

  /**
   * Returns the public webhook URL that the iOS Shortcut should POST to.
   * The token must be set server-side; we just surface the URL.
   */
  getWebhookUrl(): string {
    const base =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:8000';
    const apiBase = base.includes('/api/v1') ? base : `${base}/api/v1`;
    return `${apiBase}/health/apple/webhook`;
  },

  /** Returns the medication sync webhook URL for Health Auto Export. */
  getMedicationSyncUrl(): string {
    const base =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:8000';
    const apiBase = base.includes('/api/v1') ? base : `${base}/api/v1`;
    return `${apiBase}/health/apple/medications/sync`;
  },
};

export default appleHealthService;
