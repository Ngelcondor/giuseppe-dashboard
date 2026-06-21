import { useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface UseApiOptions {
  withAuth?: boolean;
}

interface UseApiReturn<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      errorData?.detail || errorData?.message || `Request failed with status ${response.status}`,
      errorData
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export function useApi<T>(
  apiCall: (request: typeof apiRequest) => Promise<T>,
  options: UseApiOptions = { withAuth: true }
): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { token, logout } = useAuthStore();

  const execute = useCallback(async (..._args: any[]): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const boundRequest = <R>(endpoint: string, reqOptions: RequestInit = {}) =>
        apiRequest<R>(endpoint, reqOptions, options.withAuth ? token : null);

      const result = await apiCall(boundRequest as typeof apiRequest);
      setData(result);
      return result;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          logout();
          setError('Sessione scaduta. Effettua nuovamente il login.');
        } else {
          setError(err.message);
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Si è verificato un errore imprevisto.');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiCall, token, options.withAuth, logout]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, error, loading, execute, reset };
}

// Convenience functions for direct API calls
export const api = {
  get: <T>(endpoint: string, token?: string | null) =>
    apiRequest<T>(endpoint, { method: 'GET' }, token),

  post: <T>(endpoint: string, body: any, token?: string | null) =>
    apiRequest<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }, token),

  put: <T>(endpoint: string, body: any, token?: string | null) =>
    apiRequest<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }, token),

  patch: <T>(endpoint: string, body: any, token?: string | null) =>
    apiRequest<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }, token),

  delete: <T>(endpoint: string, token?: string | null) =>
    apiRequest<T>(endpoint, { method: 'DELETE' }, token),
};

export { apiRequest, API_BASE_URL };
