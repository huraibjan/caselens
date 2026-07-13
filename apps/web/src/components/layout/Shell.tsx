'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  section?: string;
  badge?: string;
}

function Icon({ path, className = 'w-[18px] h-[18px]' }: { path: string | string[]; className?: string }) {
  const paths = Array.isArray(path) ? path : [path];
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      {paths.map((d, i) => <path key={i} strokeLinecap="round" strokeLinejoin="round" d={d} />)}
    </svg>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await fetchApi('/api/v1/auth/me');
        setUser(data);
        if (!data.organization_id) {
          router.push('/onboarding');
        }
      } catch {
        localStorage.clear();
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  const navSections = [
    {
      label: 'Workspace',
      items: [
        {
          href: '/dashboard',
          label: 'Dashboard',
          icon: <Icon path="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
        },
        {
          href: '/matters',
          label: 'Matters',
          icon: <Icon path="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
        },
        {
          href: '/analytics',
          label: 'Analytics',
          icon: <Icon path={['M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z']} />,
        },
      ],
    },
    {
      label: 'Case Management',
      items: [
        {
          href: '/contacts',
          label: 'Contacts',
          icon: <Icon path="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
        },
        {
          href: '/calendar',
          label: 'Calendar',
          icon: <Icon path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
        },
        {
          href: '/filings',
          label: 'Filings',
          icon: <Icon path={['M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z']} />,
        },
      ],
    },
    {
      label: 'Tools',
      items: [
        {
          href: '/templates',
          label: 'Templates',
          icon: <Icon path={['M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z']} />,
        },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F1F5F9' }}>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full mx-auto" style={{ animation: 'spin 0.9s linear infinite', borderWidth: '3px', borderStyle: 'solid', borderColor: '#BFDBFE', borderTopColor: '#1E40AF' }} />
          <p className="text-sm font-medium" style={{ color: '#64748B' }}>Loading your secure workspace…</p>
        </div>
      </div>
    );
  }

  const pageTitle = (() => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'Dashboard';
    const first = parts[0];
    return first.charAt(0).toUpperCase() + first.slice(1);
  })();

  return (
    <div className="min-h-screen flex" style={{ background: '#F1F5F9', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className="flex flex-col shrink-0 transition-all duration-300"
        style={{
          width: collapsed ? 68 : 240,
          background: '#0F172A',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0" style={{ padding: '20px 18px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm text-white" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>
            CL
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-white text-sm tracking-tight truncate">CaseLens</div>
              <div className="text-xs truncate" style={{ color: '#64748B' }}>Legal Intelligence</div>
            </div>
          )}
        </div>

        {/* User Card */}
        {!collapsed && (
          <div className="mx-3 my-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #1E40AF, #6366F1)', color: '#fff' }}>
                {user?.full_name?.charAt(0) || 'A'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{user?.full_name || 'Attorney'}</div>
                <div className="text-xs capitalize truncate" style={{ color: '#60A5FA' }}>{user?.org_role || 'Associate'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Nav Sections */}
        <nav className="flex-1 px-3 py-2 space-y-5">
          {navSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#334155' }}>
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/')) || pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className="flex items-center gap-3 rounded-xl transition-all duration-150 group"
                      style={{
                        padding: collapsed ? '10px 14px' : '9px 12px',
                        justifyContent: collapsed ? 'center' : undefined,
                        background: isActive ? 'linear-gradient(135deg, #1E40AF, #2563EB)' : 'transparent',
                        color: isActive ? '#FFFFFF' : '#94A3B8',
                        boxShadow: isActive ? '0 2px 8px rgba(30,64,175,0.35)' : undefined,
                      }}
                    >
                      <span className="shrink-0" style={{ color: isActive ? '#FFFFFF' : '#64748B' }}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <span className="text-sm font-medium truncate" style={{ color: isActive ? '#FFFFFF' : '#94A3B8' }}>
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 p-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3 rounded-xl transition-all"
            style={{ padding: '9px 12px', color: '#64748B', justifyContent: collapsed ? 'center' : undefined }}
            title="Toggle sidebar"
          >
            <Icon path={collapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'} />
            {!collapsed && <span className="text-sm font-medium">Collapse</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-xl transition-all"
            style={{ padding: '9px 12px', color: '#EF4444', justifyContent: collapsed ? 'center' : undefined }}
            title="Sign out"
          >
            <Icon path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="shrink-0 h-14 flex items-center justify-between px-6" style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold" style={{ color: '#0F172A' }}>{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: 'pulse 2s infinite' }} />
              Secure Session
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'linear-gradient(135deg, #1E40AF, #6366F1)', color: '#fff' }}>
              {user?.full_name?.charAt(0) || 'A'}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto" style={{ padding: '24px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
