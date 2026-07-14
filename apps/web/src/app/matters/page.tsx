'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import Shell from '@/components/layout/Shell';

/* ── Drop-a-file quick start (no matter form) ────────────────── */
function QuickStart() {
  const router = useRouter();
  const [stage, setStage] = useState<'idle' | 'uploading' | 'analyzing' | 'confirm' | 'error'>('idle');
  const [name, setName] = useState('');
  const [matterId, setMatterId] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const start = async (file: File) => {
    setErr('');
    setStage('uploading');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetchApi('/api/v1/matters/quick-upload', { method: 'POST', body: fd });
      setMatterId(res.matter_id);
      setName(res.matter_title);
      setStage('analyzing');
      poll(res.matter_id, res.document_id);
    } catch (e: any) {
      setErr(e.message || 'Upload failed.');
      setStage('error');
    }
  };

  const poll = (mid: string, docId: string) => {
    let ticks = 0;
    const t = setInterval(async () => {
      ticks += 1;
      if (ticks > 60) { clearInterval(t); return; }
      try {
        const d = await fetchApi(`/api/v1/documents/${docId}`);
        const st = (d.status || '').toLowerCase();
        if (st === 'ready') {
          clearInterval(t);
          const m = await fetchApi(`/api/v1/matters/${mid}`).catch(() => null);
          if (m?.title) setName(m.title);
          setStage('confirm');
        } else if (st === 'error') {
          clearInterval(t);
          setErr('The document could not be analysed. You can still open it and retry.');
          setStage('confirm');
        }
      } catch { /* keep polling */ }
    }, 3000);
  };

  const open = async () => {
    const t = name.trim();
    if (t) { try { await fetchApi(`/api/v1/matters/${matterId}`, { method: 'PATCH', body: JSON.stringify({ title: t }) }); } catch { /* ignore */ } }
    router.push(`/matters/${matterId}/workspace`);
  };

  if (stage === 'analyzing' || stage === 'uploading') {
    return (
      <div className="card p-6 flex items-center gap-4">
        <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-slate-700 animate-spin shrink-0" />
        <div>
          <div className="text-sm font-semibold text-slate-800">{stage === 'uploading' ? 'Uploading…' : 'Reading & analysing the case…'}</div>
          <div className="text-xs text-slate-500 mt-0.5">Detecting parties, area of law, issues and timeline. This takes a few seconds.</div>
        </div>
      </div>
    );
  }

  if (stage === 'confirm') {
    return (
      <div className="card p-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Confirm case name</div>
        {err && <div className="text-xs text-amber-700 mb-2">{err}</div>}
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') open(); }}
            className="input-base flex-1" placeholder="Case name" autoFocus />
          <button onClick={open} className="btn-primary shrink-0">Open case →</button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Detected from the document — edit if needed.</p>
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) start(f); }}
      onClick={() => inputRef.current?.click()}
      className={`rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors ${
        dragOver ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
      }`}
    >
      <svg className="w-7 h-7 mx-auto text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
      <div className="text-sm font-semibold text-slate-800">Drop a case file to start</div>
      <div className="text-xs text-slate-500 mt-1">PDF, Word or text — the matter is created and analysed automatically. No forms.</div>
      {err && <div className="text-xs text-red-600 mt-2">{err}</div>}
      <input ref={inputRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) start(f); }} />
    </div>
  );
}

const PRACTICE_AREAS = [
  { value: 'criminal',    label: 'Criminal Law',      badge: 'badge-criminal' },
  { value: 'realestate',  label: 'Real Estate',       badge: 'badge-realestate' },
  { value: 'injury',      label: 'Personal Injury',   badge: 'badge-injury' },
  { value: 'corporate',   label: 'Corporate',         badge: 'badge-corporate' },
  { value: 'family',      label: 'Family Law',        badge: 'badge-family' },
  { value: 'immigration', label: 'Immigration',       badge: 'badge-immigration' },
];

const VERDICT_STYLES: Record<string, { label: string; cls: string }> = {
  DISMISS: { label: 'Likely Dismiss',  cls: 'verdict-dismiss' },
  GUILTY:  { label: 'Likely Guilty',   cls: 'verdict-guilty' },
  ACQUIT:  { label: 'Likely Acquit',   cls: 'verdict-acquit' },
  SETTLE:  { label: 'Likely Settle',   cls: 'verdict-settle' },
};

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? '#059669' : score >= 40 ? '#D97706' : '#DC2626';
  const r = 22, cx = 28, cy = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E2E8F0" strokeWidth="5" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill={color}>{score}</text>
    </svg>
  );
}

export default function Matters() {
  const [matters, setMatters] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [matterNumber, setMatterNumber] = useState('');
  const [practiceArea, setPracticeArea] = useState('criminal');
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterArea, setFilterArea] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const loadMatters = async () => {
    try {
      const data = await fetchApi('/api/v1/matters');
      setMatters(data.items || []);
    } catch (err) {
      console.error('Failed to load matters', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMatters(); }, []);

  const handleCreateMatter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');
    try {
      await fetchApi('/api/v1/matters', {
        method: 'POST',
        body: JSON.stringify({ title, description, matter_number: matterNumber, practice_area: practiceArea }),
      });
      setTitle(''); setDescription(''); setMatterNumber('');
      setShowCreate(false);
      await loadMatters();
    } catch (err: any) {
      setError(err.message || 'Failed to create matter');
    } finally {
      setSubmitLoading(false);
    }
  };

  const filtered = matters.filter((m) => {
    const area = m.metadata?.practice_area || 'criminal';
    if (filterArea !== 'all' && area !== filterArea) return false;
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const areaInfo = (val: string) => PRACTICE_AREAS.find(a => a.value === val) || PRACTICE_AREAS[0];

  return (
    <Shell>
      <div className="space-y-5 animate-fadeIn">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black" style={{ color: '#0F172A' }}>Legal Matters</h2>
            <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>{matters.length} total · {matters.filter(m=>m.status==='active').length} active</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-ghost self-start sm:self-auto text-xs">
            {showCreate ? 'Cancel' : 'Create matter manually'}
          </button>
        </div>

        {/* Drop a file — primary path */}
        <QuickStart />

        {/* Create Form */}
        {showCreate && (
          <div className="card p-6 animate-fadeIn">
            <h3 className="font-bold mb-4" style={{ color: '#0F172A' }}>Create New Matter</h3>
            {error && <div className="mb-4 p-3 rounded-lg text-sm font-medium" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>{error}</div>}
            <form onSubmit={handleCreateMatter}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Matter Title *</label>
                  <input className="input-base" required value={title} onChange={e => setTitle(e.target.value)} placeholder="People v. Johnson / Smith Lease Dispute" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Matter Number</label>
                  <input className="input-base" value={matterNumber} onChange={e => setMatterNumber(e.target.value)} placeholder="MTR-2026-001" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Practice Area</label>
                  <select className="input-base" value={practiceArea} onChange={e => setPracticeArea(e.target.value)}>
                    {PRACTICE_AREAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Description</label>
                  <input className="input-base" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief case overview…" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={submitLoading} className="btn-primary">
                  {submitLoading ? 'Creating…' : 'Create Matter'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="card p-3 flex flex-wrap gap-3 items-center">
          <input
            className="input-base flex-1 min-w-48"
            style={{ maxWidth: 280 }}
            placeholder="🔍  Search matters…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="input-base" style={{ width: 'auto', paddingRight: 36 }} value={filterArea} onChange={e => setFilterArea(e.target.value)}>
            <option value="all">All Practice Areas</option>
            {PRACTICE_AREAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <select className="input-base" style={{ width: 'auto', paddingRight: 36 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="closed">Closed</option>
          </select>
          {(filterArea !== 'all' || filterStatus !== 'all' || search) && (
            <button className="btn-ghost text-xs" onClick={() => { setFilterArea('all'); setFilterStatus('all'); setSearch(''); }}>Clear filters</button>
          )}
        </div>

        {/* Matter List */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="card p-5"><div className="skeleton h-16" /></div>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-14 text-center">
            <div className="text-4xl mb-3">⚖️</div>
            <p className="font-semibold" style={{ color: '#475569' }}>{search || filterArea !== 'all' ? 'No matters match your filters.' : 'No matters yet.'}</p>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Create a matter and upload case documents to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((matter) => {
              const area = matter.metadata?.practice_area || 'criminal';
              const ai = areaInfo(area);
              const score = matter.metadata?.veracityScore;
              const verdict = matter.metadata?.judgment?.overall_verdict;
              const vStyle = verdict ? VERDICT_STYLES[verdict] : null;
              const suspect = matter.metadata?.suspect;
              const startDate = matter.metadata?.start_date;
              const reasoning = matter.metadata?.overallReasoning;
              const allegations = matter.metadata?.allegations || [];

              return (
                <a key={matter.id} href={`/matters/${matter.id}`}
                  className="card card-hover block p-5"
                  style={{ textDecoration: 'none' }}
                >
                  <div className="flex items-start gap-4">
                    {/* Score Gauge */}
                    <div className="shrink-0">
                      {score != null ? <ScoreGauge score={score} /> : (
                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl" style={{ background: '#F1F5F9' }}>⚖️</div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-base font-bold" style={{ color: '#0F172A' }}>{matter.title}</h3>
                        <span className={`chip ${ai.badge}`}>{ai.label}</span>
                        <span className="chip" style={{ background: matter.status === 'active' ? '#F0FDF4' : '#F8FAFC', color: matter.status === 'active' ? '#166534' : '#475569', border: '1px solid ' + (matter.status === 'active' ? '#BBF7D0' : '#E2E8F0') }}>
                          {matter.status}
                        </span>
                        {vStyle && <span className={`chip ${vStyle.cls}`}>{vStyle.label}</span>}
                      </div>

                      {matter.description && (
                        <p className="text-sm mb-2 line-clamp-1" style={{ color: '#64748B' }}>{matter.description}</p>
                      )}

                      {/* Key Intelligence Row */}
                      {(suspect || startDate || reasoning) && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2 p-3 rounded-lg" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                          {suspect && (
                            <div>
                              <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Defendant</span>
                              <span className="text-xs font-semibold" style={{ color: '#1E293B' }}>{suspect}</span>
                            </div>
                          )}
                          {startDate && (
                            <div>
                              <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Incident Date</span>
                              <span className="text-xs font-semibold" style={{ color: '#1E293B' }}>{startDate}</span>
                            </div>
                          )}
                          {score != null && (
                            <div>
                              <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Veracity</span>
                              <span className="text-xs font-black" style={{ color: score >= 70 ? '#059669' : score >= 40 ? '#D97706' : '#DC2626' }}>{score}%</span>
                            </div>
                          )}
                          {reasoning && (
                            <div className="col-span-2 sm:col-span-1">
                              <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>AI Reasoning</span>
                              <span className="text-xs line-clamp-1" style={{ color: '#475569' }}>{reasoning}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Allegations chips */}
                      {allegations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {allegations.slice(0, 3).map((a: any, i: number) => (
                            <span key={i} className="chip" style={{ background: a.status === 'verified' ? '#F0FDF4' : '#FFFBEB', color: a.status === 'verified' ? '#166534' : '#92400E', border: `1px solid ${a.status === 'verified' ? '#BBF7D0' : '#FDE68A'}`, fontSize: '10.5px' }}>
                              {a.status === 'verified' ? '✓' : '?'} {a.claim}
                            </span>
                          ))}
                          {allegations.length > 3 && <span className="chip" style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0', fontSize: '10.5px' }}>+{allegations.length - 3} more</span>}
                        </div>
                      )}
                    </div>

                    {/* Right Meta */}
                    <div className="shrink-0 text-right space-y-1">
                      <div className="text-xs font-medium" style={{ color: '#94A3B8' }}>#{matter.matter_number || 'N/A'}</div>
                      <div className="text-xs" style={{ color: '#94A3B8' }}>{matter.document_count || 0} doc{matter.document_count !== 1 ? 's' : ''}</div>
                      <div className="text-xs font-medium" style={{ color: '#1E40AF' }}>Open →</div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
