import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { api } from './useApi';
import type { LoginRequest, RegisterRequest, AuthResponse, TwoFAVerifyRequest } from '@/types';

export const useAuth = () => {
  const router = useRouter();
  const { user, token, isAuthenticated, twoFARequired, setUser, setToken, setTwoFARequired, logout: storeLogout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (credentials: LoginRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<AuthResponse>('/api/v1/auth/login', credentials);

      if (response.twoFARequired) {
        setTwoFARequired(true);
        return { twoFARequired: true };
      }

      setToken(response.token);
      setUser(response.user);
      router.push('/dashboard');
      return { success: true };
    } catch (err: any) {
      const message = err?.message || 'Errore durante il login.';
      setError(message);
      return { error: message };
    } finally {
      setLoading(false);
    }
  }, [router, setToken, setUser, setTwoFARequired]);

  const register = useCallback(async (data: RegisterRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<AuthResponse>('/api/v1/auth/register', data);
      setToken(response.token);
      setUser(response.user);
      router.push('/dashboard');
      return { success: true };
    } catch (err: any) {
      const message = err?.message || 'Errore durante la registrazione.';
      setError(message);
      return { error: message };
    } finally {
      setLoading(false);
    }
  }, [router, setToken, setUser]);

  const verify2FA = useCallback(async (data: TwoFAVerifyRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post<AuthResponse>('/api/v1/auth/verify-2fa', data);
      setToken(response.token);
      setUser(response.user);
      setTwoFARequired(false);
      router.push('/dashboard');
      return { success: true };
    } catch (err: any) {
      const message = err?.message || 'Codice 2FA non valido.';
      setError(message);
      return { error: message };
    } finally {
      setLoading(false);
    }
  }, [router, setToken, setUser, setTwoFARequired]);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await api.post('/api/v1/auth/logout', {}, token).catch(() => {});
      }
    } finally {
      storeLogout();
      router.push('/auth');
    }
  }, [token, storeLogout, router]);

  const refreshToken = useCallback(async () => {
    if (!token) return false;

    try {
      const response = await api.post<AuthResponse>('/api/v1/auth/refresh', {}, token);
      setToken(response.token);
      return true;
    } catch {
      storeLogout();
      return false;
    }
  }, [token, setToken, storeLogout]);

  return {
    user,
    token,
    isAuthenticated,
    twoFARequired,
    loading,
    error,
    login,
    register,
    verify2FA,
    logout,
    refreshToken,
  };
};
