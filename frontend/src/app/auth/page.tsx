'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody, CardHeader, CardFooter } from '@/components/ui/Card';
import api from '@/lib/api';
import { validateEmail, validatePassword } from '@/lib/utils';

interface AuthFormData {
  email: string;
  password: string;
  name?: string;
  passwordConfirm?: string;
}

interface TwoFAState {
  enabled: boolean;
  code: string;
  email: string;
}

export default function AuthPage() {
  const router = useRouter();
  const { setUser, setToken, setTwoFARequired } = useAuthStore();

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [twoFA, setTwoFA] = useState<TwoFAState>({
    enabled: false,
    code: '',
    email: '',
  });

  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    name: '',
    passwordConfirm: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const validateForm = (): boolean => {
    if (!formData.email || !formData.password) {
      setError('Compila tutti i campi');
      return false;
    }

    if (!validateEmail(formData.email)) {
      setError('Email non valida');
      return false;
    }

    if (!isLogin) {
      if (!formData.name) {
        setError('Il nome è obbligatorio');
        return false;
      }

      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.valid) {
        setError(
          'La password deve contenere almeno 8 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale'
        );
        return false;
      }

      if (formData.password !== formData.passwordConfirm) {
        setError('Le password non corrispondono');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setError('');

    try {
      const API_URL = 'http://localhost:8000/api/v1';
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const body = {
        email: formData.email,
        password: formData.password,
        ...(isLogin ? {} : { username: formData.name }),
      };

      const url = `${API_URL}${endpoint}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Errore ${res.status}`);
      }

      const data = await res.json();

      if (data.twoFARequired) {
        setTwoFA({
          enabled: true,
          code: '',
          email: formData.email,
        });
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
      setError(err.message || 'Si è verificato un errore durante l\'autenticazione');
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <h1 className="text-2xl font-bold text-slate-100">Verifica a due fattori</h1>
            <p className="text-sm text-slate-400 mt-2">
              Inserisci il codice ricevuto nella tua email
            </p>
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
                  setTwoFA((prev) => ({
                    ...prev,
                    code: e.target.value.replace(/\D/g, ''),
                  }))
                }
              />
            </CardBody>
            <CardFooter className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setTwoFA({ enabled: false, code: '', email: '' });
                  setFormData({ email: '', password: '', name: '', passwordConfirm: '' });
                }}
              >
                Indietro
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                className="flex-1"
              >
                Verifica
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold text-slate-100">
            {isLogin ? 'Accedi' : 'Registrati'}
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            {isLogin
              ? 'Accedi al tuo dashboard personale'
              : 'Crea un nuovo account per iniziare'}
          </p>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardBody className="space-y-4">
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg flex gap-2 text-red-200 text-sm">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {!isLogin && (
              <Input
                label="Nome completo"
                name="name"
                type="text"
                placeholder="Giuseppe Rossi"
                value={formData.name || ''}
                onChange={handleInputChange}
              />
            )}

            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="nome@esempio.com"
              value={formData.email}
              onChange={handleInputChange}
            />

            <div>
              <Input
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={formData.password}
                onChange={handleInputChange}
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {showPassword ? 'Nascondi' : 'Mostra'} password
                </button>
              </div>
            </div>

            {!isLogin && (
              <Input
                label="Conferma password"
                name="passwordConfirm"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={formData.passwordConfirm || ''}
                onChange={handleInputChange}
              />
            )}
          </CardBody>

          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              className="w-full"
            >
              {isLogin ? 'Accedi' : 'Registrati'}
            </Button>

            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setFormData({ email: '', password: '', name: '', passwordConfirm: '' });
              }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {isLogin
                ? 'Non hai un account? Registrati'
                : 'Hai già un account? Accedi'}
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
