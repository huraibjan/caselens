'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchApi } from '@/lib/api';
import Shell from '@/components/layout/Shell';

/* ── Hooks ───────────────────────────────────────────────────── */
function useInterval(callback: () => void, delay: number) {
  useEffect(() => {
    callback();
    const id = setInterval(callback, delay);
    return () => clearInterval(id);
  }, [delay]);
}

/* ── Micro Components ────────────────────────────────────────── */
function Trend({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value === 0) return null;
  const up = value > 0;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold ml-1" style={{ color: up ? '#059669' : '#DC2626' }}>
      {up ? '↑' : '↓'}{Math.abs(value)}{suffix}
    </span>
  );
}

function KPICard({
  label, value, sub, color, icon, trend, loading,
}: {
  label: string; value: string | number; sub?: string; color: string;
  icon: string; trend?: number; loading?: boolean;
}) {
  return (
    <div className="card p-5 flex flex-col gap-3 relative overflow-hidden group"
      style={{ transition: 'all 0.2s' }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
      {/* Gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}, ${color}40)` }} />
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>{label}</p>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
          style={{ background: color + '12', border: `1px solid ${color}20` }}>
          {icon}
        </div>
      </div>
      {loading ? (
        <div className="skeleton h-8 w-20 rounded-lg" />
      ) : (
        <div>
          <p className="text-3xl font-black leading-none" style={{ color: '#0F172A' }}>
            {value}
            {trend !== undefined && <Trend value={trend} />}
          </p>
          {sub && <p className="text-xs mt-1.5" style={{ color: '#94A3B8' }}>{sub}</p>}
        </div>
      )}
    </div>
  );
}

const AREA_COLORS: Record<string, string> = {
  criminal: '#DC2626', realestate: '#059669', injury: '#D97706',
  corporate: '#1D4ED8', family: '#7E22CE', immigration: '#115E59',
};
const AREA_LABELS: Record<string, string> = {
  criminal: 'Criminal', realestate: 'Real Estate', injury: 'Personal Injury',
  corporate: 'Corporate', family: 'Family', immigration: 'Immigration',
};
const VERDICT_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  DISMISS: { label: 'Dismiss',  bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  GUILTY:  { label: 'Guilty',   bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },
  ACQUIT:  { label: 'Acquit',   bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  SETTLE:  { label: 'Settle',   bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
};

function QuickActionCard({ icon, label, sub, href, color }: { icon: string; label: string; sub: string; href: string; color: string }) {
  return (
    <a href={href} style={{ textDecoration: 'none' }}>
      <div className="card p-4 flex items-center gap-3 cursor-pointer group"
        style={{ transition: 'all 0.18s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = color + '50'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${color}18`; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: color + '12' }}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold" style={{ color: '#0F172A' }}>{label}</div>
          <div className="text-xs" style={{ color: '#94A3B8' }}>{sub}</div>
        </div>
        <div className="ml-auto text-sm" style={{ color: color }}>→</div>
      </div>
    </a>
  );
}

function ActivityRow({ matter }: { matter: any }) {
  const area = matter.metadata?.practice_area || 'criminal';
  const score = matter.metadata?.veracityScore;
  const verdict = matter.metadata?.judgment?.overall_verdict;
  const vm = verdict ? VERDICT_MAP[verdict] : null;
  const updatedAt = matter.updated_at ? new Date(matter.updated_at) : new Date(matter.created_at);
  const minutesAgo = Math.round((Date.now() - updatedAt.getTime()) / 60000);
  const timeLabel = minutesAgo < 1 ? 'just now' : minutesAgo < 60 ? `${minutesAgo}m ago` : minutesAgo < 1440 ? `${Math.round(minutesAgo / 60)}h ago` : updatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <a href={`/matters/${matter.id}`} style={{ textDecoration: 'none', display: 'block' }}
      className="group"
      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
          style={{ background: `linear-gradient(135deg, ${AREA_COLORS[area] || '#1E40AF'}, ${AREA_COLORS[area] || '#3B82F6'}bb)` }}>
          {matter.title.charAt(0).toUpperCase()}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{matter.title}</span>
            {vm && (
              <span className="chip shrink-0 text-[10.5px]" style={{ background: vm.bg, color: vm.color, border: `1px solid ${vm.border}` }}>
                {vm.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium" style={{ color: '#94A3B8' }}>{matter.matter_number || 'No number'}</span>
            <span className="text-[10px]" style={{ color: '#CBD5E1' }}>·</span>
            <span className="text-[10px]" style={{ color: '#94A3B8' }}>{matter.document_count || 0} doc{matter.document_count !== 1 ? 's' : ''}</span>
            <span className="text-[10px]" style={{ color: '#CBD5E1' }}>·</span>
            <span className="text-[10px]" style={{ color: '#CBD5E1' }}>{AREA_LABELS[area] || area}</span>
          </div>
        </div>
        {/* Score */}
        {score != null && (
          <div className="text-right shrink-0">
            <div className="text-base font-black" style={{ color: score >= 70 ? '#059669' : score >= 40 ? '#D97706' : '#DC2626' }}>
              {score}%
            </div>
            <div className="text-[10px]" style={{ color: '#94A3B8' }}>veracity</div>
          </div>
        )}
        {/* Time */}
        <div className="text-[10px] font-medium shrink-0 w-12 text-right" style={{ color: '#94A3B8' }}>{timeLabel}</div>
      </div>
    </a>
  );
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="text-xs text-center py-6" style={{ color: '#94A3B8' }}>No data yet</div>;

  let cumAngle = -90; // start from top
  const r = 42, cx = 60, cy = 60;
  const arcs = data.map(d => {
    const angle = (d.value / total) * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    const toRad = (a: number) => (a * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(cumAngle));
    const y2 = cy + r * Math.sin(toRad(cumAngle));
    const large = angle > 180 ? 1 : 0;
    return { ...d, path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, angle };
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={120} height={120} viewBox="0 0 120 120">
        {arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} opacity={0.85} />)}
        <circle cx={cx} cy={cy} r={28} fill="white" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0F172A">{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="7" fill="#94A3B8">MATTERS</text>
      </svg>
      <div className="space-y-1.5 flex-1 min-w-0">
        {arcs.filter(a => a.value > 0).map(a => (
          <div key={a.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: a.color }} />
            <span className="text-xs truncate flex-1" style={{ color: '#475569' }}>{a.label}</span>
            <span className="text-xs font-bold" style={{ color: '#0F172A' }}>{a.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Dashboard ──────────────────────────────────────────── */
export default function Dashboard() {
  const [matters, setMatters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const [mattersData, userData] = await Promise.all([
        fetchApi('/api/v1/matters'),
        fetchApi('/api/v1/auth/me').catch(() => null),
      ]);
      setMatters(mattersData.items || []);
      if (userData) setUser(userData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Dashboard load error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + auto-refresh every 30s (for pending documents)
  useInterval(load, 30000);

  /* ── Derived stats ─────────────────────────────────────────── */
  const active   = matters.filter(m => m.status === 'active').length;
  const archived = matters.filter(m => m.status === 'archived').length;
  const closed   = matters.filter(m => m.status === 'closed').length;
  const totalDocs = matters.reduce((s, m) => s + (m.document_count || 0), 0);
  const processing = matters.filter(m => m.document_status === 'PROCESSING').length;

  const withScores = matters.filter(m => m.metadata?.veracityScore != null);
  const avgScore = withScores.length
    ? Math.round(withScores.reduce((s, m) => s + (m.metadata.veracityScore || 0), 0) / withScores.length)
    : null;

  const recentMatters = [...matters]
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 8);

  const practiceAreaData = Object.entries(
    matters.reduce((acc, m) => {
      const a = m.metadata?.practice_area || 'criminal';
      acc[a] = (acc[a] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([label, value]) => ({ label: AREA_LABELS[label] || label, value: value as number, color: AREA_COLORS[label] || '#94A3B8' }));

  const topScored = [...withScores].sort((a, b) => (b.metadata.veracityScore || 0) - (a.metadata.veracityScore || 0)).slice(0, 4);

  const firstName = user?.full_name?.split(' ')[0] || 'Counselor';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <Shell>
      <div className="space-y-6 animate-fadeIn">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black" style={{ color: '#0F172A' }}>
              {greeting}, {firstName} 👋
            </h2>
            <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
              {loading ? 'Loading your workspace…' : `${active} active matter${active !== 1 ? 's' : ''} · Last updated ${lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="btn-ghost text-xs py-2" title="Refresh">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </button>
            <a href="/matters" className="btn-primary" style={{ textDecoration: 'none', fontSize: 13 }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              New Matter
            </a>
          </div>
        </div>

        {/* ── KPI Row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard label="Active Matters" value={loading ? '—' : active}
            sub={`${closed} closed · ${archived} archived`} color="#1E40AF" icon="⚖️" loading={loading} />
          <KPICard label="Total Documents" value={loading ? '—' : totalDocs}
            sub={processing > 0 ? `${processing} processing…` : 'All indexed'} color="#6366F1" icon="📄" loading={loading} />
          <KPICard label="Avg AI Score" value={loading ? '—' : avgScore != null ? `${avgScore}%` : 'N/A'}
            sub={`${withScores.length} of ${matters.length} analyzed`} color={avgScore != null && avgScore >= 70 ? '#059669' : '#D97706'} icon="🧠" loading={loading} />
          <KPICard label="AI Analyzed" value={loading ? '—' : withScores.length}
            sub={matters.length > 0 ? `${Math.round((withScores.length / Math.max(matters.length, 1)) * 100)}% coverage` : 'No matters yet'} color="#D97706" icon="⚡" loading={loading} />
        </div>

        {/* ── Main Grid ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Left: Recent Matters Feed */}
          <div className="xl:col-span-2 card overflow-hidden flex flex-col" style={{ minHeight: 400 }}>
            <div className="px-4 py-3.5 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm" style={{ color: '#0F172A' }}>Recent Matters</span>
                {!loading && matters.length > 0 && (
                  <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#EFF6FF', color: '#1E40AF' }}>
                    {matters.length}
                  </span>
                )}
              </div>
              <a href="/matters" className="text-xs font-bold" style={{ color: '#1E40AF', textDecoration: 'none' }}>View all →</a>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3,4].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
                </div>
              ) : recentMatters.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-12 text-center px-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ background: '#F1F5F9' }}>⚖️</div>
                  <p className="font-semibold text-sm" style={{ color: '#475569' }}>No matters yet</p>
                  <p className="text-xs mt-1 mb-4" style={{ color: '#94A3B8' }}>Create your first matter and upload case documents to begin AI analysis.</p>
                  <a href="/matters" className="btn-primary text-xs" style={{ textDecoration: 'none' }}>+ Create First Matter</a>
                </div>
              ) : (
                recentMatters.map(m => <ActivityRow key={m.id} matter={m} />)
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-5">

            {/* Practice Area Donut */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>Practice Areas</h3>
                <a href="/analytics" className="text-xs font-bold" style={{ color: '#1E40AF', textDecoration: 'none' }}>Analytics →</a>
              </div>
              {loading ? (
                <div className="skeleton h-20 rounded-xl" />
              ) : (
                <DonutChart data={practiceAreaData} />
              )}
            </div>

            {/* Top Veracity Scores */}
            {(loading || topScored.length > 0) && (
              <div className="card p-5">
                <h3 className="font-bold text-sm mb-4" style={{ color: '#0F172A' }}>Top AI Scores</h3>
                {loading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-8 rounded-lg" />)}</div>
                ) : topScored.length === 0 ? (
                  <p className="text-xs" style={{ color: '#94A3B8' }}>No analyzed matters yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {topScored.map(m => {
                      const s = m.metadata.veracityScore;
                      const color = s >= 70 ? '#059669' : s >= 40 ? '#D97706' : '#DC2626';
                      return (
                        <a key={m.id} href={`/matters/${m.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                          <div className="flex items-center gap-3 group">
                            <span className="text-xs font-medium flex-1 truncate" style={{ color: '#475569' }}>{m.title}</span>
                            <span className="text-xs font-black shrink-0" style={{ color }}>{s}%</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full" style={{ background: '#E2E8F0' }}>
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s}%`, background: color }} />
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div>
              <h3 className="font-bold text-xs uppercase tracking-widest mb-3 px-1" style={{ color: '#94A3B8' }}>Quick Actions</h3>
              <div className="space-y-2">
                <QuickActionCard icon="📁" label="Open a Matter" sub="Browse and manage cases" href="/matters" color="#1E40AF" />
                <QuickActionCard icon="📝" label="Generate Letter" sub="AI-powered legal letters" href="/templates" color="#6366F1" />
                <QuickActionCard icon="👤" label="Add Contact" sub="Clients, counsel, witnesses" href="/contacts" color="#059669" />
                <QuickActionCard icon="📅" label="View Calendar" sub="Hearings & deadlines" href="/calendar" color="#D97706" />
                <QuickActionCard icon="📊" label="Analytics" sub="Score distribution & trends" href="/analytics" color="#0284C7" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
