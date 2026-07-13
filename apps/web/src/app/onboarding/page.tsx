'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

export default function Onboarding() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Auto-slugify firm name
  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
    );
  };

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const org = await fetchApi('/api/v1/organizations', {
        method: 'POST',
        body: JSON.stringify({ name, slug }),
      });

      localStorage.setItem('organization_id', org.id);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl -z-10" />

      <div className="w-full max-w-md p-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20 mb-2">
            CI
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Set up your Law Firm</h2>
          <p className="text-sm text-slate-400">Establish a private secure workspace for your cases</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleOnboarding} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Firm Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Jenkins & Associates"
              className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 outline-none text-sm text-white placeholder-slate-600 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Workspace Slug (URL)</label>
            <div className="flex items-center bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 focus-within:border-indigo-500/60 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
              <span className="text-slate-600 text-sm select-none">caselens.com/</span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="jenkins-law"
                className="w-full bg-transparent border-none outline-none text-sm text-white placeholder-slate-600 p-0 ml-0.5 focus:ring-0"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]"
          >
            {loading ? 'Creating Firm...' : 'Create Firm & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
