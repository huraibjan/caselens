'use client';

/**
 * Case workspace — a single, chat-first surface (Harvey / ChatGPT style).
 *
 * Left: a conversation with the case (opening brief + Q&A, cited).
 * Right: a slim, collapsible "Case Brief" — parties, area of law, key facts,
 * issues (with governing procedure), timeline, citations — as readable prose,
 * no sub-tabs, no navigation maze.
 *
 * Sober palette: white / slate / one navy accent. Key terms are highlighted
 * inline like a lawyer's highlighter. No emoji, no charts, no gauges.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

/* ── Inline keyword highlighting ─────────────────────────────── */
function useHighlighter(terms: string[]) {
  return useMemo(() => {
    const clean = Array.from(new Set(
      terms.filter(t => t && t.trim().length >= 3).map(t => t.trim())
    )).sort((a, b) => b.length - a.length);
    const escaped = clean.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // Also highlight statute/section references and monetary amounts
    const patterns = [
      ...escaped,
      '\\b(?:section|s\\.|art\\.|article|order|rule)\\s+\\d+[A-Za-z-]*',
      '\\$[\\d,]+(?:\\.\\d+)?',
      '\\bRs\\.?\\s?[\\d,]+',
    ];
    if (patterns.length === 0) return null;
    try { return new RegExp(`(${patterns.join('|')})`, 'gi'); }
    catch { return null; }
  }, [terms.join('|')]);
}

function Highlight({ text, re }: { text: string; re: RegExp | null }) {
  if (!text) return null;
  if (!re) return <>{text}</>;
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        re.test(p) && (i % 2 === 1)
          ? <mark key={i} className="rounded px-0.5" style={{ background: 'rgba(202,138,4,0.18)', color: 'inherit' }}>{p}</mark>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

/* ── Types ───────────────────────────────────────────────────── */
interface ChatMsg { role: 'user' | 'assistant'; content: string; citations?: any[]; abstained?: boolean; }

const SUGGESTED = [
  'Summarise the key allegations and their legal basis',
  'What are the strongest arguments for each side?',
  'Which procedure governs the main issue, and what is the next step?',
  'Identify any contradictions or evidentiary gaps',
];

export default function Workspace({ params }: { params: Promise<{ id: string }> }) {
  const [matterId, setMatterId]   = useState('');
  const [matter, setMatter]       = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [messages, setMessages]   = useState<ChatMsg[]>([]);
  const [question, setQuestion]   = useState('');
  const [asking, setAsking]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [briefOpen, setBriefOpen] = useState(true);
  const [popup, setPopup]         = useState<any>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const endRef  = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router  = useRouter();

  useEffect(() => { params.then(p => setMatterId(p.id)); }, [params]);

  const load = async () => {
    if (!matterId) return;
    try {
      const [m, docs] = await Promise.all([
        fetchApi(`/api/v1/matters/${matterId}`),
        fetchApi(`/api/v1/matters/${matterId}/documents`),
      ]);
      setMatter(m);
      const items = docs.items || [];
      setDocuments(items);
      setSelectedId(prev => {
        if (prev && items.some((d: any) => d.id === prev)) return prev;
        const ready = items.find((d: any) => (d.status || '').toLowerCase() === 'ready');
        return (ready || items[0])?.id || '';
      });
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if (matterId) load(); }, [matterId]);

  const selectedDoc = documents.find(d => d.id === selectedId);
  const anyProcessing = documents.some(d => ['processing', 'pending', 'uploading'].includes((d.status || '').toLowerCase()));

  // Poll while any document is still analyzing
  useEffect(() => {
    if (!matterId || !anyProcessing) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [matterId, anyProcessing]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const meta = (selectedDoc?.metadata && Object.keys(selectedDoc.metadata).length)
    ? selectedDoc.metadata : (matter?.metadata || {});
  const parties: any[]  = meta.parties || [];
  const area            = meta.area_of_law || {};
  const facts: any[]    = meta.facts || [];
  const issues: any[]   = meta.issues || [];
  const timeline: any[] = meta.timeline || [];
  const citedIn: any[]  = meta.citations_in_document || [];
  const suggested: any[] = meta.suggested_authorities || [];
  const veracity        = typeof meta.veracityScore === 'number' ? meta.veracityScore : null;
  const hasBrief        = parties.length > 0 || issues.length > 0 || facts.length > 0;

  const highlightTerms = useMemo(() => [
    ...parties.map((p: any) => p.name),
    ...(area.governing_statutes || []),
    ...timeline.map((t: any) => t.date),
    ...citedIn.map((c: any) => c.citation),
  ].filter(Boolean), [meta]);
  const re = useHighlighter(highlightTerms);

  const partyCounts = useMemo(() => {
    const c = { claimant: 0, respondent: 0 };
    parties.forEach((p: any) => {
      const s = (p.side || '').toLowerCase();
      if (s === 'claimant') c.claimant++;
      else if (s === 'respondent') c.respondent++;
    });
    return c;
  }, [parties]);

  const handleAsk = async (q: string) => {
    const query = q.trim();
    if (!query || !matterId || asking) return;
    setQuestion('');
    setMessages(m => [...m, { role: 'user', content: query }]);
    setAsking(true);
    try {
      const resp = await fetchApi(`/api/v1/matters/${matterId}/ask`, {
        method: 'POST', body: JSON.stringify({ question: query }),
      });
      setMessages(m => [...m, { role: 'assistant', content: resp.answer, citations: resp.citations, abstained: resp.abstained }]);
    } catch (err: any) {
      setMessages(m => [...m, { role: 'assistant', content: err.message || 'The AI service is temporarily unavailable. Please try again.' }]);
    } finally { setAsking(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !matterId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', file.name.replace(/\.[^.]+$/, ''));
      await fetchApi(`/api/v1/matters/${matterId}/documents`, { method: 'POST', body: fd });
      await load();
    } catch (err) { console.error(err); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const saveName = async () => {
    const t = nameDraft.trim();
    setEditingName(false);
    if (!t || t === matter?.title) return;
    setMatter((m: any) => ({ ...m, title: t }));
    try { await fetchApi(`/api/v1/matters/${matterId}`, { method: 'PATCH', body: JSON.stringify({ title: t }) }); }
    catch (e) { console.error(e); }
  };

  if (!matter) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="w-7 h-7 rounded-full border-2 border-slate-200 border-t-slate-700 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="shrink-0 h-14 border-b border-slate-200 flex items-center gap-3 px-4 sm:px-5">
        <button onClick={() => router.push('/matters')}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 cursor-pointer shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Matters
        </button>
        <div className="h-5 w-px bg-slate-200 shrink-0" />

        {editingName ? (
          <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
            onBlur={saveName} onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
            className="text-sm font-semibold text-slate-900 border-b border-slate-300 outline-none px-0.5 min-w-0 flex-1 max-w-md" />
        ) : (
          <button onClick={() => { setNameDraft(matter.title); setEditingName(true); }}
            className="group flex items-center gap-1.5 min-w-0 cursor-text" title="Rename matter">
            <span className="text-sm font-semibold text-slate-900 truncate">{matter.title}</span>
            <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto shrink-0">
          {area.primary && (
            <span className="hidden md:inline text-xs font-medium text-slate-500 px-2.5 py-1 rounded-md border border-slate-200">
              {area.primary}{area.procedural_framework ? ` · ${area.procedural_framework}` : ''}
            </span>
          )}
          {veracity != null && (
            <span className="hidden sm:inline text-xs font-medium text-slate-500 px-2.5 py-1 rounded-md border border-slate-200">
              Veracity {veracity}%
            </span>
          )}
          {documents.length > 1 && (
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
              className="text-xs font-medium text-slate-600 border border-slate-200 rounded-md px-2 py-1.5 outline-none max-w-[160px]">
              {documents.map(d => <option key={d.id} value={d.id}>{(d.original_filename || d.title || 'Untitled').slice(0, 32)}</option>)}
            </select>
          )}
          <label className="text-xs font-medium text-slate-600 border border-slate-200 rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-slate-50">
            {uploading ? 'Uploading…' : 'Add file'}
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleUpload} />
          </label>
          <button onClick={() => setBriefOpen(o => !o)}
            className="text-xs font-medium text-slate-600 border border-slate-200 rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-slate-50 hidden lg:block">
            {briefOpen ? 'Hide brief' : 'Show brief'}
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">

        {/* Chat column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">

              {anyProcessing && !hasBrief && (
                <div className="flex items-center gap-3 text-sm text-slate-500 py-8 justify-center">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
                  Reading and analysing the document…
                </div>
              )}

              {/* Opening brief */}
              {selectedDoc?.summary && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Case brief</div>
                  <div className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap">
                    <Highlight text={selectedDoc.summary} re={re} />
                  </div>
                </div>
              )}

              {/* Suggested prompts (only before first message) */}
              {messages.length === 0 && hasBrief && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Ask the case</div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {SUGGESTED.map(s => (
                      <button key={s} onClick={() => handleAsk(s)}
                        className="text-left text-sm text-slate-700 border border-slate-200 rounded-lg px-3.5 py-2.5 hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversation */}
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                  <div className={m.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 text-white px-4 py-2.5 text-sm leading-relaxed'
                    : 'max-w-[92%] text-[15px] leading-relaxed text-slate-800'}>
                    {m.role === 'assistant'
                      ? <div className="whitespace-pre-wrap"><Highlight text={m.content} re={re} /></div>
                      : m.content}
                    {m.role === 'assistant' && m.citations && m.citations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {m.citations.map((c: any, j: number) => (
                          <span key={j} className="text-[11px] text-slate-500 border border-slate-200 rounded-md px-2 py-0.5">
                            {c.document_name || 'Source'} · p.{c.page_number}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.role === 'assistant' && (
                      <div className="mt-2 text-[11px] text-slate-400">AI-generated — verify before relying.</div>
                    )}
                  </div>
                </div>
              ))}

              {asking && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '0.15s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: '0.3s' }} />
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-slate-200 px-5 py-3">
            <form onSubmit={e => { e.preventDefault(); handleAsk(question); }}
              className="max-w-3xl mx-auto flex items-end gap-2">
              <textarea rows={1} value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(question); } }}
                placeholder="Ask about this case…"
                className="flex-1 resize-none max-h-40 px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 leading-relaxed" />
              <button type="submit" disabled={asking || !question.trim()}
                className="shrink-0 h-11 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-30 cursor-pointer hover:bg-slate-800">
                Ask
              </button>
            </form>
          </div>
        </div>

        {/* Brief rail */}
        {briefOpen && (
          <aside className="hidden lg:flex flex-col w-[380px] xl:w-[420px] shrink-0 border-l border-slate-200 overflow-y-auto">
            <div className="p-5 space-y-6">

              {!hasBrief && (
                <div className="text-sm text-slate-400 text-center py-10">
                  {anyProcessing ? 'The case brief fills in as analysis completes…' : 'No analysis yet. Add a file to begin.'}
                </div>
              )}

              {(partyCounts.claimant > 0 || partyCounts.respondent > 0) && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-slate-600 px-2 py-1 rounded-md bg-slate-100">{partyCounts.claimant} claimant{partyCounts.claimant === 1 ? '' : 's'}</span>
                  <span className="text-slate-300">v.</span>
                  <span className="font-medium text-slate-600 px-2 py-1 rounded-md bg-slate-100">{partyCounts.respondent} respondent{partyCounts.respondent === 1 ? '' : 's'}</span>
                </div>
              )}

              <BriefSection label="Parties" show={parties.length > 0}>
                <div className="space-y-2">
                  {parties.map((p: any, i: number) => (
                    <div key={i} className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium text-slate-800">{p.name}</span>
                      <span className="text-[11px] text-slate-500 shrink-0">{p.role}</span>
                    </div>
                  ))}
                </div>
              </BriefSection>

              <BriefSection label="Area of law" show={!!area.primary}>
                <p className="text-sm text-slate-700">{area.primary}</p>
                {area.procedural_framework && <p className="text-[13px] text-slate-500 mt-0.5">{area.procedural_framework}</p>}
                {area.governing_statutes?.length > 0 && (
                  <p className="text-[13px] text-slate-500 mt-1"><Highlight text={area.governing_statutes.join(' · ')} re={re} /></p>
                )}
              </BriefSection>

              <BriefSection label="Key facts" show={facts.length > 0}>
                <ul className="space-y-2">
                  {facts.map((f: any, i: number) => (
                    <li key={i} className="text-[13px] text-slate-700 leading-relaxed flex gap-2">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        (f.status || '').toLowerCase() === 'disputed' ? 'bg-red-400'
                        : (f.status || '').toLowerCase() === 'supported' ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                      <span><Highlight text={f.fact} re={re} /></span>
                    </li>
                  ))}
                </ul>
              </BriefSection>

              <BriefSection label="Issues & procedure" show={issues.length > 0}>
                <div className="space-y-3">
                  {issues.map((it: any, i: number) => (
                    <div key={i}>
                      <div className="text-[13px] font-medium text-slate-800">{it.issue}</div>
                      {it.procedure && <div className="text-[12px] text-slate-500 mt-0.5"><Highlight text={it.procedure} re={re} /></div>}
                    </div>
                  ))}
                </div>
              </BriefSection>

              <BriefSection label="Timeline" show={timeline.length > 0}>
                <div className="space-y-1.5">
                  {timeline.map((ev: any, i: number) => (
                    <button key={i} onClick={() => setPopup(ev)}
                      className="w-full text-left flex gap-3 items-baseline hover:bg-slate-50 rounded-md px-1.5 py-1 -mx-1.5 cursor-pointer">
                      <span className="text-[11px] font-medium text-slate-400 shrink-0 w-20">{ev.date}</span>
                      <span className="text-[13px] text-slate-700 truncate">{ev.title}</span>
                    </button>
                  ))}
                </div>
              </BriefSection>

              <BriefSection label="Citations" show={citedIn.length + suggested.length > 0}>
                {citedIn.map((c: any, i: number) => (
                  <div key={`c${i}`} className="text-[13px] text-slate-700 mb-1.5">{c.citation}{c.principle ? ` — ${c.principle}` : ''}</div>
                ))}
                {suggested.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <div className="text-[11px] text-amber-700 mb-1.5">AI-suggested — verify before relying</div>
                    {suggested.map((c: any, i: number) => (
                      <div key={`s${i}`} className="text-[13px] text-slate-600 mb-1.5">{c.citation}{c.principle ? ` — ${c.principle}` : ''}</div>
                    ))}
                  </div>
                )}
              </BriefSection>
            </div>
          </aside>
        )}
      </div>

      {/* Timeline popup */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          onClick={() => setPopup(null)} style={{ background: 'rgba(15,23,42,0.4)' }}>
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">{popup.date}</div>
            <h3 className="text-base font-semibold text-slate-900 mt-1">{popup.title}</h3>
            {popup.description && <p className="text-sm text-slate-700 leading-relaxed mt-3">{popup.description}</p>}
            {Array.isArray(popup.actors) && popup.actors.length > 0 && (
              <p className="text-[13px] text-slate-500 mt-2">Involved: {popup.actors.join(', ')}</p>
            )}
            {popup.period_note && (
              <div className="mt-3 text-[13px]"><span className="text-slate-400">After this, until the next event: </span><span className="text-slate-700">{popup.period_note}</span></div>
            )}
            <button onClick={() => setPopup(null)} className="mt-4 text-sm font-medium text-slate-500 hover:text-slate-900 cursor-pointer">Close</button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function BriefSection({ label, show, children }: { label: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2.5">{label}</div>
      {children}
    </div>
  );
}
