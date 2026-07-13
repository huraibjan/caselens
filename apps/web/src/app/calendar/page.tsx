'use client';

import { useState } from 'react';
import Shell from '@/components/layout/Shell';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: 'hearing' | 'deadline' | 'meeting' | 'filing' | 'deposition';
  matter: string;
  location?: string;
  notes?: string;
  urgent?: boolean;
}

const EVENT_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  hearing:    { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', label: '🏛️ Hearing' },
  deadline:   { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: '⏰ Deadline' },
  meeting:    { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0', label: '👥 Meeting' },
  filing:     { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE', label: '📄 Filing' },
  deposition: { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A', label: '📋 Deposition' },
};

// Demo events
const TODAY = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const dateStr = (offset: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const DEMO_EVENTS: CalendarEvent[] = [
  { id: '1', title: 'Preliminary Hearing',       date: dateStr(2),  time: '9:00 AM',  type: 'hearing',    matter: 'People v. Johnson',     location: 'Courtroom 4B, NY Supreme',   urgent: true },
  { id: '2', title: 'Expert Deposition',          date: dateStr(3),  time: '2:00 PM',  type: 'deposition', matter: 'Smith v. Allstate',     location: 'Law Offices of Harrison',    urgent: false },
  { id: '3', title: 'Motion Filing Deadline',     date: dateStr(5),  time: '5:00 PM',  type: 'deadline',   matter: 'People v. Johnson',     notes: 'Motion to suppress weapon evidence', urgent: true },
  { id: '4', title: 'Client Meeting',             date: dateStr(7),  time: '11:00 AM', type: 'meeting',    matter: 'Smith Lease Dispute',   location: 'Office Conference Room A' },
  { id: '5', title: 'Answer Filing Deadline',     date: dateStr(10), time: '5:00 PM',  type: 'deadline',   matter: 'Rivera Real Estate',    urgent: false },
  { id: '6', title: 'Trial Date',                 date: dateStr(21), time: '9:00 AM',  type: 'hearing',    matter: 'People v. Johnson',     location: 'Courtroom 7A, NY Supreme',   urgent: false },
  { id: '7', title: 'Mediation Session',          date: dateStr(14), time: '1:00 PM',  type: 'meeting',    matter: 'Smith v. Allstate',     location: 'ADR Center, 40 Wall St' },
  { id: '8', title: 'Court Filing — Exhibits',    date: dateStr(1),  time: '11:59 PM', type: 'filing',     matter: 'Rivera Real Estate',    urgent: true },
];

export default function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[]>(DEMO_EVENTS);
  const [showCreate, setShowCreate] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [form, setForm] = useState({ title: '', date: dateStr(3), time: '', type: 'hearing' as CalendarEvent['type'], matter: '', location: '', notes: '' });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setEvents([{ ...form, id: Date.now().toString() }, ...events]);
    setForm({ title: '', date: dateStr(3), time: '', type: 'hearing', matter: '', location: '', notes: '' });
    setShowCreate(false);
  };

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const filtered = sorted.filter(ev => filterType === 'all' || ev.type === filterType);

  const upcoming7 = events.filter(ev => {
    const d = new Date(ev.date + 'T00:00:00');
    const diff = Math.ceil((d.getTime() - TODAY.getTime()) / 86400000);
    return diff >= 0 && diff <= 7;
  }).sort((a, b) => a.date.localeCompare(b.date));

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const daysUntil = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const diff = Math.ceil((d.getTime() - TODAY.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff < 0) return `${Math.abs(diff)}d ago`;
    return `In ${diff}d`;
  };

  return (
    <Shell>
      <div className="space-y-5 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black" style={{ color: '#0F172A' }}>Calendar & Deadlines</h2>
            <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>Hearings, filing deadlines, depositions, and court dates across all matters.</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Event
          </button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="card p-6 animate-fadeIn">
            <h3 className="font-bold mb-4" style={{ color: '#0F172A' }}>Add Calendar Event</h3>
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Event Title *</label>
                  <input className="input-base" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Preliminary Hearing" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Type</label>
                  <select className="input-base" value={form.type} onChange={e => setForm({...form, type: e.target.value as any})}>
                    {Object.entries(EVENT_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Date *</label>
                  <input className="input-base" type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Time</label>
                  <input className="input-base" value={form.time} onChange={e => setForm({...form, time: e.target.value})} placeholder="9:00 AM" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Matter</label>
                  <input className="input-base" value={form.matter} onChange={e => setForm({...form, matter: e.target.value})} placeholder="People v. Johnson" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Location</label>
                  <input className="input-base" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Courtroom 4B, NY Supreme Court" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Notes</label>
                  <input className="input-base" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Bring exhibits…" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary">Add Event</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming 7 Days */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm" style={{ color: '#0F172A' }}>⚡ Next 7 Days</h3>
            {upcoming7.length === 0 ? (
              <div className="card p-6 text-center text-sm" style={{ color: '#94A3B8' }}>No upcoming events</div>
            ) : (
              upcoming7.map(ev => {
                const s = EVENT_STYLES[ev.type];
                const days = daysUntil(ev.date);
                return (
                  <div key={ev.id} className="card p-4" style={{ borderLeft: `3px solid ${s.color}` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate" style={{ color: '#0F172A' }}>
                          {ev.urgent && <span className="text-red-500 mr-1">🔴</span>}{ev.title}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>{ev.matter}</div>
                        {ev.location && <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>📍 {ev.location}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black" style={{ color: s.color }}>{days}</div>
                        {ev.time && <div className="text-xs" style={{ color: '#94A3B8' }}>{ev.time}</div>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Type Legend */}
            <div className="card p-4">
              <h4 className="font-semibold text-xs mb-3 uppercase tracking-wider" style={{ color: '#64748B' }}>Event Types</h4>
              <div className="space-y-1.5">
                {Object.entries(EVENT_STYLES).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: v.color }} />
                    <span className="text-xs" style={{ color: '#475569' }}>{v.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full Event List */}
          <div className="lg:col-span-2 space-y-3">
            {/* Filter */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setFilterType('all')} className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                style={{ background: filterType === 'all' ? '#1E40AF' : '#F1F5F9', color: filterType === 'all' ? '#fff' : '#475569', border: '1px solid ' + (filterType === 'all' ? '#1E40AF' : '#E2E8F0') }}>
                All
              </button>
              {Object.entries(EVENT_STYLES).map(([k, v]) => (
                <button key={k} onClick={() => setFilterType(k)} className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                  style={{ background: filterType === k ? v.color : v.bg, color: filterType === k ? '#fff' : v.color, border: `1px solid ${v.border}` }}>
                  {v.label}
                </button>
              ))}
            </div>

            {/* Event Table */}
            <div className="card overflow-hidden">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Event</th>
                    <th>Type</th>
                    <th>Matter</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-10" style={{ color: '#94A3B8' }}>No events found.</td></tr>
                  ) : (
                    filtered.map(ev => {
                      const s = EVENT_STYLES[ev.type];
                      const days = daysUntil(ev.date);
                      const isPast = new Date(ev.date + 'T00:00:00') < TODAY;
                      return (
                        <tr key={ev.id} style={{ opacity: isPast ? 0.55 : 1 }}>
                          <td>
                            <div className="font-semibold text-sm" style={{ color: '#0F172A' }}>{formatDate(ev.date)}</div>
                            <div className="text-xs" style={{ color: isPast ? '#94A3B8' : s.color, fontWeight: 600 }}>{days}</div>
                            {ev.time && <div className="text-xs" style={{ color: '#94A3B8' }}>{ev.time}</div>}
                          </td>
                          <td>
                            <div className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                              {ev.urgent && !isPast && <span className="text-red-500 mr-1">🔴</span>}{ev.title}
                            </div>
                            {ev.location && <div className="text-xs" style={{ color: '#94A3B8' }}>📍 {ev.location}</div>}
                            {ev.notes && <div className="text-xs" style={{ color: '#64748B' }}>{ev.notes}</div>}
                          </td>
                          <td>
                            <span className="chip" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: '10.5px' }}>
                              {s.label}
                            </span>
                          </td>
                          <td className="text-sm" style={{ color: '#475569' }}>{ev.matter}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
