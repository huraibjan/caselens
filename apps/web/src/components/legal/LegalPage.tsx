import Link from 'next/link';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  effectiveDate: string;
  children: ReactNode;
}

/** Shared shell for public legal/policy pages (privacy, terms, security). */
export default function LegalPage({ title, subtitle, effectiveDate, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs text-white"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
              CL
            </div>
            <span className="font-black text-lg text-slate-900 tracking-tight">CaseLens</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/privacy" className="text-slate-500 hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="text-slate-500 hover:text-slate-900 transition-colors">Terms</Link>
            <Link href="/security" className="text-slate-500 hover:text-slate-900 transition-colors">Security</Link>
            <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800 transition-colors">Sign in →</Link>
          </nav>
        </div>
      </header>

      {/* Title band */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-slate-500 mt-2 text-base">{subtitle}</p>}
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mt-4">
            Effective {effectiveDate}
          </p>
        </div>
      </div>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <article className="legal-prose space-y-8 text-[15px] leading-relaxed text-slate-700">
          {children}
        </article>

        <div className="mt-16 pt-8 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} CaseLens. All rights reserved.</p>
          <Link href="/login" className="text-sm font-semibold text-blue-700 hover:text-blue-800">← Back to sign in</Link>
        </div>
      </main>

      <style>{`
        .legal-prose h2 { font-size: 1.2rem; font-weight: 800; color: #0F172A; letter-spacing: -0.01em; margin-top: 0.5rem; }
        .legal-prose h3 { font-size: 1rem; font-weight: 700; color: #1E293B; margin-top: 1rem; }
        .legal-prose p { margin-top: 0.5rem; }
        .legal-prose ul { list-style: disc; padding-left: 1.4rem; margin-top: 0.5rem; }
        .legal-prose li { margin-top: 0.35rem; }
        .legal-prose a { color: #1D4ED8; font-weight: 600; }
        .legal-prose strong { color: #0F172A; font-weight: 700; }
        .legal-prose section { scroll-margin-top: 5rem; }
      `}</style>
    </div>
  );
}
