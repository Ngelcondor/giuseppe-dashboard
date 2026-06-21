'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody, CardHeader, CardFooter } from '@/components/ui/Card';
import api from '@/lib/api';

interface TwoFAState {
  enabled: boolean;
  code: string;
  email: string;
}

export default function AuthPage() {
  const router = useRouter();
  const { setUser, setToken, setTwoFARequired } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [twoFA, setTwoFA] = useState<TwoFAState>({
    enabled: false,
    code: '',
    email: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Inserisci email e password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const base = API_URL.includes('/api/v1')
        ? API_URL
        : `${API_URL.replace(/\/$/, '')}/api/v1`;

      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Errore ${res.status}`);
      }

      const data = await res.json();

      if (data.twoFARequired) {
        setTwoFA({ enabled: true, code: '', email });
        setTwoFARequired(true);
      } else {
        setUser(data.user);
        setToken(data.access_token);
        localStorage.setItem('token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('refreshToken', data.refresh_token);
        }
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Credenziali non valide');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFA.code || twoFA.code.length !== 6) {
      setError('Inserisci un codice a 6 cifre');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/verify-2fa', {
        email: twoFA.email,
        code: twoFA.code,
      });

      setUser(response.data.user);
      setToken(response.data.access_token);
      localStorage.setItem('token', response.data.access_token);
      if (response.data.refresh_token) {
        localStorage.setItem('refreshToken', response.data.refresh_token);
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Codice 2FA non valido');
    } finally {
      setIsLoading(false);
    }
  };

  if (twoFA.enabled) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <h1 className="text-2xl font-bold text-heading">Verifica a due fattori</h1>
            <p className="text-sm text-tertiary mt-2">Inserisci il codice dalla tua app authenticator</p>
          </CardHeader>
          <form onSubmit={handleTwoFASubmit}>
            <CardBody className="space-y-4">
              {error && (
                <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg flex gap-2 text-red-200 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
              <Input
                label="Codice 2FA"
                name="code"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={twoFA.code}
                onChange={(e) =>
                  setTwoFA((prev) => ({ ...prev, code: e.target.value.replace(/\D/g, '') }))
                }
              />
            </CardBody>
            <CardFooter className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTwoFA({ enabled: false, code: '', email: '' })}
              >
                Indietro
              </Button>
              <Button type="submit" variant="primary" isLoading={isLoading} className="flex-1">
                Verifica
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold text-heading">Bentornato</h1>
          <p className="text-sm text-tertiary mt-2">Accedi al tuo dashboard</p>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardBody className="space-y-4">
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg flex gap-2 text-red-200 text-sm">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="nome@esempio.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
            />

            <div>
              <Input
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {showPassword ? 'Nascondi' : 'Mostra'} password
              </button>
            </div>
          </CardBody>

          <CardFooter>
            <Button type="submit" variant="primary" isLoading={isLoading} className="w-full">
              Accedi
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
