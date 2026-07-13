'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchApi } from '@/lib/api';
import Shell from '@/components/layout/Shell';

/* ── Template catalogue ──────────────────────────────────────── */
const TEMPLATES = [
  {
    id: 'demand_letter', category: 'Civil Litigation', icon: '⚖️',
    name: 'Demand Letter',
    desc: 'Formal demand for payment, performance, or relief with deadline.',
    fields: [
      { key: 'defendant_name', label: 'Defendant Name', placeholder: 'John Doe / ACME Corp', required: false },
      { key: 'amount', label: 'Amount / Relief', placeholder: '$150,000 in compensatory damages', required: false },
      { key: 'deadline', label: 'Response Deadline', placeholder: 'Leave blank for 30-day default', required: false },
    ],
  },
  {
    id: 'cease_desist', category: 'Civil Litigation', icon: '🚫',
    name: 'Cease & Desist',
    desc: 'Order an opposing party to immediately stop unlawful conduct.',
    fields: [
      { key: 'defendant_name', label: 'Respondent Name', placeholder: 'Jane Smith / XYZ Ltd.', required: false },
      { key: 'conduct', label: 'Infringing Conduct', placeholder: 'Describe the unlawful activity', required: false },
      { key: 'deadline', label: 'Compliance Deadline', placeholder: '7 days from receipt', required: false },
    ],
  },
  {
    id: 'client_update', category: 'Client Communication', icon: '📬',
    name: 'Client Status Update',
    desc: 'Professional status letter with AI findings, upcoming deadlines, and action items.',
    fields: [
      { key: 'client_address', label: 'Client Address', placeholder: '123 Main St, New York, NY 10001', required: false },
      { key: 'next_steps', label: 'Specific Next Steps', placeholder: 'e.g., Deposition scheduled for…', required: false },
    ],
  },
  {
    id: 'injury_claim', category: 'Personal Injury', icon: '🏥',
    name: 'Personal Injury Claim',
    desc: 'Demand letter to insurer with injury description, treatment, and itemized damages.',
    fields: [
      { key: 'insurer', label: 'Insurance Company', placeholder: 'Allstate Insurance Co.', required: false },
      { key: 'policy_number', label: 'Policy / Claim #', placeholder: 'CLM-2024-88812', required: false },
      { key: 'amount', label: 'Total Demand', placeholder: '$350,000', required: false },
    ],
  },
  {
    id: 'real_estate_notice', category: 'Real Estate', icon: '🏠',
    name: 'Real Estate Notice',
    desc: 'Property-related notice (eviction, breach of lease, sale dispute).',
    fields: [
      { key: 'property_address', label: 'Property Address', placeholder: '456 Oak Ave, Miami, FL', required: false },
      { key: 'defendant_name', label: 'Tenant / Respondent', placeholder: 'John Tenant', required: false },
      { key: 'deadline', label: 'Cure Deadline', placeholder: '3 days', required: false },
    ],
  },
  {
    id: 'court_filing', category: 'Court Documents', icon: '📋',
    name: 'Court Filing Notice',
    desc: 'Formal notice of document filing with caption block and certificate of service.',
    fields: [
      { key: 'court_name', label: 'Court Name', placeholder: 'Superior Court of California', required: false },
      { key: 'case_number', label: 'Case Number', placeholder: '24-CV-000123', required: false },
      { key: 'filing_description', label: 'Document Filed', placeholder: 'Motion for Summary Judgment', required: false },
    ],
  },
];

const CATEGORIES = ['All', ...Array.from(new Set(TEMPLATES.map(t => t.category)))];
const CATEGORY_COLORS: Record<string, string> = {
  'Civil Litigation': '#1E40AF',
  'Client Communication': '#059669',
  'Personal Injury': '#D97706',
  'Real Estate': '#7E22CE',
  'Court Documents': '#0E7490',
};

/* ── Status badge ────────────────────────────────────────────── */
function StatusBadge({ status }: { status: 'idle' | 'loading' | 'done' | 'error' }) {
  const map = {
    idle:    { bg: '#F8FAFC', color: '#94A3B8', border: '#E2E8F0', label: 'Ready' },
    loading: { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE', label: 'Generating…' },
    done:    { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0', label: 'Complete' },
    error:   { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA', label: 'Error' },
  };
  const s = map[status];
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status === 'loading' && (
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', border: '1.5px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', marginRight: 4 }} />
      )}
      {s.label}
    </span>
  );
}

/* ── Letter Output panel ─────────────────────────────────────── */
function LetterPanel({ result, onClear }: { result: any; onClear: () => void }) {
  const textRef = useRef<HTMLTextAreaElement>(null);

  const copyToClipboard = () => {
    if (textRef.current) {
      navigator.clipboard.writeText(textRef.current.value);
    }
  };

  const downloadTxt = () => {
    if (!textRef.current) return;
    const blob = new Blob([textRef.current.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.template_name.replace(/\s+/g, '_')}_${result.matter_title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Output header */}
      <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <div>
          <div className="font-bold text-sm" style={{ color: '#0F172A' }}>{result.template_name}</div>
          <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            {result.matter_title} · {result.rag_chunks_used} RAG chunks · {result.tokens_used.toLocaleString()} tokens
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyToClipboard} className="btn-ghost py-2 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Copy
          </button>
          <button onClick={downloadTxt} className="btn-primary py-2 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download .txt
          </button>
          <button onClick={onClear} className="btn-ghost py-2 text-xs" title="Clear">✕</button>
        </div>
      </div>

      {/* AI metadata bar */}
      <div className="flex flex-wrap gap-4 px-5 py-2.5 shrink-0" style={{ borderBottom: '1px solid #F1F5F9', background: '#FAFBFC' }}>
        {[
          { label: 'Defendant', value: result.metadata_used?.defendant },
          { label: 'Veracity Score', value: result.metadata_used?.veracity_score != null ? `${result.metadata_used.veracity_score}%` : 'N/A' },
          { label: 'Allegations Used', value: result.metadata_used?.allegations_count ?? 0 },
          { label: 'RAG Chunks', value: result.rag_chunks_used },
        ].map(f => (
          <div key={f.label} className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{f.label}</span>
            <span className="text-xs font-bold mt-0.5" style={{ color: '#0F172A' }}>{f.value || '—'}</span>
          </div>
        ))}
        <div className="flex flex-col ml-auto">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Generated</span>
          <span className="text-xs font-bold mt-0.5" style={{ color: '#0F172A' }}>
            {new Date(result.generated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Letter text */}
      <div className="flex-1 p-4 overflow-auto">
        <textarea
          ref={textRef}
          defaultValue={result.letter_text}
          className="w-full h-full resize-none outline-none text-sm leading-relaxed font-mono"
          style={{
            color: '#1E293B',
            background: 'transparent',
            border: 'none',
            fontFamily: "'Courier New', Courier, monospace",
            lineHeight: 1.75,
          }}
        />
      </div>

      {/* Review bar */}
      <div className="flex items-center gap-3 px-5 py-3 shrink-0" style={{ borderTop: '1px solid #F1F5F9', background: '#FAFBFC' }}>
        <span className="text-xs" style={{ color: '#64748B' }}>Review status:</span>
        <button className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }}>
          ✓ Mark as Reviewed
        </button>
        <button className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
          ✉ Mark as Sent
        </button>
        <span className="text-xs ml-auto" style={{ color: '#94A3B8' }}>Always verify AI-generated content before use in legal proceedings.</span>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────── */
export default function Templates() {
  const [matters, setMatters] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [selectedMatter, setSelectedMatter] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('All');
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchApi('/api/v1/matters')
      .then(d => {
        const items = d.items || [];
        setMatters(items);
        if (items.length > 0) setSelectedMatter(items[0].id);
      })
      .catch(console.error);
  }, []);

  // Reset fields when template changes
  useEffect(() => {
    setCustomFields({});
    setResult(null);
    setStatus('idle');
    setError('');
  }, [selectedTemplate]);

  const startProgressBar = () => {
    setProgress(0);
    let p = 0;
    const tick = () => {
      p += Math.random() * 8 + 2;
      if (p >= 92) { setProgress(92); return; }
      setProgress(p);
      progressRef.current = setTimeout(tick, 250);
    };
    progressRef.current = setTimeout(tick, 250);
  };

  const stopProgressBar = () => {
    if (progressRef.current) clearTimeout(progressRef.current);
    setProgress(100);
  };

  const generate = async () => {
    if (!selectedMatter) { setError('Please select a matter first.'); return; }
    setStatus('loading');
    setError('');
    setResult(null);
    startProgressBar();

    try {
      const payload: any = {
        template_id: selectedTemplate.id,
        custom_fields: customFields,
      };
      // Map universal overrides
      if (customFields.defendant_name) payload.override_defendant = customFields.defendant_name;
      if (customFields.amount) payload.override_amount = customFields.amount;
      if (customFields.deadline) payload.override_deadline = customFields.deadline;

      const data = await fetchApi(`/api/v1/matters/${selectedMatter}/generate-letter`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      stopProgressBar();
      setTimeout(() => { setResult(data); setStatus('done'); }, 200);
    } catch (err: any) {
      stopProgressBar();
      setError(err.message || 'Generation failed. Please try again.');
      setStatus('error');
    }
  };

  const filtered = category === 'All' ? TEMPLATES : TEMPLATES.filter(t => t.category === category);
  const selectedMatterObj = matters.find(m => m.id === selectedMatter);

  return (
    <Shell>
      <div className="flex flex-col h-full animate-fadeIn" style={{ gap: 0 }}>
        {/* Page title bar */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-black" style={{ color: '#0F172A' }}>Letter Generator</h2>
            <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
              Select a template → choose a matter → generate a real AI-drafted letter grounded in your case documents.
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5" style={{ flex: 1 }}>

          {/* ── LEFT: Template Selector ─────────────────────────── */}
          <div className="xl:col-span-3 flex flex-col gap-3">
            {/* Category tabs */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: category === c ? '#1E40AF' : '#F1F5F9',
                    color: category === c ? '#fff' : '#475569',
                    border: `1px solid ${category === c ? '#1E40AF' : '#E2E8F0'}`,
                  }}>
                  {c}
                </button>
              ))}
            </div>

            {/* Template cards */}
            <div className="space-y-2">
              {filtered.map(t => {
                const isSelected = selectedTemplate.id === t.id;
                const catColor = CATEGORY_COLORS[t.category] || '#1E40AF';
                return (
                  <button key={t.id} onClick={() => setSelectedTemplate(t)}
                    className="w-full text-left rounded-xl p-3.5 transition-all"
                    style={{
                      background: isSelected ? '#EFF6FF' : '#FAFBFC',
                      border: `1.5px solid ${isSelected ? '#BFDBFE' : '#E2E8F0'}`,
                      boxShadow: isSelected ? '0 2px 8px rgba(59,130,246,0.1)' : 'none',
                    }}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{ background: catColor + '14' }}>
                        {t.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold leading-snug" style={{ color: isSelected ? '#1E40AF' : '#0F172A' }}>
                          {t.name}
                        </div>
                        <div className="text-[10.5px] mt-0.5 leading-snug" style={{ color: '#94A3B8' }}>{t.desc}</div>
                        <span className="inline-block mt-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: catColor + '12', color: catColor }}>
                          {t.category}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── CENTER: Form ─────────────────────────────────────── */}
          <div className="xl:col-span-4 card flex flex-col">
            {/* Form header */}
            <div className="px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: (CATEGORY_COLORS[selectedTemplate.category] || '#1E40AF') + '14' }}>
                  {selectedTemplate.icon}
                </div>
                <div>
                  <div className="font-bold text-sm" style={{ color: '#0F172A' }}>{selectedTemplate.name}</div>
                  <div className="text-xs" style={{ color: '#94A3B8' }}>{selectedTemplate.category}</div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Matter selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#475569' }}>
                  Select Matter *
                </label>
                {matters.length === 0 ? (
                  <div className="p-3 rounded-xl text-xs text-center" style={{ background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
                    ⚠ No matters found. <a href="/matters" style={{ color: '#92400E', fontWeight: 700 }}>Create a matter first →</a>
                  </div>
                ) : (
                  <select className="input-base" value={selectedMatter} onChange={e => setSelectedMatter(e.target.value)}>
                    {matters.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.title}{m.matter_number ? ` (${m.matter_number})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Case metadata preview (from AI pipeline) */}
              {selectedMatterObj?.metadata && Object.keys(selectedMatterObj.metadata).length > 0 && (
                <div className="rounded-xl p-3.5 space-y-2" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#166534' }}>
                    ✓ AI Data Available — will auto-fill letter
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {[
                      { key: 'suspect', label: 'Defendant' },
                      { key: 'veracityScore', label: 'Veracity', suffix: '%' },
                      { key: 'practice_area', label: 'Practice Area' },
                      { key: 'start_date', label: 'Date' },
                    ].map(f => {
                      const val = selectedMatterObj.metadata[f.key];
                      if (!val) return null;
                      return (
                        <div key={f.key}>
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: '#94A3B8' }}>{f.label}</span>
                          <div className="text-xs font-semibold" style={{ color: '#166534' }}>
                            {String(val)}{f.suffix || ''}
                          </div>
                        </div>
                      );
                    }).filter(Boolean)}
                  </div>
                </div>
              )}

              {/* No AI data warning */}
              {selectedMatterObj && (!selectedMatterObj.metadata || Object.keys(selectedMatterObj.metadata || {}).length === 0) && (
                <div className="rounded-xl p-3 text-xs" style={{ background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
                  ⚡ This matter has no AI analysis yet. The letter will use template defaults. Upload and process documents in the workspace to enable AI auto-fill.
                </div>
              )}

              {/* Custom overrides */}
              {selectedTemplate.fields.length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>
                    Field Overrides <span className="font-normal normal-case ml-1" style={{ color: '#94A3B8' }}>(optional — AI fills from case data)</span>
                  </label>
                  <div className="space-y-3">
                    {selectedTemplate.fields.map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>{f.label}</label>
                        <input
                          className="input-base"
                          placeholder={f.placeholder}
                          value={customFields[f.key] || ''}
                          onChange={e => setCustomFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl text-sm font-medium" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                  {error}
                </div>
              )}
            </div>

            {/* Generate button + progress bar */}
            <div className="px-5 pb-5 pt-3 shrink-0" style={{ borderTop: '1px solid #F1F5F9' }}>
              {status === 'loading' && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1" style={{ color: '#64748B' }}>
                    <span>Analyzing case data + generating letter…</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: '#E2E8F0' }}>
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #1E40AF, #6366F1)',
                      boxShadow: '0 0 8px rgba(99,102,241,0.4)',
                    }} />
                  </div>
                </div>
              )}
              <button
                onClick={generate}
                disabled={status === 'loading' || !selectedMatter}
                className="btn-primary w-full justify-center"
                style={{
                  fontSize: 14,
                  paddingTop: 12,
                  paddingBottom: 12,
                  opacity: (status === 'loading' || !selectedMatter) ? 0.6 : 1,
                  cursor: (status === 'loading' || !selectedMatter) ? 'not-allowed' : 'pointer',
                }}>
                {status === 'loading' ? (
                  <>
                    <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
                    Generating…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Generate {selectedTemplate.name}
                  </>
                )}
              </button>
              <p className="text-[10.5px] text-center mt-2" style={{ color: '#94A3B8' }}>
                Uses {selectedMatterObj?.document_count || 0} uploaded documents as evidence grounding
              </p>
            </div>
          </div>

          {/* ── RIGHT: Output ─────────────────────────────────────── */}
          <div className="xl:col-span-5 card overflow-hidden" style={{ minHeight: 500 }}>
            {!result && status !== 'loading' ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8" style={{ minHeight: 400 }}>
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-5"
                  style={{ background: 'linear-gradient(135deg, #EFF6FF, #E0E7FF)', border: '1px solid #BFDBFE' }}>
                  {selectedTemplate.icon}
                </div>
                <h3 className="text-lg font-black mb-2" style={{ color: '#0F172A' }}>{selectedTemplate.name}</h3>
                <p className="text-sm mb-1" style={{ color: '#64748B' }}>{selectedTemplate.desc}</p>
                <p className="text-xs mt-4 max-w-sm" style={{ color: '#94A3B8' }}>
                  Select a matter, optionally fill in custom fields, then click{' '}
                  <span className="font-bold" style={{ color: '#1E40AF' }}>Generate</span> to produce a
                  real AI-drafted letter grounded in your case documents.
                </p>

                {/* Template structure preview */}
                <div className="mt-6 w-full max-w-sm text-left rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>Letter Structure</div>
                  <ol className="space-y-1.5">
                    {selectedTemplate.id in {
                      demand_letter: true, cease_desist: true, client_update: true,
                      injury_claim: true, real_estate_notice: true, court_filing: true,
                    } && [
                      'Firm Letterhead & Date',
                      'Recipient Address Block',
                      'RE: Matter Reference',
                      'Legal Standing & Purpose',
                      'Factual Basis (from case documents)',
                      'Relief / Demands',
                      'Deadline & Consequences',
                      'Professional Closing',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#64748B' }}>
                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                          style={{ background: '#1E40AF', color: '#fff' }}>
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : status === 'loading' && !result ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 p-8" style={{ minHeight: 400 }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', animation: 'pulse 1.5s ease-in-out infinite' }}>
                  🤖
                </div>
                <div className="text-center">
                  <div className="font-bold text-sm" style={{ color: '#0F172A' }}>AI is drafting your letter</div>
                  <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                    Retrieving case evidence · Grounding in documents · Writing letter
                  </div>
                </div>
                {/* Animated dots */}
                <div className="flex gap-1.5">
                  {[0, 0.2, 0.4].map((d, i) => (
                    <div key={i} className="w-2 h-2 rounded-full" style={{
                      background: '#1E40AF',
                      animation: `pulse 1.2s ease-in-out ${d}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            ) : result ? (
              <LetterPanel result={result} onClear={() => { setResult(null); setStatus('idle'); }} />
            ) : null}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.92); }
        }
      `}</style>
    </Shell>
  );
}
