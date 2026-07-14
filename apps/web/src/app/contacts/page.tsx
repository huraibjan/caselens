'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import Shell from '@/components/layout/Shell';

const CONTACT_ROLES = [
  { value: 'client',             label: 'Client' },
  { value: 'opposing_counsel',   label: 'Opposing Counsel' },
  { value: 'witness',            label: 'Witness' },
  { value: 'expert',             label: 'Expert Witness' },
  { value: 'judge',              label: 'Judge' },
  { value: 'co_counsel',         label: 'Co-Counsel' },
  { value: 'paralegal',          label: 'Paralegal' },
  { value: 'insurance',          label: 'Insurance Rep' },
];

const ROLE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  client:           { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  opposing_counsel: { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  witness:          { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  expert:           { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
  judge:            { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  co_counsel:       { bg: '#F0FDFA', color: '#115E59', border: '#99F6E4' },
  paralegal:        { bg: '#FDF4FF', color: '#7E22CE', border: '#E9D5FF' },
  insurance:        { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' },
};

interface Contact {
  id: string;
  name: string;
  role: string;
  email?: string | null;
  phone?: string | null;
  firm?: string | null;
  notes?: string | null;
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [form, setForm] = useState({ name: '', role: 'client', email: '', phone: '', firm: '', notes: '' });

  const load = async () => {
    try { setContacts(await fetchApi('/api/v1/contacts')); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchApi('/api/v1/contacts', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', role: 'client', email: '', phone: '', firm: '', notes: '' });
      setShowCreate(false);
      await load();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setContacts(cs => cs.filter(c => c.id !== id));
    try { await fetchApi(`/api/v1/contacts/${id}`, { method: 'DELETE' }); } catch (e) { console.error(e); load(); }
  };

  const filtered = contacts.filter(c => {
    if (filterRole !== 'all' && c.role !== filterRole) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !(c.email || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const roleStyle = (role: string) => ROLE_STYLES[role] || ROLE_STYLES.insurance;
  const roleLabel = (role: string) => CONTACT_ROLES.find(r => r.value === role)?.label || role;

  return (
    <Shell>
      <div className="space-y-5 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black" style={{ color: '#0F172A' }}>Contacts</h2>
            <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>Clients, counsel, witnesses, judges and parties across all matters.</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Contact
          </button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="card p-6 animate-fadeIn">
            <h3 className="font-bold mb-4" style={{ color: '#0F172A' }}>New Contact</h3>
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Full Name *</label>
                  <input className="input-base" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="James A. Worthington" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Role *</label>
                  <select className="input-base" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    {CONTACT_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Email</label>
                  <input className="input-base" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="contact@firm.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Phone</label>
                  <input className="input-base" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="(212) 555-0100" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Firm / Organization</label>
                  <input className="input-base" value={form.firm} onChange={e => setForm({...form, firm: e.target.value})} placeholder="Smith & Associates" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Notes</label>
                  <input className="input-base" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Key background, availability, conflict notes…" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving…' : 'Add Contact'}</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="card p-3 flex flex-wrap gap-3 items-center">
          <input className="input-base flex-1 min-w-48" style={{ maxWidth: 280 }} placeholder="🔍  Search contacts…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input-base" style={{ width: 'auto' }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="all">All Roles</option>
            {CONTACT_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total', count: contacts.length, color: '#1E40AF' },
            { label: 'Clients', count: contacts.filter(c => c.role === 'client').length, color: '#1D4ED8' },
            { label: 'Opposing', count: contacts.filter(c => c.role === 'opposing_counsel').length, color: '#DC2626' },
            { label: 'Experts', count: contacts.filter(c => c.role === 'expert').length, color: '#6D28D9' },
          ].map(s => (
            <div key={s.label} className="card p-3 text-center">
              <div className="text-xl font-black" style={{ color: s.color }}>{s.count}</div>
              <div className="text-xs font-medium mt-0.5" style={{ color: '#64748B' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Contact Cards */}
        {loading ? (
          <div className="card p-12 text-center text-sm" style={{ color: '#94A3B8' }}>Loading contacts…</div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="font-semibold" style={{ color: '#475569' }}>{contacts.length === 0 ? 'No contacts yet' : 'No contacts match your filters'}</p>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>{contacts.length === 0 ? 'Add your first contact to get started.' : 'Try adjusting search or role filter.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(contact => {
              const rs = roleStyle(contact.role);
              const initials = contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={contact.id} className="card p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0" style={{ background: rs.bg, color: rs.color, border: `1.5px solid ${rs.border}` }}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm truncate" style={{ color: '#0F172A' }}>{contact.name}</div>
                      {contact.firm && <div className="text-xs truncate" style={{ color: '#64748B' }}>{contact.firm}</div>}
                    </div>
                    <span className="chip shrink-0" style={{ background: rs.bg, color: rs.color, border: `1px solid ${rs.border}`, fontSize: '10.5px' }}>
                      {roleLabel(contact.role)}
                    </span>
                    <button onClick={() => handleDelete(contact.id)} title="Delete contact"
                      className="shrink-0 text-slate-300 hover:text-red-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  {(contact.email || contact.phone) && (
                    <div className="space-y-1 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                      {contact.email && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: '#475569' }}>
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          <a href={`mailto:${contact.email}`} style={{ color: '#1E40AF' }}>{contact.email}</a>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: '#475569' }}>
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          {contact.phone}
                        </div>
                      )}
                    </div>
                  )}
                  {contact.notes && (
                    <p className="text-xs line-clamp-2" style={{ color: '#94A3B8' }}>{contact.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
