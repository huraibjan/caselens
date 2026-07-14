'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import LoadingScreen from '@/components/ui/LoadingScreen';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

const FEATURES = [
  { icon: '⚖️', label: 'AI Judgment Engine',    sub: 'Per-charge probability scoring with legal reasoning' },
  { icon: '📄', label: 'RAG Document Analysis', sub: 'Ask questions from case files with page citations' },
  { icon: '📝', label: 'Letter Generator',       sub: 'AI-drafted demand letters, motions & notices' },
  { icon: '🔐', label: 'Encrypted & Compliant',  sub: 'Attorney-client privilege protected end-to-end' },
];

export default function Login() {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [dest, setDest]           = useState('/dashboard');
  const router = useRouter();

  /** Shared post-authentication flow: persist tokens, resolve destination. */
  const afterAuth = async (data: any) => {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    const user = await fetchApi('/api/v1/auth/me');
    const target = user.organization_id ? '/dashboard' : '/onboarding';
    if (user.organization_id) localStorage.setItem('organization_id', user.organization_id);
    setDest(target);
    setShowLoader(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await fetchApi('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await afterAuth(data);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please try again.');
      setLoading(false);
    }
  };

  const handleGoogle = async (credential: string) => {
    setError('');
    setLoading(true);
    try {
      const data = await fetchApi('/api/v1/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      });
      await afterAuth(data);
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  if (showLoader) return <LoadingScreen onComplete={() => router.push(dest)} />;

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── LEFT PANEL — photographic background + brand ─────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden p-12">
        {/* Background photo */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/intelix-ai.jpeg')" }}
        />
        {/* Dark brand gradient overlay for legibility */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(150deg, rgba(15,23,42,0.94) 0%, rgba(30,27,75,0.90) 45%, rgba(15,23,42,0.95) 100%)',
          }}
        />
        {/* Glowing accent orbs */}
        <div className="absolute top-[-80px] left-[-80px] w-[420px] h-[420px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #3B82F6, transparent 70%)' }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-[320px] h-[320px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #6366F1, transparent 70%)' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }} />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm text-white"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', boxShadow: '0 4px 20px rgba(99,102,241,0.5)' }}>
              CI
            </div>
            <div>
              <div className="text-lg font-black text-white tracking-tight">CaseIntelix</div>
              <div className="text-xs font-medium" style={{ color: '#60A5FA' }}>Legal Intelligence Platform</div>
            </div>
          </div>

          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6 tracking-wider uppercase"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.3)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
              AI-Powered · SOC 2 Ready
            </div>
            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4" style={{ letterSpacing: '-0.02em' }}>
              The AI-Powered
              <br />
              <span style={{
                background: 'linear-gradient(90deg, #60A5FA, #818CF8, #A78BFA)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Legal Workspace
              </span>
            </h1>
            <p className="text-base leading-relaxed" style={{ color: '#CBD5E1', maxWidth: 400 }}>
              Analyze case documents, generate AI judgments, track matters, and draft legal letters — all in one secure platform.
            </p>
          </div>

          <div className="space-y-5">
            {FEATURES.map(f => (
              <div key={f.label} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  {f.icon}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{f.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap gap-2 mt-10">
          {['End-to-End Encrypted', 'SOC 2 Ready', 'Human-in-the-Loop Review', 'Cited & Grounded'].map(b => (
            <span key={b} className="text-xs font-medium px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)' }}>
              ✓ {b}
            </span>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL — sign in form ──────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 px-6 py-12">
        <div className="flex items-center gap-3 mb-8 lg:hidden">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
            CI
          </div>
          <span className="font-black text-xl text-slate-900">CaseIntelix</span>
        </div>

        <div className="w-full max-w-[420px]">
          <div className="bg-white rounded-2xl p-8 space-y-5"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0' }}>

            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Welcome back</h2>
              <p className="text-sm text-slate-500 mt-1">Sign in to your secure workspace</p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl text-sm font-medium bg-red-50 text-red-800 border border-red-200">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Google sign-in */}
            <GoogleSignInButton onCredential={handleGoogle} disabled={loading} />

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">or continue with email</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="lawyer@firm.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm
                             placeholder-slate-400 outline-none transition-all duration-150
                             focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                    Password
                  </label>
                  <Link href="/register" className="text-xs font-semibold text-blue-700 hover:text-blue-800 transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm
                             placeholder-slate-400 outline-none transition-all duration-150
                             focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                />
              </div>

              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm text-white
                           transition-all duration-150 active:scale-[0.98]
                           disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: loading ? '#93C5FD' : 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
                  boxShadow: loading ? 'none' : '0 4px 16px rgba(30,64,175,0.35)',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                      style={{ animation: 'spin 0.8s linear infinite' }} />
                    Verifying credentials…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Sign In to Workspace
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-bold text-blue-700 hover:text-blue-800 transition-colors">
                Create account →
              </Link>
            </p>

            <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200">
              <svg className="w-3.5 h-3.5 text-green-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-xs font-semibold text-green-800">
                256-bit encrypted · Attorney-client privilege protected
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-5 mt-6">
            <Link href="/privacy" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Terms of Service</Link>
            <Link href="/security" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Security</Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100%{ opacity:1; } 50%{ opacity:.3; } }
      `}</style>
    </div>
  );
}
