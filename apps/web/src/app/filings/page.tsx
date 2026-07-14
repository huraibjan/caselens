'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
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
  type: string;              // filing_type
  matter: string;            // matter_title for display
  matter_id?: string | null;
  status: 'filed' | 'pending' | 'overdue' | 'draft';
  filed_at?: string | null;
  due_at?: string | null;
  notes?: string | null;
}

// Derive a display status: a pending filing past its due date reads as "overdue".
function displayStatus(f: Filing): Filing['status'] {
  if (f.status === 'pending' && f.due_at) {
    const due = new Date(f.due_at);
    if (due < new Date()) return 'overdue';
  }
  return f.status;
}

export default function Filings() {
  const [filings, setFilings] = useState<Filing[]>([]);
  const [matters, setMatters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', type: FILING_TYPES[0], matter_id: '', status: 'draft' as Filing['status'], due_at: '', notes: '' });

  const load = async () => {
    try {
      const [fs, ms] = await Promise.all([
        fetchApi('/api/v1/filings'),
        fetchApi('/api/v1/matters').then(r => r.items || []).catch(() => []),
      ]);
      setFilings((fs || []).map((f: any) => ({
        id: f.id, title: f.title, type: f.filing_type, status: f.status,
        matter: f.matter_title || '', matter_id: f.matter_id,
        filed_at: f.filed_at ? f.filed_at.slice(0, 10) : null,
        due_at: f.due_at ? f.due_at.slice(0, 10) : null, notes: f.notes,
      })));
      setMatters(ms);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchApi('/api/v1/filings', { method: 'POST', body: JSON.stringify({
        title: form.title, filing_type: form.type, status: form.status,
        matter_id: form.matter_id || null, notes: form.notes || null,
        due_at: form.due_at ? new Date(form.due_at + 'T00:00:00').toISOString() : null,
        filed_at: form.status === 'filed' && form.due_at ? new Date(form.due_at + 'T00:00:00').toISOString() : null,
      }) });
      setForm({ title: '', type: FILING_TYPES[0], matter_id: '', status: 'draft', due_at: '', notes: '' });
      setShowCreate(false);
      await load();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setFilings(fs => fs.filter(f => f.id !== id));
    try { await fetchApi(`/api/v1/filings/${id}`, { method: 'DELETE' }); } catch (e) { console.error(e); load(); }
  };

  const filtered = filings.filter(f => {
    if (filterStatus !== 'all' && displayStatus(f) !== filterStatus) return false;
    if (search && !f.title.toLowerCase().includes(search.toLowerCase()) && !f.matter.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    total: filings.length,
    filed: filings.filter(f => displayStatus(f) === 'filed').length,
    pending: filings.filter(f => displayStatus(f) === 'pending').length,
    overdue: filings.filter(f => displayStatus(f) === 'overdue').length,
  };

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
                  <select className="input-base" value={form.matter_id} onChange={e => setForm({...form, matter_id: e.target.value})}>
                    <option value="">— None —</option>
                    {matters.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
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
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving…' : 'Save Filing'}</button>
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
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10" style={{ color: '#94A3B8' }}>Loading filings…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10" style={{ color: '#94A3B8' }}>{filings.length === 0 ? 'No filings yet — add a motion, pleading, or exhibit.' : 'No filings match your filters.'}</td></tr>
              ) : (
                filtered.map(f => {
                  const ds = displayStatus(f);
                  const ss = STATUS_STYLES[ds];
                  const date = ds === 'filed' ? f.filed_at : f.due_at;
                  return (
                    <tr key={f.id}>
                      <td>
                        <div className="font-semibold" style={{ color: '#0F172A' }}>{f.title}</div>
                        {f.notes && <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{f.notes}</div>}
                      </td>
                      <td className="text-sm" style={{ color: '#475569' }}>{f.type}</td>
                      <td className="text-sm font-medium" style={{ color: '#1E40AF' }}>{f.matter || '—'}</td>
                      <td className="text-sm" style={{ color: '#475569' }}>{date || '—'}</td>
                      <td>
                        <div className="flex items-center justify-between gap-2">
                          <span className="chip capitalize" style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`, fontSize: '11px' }}>{ds}</span>
                          <button onClick={() => handleDelete(f.id)} title="Delete filing" className="text-slate-300 hover:text-red-500 shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
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
