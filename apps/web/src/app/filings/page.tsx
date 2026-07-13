'use client';

import { useState } from 'react';
import Shell from '@/components/layout/Shell';

const FILING_TYPES = [
  'Complaint / Petition',
  'Answer / Response',
  'Motion to Dismiss',
  'Motion for Summary Judgment',
  'Discovery Request',
  'Subpoena',
  'Notice of Appeal',
  'Exhibit Filing',
  'Court Order',
  'Consent Decree',
  'Settlement Agreement',
  'Plea Agreement',
];

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  filed:   { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  pending: { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  overdue: { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  draft:   { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' },
};

interface Filing {
  id: string;
  title: string;
  type: string;
  matter: string;
  status: 'filed' | 'pending' | 'overdue' | 'draft';
  filed_at?: string;
  due_at?: string;
  notes?: string;
}

const DEMO_FILINGS: Filing[] = [
  { id: '1', title: 'Motion to Suppress Weapon Evidence', type: 'Motion to Dismiss', matter: 'People v. Johnson', status: 'filed', filed_at: '2026-06-28', due_at: '2026-06-28' },
  { id: '2', title: 'Answer to Amended Complaint', type: 'Answer / Response', matter: 'Smith Lease Dispute', status: 'pending', due_at: '2026-07-15' },
  { id: '3', title: 'Exhibit Bundle A — Medical Records', type: 'Exhibit Filing', matter: 'Smith v. Allstate', status: 'filed', filed_at: '2026-07-01', due_at: '2026-07-01' },
  { id: '4', title: 'Notice of Appeal', type: 'Notice of Appeal', matter: 'Rivera Real Estate', status: 'overdue', due_at: '2026-07-08' },
  { id: '5', title: 'Plea Agreement Draft', type: 'Plea Agreement', matter: 'People v. Johnson', status: 'draft' },
];

export default function Filings() {
  const [filings, setFilings] = useState<Filing[]>(DEMO_FILINGS);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', type: FILING_TYPES[0], matter: '', status: 'draft' as Filing['status'], due_at: '', notes: '' });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFilings([{ ...form, id: Date.now().toString() }, ...filings]);
    setForm({ title: '', type: FILING_TYPES[0], matter: '', status: 'draft', due_at: '', notes: '' });
    setShowCreate(false);
  };

  const filtered = filings.filter(f => {
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    if (search && !f.title.toLowerCase().includes(search.toLowerCase()) && !f.matter.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = { total: filings.length, filed: filings.filter(f => f.status === 'filed').length, pending: filings.filter(f => f.status === 'pending').length, overdue: filings.filter(f => f.status === 'overdue').length };

  return (
    <Shell>
      <div className="space-y-5 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black" style={{ color: '#0F172A' }}>Court Filings</h2>
            <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>Track motions, pleadings, exhibits, and court documents across all matters.</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Filing
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Filings', value: counts.total, color: '#1E40AF' },
            { label: 'Filed', value: counts.filed, color: '#059669' },
            { label: 'Pending', value: counts.pending, color: '#D97706' },
            { label: 'Overdue', value: counts.overdue, color: '#DC2626' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs font-medium mt-1" style={{ color: '#64748B' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="card p-6 animate-fadeIn">
            <h3 className="font-bold mb-4" style={{ color: '#0F172A' }}>New Filing</h3>
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Filing Title *</label>
                  <input className="input-base" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Motion to Suppress Evidence" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Filing Type</label>
                  <select className="input-base" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                    {FILING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Matter</label>
                  <input className="input-base" value={form.matter} onChange={e => setForm({...form, matter: e.target.value})} placeholder="People v. Johnson" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Status</label>
                  <select className="input-base" value={form.status} onChange={e => setForm({...form, status: e.target.value as Filing['status']})}>
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="filed">Filed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Due / Filed Date</label>
                  <input className="input-base" type="date" value={form.due_at} onChange={e => setForm({...form, due_at: e.target.value})} />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Notes</label>
                  <input className="input-base" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Key details, referenced exhibits, opposing counsel response…" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary">Save Filing</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="card p-3 flex flex-wrap gap-3 items-center">
          <input className="input-base flex-1 min-w-48" style={{ maxWidth: 280 }} placeholder="🔍  Search filings…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex gap-2 flex-wrap">
            {['all', 'filed', 'pending', 'overdue', 'draft'].map(s => {
              const ss = STATUS_STYLES[s] || { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' };
              return (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all capitalize"
                  style={{ background: filterStatus === s ? (s === 'all' ? '#1E40AF' : ss.color) : ss.bg, color: filterStatus === s ? '#fff' : ss.color, border: `1px solid ${ss.border}` }}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filing Table */}
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Filing</th>
                <th>Type</th>
                <th>Matter</th>
                <th>Due / Filed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10" style={{ color: '#94A3B8' }}>No filings found.</td></tr>
              ) : (
                filtered.map(f => {
                  const ss = STATUS_STYLES[f.status];
                  const date = f.status === 'filed' ? f.filed_at : f.due_at;
                  return (
                    <tr key={f.id}>
                      <td>
                        <div className="font-semibold" style={{ color: '#0F172A' }}>{f.title}</div>
                        {f.notes && <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{f.notes}</div>}
                      </td>
                      <td className="text-sm" style={{ color: '#475569' }}>{f.type}</td>
                      <td className="text-sm font-medium" style={{ color: '#1E40AF' }}>{f.matter}</td>
                      <td className="text-sm" style={{ color: '#475569' }}>{date || '—'}</td>
                      <td>
                        <span className="chip capitalize" style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, fontSize: '11px' }}>
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
