'use client';

/**
 * Document Viewer — MS-Word-style reader (left) + AI analysis rail (right).
 *
 * Right-side tabs: Facts Check · Issues & Procedure · Parties · Timeline ·
 * Citations · Summary. Every list item expands into a detail panel; timeline
 * entries open a popup with the full event story (who / role / what happened
 * in the period until the next event).
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';

/* ── Types matching the deep-analysis schema ─────────────────── */
interface Party    { name: string; role: string; side: string; description: string; }
interface AreaOfLaw {
  primary?: string; sub_areas?: string[]; governing_statutes?: string[];
  procedural_framework?: string; jurisdiction?: string; reasoning?: string;
}
interface Fact     { fact: string; source: string; status: string; note?: string; }
interface Issue    {
  issue: string; category?: string; procedure?: string;
  statutory_basis?: string; stage?: string; recommended_action?: string;
}
interface TimelineEvent {
  date: string; title: string; description?: string;
  actors?: string[]; period_note?: string; significance?: string;
}
interface CitationFound     { citation: string; court?: string; principle?: string; context?: string; }
interface SuggestedAuthority { citation: string; court?: string; principle?: string; relevance?: string; }
interface PageContent { page_number: number; text_content: string | null; }

type TabKey = 'summary' | 'facts' | 'issues' | 'parties' | 'timeline' | 'citations';

const FACT_STATUS: Record<string, string> = {
  supported:  'bg-green-50 text-green-800 border-green-200',
  disputed:   'bg-red-50 text-red-800 border-red-200',
  unverified: 'bg-amber-50 text-amber-800 border-amber-200',
};

const SIDE_STYLE: Record<string, string> = {
  claimant:   'bg-blue-50 text-blue-800 border-blue-200',
  respondent: 'bg-rose-50 text-rose-800 border-rose-200',
  neutral:    'bg-slate-50 text-slate-700 border-slate-200',
};

/** Roles that count toward the claimant/respondent header badges. */
const CLAIMANT_ROLES = ['plaintiff', 'petitioner', 'applicant', 'appellant', 'complainant', 'decree holder'];
const RESPONDENT_ROLES = ['defendant', 'respondent', 'opponent', 'accused', 'judgment debtor', 'objector'];

function roleBucket(p: Party): 'claimant' | 'respondent' | 'other' {
  const r = (p.role || '').toLowerCase();
  if (CLAIMANT_ROLES.some(x => r.includes(x))) return 'claimant';
  if (RESPONDENT_ROLES.some(x => r.includes(x))) return 'respondent';
  return 'other';
}

/* ── Expandable detail card ──────────────────────────────────── */
function DetailCard({ title, badge, badgeClass, children, defaultOpen = false }: {
  title: string; badge?: string; badgeClass?: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden transition-shadow hover:shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
      >
        <span className="text-sm font-semibold text-slate-800 leading-snug">{title}</span>
        <span className="flex items-center gap-2 shrink-0">
          {badge && (
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${badgeClass || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              {badge}
            </span>
          )}
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-slate-100">{children}</div>}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="mt-2.5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className="text-sm text-slate-700 mt-0.5 leading-relaxed">{value}</div>
    </div>
  );
}

/* ── Timeline event popup ────────────────────────────────────── */
function TimelinePopup({ ev, onClose }: { ev: TimelineEvent; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-blue-700">{ev.date}</div>
            <h3 className="text-lg font-black text-slate-900 mt-1">{ev.title}</h3>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {ev.description && <p className="text-sm text-slate-700 leading-relaxed mt-3">{ev.description}</p>}
        {ev.actors && ev.actors.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ev.actors.map(a => (
              <span key={a} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">👤 {a}</span>
            ))}
          </div>
        )}
        <Field label="What happened after this (until the next event)" value={ev.period_note} />
        <Field label="Significance" value={ev.significance} />
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────── */
export default function DocumentViewer({ params }: { params: Promise<{ id: string; docId: string }> }) {
  const [matterId, setMatterId] = useState('');
  const [docId, setDocId]       = useState('');
  const [doc, setDoc]           = useState<any>(null);
  const [pages, setPages]       = useState<PageContent[]>([]);
  const [tab, setTab]           = useState<TabKey>('summary');
  const [popupEvent, setPopupEvent] = useState<TimelineEvent | null>(null);
  const [loading, setLoading]   = useState(true);
  const router = useRouter();

  useEffect(() => { params.then(p => { setMatterId(p.id); setDocId(p.docId); }); }, [params]);

  const loadAll = async (id: string) => {
    try {
      const [d, pg] = await Promise.all([
        fetchApi(`/api/v1/documents/${id}`),
        fetchApi(`/api/v1/documents/${id}/pages`).catch(() => ({ pages: [] })),
      ]);
      setDoc(d);
      setPages(pg.pages || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (docId) loadAll(docId); }, [docId]);

  // Poll while the document is still being analyzed
  useEffect(() => {
    if (!docId || !doc) return;
    const st = (doc.status || '').toLowerCase();
    if (st === 'processing' || st === 'pending' || st === 'uploading') {
      const t = setInterval(() => loadAll(docId), 3000);
      return () => clearInterval(t);
    }
  }, [docId, doc?.status]);

  const meta = doc?.metadata || {};
  const parties: Party[]            = meta.parties || [];
  const areaOfLaw: AreaOfLaw        = meta.area_of_law || {};
  const facts: Fact[]               = meta.facts || [];
  const issues: Issue[]             = meta.issues || [];
  const timeline: TimelineEvent[]   = meta.timeline || [];
  const citationsFound: CitationFound[]      = meta.citations_in_document || [];
  const suggested: SuggestedAuthority[]      = meta.suggested_authorities || [];
  const hasDeep = !!meta.analysis_version && meta.analysis_version >= 2;
  const isProcessing = ['processing', 'pending', 'uploading'].includes((doc?.status || '').toLowerCase());

  const counts = useMemo(() => {
    const c = { claimant: 0, respondent: 0, other: 0 };
    parties.forEach(p => { c[roleBucket(p)] += 1; });
    return c;
  }, [parties]);

  const TABS: { key: TabKey; label: string; icon: string; count?: number }[] = [
    { key: 'summary',   label: 'Summary',            icon: '📝' },
    { key: 'facts',     label: 'Facts Check',        icon: '✅', count: facts.length },
    { key: 'issues',    label: 'Issues & Procedure', icon: '⚖️', count: issues.length },
    { key: 'parties',   label: 'Parties',            icon: '👥', count: parties.length },
    { key: 'timeline',  label: 'Timeline',           icon: '🕐', count: timeline.length },
    { key: 'citations', label: 'Citations',          icon: '📚', count: citationsFound.length + suggested.length },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-200 border-t-blue-700 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-4 flex-wrap">
        <button type="button" onClick={() => router.push(`/matters/${matterId}/workspace`)}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Workspace
        </button>
        <div className="h-5 w-px bg-slate-200" />
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-900 truncate">{doc?.title || 'Document'}</div>
          <div className="text-[11px] text-slate-400">{doc?.page_count || pages.length} pages · {(doc?.status || '').toUpperCase()}</div>
        </div>

        {/* Party counts + area of law */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {parties.length > 0 && (
            <>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                {counts.claimant} Claimant{counts.claimant === 1 ? '' : 's'}
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                {counts.respondent} Respondent{counts.respondent === 1 ? '' : 's'}
              </span>
            </>
          )}
          {areaOfLaw.primary && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
              ⚖️ {areaOfLaw.primary}{areaOfLaw.procedural_framework ? ` · ${areaOfLaw.procedural_framework}` : ''}
            </span>
          )}
        </div>
      </header>

      {/* ── Split view ──────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">

        {/* Left: document reader */}
        <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
          <div className="max-w-3xl mx-auto space-y-6">
            {pages.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-400">
                {isProcessing ? 'Extracting document text…' : 'No extracted text available for this document.'}
              </div>
            )}
            {pages.map(p => (
              <div key={p.page_number} className="bg-white rounded-sm shadow-md border border-slate-200 px-10 py-9 lg:px-14 lg:py-12">
                <pre className="whitespace-pre-wrap text-[13.5px] leading-[1.75] text-slate-800"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                  {p.text_content || ' '}
                </pre>
                <div className="mt-8 pt-3 border-t border-slate-100 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Page {p.page_number}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: analysis rail */}
        <div className="w-[430px] xl:w-[480px] shrink-0 border-l border-slate-200 bg-white flex flex-col min-h-0">
          {/* Tabs */}
          <div className="shrink-0 flex items-center gap-1 px-3 pt-3 pb-2 border-b border-slate-100 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  tab === t.key ? 'bg-blue-700 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}>
                <span>{t.icon}</span>{t.label}
                {typeof t.count === 'number' && t.count > 0 && (
                  <span className={`text-[10px] px-1.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-slate-200 text-slate-600'}`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">

            {/* Analyzing / no-deep-data state */}
            {isProcessing && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <div className="w-4 h-4 rounded-full border-2 border-blue-300 border-t-blue-700 animate-spin shrink-0" />
                <div className="text-sm font-semibold text-blue-900">AI analysis in progress — this panel fills in automatically.</div>
              </div>
            )}
            {!isProcessing && !hasDeep && tab !== 'summary' && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                Deep analysis hasn&apos;t run for this document yet. Re-run analysis from the workspace to populate
                parties, facts, issues, timeline, and citations.
              </div>
            )}

            {tab === 'summary' && (
              <>
                {areaOfLaw.primary && (
                  <DetailCard title={`Area of Law: ${areaOfLaw.primary}`} badge={areaOfLaw.jurisdiction || 'jurisdiction'} defaultOpen>
                    {areaOfLaw.sub_areas && areaOfLaw.sub_areas.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {areaOfLaw.sub_areas.map(s => (
                          <span key={s} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">{s}</span>
                        ))}
                      </div>
                    )}
                    <Field label="Procedural framework" value={areaOfLaw.procedural_framework} />
                    <Field label="Governing statutes" value={areaOfLaw.governing_statutes?.join(' · ')} />
                    <Field label="Why this classification" value={areaOfLaw.reasoning} />
                  </DetailCard>
                )}
                <div className="border border-slate-200 rounded-xl bg-white p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">AI Summary</div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {doc?.summary || 'No summary generated yet.'}
                  </p>
                </div>
              </>
            )}

            {tab === 'facts' && (
              facts.length === 0
                ? <EmptyTab label="No facts extracted." />
                : facts.map((f, i) => (
                  <DetailCard key={i} title={f.fact} badge={f.status} badgeClass={FACT_STATUS[(f.status || '').toLowerCase()]}>
                    <Field label="Source in document" value={f.source} />
                    <Field label="Note" value={f.note} />
                  </DetailCard>
                ))
            )}

            {tab === 'issues' && (
              issues.length === 0
                ? <EmptyTab label="No issues extracted." />
                : issues.map((it, i) => (
                  <DetailCard key={i} title={it.issue} badge={it.category || 'issue'}>
                    <Field label="Procedure (how this issue is dealt with)" value={it.procedure} />
                    <Field label="Statutory basis" value={it.statutory_basis} />
                    <Field label="Current stage" value={it.stage} />
                    <Field label="Recommended action" value={it.recommended_action} />
                  </DetailCard>
                ))
            )}

            {tab === 'parties' && (
              parties.length === 0
                ? <EmptyTab label="No parties extracted." />
                : (['claimant', 'respondent', 'other'] as const).map(bucket => {
                  const list = parties.filter(p => roleBucket(p) === bucket);
                  if (list.length === 0) return null;
                  return (
                    <div key={bucket}>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 mt-1">
                        {bucket === 'claimant' ? 'Claimant side' : bucket === 'respondent' ? 'Respondent side' : 'Other participants'} ({list.length})
                      </div>
                      <div className="space-y-2.5">
                        {list.map((p, i) => (
                          <DetailCard key={i} title={p.name} badge={p.role} badgeClass={SIDE_STYLE[(p.side || '').toLowerCase()]}>
                            <Field label="Legal role" value={p.role} />
                            <Field label="Description" value={p.description} />
                          </DetailCard>
                        ))}
                      </div>
                    </div>
                  );
                })
            )}

            {tab === 'timeline' && (
              timeline.length === 0
                ? <EmptyTab label="No dated events extracted." />
                : (
                  <div className="relative pl-5">
                    <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-200" />
                    <div className="space-y-3">
                      {timeline.map((ev, i) => (
                        <button key={i} type="button" onClick={() => setPopupEvent(ev)}
                          className="relative w-full text-left cursor-pointer group">
                          <span className="absolute -left-5 top-2 w-[15px] h-[15px] rounded-full bg-white border-[3px] border-blue-600 group-hover:scale-110 transition-transform" />
                          <div className="border border-slate-200 rounded-xl bg-white px-4 py-3 group-hover:border-blue-300 group-hover:shadow-sm transition-all">
                            <div className="text-[11px] font-black text-blue-700">{ev.date}</div>
                            <div className="text-sm font-semibold text-slate-800 mt-0.5">{ev.title}</div>
                            {ev.actors && ev.actors.length > 0 && (
                              <div className="text-[11px] text-slate-400 mt-1 truncate">👤 {ev.actors.join(', ')}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
            )}

            {tab === 'citations' && (
              <>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Cited in this document ({citationsFound.length})</div>
                {citationsFound.length === 0 && <EmptyTab label="No citations found in the document." />}
                {citationsFound.map((c, i) => (
                  <DetailCard key={`f${i}`} title={c.citation} badge={c.court || 'cited'}>
                    <Field label="Principle" value={c.principle} />
                    <Field label="Context in document" value={c.context} />
                  </DetailCard>
                ))}

                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 mt-4">AI-suggested authorities ({suggested.length})</div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] leading-relaxed text-amber-900 font-medium">
                  ⚠️ These authorities are AI-suggested from model knowledge, not a verified legal database.
                  Always verify citation, parties, and holding in an official reporter before relying on them.
                </div>
                {suggested.map((c, i) => (
                  <DetailCard key={`s${i}`} title={c.citation} badge="verify before relying" badgeClass="bg-amber-50 text-amber-800 border-amber-300">
                    <Field label="Court" value={c.court} />
                    <Field label="Principle" value={c.principle} />
                    <Field label="Why it may be relevant" value={c.relevance} />
                  </DetailCard>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {popupEvent && <TimelinePopup ev={popupEvent} onClose={() => setPopupEvent(null)} />}
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
      {label}
    </div>
  );
}
