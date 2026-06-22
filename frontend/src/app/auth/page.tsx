'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';

interface TwoFAState {
  enabled: boolean;
  code: string;
  email: string;
}

// "Login 3D — Orbit" design (from Claude Design / Giuseppe Dashboard DS),
// adapted to the app's real auth flow. Dark, self-contained theme: the color
// tokens are overridden on .lg-root so it renders correctly over the dark
// scene regardless of the app's light dashboard theme.
const LOGIN_CSS = `
.lg-root{
  --lg-accent:99 102 241;
  --color-heading:255 255 255;
  --color-body:226 232 240;
  --color-tertiary:148 163 184;
  --color-muted:100 116 139;
  font-family:'Inter Tight',system-ui,sans-serif;-webkit-font-smoothing:antialiased;
  position:relative;min-height:100vh;overflow:hidden;color:rgb(var(--color-body));
  background:
    radial-gradient(1200px 700px at 22% -10%, rgb(var(--lg-accent)/0.18), transparent 60%),
    radial-gradient(1000px 800px at 110% 120%, rgb(236 72 153/0.12), transparent 55%),
    rgb(6 6 9)}
.lg-grid{position:absolute;inset:0;background-image:linear-gradient(rgb(255 255 255/0.025) 1px,transparent 1px),linear-gradient(90deg,rgb(255 255 255/0.025) 1px,transparent 1px);background-size:64px 64px;mask-image:radial-gradient(800px 600px at 50% 45%,#000,transparent 78%);-webkit-mask-image:radial-gradient(800px 600px at 50% 45%,#000,transparent 78%);pointer-events:none}
.lg-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 120% at 50% 40%,transparent 55%,rgb(0 0 0/0.55) 100%)}
.lg-glow{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none;opacity:.55}
.lg-glow-a{width:420px;height:420px;left:8%;top:12%;background:rgb(var(--lg-accent)/0.5);animation:lgDrift 14s ease-in-out infinite}
.lg-glow-b{width:360px;height:360px;right:6%;bottom:8%;background:rgb(236 72 153/0.4);animation:lgDrift 18s ease-in-out infinite reverse}
@keyframes lgDrift{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-24px)}}
.lg-orbit{position:absolute;inset:0;display:grid;place-items:center;perspective:1100px;pointer-events:none}
.lg-gyro{position:relative;width:560px;height:560px;transform-style:preserve-3d;animation:lgTumble 30s linear infinite}
.lg-ring{position:absolute;inset:0;border-radius:50%;border:1.5px solid rgb(var(--lg-accent)/0.4);box-shadow:inset 0 0 60px rgb(var(--lg-accent)/0.08)}
.lg-ring.r1{transform:rotateX(74deg)}
.lg-ring.r2{transform:rotateY(72deg);border-color:rgb(var(--lg-accent)/0.3)}
.lg-ring.r3{inset:64px;transform:rotateX(58deg) rotateY(42deg);border-color:rgb(var(--lg-accent)/0.26)}
.lg-ring.r4{inset:132px;transform:rotateX(18deg) rotateY(68deg);border:1.5px solid rgb(236 72 153/0.3)}
.lg-ring.r5{inset:200px;transform:rotateY(30deg) rotateX(50deg);border-color:rgb(var(--lg-accent)/0.45)}
.lg-orbdot{position:absolute;top:50%;left:50%;width:10px;height:10px;margin:-5px;border-radius:50%;background:rgb(var(--lg-accent));box-shadow:0 0 18px 2px rgb(var(--lg-accent)/0.8);transform:rotateX(74deg) translateX(280px)}
.lg-orbdot.d2{background:rgb(236 72 153);box-shadow:0 0 18px 2px rgb(236 72 153/0.8);transform:rotateY(72deg) translateX(280px)}
.lg-core{position:absolute;inset:42%;border-radius:50%;background:radial-gradient(circle,rgb(var(--lg-accent)/0.95),rgb(var(--lg-accent)/0) 70%);filter:blur(8px);animation:lgPulse 4.5s ease-in-out infinite}
@keyframes lgTumble{from{transform:rotateX(0) rotateY(0)}to{transform:rotateX(360deg) rotateY(360deg)}}
@keyframes lgPulse{0%,100%{opacity:.65;transform:scale(.92)}50%{opacity:1;transform:scale(1.08)}}
.lg-stage{position:relative;z-index:5;min-height:100vh;display:grid;place-items:center;padding:40px 20px}
.lg-cardwrap{perspective:1300px}
.lg-card{position:relative;width:min(424px,92vw);transform-style:preserve-3d;transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .18s cubic-bezier(.2,.7,.2,1);
  border:1px solid rgb(255 255 255/0.12);border-radius:26px;
  background:linear-gradient(160deg,rgb(255 255 255/0.07),rgb(255 255 255/0.022));
  backdrop-filter:blur(22px) saturate(1.2);-webkit-backdrop-filter:blur(22px) saturate(1.2);
  box-shadow:0 50px 100px -28px rgb(0 0 0/0.8),0 0 0 1px rgb(var(--lg-accent)/0.07),inset 0 1px 0 rgb(255 255 255/0.09);
  display:flex;overflow:visible}
.lg-sheen{position:absolute;inset:0;border-radius:26px;background:linear-gradient(120deg,transparent 35%,rgb(255 255 255/0.07) 48%,transparent 60%);pointer-events:none;opacity:.7}
.lg-formcol{flex:1;min-width:0;padding:40px 38px;transform-style:preserve-3d}
@media(max-width:640px){.lg-formcol{padding:34px 28px}}
.lg-mark{width:38px;height:38px;border-radius:11px;background:rgb(var(--lg-accent));display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Fraunces',serif;font-style:italic;font-weight:600;font-size:21px;flex:none;box-shadow:0 8px 24px -6px rgb(var(--lg-accent)/0.8)}
.lg-brandtop{display:flex;align-items:center;gap:12px;margin-bottom:30px}
.lg-brandtop .nm{font-size:15.5px;font-weight:600;color:rgb(var(--color-heading));letter-spacing:-.01em}
.lg-brandtop .tg{font-size:11.5px;color:rgb(var(--color-tertiary))}
.lg-eyebrow{font:600 10.5px/1 'JetBrains Mono',monospace;letter-spacing:.22em;text-transform:uppercase;color:rgb(var(--lg-accent))}
.lg-h1{margin:14px 0 0;font-size:30px;line-height:1.05;letter-spacing:-.02em;color:rgb(var(--color-heading));font-weight:600}
.lg-h1 em{font-family:'Fraunces',serif;font-style:italic;font-weight:500}
.lg-sub{margin:11px 0 0;font-size:14px;color:rgb(var(--color-tertiary));line-height:1.5}
.lg-form{display:flex;flex-direction:column;gap:16px;margin-top:26px}
.lg-field{display:flex;flex-direction:column;gap:8px}
.lg-label{font:600 10.5px/1 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:rgb(var(--color-tertiary))}
.lg-inputwrap{position:relative}
.lg-input{width:100%;background:rgb(255 255 255/0.04);border:1px solid rgb(255 255 255/0.13);border-radius:13px;padding:13px 15px;color:rgb(var(--color-heading));font:500 15px/1.2 'Inter Tight',sans-serif;outline:none;transition:border-color .2s,box-shadow .2s,background .2s}
.lg-input::placeholder{color:rgb(var(--color-muted))}
.lg-input:focus{border-color:rgb(var(--lg-accent)/0.85);box-shadow:0 0 0 3px rgb(var(--lg-accent)/0.2);background:rgb(255 255 255/0.06)}
.lg-inputwrap .lg-input{padding-right:44px}
.lg-eye{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:rgb(var(--color-muted));padding:6px;display:flex;border-radius:8px;transition:color .15s}
.lg-eye:hover{color:rgb(var(--color-body))}
.lg-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:2px}
.lg-remember{display:flex;align-items:center;gap:9px;cursor:pointer;user-select:none}
.lg-remember input{appearance:none;-webkit-appearance:none;width:18px;height:18px;border-radius:6px;border:1.5px solid rgb(255 255 255/0.2);background:rgb(255 255 255/0.04);cursor:pointer;position:relative;flex:none;transition:.18s}
.lg-remember input:checked{background:rgb(var(--lg-accent));border-color:rgb(var(--lg-accent))}
.lg-remember input:checked::after{content:"";position:absolute;left:5px;top:1.5px;width:5px;height:9px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}
.lg-remember span{font-size:13px;color:rgb(var(--color-body))}
.lg-link{font-size:12.5px;color:rgb(var(--lg-accent));text-decoration:none;font-weight:500;background:none;border:none;cursor:pointer;padding:0}
.lg-link:hover{text-decoration:underline}
.lg-submit{width:100%;border:none;border-radius:13px;padding:14px 18px;font:600 15px/1 'Inter Tight',sans-serif;color:#fff;cursor:pointer;background:rgb(var(--lg-accent));box-shadow:0 14px 34px -10px rgb(var(--lg-accent)/0.85);transition:transform .14s,box-shadow .2s,filter .2s}
.lg-submit:hover{filter:brightness(1.08);box-shadow:0 18px 44px -10px rgb(var(--lg-accent)/0.95)}
.lg-submit:active{transform:scale(.98)}
.lg-submit:disabled{opacity:.65;cursor:not-allowed;filter:none}
.lg-error{display:flex;align-items:flex-start;gap:9px;margin-top:20px;padding:11px 13px;border-radius:12px;background:rgb(239 68 68/0.12);border:1px solid rgb(239 68 68/0.32);color:rgb(254 202 202);font-size:13px;line-height:1.45}
.lg-error svg{flex:none;margin-top:1px}
.lg-chip{position:absolute;top:24px;right:28px;z-index:6;display:flex;align-items:center;gap:8px;font:500 11.5px/1 'JetBrains Mono',monospace;color:rgb(var(--color-tertiary));border:1px solid rgb(255 255 255/0.1);background:rgb(255 255 255/0.03);padding:8px 12px;border-radius:99px;backdrop-filter:blur(8px)}
.lg-chip i{width:7px;height:7px;border-radius:50%;background:rgb(34 197 94);box-shadow:0 0 8px rgb(34 197 94/0.9);font-style:normal}
.lg-anim .lg-reveal{opacity:0;transform:translateY(28px) scale(.96)}
@media(prefers-reduced-motion:no-preference){
  .lg-anim.lg-lit .lg-reveal{opacity:1;transform:none;transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform 1s cubic-bezier(.2,.7,.2,1)}
}
@media(prefers-reduced-motion:reduce){
  .lg-anim .lg-reveal{opacity:1;transform:none}
  .lg-gyro,.lg-glow,.lg-core{animation:none}
  .lg-card{transition:none}
}
`;

export default function AuthPage() {
  const router = useRouter();
  const { setUser, setToken, setTwoFARequired } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [twoFA, setTwoFA] = useState<TwoFAState>({ enabled: false, code: '', email: '' });

  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Entrance reveal + mouse-tilt parallax (respects reduced motion).
  useEffect(() => {
    const root = rootRef.current;
    const card = cardRef.current;
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const raf = requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('lg-lit')));
    const t1 = window.setTimeout(() => root.classList.add('lg-lit'), 120);
    const t2 = window.setTimeout(() => root.classList.remove('lg-anim'), 1600);

    let onMove: ((e: PointerEvent) => void) | undefined;
    if (!reduce && card) {
      const stage = root.querySelector<HTMLElement>('.lg-stage');
      onMove = (e: PointerEvent) => {
        if (!stage) return;
        const r = stage.getBoundingClientRect();
        const cx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
        const cy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
        card.style.setProperty('--ry', (cx * 15).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (cy * -15).toFixed(2) + 'deg');
      };
      window.addEventListener('pointermove', onMove, { passive: true });
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (onMove) window.removeEventListener('pointermove', onMove);
    };
  }, []);

  const persistToken = (accessToken: string, refreshToken?: string) => {
    setToken(accessToken);
    const store = remember ? window.localStorage : window.sessionStorage;
    store.setItem('token', accessToken);
    // api.ts reads localStorage.token — mirror there so the session works either way.
    window.localStorage.setItem('token', accessToken);
    if (refreshToken) store.setItem('refreshToken', refreshToken);
  };

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
      const base = API_URL.includes('/api/v1') ? API_URL : `${API_URL.replace(/\/$/, '')}/api/v1`;
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
        persistToken(data.access_token, data.refresh_token);
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
      const response = await api.post('/auth/verify-2fa', { email: twoFA.email, code: twoFA.code });
      setUser(response.data.user);
      persistToken(response.data.access_token, response.data.refresh_token);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Codice 2FA non valido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LOGIN_CSS }} />
      <div className="lg-root lg-anim" ref={rootRef} data-screen-label="Login">
        <div className="lg-grid" />
        <div className="lg-glow lg-glow-a" />
        <div className="lg-glow lg-glow-b" />

        <div className="lg-orbit" aria-hidden="true">
          <div className="lg-gyro">
            <div className="lg-ring r1" />
            <div className="lg-ring r2" />
            <div className="lg-ring r3" />
            <div className="lg-ring r4" />
            <div className="lg-ring r5" />
            <div className="lg-orbdot" />
            <div className="lg-orbdot d2" />
            <div className="lg-core" />
          </div>
        </div>

        <div className="lg-vignette" />
        <div className="lg-chip"><i />SISTEMA OPERATIVO</div>

        <div className="lg-stage">
          <div className="lg-cardwrap lg-reveal">
            <div className="lg-card" ref={cardRef}>
              <div className="lg-sheen" />
              <div className="lg-formcol">
                <div className="lg-brandtop" style={{ transform: 'translateZ(62px)' }}>
                  <span className="lg-mark">G</span>
                  <div>
                    <div className="nm">Giuseppe Dashboard</div>
                    <div className="tg">Il tuo spazio di studio</div>
                  </div>
                </div>

                {twoFA.enabled ? (
                  <>
                    <div style={{ transform: 'translateZ(44px)' }}>
                      <div className="lg-eyebrow">Verifica</div>
                      <h1 className="lg-h1">Due <em>fattori</em></h1>
                      <p className="lg-sub">Inserisci il codice dalla tua app authenticator.</p>
                    </div>

                    {error && (
                      <div className="lg-error" role="alert">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                      </div>
                    )}

                    <form className="lg-form" onSubmit={handleTwoFASubmit}>
                      <div className="lg-field" style={{ transform: 'translateZ(30px)' }}>
                        <label className="lg-label" htmlFor="lg-2fa">Codice 2FA</label>
                        <input
                          className="lg-input"
                          id="lg-2fa"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="000000"
                          autoComplete="one-time-code"
                          value={twoFA.code}
                          onChange={(e) => { setTwoFA((p) => ({ ...p, code: e.target.value.replace(/\D/g, '') })); setError(''); }}
                        />
                      </div>
                      <div className="lg-row" style={{ transform: 'translateZ(22px)' }}>
                        <button type="button" className="lg-link" onClick={() => { setTwoFA({ enabled: false, code: '', email: '' }); setError(''); }}>
                          ← Indietro
                        </button>
                      </div>
                      <div style={{ transform: 'translateZ(54px)', marginTop: 6 }}>
                        <button className="lg-submit" type="submit" disabled={isLoading}>
                          {isLoading ? 'Verifica…' : 'Verifica'}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <div style={{ transform: 'translateZ(44px)' }}>
                      <div className="lg-eyebrow">Bentornato</div>
                      <h1 className="lg-h1">Accedi al tuo <em>spazio</em></h1>
                      <p className="lg-sub">Inserisci le credenziali per continuare.</p>
                    </div>

                    {error && (
                      <div className="lg-error" role="alert">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                      </div>
                    )}

                    <form className="lg-form" onSubmit={handleSubmit}>
                      <div className="lg-field" style={{ transform: 'translateZ(30px)' }}>
                        <label className="lg-label" htmlFor="lg-email">Email</label>
                        <input
                          className="lg-input"
                          id="lg-email"
                          type="email"
                          placeholder="nome@esempio.com"
                          autoComplete="username"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        />
                      </div>
                      <div className="lg-field" style={{ transform: 'translateZ(26px)' }}>
                        <label className="lg-label" htmlFor="lg-pass">Password</label>
                        <div className="lg-inputwrap">
                          <input
                            className="lg-input"
                            id="lg-pass"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••••"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                          />
                          <button
                            type="button"
                            className="lg-eye"
                            aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                            onClick={() => setShowPassword((s) => !s)}
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div className="lg-row" style={{ transform: 'translateZ(22px)' }}>
                        <label className="lg-remember">
                          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                          <span>Ricordami</span>
                        </label>
                      </div>
                      <div style={{ transform: 'translateZ(54px)', marginTop: 6 }}>
                        <button className="lg-submit" type="submit" disabled={isLoading}>
                          {isLoading ? 'Accesso…' : 'Accedi'}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
