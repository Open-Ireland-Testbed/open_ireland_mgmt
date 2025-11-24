import React, { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import usePersistentState from '../hooks/usePersistentState';
import { useAdminContext } from '../context/AdminContext';
import GlobalSearchBar from './GlobalSearchBar';
import useDateRangeStore from '../state/useDateRangeStore';

const Icon = {
  dashboard: (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M11 3H4a1 1 0 0 0-1 1v4h8V3Zm0 6H3v7a1 1 0 0 0 1 1h7V9Zm2 7h3a1 1 0 0 0 1-1v-5h-4v6Zm4-8V4a1 1 0 0 0-1-1h-3v5h4Z" />
    </svg>
  ),
  approvals: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14M5 12h10M5 17h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m15 17 2 2 4-4" />
    </svg>
  ),
  bookings: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  ),
  devices: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v3" />
    </svg>
  ),
  topologies: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.9 7.9 10.5 15m6.1-7.1L13.5 15M6 6h12" />
    </svg>
  ),
  users: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 8v6m3-3h-6" />
    </svg>
  ),
  logs: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 21h12M16 3h2a1 1 0 0 1 1 1v16M8 3h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h4M8 11h8M8 15h6" />
    </svg>
  ),
  settings: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.06A1.65 1.65 0 0 0 9 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.06a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.06A1.65 1.65 0 0 0 20.91 11H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: Icon.dashboard },
  { key: 'approvals', label: 'Approvals', path: '/admin/approvals', icon: Icon.approvals },
  { key: 'bookings', label: 'Bookings', path: '/admin/bookings', icon: Icon.bookings },
  { key: 'devices', label: 'Devices', path: '/admin/devices', icon: Icon.devices },
  { key: 'topologies', label: 'Topologies', path: '/admin/topologies', icon: Icon.topologies },
  { key: 'users', label: 'Users & Roles', path: '/admin/users', icon: Icon.users },
  { key: 'logs', label: 'Logs & Audit', path: '/admin/logs', icon: Icon.logs },
  { key: 'settings', label: 'Settings', path: '/admin/settings', icon: Icon.settings, requiresSetting: true },
];

function AdminLayout({ children }) {
  const location = useLocation();
  const { session, logout, permissions } = useAdminContext();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [darkMode, setDarkMode] = usePersistentState('admin-dark-mode', () => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('darkMode') === 'true';
  });
  const dateRange = useDateRangeStore((state) => state.getRange('global'));
  const setDateRange = useDateRangeStore((state) => state.setRange);

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    window.localStorage.setItem('darkMode', darkMode ? 'true' : 'false');
  }, [darkMode]);

  const availableNavItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (item.key === 'settings') {
        return permissions?.['settings:write'];
      }
      return true;
    });
  }, [permissions]);

  React.useEffect(() => {
    if (!dateRange?.start || !dateRange?.end) {
      const now = new Date();
      const iso = now.toISOString().slice(0, 10);
      setDateRange('global', {
        start: iso,
        end: iso,
        preset: 'Today',
      });
    }
  }, [dateRange, setDateRange]);

  const activeKey =
    availableNavItems.find((item) => location.pathname.startsWith(item.path))?.key || 'dashboard';

  const presets = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'next-week', label: 'Next Week' },
    { key: 'month', label: 'This Month' },
  ];

  const handlePreset = (key) => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    switch (key) {
      case 'week': {
        const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
        start.setDate(now.getDate() + diff);
        end.setDate(start.getDate() + 6);
        break;
      }
      case 'next-week': {
        const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
        start.setDate(now.getDate() + diff + 7);
        end.setDate(start.getDate() + 6);
        break;
      }
      case 'month': {
        start.setDate(1);
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        break;
      }
      default:
        break;
    }

    setDateRange('global', {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      preset: presets.find((preset) => preset.key === key)?.label ?? 'Custom',
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 transition-transform duration-200 ease-in-out',
          isNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <div className="h-16 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center">
          <div>
            <div className="text-xs uppercase tracking-wide text-blue-500 font-semibold">Open Ireland Labs</div>
            <div className="mt-1 text-lg font-bold">Admin Control</div>
          </div>
        </div>
        <nav className="px-3 py-4 text-sm font-semibold">
          <ul className="space-y-1">
            {availableNavItems.map((item) => {
              const isActive = activeKey === item.key;
              return (
                <li key={item.key}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/admin/dashboard'}
                    className={[
                      'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                        : 'text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50/70 dark:hover:bg-blue-900/20',
                    ].join(' ')}
                    onClick={() => setIsNavOpen(false)}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-200">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-auto px-4 py-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400">
          Built for approvals & uptime · v2
        </div>
      </aside>
      <div className="flex-1 md:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur">
          <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 md:hidden"
              onClick={() => setIsNavOpen((prev) => !prev)}
              aria-label="Toggle navigation"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="none">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <GlobalSearchBar />
              <div className="hidden sm:flex items-center gap-2">
                {presets.map((preset) => {
                  const isActive = (dateRange?.preset || 'Today') === preset.label;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handlePreset(preset.key)}
                      className={[
                        'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
                      ].join(' ')}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div className="hidden lg:flex text-xs text-slate-500 dark:text-slate-400">
                {dateRange?.start ? `${dateRange.start} → ${dateRange.end}` : 'Date range · Custom'}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 5V3m0 18v-2m7-7h2M3 12h2m13.66 5.66 1.41 1.41M5.93 5.93 7.34 7.34m0 9.32-1.41 1.41m11.31-11.31 1.41-1.41" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                )}
              </button>
              <div className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold">
                  {session.user?.username?.slice(0, 2)?.toUpperCase() || 'AD'}
                </span>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold">{session.user?.username}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{session.role}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="hidden sm:inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)]">
          <div className="px-4 py-6 sm:px-6 lg:px-10">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;

