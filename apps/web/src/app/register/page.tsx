'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await fetchApi('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      router.push('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm
    placeholder-slate-400 outline-none transition-all duration-150
    focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10`;

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Left decorative panel ─────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-center items-center w-[48%] relative overflow-hidden p-12 text-center"
        style={{ background: 'linear-gradient(145deg, #0F172A 0%, #1E1B4B 45%, #0F172A 100%)' }}
      >
        {/* Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #3B82F6, transparent 70%)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #8B5CF6, transparent 70%)' }} />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }} />

        <div className="relative z-10 max-w-sm">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl text-white mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', boxShadow: '0 8px 24px rgba(99,102,241,0.5)' }}>
            CL
          </div>
          <h2 className="text-3xl font-black text-white mb-4" style={{ letterSpacing: '-0.02em' }}>
            Join CaseLens
          </h2>
          <p className="text-slate-400 leading-relaxed mb-8">
            Set up your secure legal workspace in minutes. Start analyzing cases with AI-powered precision.
          </p>
          <div className="space-y-3 text-left">
            {[
              '✓  AI judgment engine with per-charge probability',
              '✓  RAG document analysis with page citations',
              '✓  Auto-generate legal letters & filings',
              '✓  Secure multi-matter workspace',
            ].map(f => (
              <div key={f} className="text-sm text-slate-400">{f}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: form ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 px-6 py-12">

        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-8 lg:hidden">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>CL</div>
          <span className="font-black text-xl text-slate-900">CaseLens</span>
        </div>

        <div className="w-full max-w-[420px]">
          <div className="bg-white rounded-2xl p-8 space-y-6"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0' }}>

            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Create your account</h2>
              <p className="text-sm text-slate-500 mt-1">Set up your secure legal workspace</p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl text-sm font-medium bg-red-50 text-red-800 border border-red-200">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Full Name</label>
                <input id="reg-name" type="text" required autoComplete="name"
                  value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Sarah Jenkins, Esq."
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Email Address</label>
                <input id="reg-email" type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="lawyer@firm.com"
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Password</label>
                <input id="reg-password" type="password" required autoComplete="new-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className={inputClass} />
                <p className="text-xs text-slate-400 mt-1.5">Minimum 8 characters recommended</p>
              </div>

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm text-white
                           transition-all duration-150 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: loading ? '#93C5FD' : 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
                  boxShadow: loading ? 'none' : '0 4px 16px rgba(30,64,175,0.35)',
                  fontFamily: "'Inter', sans-serif",
                }}>
                {loading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                      style={{ animation: 'spin 0.8s linear infinite' }} />
                    Creating account…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Create Account
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <p className="text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-blue-700 hover:text-blue-800 transition-colors">
                Sign in →
              </Link>
            </p>

            <p className="text-center text-xs text-slate-400">
              By creating an account you agree to our{' '}
              <a href="#" className="underline hover:text-slate-600">Terms of Service</a> and{' '}
              <a href="#" className="underline hover:text-slate-600">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
