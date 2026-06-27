/**
 * Budget service — API client for budget, bank, transactions, and scadenze.
 */
import api from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BankConnection {
  id: string;
  institution_id: string;
  institution_name: string;
  account_id: string | null;
  account_iban: string | null;
  account_name: string | null;
  currency: string;
  status: 'active' | 'expired' | 'error' | 'pending';
  last_sync_at: string | null;
  last_sync_error: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface BankBalance {
  amount: number;
  currency: string;
  balance_type: string;
}

export interface BankAuthResponse {
  auth_link: string;
  requisition_id: string;
  institution_id: string;
  institution_name: string;
}

export interface Institution {
  id: string;
  name: string;
  logo: string | null;
  countries: string[] | null;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  description: string | null;
  transaction_type: 'income' | 'expense';
  date: string;
  source: 'manual' | 'bank_sync' | 'csv_import';
  external_id: string | null;
  merchant_name: string | null;
  linked_scadenza_id: string | null;
  is_recurring: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategorySpending {
  category: string;
  spent: number;
  limit: number | null;
  remaining: number | null;
  percentage: number;
}

export interface ScadenzaPreview {
  id: string;
  desc: string;
  importo: number;
  scadenza_gg_mm: string;
  tipo: string;
  pagato: boolean;
  days_until: number;
  is_overdue: boolean;
  matched_transaction: boolean;
}

export interface BudgetDashboard {
  bank_connected: boolean;
  bank_balance: number | null;
  bank_currency: string;
  bank_last_sync: string | null;
  month: string;
  total_income: number;
  total_expenses: number;
  net_balance: number;
  categories: CategorySpending[];
  upcoming_scadenze: ScadenzaPreview[];
  overdue_scadenze: ScadenzaPreview[];
  scadenze_total: number;
  scadenze_paid: number;
  scadenze_remaining: number;
  recent_transactions: Transaction[];
}

export interface BudgetGoal {
  id: string;
  category: string;
  monthly_limit: number;
  month: string;
  notes: string | null;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  message: string;
}

// ─── Bank Connection ─────────────────────────────────────────────────────────

export async function getBankConnection(): Promise<BankConnection | null> {
  const { data } = await api.get('/budget/bank/connection');
  return data;
}

export async function getBankBalance(): Promise<BankBalance[]> {
  const { data } = await api.get('/budget/bank/balance');
  return data;
}

export interface BankProviderStatus {
  provider_available: boolean;
  provider_name: string | null;
}

export async function getBankProviderStatus(): Promise<BankProviderStatus> {
  const { data } = await api.get('/budget/bank/status');
  return data;
}

export async function initBankAuth(institutionId?: string, country = 'ES'): Promise<BankAuthResponse> {
  const { data } = await api.post('/budget/bank/auth', {
    institution_id: institutionId,
    country,
  });
  return data;
}

export async function completeBankAuth(code: string, state?: string): Promise<BankConnection> {
  const { data } = await api.post('/budget/bank/callback', {
    code,
    state,
  });
  return data;
}

export async function syncBankTransactions(daysBack = 30): Promise<ImportResult> {
  const { data } = await api.post(`/budget/bank/sync?days_back=${daysBack}`);
  return data;
}

export async function disconnectBank(): Promise<void> {
  await api.delete('/budget/bank/connection');
}

export async function listInstitutions(country = 'ES'): Promise<Institution[]> {
  const { data } = await api.get(`/budget/bank/institutions?country=${country}`);
  return data;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getBudgetDashboard(month?: number, year?: number): Promise<BudgetDashboard> {
  const params = new URLSearchParams();
  if (month) params.set('month', month.toString());
  if (year) params.set('year', year.toString());
  const { data } = await api.get(`/budget/dashboard?${params}`);
  return data;
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function listTransactions(opts?: {
  month?: number;
  year?: number;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<Transaction[]> {
  const params = new URLSearchParams();
  if (opts?.month) params.set('month', opts.month.toString());
  if (opts?.year) params.set('year', opts.year.toString());
  if (opts?.category) params.set('category', opts.category);
  if (opts?.limit) params.set('limit', opts.limit.toString());
  if (opts?.offset) params.set('offset', opts.offset.toString());
  const { data } = await api.get(`/budget/transactions?${params}`);
  return data;
}

export async function createTransaction(tx: {
  amount: number;
  category: string;
  description?: string;
  transaction_type: 'income' | 'expense';
  date: string;
  is_recurring?: boolean;
  notes?: string;
}): Promise<Transaction> {
  const { data } = await api.post('/budget/transactions', tx);
  return data;
}

export async function updateTransaction(
  id: string,
  body: Partial<{ amount: number; category: string; description: string; date: string }>,
): Promise<Transaction> {
  const { data } = await api.put(`/budget/transactions/${id}`, body);
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/budget/transactions/${id}`);
}

/** Re-run the categoriser over imported transactions. Returns how many changed. */
export async function recategorizeTransactions(): Promise<{ updated: number; total: number }> {
  const { data } = await api.post('/budget/transactions/recategorize');
  return data;
}

// ─── CSV Import ──────────────────────────────────────────────────────────────

export async function importCSV(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/budget/import/csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ─── Budget Goals ────────────────────────────────────────────────────────────

export async function listGoals(): Promise<BudgetGoal[]> {
  const { data } = await api.get('/budget/goals');
  return data;
}

export async function createGoal(goal: {
  category: string;
  monthly_limit: number;
  month: string;
}): Promise<BudgetGoal> {
  const { data } = await api.post('/budget/goals', goal);
  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  await api.delete(`/budget/goals/${id}`);
}
