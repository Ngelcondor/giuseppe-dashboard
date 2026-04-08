/**
 * API Token management service.
 */
import api from '@/lib/api';

export interface APIToken {
  id: string;
  name: string;
  token_prefix: string;
  scope: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  description: string | null;
}

export interface APITokenCreated extends APIToken {
  token: string; // Full token, shown only once
}

export interface APITokenList {
  tokens: APIToken[];
  total: number;
}

export interface CreateTokenRequest {
  name: string;
  scope?: string;
  description?: string;
  expires_in_days?: number;
}

export interface WebhookSecretInfo {
  is_configured: boolean;
  secret_preview: string | null;
  hint: string;
}

const apiTokenService = {
  /** List all API tokens */
  async list(): Promise<APITokenList> {
    const { data } = await api.get('/api-tokens');
    return data;
  },

  /** Create a new API token */
  async create(request: CreateTokenRequest): Promise<APITokenCreated> {
    const { data } = await api.post('/api-tokens', request);
    return data;
  },

  /** Revoke (delete) a token */
  async revoke(tokenId: string): Promise<void> {
    await api.delete(`/api-tokens/${tokenId}`);
  },

  /** Toggle token active/inactive */
  async toggle(tokenId: string): Promise<APIToken> {
    const { data } = await api.patch(`/api-tokens/${tokenId}/toggle`);
    return data;
  },

  /** Get webhook secret info */
  async getWebhookSecret(): Promise<WebhookSecretInfo> {
    const { data } = await api.get('/api-tokens/webhook-secret');
    return data;
  },

  /** Reveal full webhook secret */
  async revealWebhookSecret(): Promise<string> {
    const { data } = await api.get('/api-tokens/webhook-secret/reveal');
    return data.secret;
  },
};

export default apiTokenService;
