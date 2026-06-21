import api from '@/lib/api';

// Open Banking integration (honest status). Reads the `openbanking` settings
// config. Until a provider is configured AND authorised, the backend returns
// connected:false with empty lists — no fabricated balances/transactions.
// Live saldi/movimenti are served by the Budget bank stack (/budget/bank/*).

export interface BankingStatus {
  provider: string | null;
  connected: boolean;
  status: 'connected' | 'not_connected';
  detail: string | null;
}

export interface BankingAccount {
  account_id: string;
  iban?: string | null;
  name?: string | null;
  currency?: string;
}

export interface BankingAccountsResponse {
  connected: boolean;
  status: 'connected' | 'not_connected';
  provider: string | null;
  accounts: BankingAccount[];
  detail: string | null;
}

export async function getBankingStatus(): Promise<BankingStatus> {
  const { data } = await api.get<BankingStatus>('/banking/status');
  return data;
}

export async function getBankingAccounts(): Promise<BankingAccountsResponse> {
  const { data } = await api.get<BankingAccountsResponse>('/banking/accounts');
  return data;
}
