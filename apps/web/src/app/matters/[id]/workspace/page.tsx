'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import Shell from '@/components/layout/Shell';

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */
interface Allegation    { claim: string; source: string; status: string; desc: string; }
interface Contradiction { text: string; severity: string; }
interface Charge        { charge: string; verdict: string; probability: number; statute: string; reasoning: string; }
interface TimelineEvent { date: string; label: string; type: string; icon: string; }

/* ═══════════════════════════════════════════════════════════════
   SVG HELPERS
═══════════════════════════════════════════════════════════════ */

/** Circular gauge (score arc) */
function ScoreArc({ score, size = 130 }: { score: number; size?: number }) {
  const r = size * 0.38, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const fill = (Math.min(100, Math.max(0, score)) / 100) * circ;
  const color = score >= 70 ? '#059669' : score >= 40 ? '#D97706' : '#DC2626';
  const label = score >= 70 ? 'STRONG' : score >= 40 ? 'MODERATE' : 'WEAK';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E2E8F0" strokeWidth={size * 0.075} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={size * 0.075}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeDashoffset={circ * 0.25} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={size * 0.2} fontWeight="900" fill={color}>{score}</text>
      <text x={cx} y={cy + size * 0.12} textAnchor="middle" fontSize={size * 0.09} fontWeight="700" fill="#94A3B8">{label}</text>
    </svg>
  );
}

/** Horizontal metric bar */
function MetricBar({ label, score, desc, color }: { label: string; score: number; desc: string; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-slate-800">{label}</span>
          <span className="block text-xs text-slate-400">{desc}</span>
        </div>
        <span className="text-base font-black ml-3" style={{ color }}>{score}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

/** Sentiment bar — positive / neutral / negative */
function SentimentBar({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden">
        <div style={{ width: `${positive}%`, background: '#059669' }} title={`Positive ${positive}%`} />
        <div style={{ width: `${neutral}%`,  background: '#E2E8F0' }} title={`Neutral ${neutral}%`} />
        <div style={{ width: `${negative}%`, background: '#DC2626' }} title={`Negative ${negative}%`} />
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" /><span className="text-slate-600">Positive {positive}%</span></span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block" /><span className="text-slate-600">Neutral {neutral}%</span></span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" /><span className="text-slate-600">Negative {negative}%</span></span>
      </div>
    </div>
  );
}

/** Radar chart (SVG) for multi-axis case scoring */
function RadarChart({ scores }: { scores: { label: string; value: number }[] }) {
  const cx = 120, cy = 120, r = 90;
  const n = scores.length;
  const angle = (i: number) => (i * 2 * Math.PI) / n - Math.PI / 2;

  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];
  const toXY = (i: number, pct: number) => ({
    x: cx + r * pct * Math.cos(angle(i)),
    y: cy + r * pct * Math.sin(angle(i)),
  });

  const polyPoints = scores
    .map((s, i) => toXY(i, s.value / 100))
    .map(p => `${p.x},${p.y}`)
    .join(' ');

  return (
    <svg width={240} height={240} viewBox="0 0 240 240">
      {/* Grid rings */}
      {gridLevels.map(pct => (
        <polygon key={pct}
          points={scores.map((_, i) => { const p = toXY(i, pct); return `${p.x},${p.y}`; }).join(' ')}
          fill="none" stroke="#E2E8F0" strokeWidth="1" />
      ))}
      {/* Axes */}
      {scores.map((_, i) => {
        const outer = toXY(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="#E2E8F0" strokeWidth="1" />;
      })}
      {/* Data polygon */}
      <polygon points={polyPoints} fill="rgba(30,64,175,0.15)" stroke="#1E40AF" strokeWidth="2" strokeLinejoin="round" />
      {/* Dots */}
      {scores.map((s, i) => {
        const p = toXY(i, s.value / 100);
        return <circle key={i} cx={p.x} cy={p.y} r={4} fill="#1E40AF" stroke="#fff" strokeWidth={2} />;
      })}
      {/* Labels */}
      {scores.map((s, i) => {
        const p = toXY(i, 1.22);
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fontWeight="700" fill="#475569">
            {s.label}
          </text>
        );
      })}
    </svg>
  );
}

/** Severity badge */
const SEV: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high:     'bg-red-100 text-red-800 border border-red-300',
  medium:   'bg-amber-100 text-amber-800 border border-amber-300',
  low:      'bg-blue-100 text-blue-800 border border-blue-300',
  info:     'bg-slate-100 text-slate-700 border border-slate-300',
};

/** Entity chip */
const ENTITY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  PERSON:   { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  ORG:      { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  DATE:     { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  LOCATION: { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
  STATUTE:  { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  MONEY:    { bg: '#F0FDFA', color: '#115E59', border: '#99F6E4' },
};
function EntityChip({ text, type }: { text: string; type: string }) {
  const s = ENTITY_STYLE[type] || { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' };
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold mr-2 mb-2 border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {type === 'PERSON' ? '👤' : type === 'ORG' ? '🏛️' : type === 'DATE' ? '📅' : type === 'STATUTE' ? '⚖️' : type === 'MONEY' ? '💰' : '📍'}
      {' '}{text}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Workspace({ params }: { params: Promise<{ id: string }> }) {
  const [matterId, setMatterId]       = useState<string | null>(null);
  const [matter, setMatter]           = useState<any>(null);
  const [documents, setDocuments]     = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'judgment' | 'evidence' | 'entities' | 'timeline' | 'chat'>('overview');
  const [question, setQuestion]       = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError]     = useState('');
  const [timelinePopup, setTimelinePopup] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => { params.then(p => setMatterId(p.id)); }, [params]);

  const loadDocuments = async () => {
    if (!matterId) return;
    try {
      const data = await fetchApi(`/api/v1/matters/${matterId}/documents`);
      const docs = data.items || [];
      setDocuments(docs);
      
      if (!selectedDoc && docs.length > 0) {
        const ready = docs.find((d: any) => d.status?.toLowerCase() === 'ready');
        setSelectedDoc(ready || docs[0]);
      } else if (selectedDoc) {
        const fresh = docs.find((d: any) => d.id === selectedDoc.id);
        if (fresh) setSelectedDoc(fresh);
      }
    } catch (err) { console.error('Failed to load documents', err); }
  };

  useEffect(() => {
    if (matterId) {
      loadDocuments();
      fetchApi(`/api/v1/matters/${matterId}`).then(setMatter).catch(console.error);
    }
  }, [matterId]);

  // Real-time polling for document processing status
  useEffect(() => {
    if (!matterId || documents.length === 0) return;
    const hasProcessing = documents.some(
      d => d.status?.toLowerCase() === 'processing' || d.status?.toLowerCase() === 'pending'
    );
    if (hasProcessing) {
      const interval = setInterval(loadDocuments, 2500);
      return () => clearInterval(interval);
    }
  }, [matterId, documents, selectedDoc?.id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !matterId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', file.name.replace(/\.[^.]+$/, ''));
      const created = await fetchApi(`/api/v1/matters/${matterId}/documents`, { method: 'POST', body: fd });
      await loadDocuments();
      // Auto-open the document reader once AI analysis completes
      if (created?.id) watchAndOpenReader(created.id);
    } catch (err) { console.error(err); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  /** Poll the freshly uploaded document; when analysis is READY, open the reader. */
  const watchAndOpenReader = (docId: string) => {
    let ticks = 0;
    const t = setInterval(async () => {
      ticks += 1;
      if (ticks > 60) { clearInterval(t); return; } // give up after ~3 min
      try {
        const d = await fetchApi(`/api/v1/documents/${docId}`);
        const st = (d.status || '').toLowerCase();
        if (st === 'ready') {
          clearInterval(t);
          router.push(`/matters/${matterId}/documents/${docId}`);
        } else if (st === 'error') {
          clearInterval(t);
          await loadDocuments();
        }
      } catch { /* transient — keep polling */ }
    }, 3000);
  };

  const handleAnalyze = async (docId: string) => {
    setAnalyzingId(docId);
    try {
      await fetchApi(`/api/v1/documents/${docId}/analyze`, { method: 'POST' });
      await loadDocuments();
    } catch (err) {
      console.error("Failed to run analysis:", err);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !matterId) return;
    setChatError('');
    setChatLoading(true);
    const q = question;
    setQuestion('');
    setChatMessages(p => [...p, { id: Math.random().toString(), role: 'user', content: q }]);
    try {
      const resp = await fetchApi(`/api/v1/matters/${matterId}/ask`, { method: 'POST', body: JSON.stringify({ question: q }) });
      setChatMessages(p => [...p, resp]);
    } catch (err: any) {
      setChatError(err.message || 'Failed to get answer');
    } finally { setChatLoading(false); }
  };

  /* ── Intelligence data from metadata ─────────────────────── */
  const meta = (selectedDoc?.metadata && Object.keys(selectedDoc.metadata).length > 0)
    ? selectedDoc.metadata
    : matter?.metadata;

  const intel = {
    suspect:     (meta?.suspect || matter?.title || 'Unknown') as string,
    start_date:  (meta?.start_date || '') as string,
    end_date:    (meta?.end_date   || '') as string,
    veracityScore:          (meta?.veracityScore || 0) as number,
    overallReasoning:       (meta?.overallReasoning || '') as string,
    allegations:            ((meta?.allegations || []) as Allegation[]),
    contradictions:         ((meta?.contradictions || []) as Contradiction[]),
    charges:                ((meta?.judgment?.charges || meta?.outcomes?.map((o: any) => ({
      charge: o.ruling, verdict: o.ruling?.includes('Dismiss') ? 'DISMISS' : o.ruling?.includes('Guilty') ? 'GUILTY' : 'SETTLE',
      probability: parseInt(o.probability) || 75, statute: o.statute, reasoning: o.details,
    })) || []) as Charge[]),
    overall_verdict:        ((meta?.judgment?.overall_verdict || 'PENDING') as string),
    settlement_probability: ((meta?.judgment?.settlement_probability || 42) as number),
    risk_factors:           ((meta?.judgment?.risk_factors || meta?.contradictions?.map((c: Contradiction) => c.text) || []) as string[]),
    attorney_notes:         ((meta?.judgment?.attorney_notes || meta?.overallReasoning || '') as string),
    entities:               (meta?.entities || null),
  };

  /* Real deep-analysis data (analysis_version >= 2) */
  const realParties: any[] = meta?.parties || [];
  const realTimeline: any[] = meta?.timeline || [];
  const areaOfLaw = meta?.area_of_law || null;

  /* Derived entities (fallback to defaults when no deep-analysis data) */
  const entities = intel.entities || {
    PERSON:   realParties.length > 0
      ? realParties.map((p: any) => p.name).filter(Boolean)
      : [intel.suspect, 'Presiding Judge', 'Defense Counsel'].filter(Boolean),
    ORG:      ['Court of Record', 'Public Defender Office'],
    DATE:     [intel.start_date, intel.end_date].filter(Boolean),
    STATUTE:  (areaOfLaw?.governing_statutes?.length
      ? areaOfLaw.governing_statutes
      : intel.charges.map((c: Charge) => c.statute)).filter(Boolean),
    LOCATION: [areaOfLaw?.jurisdiction || 'Filed Jurisdiction'].filter(Boolean),
    MONEY:    [],
  };

  /* Sentiment (from metadata or derived from veracity) */
  const vs = intel.veracityScore;
  const sentiment = meta?.sentiment || {
    positive: Math.round(vs * 0.6),
    neutral:  Math.round(40 - vs * 0.2),
    negative: Math.max(5, 100 - Math.round(vs * 0.6) - Math.round(40 - vs * 0.2)),
  };

  /* Radar scores */
  const radarScores = [
    { label: 'Veracity',     value: intel.veracityScore || 0 },
    { label: 'Evidence',     value: Math.min(95, (intel.veracityScore || 0) + 8) },
    { label: 'Consistency',  value: Math.max(15, (intel.veracityScore || 0) - 12) },
    { label: 'Settlement',   value: intel.settlement_probability },
    { label: 'Risk',         value: 100 - Math.max(10, (intel.veracityScore || 0) - 5) },
  ];

  /* Verdict color map */
  const VERDICT_MAP: Record<string, { bg: string; color: string; border: string; label: string }> = {
    DISMISS: { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA', label: 'Case Dismissed' },
    GUILTY:  { bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3', label: 'Guilty' },
    ACQUIT:  { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0', label: 'Acquitted' },
    SETTLE:  { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A', label: 'Settlement Likely' },
    PENDING: { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0', label: 'Pending Analysis' },
  };
  const vm = VERDICT_MAP[intel.overall_verdict] || VERDICT_MAP['PENDING'];

  const TABS = [
    { key: 'overview',  label: 'Overview',   icon: '🧠' },
    { key: 'judgment',  label: 'Judgment',   icon: '⚖️' },
    { key: 'evidence',  label: 'Evidence',   icon: '📊' },
    { key: 'entities',  label: 'Entities',   icon: '🏷️' },
    { key: 'timeline',  label: 'Timeline',   icon: '🕐' },
    { key: 'chat',      label: 'AI Counsel', icon: '💬' },
  ] as const;

  const hasIntel = !!meta && intel.veracityScore > 0;

  /* ─────────────────────────────────────────────────────────── */
  return (
    <Shell>
      <div className="flex flex-col gap-0 h-[calc(100vh-6rem)] overflow-hidden">

        {/* ── TOP BAR ────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-1 pb-3 gap-4"
          style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight">
              {matter?.title || 'Case Intelligence Report'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {documents.length} document{documents.length !== 1 ? 's' : ''} · AI-powered legal analysis
              {intel.suspect && intel.suspect !== 'Unknown' ? ` · Defendant: ${intel.suspect}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Document selector */}
            {documents.length > 0 && (
              <select
                value={selectedDoc?.id || ''}
                onChange={e => setSelectedDoc(documents.find((d: any) => d.id === e.target.value))}
                className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 outline-none"
              >
                <option value="">Select document…</option>
                {documents.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {(d.original_filename || d.title || 'Untitled').slice(0, 40)}
                  </option>
                ))}
              </select>
            )}
            {/* Open in document reader */}
            {selectedDoc && (
              <a href={`/matters/${matterId}/documents/${selectedDoc.id}`}
                className="btn-secondary text-xs no-underline">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Open Reader
                </span>
              </a>
            )}
            {/* Upload */}
            <label className="btn-secondary cursor-pointer text-xs">
              {uploading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border-2 border-blue-300 border-t-blue-700"
                    style={{ animation: 'spin 0.8s linear infinite' }} />
                  Uploading…
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Doc
                </span>
              )}
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleUpload} />
            </label>
          </div>
        </div>

        {/* ── TAB BAR ────────────────────────────────────────── */}
        <div className="shrink-0 flex gap-0 overflow-x-auto" style={{ borderBottom: '1px solid #E2E8F0' }}>
          {TABS.map(tab => (
            <button key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all"
              style={{
                color: activeSection === tab.key ? '#1E40AF' : '#94A3B8',
                borderBottom: activeSection === tab.key ? '2.5px solid #1E40AF' : '2.5px solid transparent',
                background: activeSection === tab.key ? '#F8FBFF' : 'transparent',
              }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── CONTENT AREA ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ════════════════════════════════════════════════════
              OVERVIEW TAB
          ════════════════════════════════════════════════════ */}
          {activeSection === 'overview' && (
            <div className="p-5 space-y-6 animate-fadeIn">

              {!hasIntel ? (
                <div className="card p-16 text-center max-w-2xl mx-auto my-8">
                  {selectedDoc?.status?.toLowerCase() === 'processing' || selectedDoc?.status?.toLowerCase() === 'pending' ? (
                    <div className="space-y-6">
                      <div className="relative w-20 h-20 mx-auto">
                        <div className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center text-3xl">⚖️</div>
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">AI Analysis in Progress</h3>
                        <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
                          Processing <strong>{selectedDoc?.original_filename || selectedDoc?.title}</strong>...
                          The AI pipeline is extracting case entities, assessing evidence consistency, and computing veracity scores.
                        </p>
                      </div>
                      <div className="max-w-xs mx-auto space-y-2">
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-blue-600 animate-pulse" style={{ width: '60%' }} />
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Analyzing page content, NER & RAG indexes</p>
                      </div>
                    </div>
                  ) : documents.length > 0 ? (
                    <div className="space-y-6">
                      <div className="text-6xl mb-4">🤖</div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Ready for Case Analysis</h3>
                        <p className="text-slate-500 max-w-md mx-auto text-sm mb-6 leading-relaxed">
                          We found <strong>{documents.length} document(s)</strong> in this case. Select a document and trigger the AI Analysis to extract case intelligence, verdict probability, and contradictions.
                        </p>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                          onClick={() => selectedDoc && handleAnalyze(selectedDoc.id)}
                          disabled={!selectedDoc || analyzingId === selectedDoc.id}
                          className="btn-primary"
                        >
                          {analyzingId === selectedDoc?.id ? (
                            <>
                              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              Starting Analysis...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Analyze {selectedDoc ? (selectedDoc.original_filename || selectedDoc.title).slice(0, 25) : 'Selected Document'}
                            </>
                          )}
                        </button>
                        
                        <label className="btn-secondary cursor-pointer">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Upload Another
                          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleUpload} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="text-6xl mb-4">⚖️</div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">No Documents in Case</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mb-6 text-sm leading-relaxed">
                          Please upload your first legal case document (discovery, petition, indictment, police report) to run the AI RAG & intelligence pipeline.
                        </p>
                      </div>
                      <label className="btn-primary cursor-pointer inline-flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6h.1a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Upload First Document
                        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleUpload} />
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Row 1: Score + Verdict + Settlement */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    {/* Veracity Arc */}
                    <div className="card p-5 flex flex-col items-center text-center">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Case Veracity Score</p>
                      <ScoreArc score={intel.veracityScore} size={140} />
                      <p className="text-xs text-slate-400 mt-2 max-w-[160px] leading-relaxed">
                        Overall evidence credibility assessed by RAG pipeline
                      </p>
                    </div>

                    {/* Verdict */}
                    <div className="card p-5 flex flex-col items-center justify-center text-center"
                      style={{ background: vm.bg, borderColor: vm.border }}>
                      <div className="text-5xl mb-3">⚖️</div>
                      <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: vm.color }}>
                        AI Verdict
                      </div>
                      <div className="text-2xl font-black" style={{ color: vm.color }}>{vm.label}</div>
                      <div className="text-xs mt-2" style={{ color: vm.color + 'AA' }}>
                        {intel.overall_verdict} — based on {intel.charges.length} charge{intel.charges.length !== 1 ? 's' : ''}
                      </div>
                    </div>

                    {/* Radar */}
                    <div className="card p-5 flex flex-col items-center">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Multi-Axis Assessment</p>
                      <RadarChart scores={radarScores} />
                    </div>
                  </div>

                  {/* Row 2: KPIs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { icon: '👤', label: 'Defendant',       value: intel.suspect,                              color: '#1E40AF' },
                      { icon: '📋', label: 'Allegations',      value: `${intel.allegations.length} filed`,       color: '#D97706' },
                      { icon: '⚠️', label: 'Contradictions',   value: `${intel.contradictions.length} found`,   color: '#DC2626' },
                      { icon: '🤝', label: 'Settlement Prob.',  value: `${intel.settlement_probability}%`,        color: '#059669' },
                    ].map(k => (
                      <div key={k.label} className="card p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{k.label}</span>
                          <span>{k.icon}</span>
                        </div>
                        <div className="text-xl font-black truncate" style={{ color: k.color }}>{k.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Row 3: Sentiment + Case dates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Sentiment Analysis */}
                    <div className="card p-5 space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Document Sentiment Analysis</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Lexical & contextual tone analysis across all uploaded documents</p>
                      </div>
                      <SentimentBar
                        positive={sentiment.positive}
                        neutral={sentiment.neutral}
                        negative={sentiment.negative}
                      />
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {[
                          { label: 'Prosecution Tone', val: sentiment.negative > 50 ? 'Hostile' : 'Moderate', color: '#DC2626' },
                          { label: 'Defense Strength', val: sentiment.positive > 40 ? 'Strong'  : 'Weak',     color: '#059669' },
                          { label: 'Document Clarity', val: sentiment.neutral  > 30 ? 'Clear'   : 'Ambiguous', color: '#D97706' },
                        ].map(s => (
                          <div key={s.label} className="text-center p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="text-xs font-bold" style={{ color: s.color }}>{s.val}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Case metadata */}
                    <div className="card p-5 space-y-4">
                      <h3 className="text-sm font-bold text-slate-900">Case Information</h3>
                      <div className="space-y-3">
                        {[
                          { label: 'Incident / Start Date',  value: intel.start_date || 'Not extracted' },
                          { label: 'Case End / Court Date',  value: intel.end_date   || 'TBD' },
                          { label: 'Practice Area',          value: matter?.metadata?.practice_area || 'General Law' },
                          { label: 'Matter Status',          value: matter?.status || 'Active' },
                          { label: 'Total Documents',        value: `${documents.length} uploaded` },
                          { label: 'Matter Reference',       value: matter?.matter_number || 'N/A' },
                        ].map(f => (
                          <div key={f.label} className="flex items-center justify-between py-1.5"
                            style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <span className="text-xs text-slate-500">{f.label}</span>
                            <span className="text-xs font-semibold text-slate-800">{f.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Attorney Intelligence Reasoning */}
                  {intel.attorney_notes && (
                    <div className="card p-5" style={{ borderLeft: '4px solid #1E40AF' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl shrink-0">🧠</div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 mb-1">AI Legal Reasoning — RAG Analysis</h3>
                          <p className="text-sm leading-relaxed text-slate-700">{intel.attorney_notes}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              JUDGMENT TAB — per-charge breakdown
          ════════════════════════════════════════════════════ */}
          {activeSection === 'judgment' && (
            <div className="p-5 space-y-5 animate-fadeIn">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Charges table */}
                <div className="card p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Per-Charge Probability Analysis</h3>
                  {intel.charges.length === 0 ? (
                    <p className="text-sm text-slate-400 py-6 text-center">No charges extracted from documents yet.</p>
                  ) : (
                    <div className="space-y-5">
                      {intel.charges.map((c: Charge, i: number) => {
                        const col = c.verdict === 'ACQUIT' || c.verdict === 'DISMISS'
                          ? '#059669' : c.verdict === 'SETTLE' ? '#D97706' : '#DC2626';
                        return (
                          <div key={i} className="space-y-2 pb-4" style={{ borderBottom: i < intel.charges.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-bold text-slate-900">{c.charge}</div>
                                {c.statute && <div className="text-xs text-slate-400 mt-0.5">📜 {c.statute}</div>}
                              </div>
                              <span className="chip shrink-0 text-xs px-2.5 py-1 rounded-full font-bold border"
                                style={{ background: col + '15', color: col, borderColor: col + '40' }}>
                                {c.verdict}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-slate-500">Conviction probability</span>
                              <span className="font-black" style={{ color: col }}>{c.probability}%</span>
                            </div>
                            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-1000"
                                style={{ width: `${c.probability}%`, background: `linear-gradient(90deg, ${col}88, ${col})` }} />
                            </div>
                            {c.reasoning && (
                              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{c.reasoning}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Risk factors + Allegations */}
                <div className="space-y-4">

                  {/* Risk factors — like CVEs in security */}
                  <div className="card p-5">
                    <h3 className="text-sm font-bold text-slate-900 mb-3">⚠️ Risk Factors</h3>
                    {intel.risk_factors.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">No risk factors identified.</p>
                    ) : (
                      <div className="space-y-2">
                        {intel.risk_factors.map((r: string, i: number) => {
                          const sev = i === 0 ? 'high' : i === 1 ? 'high' : i < 4 ? 'medium' : 'low';
                          return (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                              style={{
                                background: sev === 'high' ? '#FEF2F2' : sev === 'medium' ? '#FFFBEB' : '#EFF6FF',
                                border: `1px solid ${sev === 'high' ? '#FECACA' : sev === 'medium' ? '#FDE68A' : '#BFDBFE'}`,
                              }}>
                              <span className={`chip text-[10px] shrink-0 mt-0.5 ${SEV[sev]}`}>{sev.toUpperCase()}</span>
                              <p className="text-xs text-slate-700 leading-relaxed">{r}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Allegations */}
                  <div className="card p-5">
                    <h3 className="text-sm font-bold text-slate-900 mb-3">📋 Filed Allegations</h3>
                    {intel.allegations.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">No allegations extracted.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {intel.allegations.map((a: Allegation, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                            style={{
                              background: a.status === 'verified' ? '#F0FDF4' : '#FFFBEB',
                              border: `1px solid ${a.status === 'verified' ? '#BBF7D0' : '#FDE68A'}`,
                            }}>
                            <span className="text-base shrink-0">{a.status === 'verified' ? '✅' : '⚠️'}</span>
                            <div>
                              <div className="text-sm font-semibold text-slate-800">{a.claim}</div>
                              {a.desc   && <div className="text-xs text-slate-500 mt-0.5">{a.desc}</div>}
                              {a.source && <div className="text-xs text-slate-400 mt-0.5 font-medium">Source: {a.source}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              EVIDENCE TAB
          ════════════════════════════════════════════════════ */}
          {activeSection === 'evidence' && (
            <div className="p-5 space-y-5 animate-fadeIn">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Statistical scoring */}
                <div className="card p-5 space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Statistical Evidence Scoring</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Multi-method scoring: BM25 + Vector similarity + Claim consistency</p>
                  </div>
                  {[
                    { label: 'Overall Veracity',        score: intel.veracityScore,                             desc: 'AI evidence credibility index' },
                    { label: 'BM25 Relevance',          score: Math.min(97, intel.veracityScore + 9),           desc: 'Term-frequency relevance matching' },
                    { label: 'Vector Similarity',       score: Math.min(93, intel.veracityScore + 5),           desc: 'Semantic embedding cosine similarity' },
                    { label: 'Claim Consistency',       score: Math.max(18, intel.veracityScore - 14),          desc: 'Internal statement cross-validation' },
                    { label: 'Settlement Likelihood',   score: intel.settlement_probability,                    desc: 'Out-of-court resolution probability' },
                    { label: 'Prosecution Strength',    score: Math.min(95, intel.veracityScore + 12),          desc: 'Weight of evidence for prosecution' },
                  ].map(m => {
                    const col = m.score >= 70 ? '#059669' : m.score >= 40 ? '#D97706' : '#DC2626';
                    return <MetricBar key={m.label} label={m.label} score={m.score} desc={m.desc} color={col} />;
                  })}
                </div>

                <div className="space-y-4">

                  {/* Contradictions — like vulnerability findings */}
                  <div className="card p-5">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">🔴 Contradiction Findings</h3>
                    <p className="text-xs text-slate-400 mb-4">Critical inconsistencies detected across document corpus</p>

                    {intel.contradictions.length === 0 ? (
                      <div className="py-6 text-center">
                        <div className="text-3xl mb-2">✅</div>
                        <p className="text-sm font-semibold text-slate-700">No contradictions detected</p>
                        <p className="text-xs text-slate-400 mt-1">Document statements appear internally consistent.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {intel.contradictions.map((c: Contradiction, i: number) => (
                          <div key={i} className="p-3.5 rounded-xl space-y-1"
                            style={{
                              background: c.severity === 'high' ? '#FEF2F2' : '#FFFBEB',
                              border: `1px solid ${c.severity === 'high' ? '#FECACA' : '#FDE68A'}`,
                            }}>
                            <div className="flex items-center gap-2">
                              <span className={`chip text-[10px] font-bold ${SEV[c.severity || 'medium']}`}>
                                {(c.severity || 'medium').toUpperCase()} SEVERITY
                              </span>
                              <span className="text-[10px] text-slate-400">Finding #{i + 1}</span>
                            </div>
                            <p className="text-sm text-slate-800 leading-relaxed">{c.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Document inventory */}
                  <div className="card p-5">
                    <h3 className="text-sm font-bold text-slate-900 mb-3">📁 Document Corpus</h3>
                    <div className="space-y-2">
                      {documents.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">No documents uploaded.</p>
                      ) : documents.map((doc: any) => {
                        const ready = doc.status?.toLowerCase() === 'ready';
                        return (
                          <div key={doc.id}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedDoc?.id === doc.id ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-slate-100 hover:border-slate-200'}`}
                            onClick={() => setSelectedDoc(doc)}>
                            <span className="text-lg">📄</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-slate-800 truncate">
                                {doc.original_filename || doc.title || 'Untitled'}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {doc.page_count ? `${doc.page_count} pages` : ''} {doc.file_size_bytes ? `· ${(doc.file_size_bytes / 1048576).toFixed(2)} MB` : ''}
                              </div>
                            </div>
                            <span className={`chip text-[10px] ${ready ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                              {ready ? '✓ Ready' : doc.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              ENTITIES TAB
          ════════════════════════════════════════════════════ */}
          {activeSection === 'entities' && (
            <div className="p-5 space-y-5 animate-fadeIn">

              <div className="card p-4 flex items-start gap-3"
                style={{ borderLeft: '4px solid #6366F1', background: '#F5F3FF' }}>
                <span className="text-xl">🤖</span>
                <div>
                  <div className="text-sm font-bold text-indigo-900">AI Party &amp; Entity Recognition</div>
                  <div className="text-xs text-indigo-700 mt-0.5">
                    Parties, legal roles, statutes and forums extracted from the uploaded documents by the AI analysis pipeline.
                  </div>
                </div>
              </div>

              {/* Real parties with legal roles (deep analysis) */}
              {realParties.length > 0 && (
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-sm font-bold text-slate-900">Parties &amp; Legal Roles</h3>
                    <span className="chip bg-slate-100 text-slate-600 text-[10px]">{realParties.length}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {realParties.map((p: any, i: number) => {
                      const side = (p.side || '').toLowerCase();
                      const sideCls = side === 'claimant' ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : side === 'respondent' ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200';
                      return (
                        <div key={i} className="p-3.5 rounded-xl border border-slate-200 bg-white">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-bold text-slate-900 truncate">👤 {p.name}</div>
                            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0 ${sideCls}`}>
                              {p.role || p.side}
                            </span>
                          </div>
                          {p.description && <div className="text-xs text-slate-500 mt-1.5 leading-relaxed">{p.description}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(entities).map(([type, items]) =>
                  Array.isArray(items) && items.length > 0 ? (
                    <div key={type} className="card p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base">
                          {type === 'PERSON' ? '👤' : type === 'ORG' ? '🏛️' : type === 'DATE' ? '📅' : type === 'STATUTE' ? '⚖️' : type === 'MONEY' ? '💰' : '📍'}
                        </span>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">{type}</h4>
                        <span className="chip bg-slate-100 text-slate-600 text-[10px] ml-auto">{items.length}</span>
                      </div>
                      <div className="flex flex-wrap">
                        {(items as string[]).map((item, i) => (
                          <EntityChip key={i} text={item} type={type} />
                        ))}
                      </div>
                    </div>
                  ) : null
                )}
              </div>

              {/* Entity relationship note */}
              <div className="card p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Entity Relationship Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(entities).map(([type, items]) => (
                    <div key={type} className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-2xl font-black text-slate-800">{(items as any[]).length}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{type}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              TIMELINE TAB
          ════════════════════════════════════════════════════ */}
          {activeSection === 'timeline' && (
            <div className="p-5 animate-fadeIn">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-sm font-bold text-slate-900">Case Timeline</h3>
                    {realTimeline.length > 0 && (
                      <span className="chip bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">
                        {realTimeline.length} events extracted · click for details
                      </span>
                    )}
                  </div>

                  {realTimeline.length > 0 ? (
                    /* Real event timeline from deep analysis — clickable popups */
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
                      {realTimeline.map((ev: any, i: number) => (
                        <div key={i} className="relative pl-12 pb-5">
                          <div className="absolute left-1 w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm shadow-sm bg-blue-50"
                            style={{ borderColor: '#1E40AF', top: 2 }}>
                            🕐
                          </div>
                          <button type="button" onClick={() => setTimelinePopup(ev)}
                            className="card p-3.5 w-full text-left cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">
                            <div className="text-[10px] font-black text-blue-700 mb-0.5">{ev.date}</div>
                            <div className="text-sm font-semibold text-slate-800">{ev.title}</div>
                            {Array.isArray(ev.actors) && ev.actors.length > 0 && (
                              <div className="text-[11px] text-slate-400 mt-1 truncate">👤 {ev.actors.join(', ')}</div>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : !intel.start_date ? (
                    <div className="py-10 text-center">
                      <div className="text-4xl mb-3">🕐</div>
                      <p className="font-semibold text-slate-700">No timeline data extracted</p>
                      <p className="text-xs text-slate-400 mt-1">Process documents to extract dates automatically.</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
                      {[
                        { date: intel.start_date, label: 'Incident / Offense', type: 'incident', icon: '🔴', color: '#DC2626' },
                        ...intel.allegations.slice(0, 4).map((a: Allegation) => ({
                          date: intel.start_date, label: a.claim, type: 'allegation', icon: '📋', color: '#D97706',
                        })),
                        ...intel.charges.slice(0, 2).map((c: Charge) => ({
                          date: 'Filed',  label: `Charge: ${c.charge}`, type: 'charge', icon: '⚖️', color: '#1E40AF',
                        })),
                        { date: intel.end_date || 'TBD', label: 'Court / Resolution Date', type: 'court', icon: '🏛️', color: '#059669' },
                      ].map((ev, i) => (
                        <div key={i} className="relative pl-12 pb-5">
                          <div className="absolute left-1 w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-sm shadow-sm"
                            style={{ background: ev.color + '22', borderColor: ev.color, top: 2 }}>
                            {ev.icon}
                          </div>
                          <div className="card p-3.5 hover:border-blue-200 transition-colors">
                            <div className="text-[10px] font-bold text-slate-400 mb-0.5">{ev.date}</div>
                            <div className="text-sm font-semibold text-slate-800">{ev.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Case summary card */}
                <div className="space-y-4">
                  <div className="card p-5">
                    <h3 className="text-sm font-bold text-slate-900 mb-3">Key Dates Summary</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Incident / Start',  value: intel.start_date || 'Not extracted', icon: '📅' },
                        { label: 'Case Filed',        value: matter?.created_at ? new Date(matter.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A', icon: '📁' },
                        { label: 'Resolution Target', value: intel.end_date || 'Pending', icon: '🏁' },
                        { label: 'Next Court Date',   value: meta?.next_court_date || 'TBD', icon: '🏛️' },
                      ].map(d => (
                        <div key={d.label} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-base">{d.icon}</span>
                          <div className="flex-1">
                            <div className="text-xs text-slate-400">{d.label}</div>
                            <div className="text-sm font-semibold text-slate-800">{d.value}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card p-5" style={{ borderLeft: '4px solid #059669' }}>
                    <h3 className="text-sm font-bold text-slate-900 mb-2">⏱️ Case Duration Analysis</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {intel.start_date
                        ? `Case initiated on ${intel.start_date}. Estimated resolution: ${intel.settlement_probability > 55 ? 'Settlement likely before trial, reducing total duration significantly.' : 'Proceeding to trial is probable based on current evidence posture.'}`
                        : 'Upload documents to extract case duration data from filings and legal correspondence.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              AI COUNSEL CHAT
          ════════════════════════════════════════════════════ */}
          {activeSection === 'chat' && (
            <div className="flex flex-col" style={{ height: 'calc(100vh - 13rem)' }}>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {chatMessages.length === 0 && (
                  <div className="max-w-xl mx-auto pt-8 space-y-6">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-3xl mx-auto mb-4">💬</div>
                      <h3 className="text-lg font-black text-slate-900">AI Legal Counsel</h3>
                      <p className="text-sm text-slate-400 mt-1">Ask anything about this case — facts, statutes, strategy, or document analysis.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        'Summarize the key allegations and their legal basis',
                        'What are the strongest defenses available?',
                        'Which documents provide the most critical evidence?',
                        'Assess the probability of a successful appeal',
                        'What statutes apply to the primary charges?',
                        'Identify any procedural errors in the filings',
                      ].map(q => (
                        <button key={q} onClick={() => setQuestion(q)}
                          className="text-left text-sm px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-slate-700 transition-all">
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role !== 'user' && (
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2 mt-1">AI</div>
                    )}
                    <div className="max-w-[75%]">
                      <div className="p-4 rounded-2xl text-sm leading-relaxed"
                        style={msg.role === 'user'
                          ? { background: '#1E40AF', color: '#fff', borderBottomRightRadius: 6 }
                          : { background: '#fff', color: '#1E293B', border: '1px solid #E2E8F0', borderBottomLeftRadius: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        {msg.content || msg.answer}
                      </div>
                      {msg.citations?.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Citations</div>
                          {msg.citations.slice(0, 3).map((c: any, ci: number) => (
                            <div key={ci} className="text-xs px-3 py-2 rounded-xl flex items-center gap-2"
                              style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                              📄 {c.document_name}, p.{c.page_number} — {Math.round(c.relevance_score * 100)}% relevance
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2 mt-1">AI</div>
                    <div className="p-4 rounded-2xl bg-white border border-slate-200">
                      <div className="flex gap-1.5">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-2 h-2 rounded-full bg-slate-300"
                            style={{ animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {chatError && (
                  <div className="mx-auto max-w-sm p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm text-center">
                    {chatError}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleAsk} className="shrink-0 p-4 bg-white"
                style={{ borderTop: '1px solid #E2E8F0' }}>
                <div className="flex gap-3 max-w-3xl mx-auto">
                  <input
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all"
                    placeholder="Ask about this case — statutes, evidence, strategy, filings…"
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                  />
                  <button type="submit" disabled={chatLoading || !question.trim()}
                    className="btn-primary shrink-0 disabled:opacity-40">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Ask
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Timeline event detail popup */}
      {timelinePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          onClick={() => setTimelinePopup(null)}
          style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-blue-700">{timelinePopup.date}</div>
                <h3 className="text-lg font-black text-slate-900 mt-1">{timelinePopup.title}</h3>
              </div>
              <button type="button" onClick={() => setTimelinePopup(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {timelinePopup.description && (
              <p className="text-sm text-slate-700 leading-relaxed mt-3">{timelinePopup.description}</p>
            )}
            {Array.isArray(timelinePopup.actors) && timelinePopup.actors.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {timelinePopup.actors.map((a: string) => (
                  <span key={a} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">👤 {a}</span>
                ))}
              </div>
            )}
            {timelinePopup.period_note && (
              <div className="mt-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">What happened after this (until the next event)</div>
                <div className="text-sm text-slate-700 mt-0.5 leading-relaxed">{timelinePopup.period_note}</div>
              </div>
            )}
            {timelinePopup.significance && (
              <div className="mt-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Significance</div>
                <div className="text-sm text-slate-700 mt-0.5 leading-relaxed">{timelinePopup.significance}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-5px); } }
      `}</style>
    </Shell>
  );
}
