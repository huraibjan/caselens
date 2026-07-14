'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import Shell from '@/components/layout/Shell';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  ready:      { label: 'Ready',      cls: 'bg-green-50 text-green-700 border border-green-200' },
  READY:      { label: 'Ready',      cls: 'bg-green-50 text-green-700 border border-green-200' },
  PENDING:    { label: 'Pending',    cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  PROCESSING: { label: 'Processing', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  ERROR:      { label: 'Error',      cls: 'bg-red-50 text-red-700 border border-red-200' },
};

const AREA_MAP: Record<string, { label: string; cls: string }> = {
  criminal:    { label: 'Criminal Law',     cls: 'badge-criminal' },
  realestate:  { label: 'Real Estate',      cls: 'badge-realestate' },
  injury:      { label: 'Personal Injury',  cls: 'badge-injury' },
  corporate:   { label: 'Corporate',        cls: 'badge-corporate' },
  family:      { label: 'Family Law',       cls: 'badge-family' },
  immigration: { label: 'Immigration',      cls: 'badge-immigration' },
};

export default function MatterDashboard({ params }: { params: Promise<{ id: string }> }) {
  const [matterId, setMatterId]   = useState<string | null>(null);
  const [matter, setMatter]       = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [error, setError]         = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => { params.then(p => setMatterId(p.id)); }, [params]);

  const loadData = async () => {
    if (!matterId) return;
    try {
      const [matterData, docsData] = await Promise.all([
        fetchApi(`/api/v1/matters/${matterId}`),
        fetchApi(`/api/v1/matters/${matterId}/documents`),
      ]);
      setMatter(matterData);
      setDocuments(docsData.items || []);
    } catch (err) {
      console.error('Failed to load matter', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (matterId) loadData(); }, [matterId]);

  const uploadFile = async (file: File) => {
    if (!matterId) return;
    setError('');
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const created = await fetchApi(`/api/v1/matters/${matterId}/documents`, { method: 'POST', body: formData });
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadData();
      // Auto-open the document viewer once AI analysis completes
      if (created?.id) watchAndOpen(created.id);
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  /** Poll the freshly uploaded document; when analysis is READY, open the viewer. */
  const watchAndOpen = (docId: string) => {
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
          await loadData();
        }
      } catch { /* transient — keep polling */ }
    }, 3000);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) uploadFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  if (loading || !matter) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 rounded-full border-2 border-blue-200 border-t-blue-600 mx-auto"
              style={{ animation: 'spin 0.9s linear infinite' }} />
            <p className="text-sm text-slate-500">Loading matter details…</p>
          </div>
        </div>
      </Shell>
    );
  }

  const area    = matter.metadata?.practice_area || 'criminal';
  const areaInfo = AREA_MAP[area] || AREA_MAP.criminal;
  const score   = matter.metadata?.veracityScore;
  const suspect = matter.metadata?.suspect;
  const verdict = matter.metadata?.judgment?.overall_verdict;
  const allegations = matter.metadata?.allegations || [];
  const scoreColor = score != null ? (score >= 70 ? '#059669' : score >= 40 ? '#D97706' : '#DC2626') : '#94A3B8';

  return (
    <Shell>
      <div className="space-y-6 animate-fadeIn">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5"
          style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`chip ${areaInfo.cls}`}>{areaInfo.label}</span>
              <span className="chip bg-slate-100 text-slate-600 border border-slate-200">
                {matter.status}
              </span>
              {matter.matter_number && (
                <span className="text-xs font-medium text-slate-500">No: {matter.matter_number}</span>
              )}
              {verdict && (
                <span className={`chip verdict-${verdict.toLowerCase()}`}>
                  {verdict}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{matter.title}</h2>
            {matter.description && (
              <p className="text-sm text-slate-500 max-w-2xl">{matter.description}</p>
            )}
          </div>

          <Link
            href={`/matters/${matterId}/workspace`}
            className="btn-primary shrink-0 self-start"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Open Case Workspace
          </Link>
        </div>

        {/* ── AI Intelligence Cards (if analyzed) ─────────────── */}
        {matter.metadata && Object.keys(matter.metadata).length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Veracity Score', value: score != null ? `${score}%` : 'N/A', color: scoreColor, icon: '🧠' },
              { label: 'Defendant',      value: suspect || 'Unknown',                  color: '#1E40AF', icon: '👤' },
              { label: 'Practice Area',  value: areaInfo.label,                        color: '#6366F1', icon: '⚖️' },
              { label: 'Allegations',    value: allegations.length || 0,               color: '#D97706', icon: '📋' },
            ].map(kpi => (
              <div key={kpi.label} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{kpi.label}</span>
                  <span className="text-base">{kpi.icon}</span>
                </div>
                <div className="text-xl font-black" style={{ color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl text-sm font-medium bg-red-50 text-red-800 border border-red-200">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* ── Main Grid ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Document Library */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Document Library</h3>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {documents.length} file{documents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="card p-10 text-center">
                <div className="text-4xl mb-3">📂</div>
                <p className="font-semibold text-slate-700">No documents uploaded yet</p>
                <p className="text-sm text-slate-400 mt-1">Upload discovery files or legal documents to begin AI analysis.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => {
                  const st = STATUS_MAP[doc.status] || STATUS_MAP['PENDING'];
                  const sizeMB = doc.file_size_bytes ? (doc.file_size_bytes / 1024 / 1024).toFixed(2) : null;
                  const fname = doc.original_filename || doc.title || 'Untitled Document';
                  return (
                    <div key={doc.id}
                      className="card p-4 flex items-center gap-4 card-hover"
                      onClick={() => router.push(`/matters/${matterId}/documents/${doc.id}`)}
                    >
                      {/* File icon */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                        📄
                      </div>

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 text-sm truncate">{fname}</div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {sizeMB && (
                            <span className="text-xs text-slate-500">{sizeMB} MB</span>
                          )}
                          {doc.page_count && (
                            <span className="text-xs text-slate-500">{doc.page_count} page{doc.page_count !== 1 ? 's' : ''}</span>
                          )}
                          <span className="text-xs text-slate-400">
                            {doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                          </span>
                        </div>
                      </div>

                      {/* Status + action */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`chip text-xs ${st.cls} ${doc.status === 'PROCESSING' ? 'animate-pulse' : ''}`}>
                          {st.label}
                        </span>
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Allegations section */}
            {allegations.length > 0 && (
              <div className="card p-5 mt-4">
                <h4 className="text-sm font-bold text-slate-900 mb-3">AI-Extracted Allegations</h4>
                <div className="space-y-2">
                  {allegations.map((a: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                      style={{ background: a.status === 'verified' ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${a.status === 'verified' ? '#BBF7D0' : '#FDE68A'}` }}>
                      <span className="text-sm shrink-0">{a.status === 'verified' ? '✓' : '?'}</span>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{a.claim}</div>
                        {a.desc && <div className="text-xs text-slate-500 mt-0.5">{a.desc}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Upload + Quick links */}
          <div className="space-y-5">
            <h3 className="text-base font-bold text-slate-900">Upload Discovery Files</h3>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInput}
              accept=".pdf,.docx,.txt"
              className="hidden"
            />

            {/* Drop Zone */}
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className="card p-8 text-center cursor-pointer transition-all duration-200"
              style={{
                borderStyle: 'dashed',
                borderWidth: 2,
                borderColor: dragOver ? '#3B82F6' : uploading ? '#93C5FD' : '#CBD5E1',
                background: dragOver ? '#EFF6FF' : uploading ? '#F8FAFC' : '#FAFBFC',
                cursor: uploading ? 'not-allowed' : 'pointer',
              }}
            >
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
                {uploading ? (
                  <div className="w-6 h-6 rounded-full border-2 border-blue-200 border-t-blue-600"
                    style={{ animation: 'spin 0.9s linear infinite' }} />
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )}
              </div>
              <p className="font-semibold text-slate-700 text-sm">
                {uploading ? 'Uploading…' : dragOver ? 'Drop file to upload' : 'Click or drag to upload'}
              </p>
              <p className="text-xs text-slate-400 mt-1">PDF, DOCX, TXT · Max 100MB</p>
            </div>

            {/* Quick actions */}
            <div className="card p-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Quick Actions</div>
              {[
                { icon: '🔍', label: 'Open AI Workspace', sub: 'Chat, analyze, cite documents', href: `/matters/${matterId}/workspace` },
                { icon: '📝', label: 'Generate Letter', sub: 'AI-drafted from case data', href: '/templates' },
                { icon: '📊', label: 'View Analytics', sub: 'Score distribution & trends', href: '/analytics' },
              ].map(a => (
                <Link key={a.label} href={a.href}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                  style={{ textDecoration: 'none' }}>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-base shrink-0">{a.icon}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{a.label}</div>
                    <div className="text-xs text-slate-400">{a.sub}</div>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Shell>
  );
}
