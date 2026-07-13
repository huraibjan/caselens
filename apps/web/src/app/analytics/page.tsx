'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import Shell from '@/components/layout/Shell';

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{sub}</p>}
    </div>
  );
}

function HistogramBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-28 truncate font-medium" style={{ color: '#475569' }}>{label}</span>
      <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: '#F1F5F9' }}>
        <div className="h-full rounded-md flex items-center px-2 transition-all duration-700" style={{ width: `${Math.max(pct, 4)}%`, background: color }}>
          {pct > 15 && <span className="text-[10px] font-bold text-white">{count}</span>}
        </div>
      </div>
      {pct <= 15 && <span className="text-xs font-bold w-5" style={{ color }}>{count}</span>}
    </div>
  );
}

export default function Analytics() {
  const [matters, setMatters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/api/v1/matters')
      .then(d => setMatters(d.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const analyzed = matters.filter(m => m.metadata?.veracityScore != null);
  const avgScore = analyzed.length ? Math.round(analyzed.reduce((s, m) => s + m.metadata.veracityScore, 0) / analyzed.length) : 0;

  const scoreRanges = [
    { label: '90–100% (Strong)', min: 90, max: 100, color: '#059669' },
    { label: '70–89% (Solid)',   min: 70, max: 89,  color: '#10B981' },
    { label: '50–69% (Moderate)',min: 50, max: 69,  color: '#D97706' },
    { label: '30–49% (Weak)',    min: 30, max: 49,  color: '#F97316' },
    { label: '0–29% (Critical)', min: 0,  max: 29,  color: '#DC2626' },
  ];

  const rangeCounts = scoreRanges.map(r => ({
    ...r,
    count: analyzed.filter(m => m.metadata.veracityScore >= r.min && m.metadata.veracityScore <= r.max).length,
  }));
  const maxCount = Math.max(...rangeCounts.map(r => r.count), 1);

  const verdictCounts: Record<string, number> = {};
  analyzed.forEach(m => {
    const v = m.metadata?.judgment?.overall_verdict || 'PENDING';
    verdictCounts[v] = (verdictCounts[v] || 0) + 1;
  });

  const practiceAreaCounts: Record<string, { count: number; avgScore: number }> = {};
  matters.forEach(m => {
    const area = m.metadata?.practice_area || 'criminal';
    if (!practiceAreaCounts[area]) practiceAreaCounts[area] = { count: 0, avgScore: 0 };
    practiceAreaCounts[area].count++;
    if (m.metadata?.veracityScore) practiceAreaCounts[area].avgScore += m.metadata.veracityScore;
  });
  Object.keys(practiceAreaCounts).forEach(a => {
    if (practiceAreaCounts[a].count) practiceAreaCounts[a].avgScore = Math.round(practiceAreaCounts[a].avgScore / practiceAreaCounts[a].count);
  });

  const AREA_COLORS: Record<string, string> = { criminal: '#DC2626', realestate: '#059669', injury: '#D97706', corporate: '#1D4ED8', family: '#7E22CE', immigration: '#115E59' };
  const VERDICT_COLORS: Record<string, string> = { DISMISS: '#DC2626', GUILTY: '#BE123C', ACQUIT: '#059669', SETTLE: '#D97706', PENDING: '#94A3B8' };

  return (
    <Shell>
      <div className="space-y-6 animate-fadeIn">
        <div>
          <h2 className="text-2xl font-black" style={{ color: '#0F172A' }}>Analytics & Intelligence</h2>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>AI-driven statistical analysis across all your legal matters.</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Matters"    value={loading ? '—' : String(matters.length)}         sub="All statuses"              color="#1E40AF" />
          <StatCard label="AI Analyzed"      value={loading ? '—' : String(analyzed.length)}        sub={`${matters.length - analyzed.length} pending`} color="#6366F1" />
          <StatCard label="Avg Veracity"     value={loading ? '—' : analyzed.length ? `${avgScore}%` : 'N/A'} sub="Evidence credibility score" color={avgScore >= 70 ? '#059669' : '#D97706'} />
          <StatCard label="Total Documents"  value={loading ? '—' : String(matters.reduce((s, m) => s + (m.document_count || 0), 0))} sub="Uploaded &amp; indexed"  color="#0284C7" />
        </div>

        {loading ? (
          <div className="card p-10 text-center text-sm" style={{ color: '#94A3B8' }}>Loading analytics…</div>
        ) : analyzed.length === 0 ? (
          <div className="card p-14 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="font-semibold" style={{ color: '#475569' }}>No AI-analyzed matters yet.</p>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Upload documents to a matter and the AI pipeline will generate scores and judgments.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Veracity Score Distribution */}
            <div className="card p-6">
              <h3 className="font-bold mb-1" style={{ color: '#0F172A' }}>Veracity Score Distribution</h3>
              <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>How credible is the evidence across matters?</p>
              <div className="space-y-3">
                {rangeCounts.map(r => (
                  <HistogramBar key={r.label} label={r.label} count={r.count} max={maxCount} color={r.color} />
                ))}
              </div>
            </div>

            {/* Verdict Distribution */}
            <div className="card p-6">
              <h3 className="font-bold mb-1" style={{ color: '#0F172A' }}>AI Verdict Predictions</h3>
              <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>Predicted case outcomes based on document evidence.</p>
              {Object.keys(verdictCounts).length === 0 ? (
                <p className="text-sm" style={{ color: '#94A3B8' }}>No verdict predictions yet.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(verdictCounts).map(([verdict, count]) => (
                    <HistogramBar key={verdict} label={verdict} count={count} max={Math.max(...Object.values(verdictCounts))} color={VERDICT_COLORS[verdict] || '#94A3B8'} />
                  ))}
                </div>
              )}
            </div>

            {/* Practice Area Breakdown */}
            <div className="card p-6 lg:col-span-2">
              <h3 className="font-bold mb-1" style={{ color: '#0F172A' }}>Practice Area Breakdown</h3>
              <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>Matter count and average veracity score per practice area.</p>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Practice Area</th>
                      <th>Matters</th>
                      <th>Avg Veracity Score</th>
                      <th>Score Indicator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(practiceAreaCounts).map(([area, data]) => {
                      const color = AREA_COLORS[area] || '#1E40AF';
                      const areaLabel = area === 'realestate' ? 'Real Estate' : area.charAt(0).toUpperCase() + area.slice(1);
                      return (
                        <tr key={area}>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                              <span className="font-medium">{areaLabel}</span>
                            </div>
                          </td>
                          <td><span className="font-bold" style={{ color: '#0F172A' }}>{data.count}</span></td>
                          <td>
                            <span className="font-black" style={{ color: data.avgScore >= 70 ? '#059669' : data.avgScore >= 40 ? '#D97706' : '#DC2626' }}>
                              {data.avgScore > 0 ? `${data.avgScore}%` : 'N/A'}
                            </span>
                          </td>
                          <td>
                            <div className="score-bar w-32">
                              <div className="score-bar-fill" style={{ width: `${data.avgScore}%`, background: data.avgScore >= 70 ? '#059669' : data.avgScore >= 40 ? '#D97706' : '#DC2626' }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Matters by Score */}
            <div className="card p-6 lg:col-span-2">
              <h3 className="font-bold mb-1" style={{ color: '#0F172A' }}>Matters Ranked by Veracity Score</h3>
              <p className="text-xs mb-4" style={{ color: '#94A3B8' }}>Highest to lowest evidence credibility.</p>
              <div className="space-y-2.5">
                {[...analyzed].sort((a, b) => b.metadata.veracityScore - a.metadata.veracityScore).map((m, idx) => {
                  const s = m.metadata.veracityScore;
                  const color = s >= 70 ? '#059669' : s >= 40 ? '#D97706' : '#DC2626';
                  return (
                    <a key={m.id} href={`/matters/${m.id}`} className="flex items-center gap-4 p-3 rounded-xl transition-all" style={{ textDecoration: 'none', border: '1px solid #F1F5F9' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span className="text-sm font-black w-5 text-right" style={{ color: '#94A3B8' }}>{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{m.title}</div>
                        {m.metadata?.overallReasoning && <div className="text-xs truncate mt-0.5" style={{ color: '#94A3B8' }}>{m.metadata.overallReasoning}</div>}
                      </div>
                      <span className="text-lg font-black shrink-0" style={{ color }}>{s}%</span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
