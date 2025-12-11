import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useAdminStore from '../store/adminStore';
import AccessibilityMenu from '../components/AccessibilityMenu';
import { API_BASE_URL } from '../config/api';
import CryptoJS from 'crypto-js';
const ParticleBackground = lazy(() => import('../components/ParticleBackground'));

// Sidebar navigation items
const NAV_ITEMS = [
    { key: 'dashboard', label: 'Dashboard', path: '/admin', icon: '📊' },
    { key: 'approvals', label: 'Approvals', path: '/admin/approvals', icon: '✅' },
    { key: 'conflicts', label: 'Conflicts', path: '/admin/conflicts', icon: '⚠️' },
    { key: 'utilization', label: 'Utilization Insights', path: '/admin/utilization', icon: '📈' },
    { key: 'rules', label: 'Rules Engine', path: '/admin/rules', icon: '⚙️' },
    { key: 'priority', label: 'Priority Season', path: '/admin/priority', icon: '🎯' },
    { key: 'users', label: 'Users & Roles', path: '/admin/users', icon: '👥' },
    { key: 'logs', label: 'Logs & Audit', path: '/admin/logs', icon: '📋' },
    { key: 'settings', label: 'Settings', path: '/admin/settings', icon: '🔧' },
];

export default function AdminShell() {
    const location = useLocation();
    const navigate = useNavigate();
    const { username, isAdmin, clearAuth } = useAuthStore();
    const { isPrioritySeason, setPrioritySeason, initialize: initAdminStore } = useAdminStore();

    // Track window size for responsive behavior
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth < 768;
    });

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Theme state (shared with client but scoped to admin)
    const [darkMode, setDarkMode] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem('darkMode') === 'true';
    });
    const [particlesEnabled, setParticlesEnabled] = useState(() => {
        const saved = localStorage.getItem('particlesEnabled');
        return saved !== null ? saved === 'true' : false;
    });
    const [particleOpacity, setParticleOpacity] = useState(() => {
        const saved = localStorage.getItem('particleOpacity');
        return saved ? parseFloat(saved) : 0.6;
    });
    // Sidebar state - persist to localStorage like client
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        if (typeof window === 'undefined') return true;
        const saved = localStorage.getItem('admin_sidebar_open');
        return saved !== null ? saved === 'true' : true; // Default to open
    });
    const [isNavigating, setIsNavigating] = useState(false);

    // Persist sidebar state to localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('admin_sidebar_open', isSidebarOpen.toString());
        }
    }, [isSidebarOpen]);

    // Initialize admin store on mount
    useEffect(() => {
        initAdminStore();
    }, [initAdminStore]);

    // Initialize colors from localStorage on mount (like client)
    useEffect(() => {
        // Check for saved dark mode preference
        const savedMode = localStorage.getItem('darkMode') === 'true';
        setDarkMode(savedMode);
        if (savedMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // Initialize colors from localStorage based on current mode
        const isDark = savedMode;
        const bgKey = `backgroundColor-${isDark ? 'dark' : 'light'}`;
        const accentKey = `accentColor-${isDark ? 'dark' : 'light'}`;
        const savedBackground = localStorage.getItem(bgKey);
        const savedAccent = localStorage.getItem(accentKey);
        if (savedBackground) {
            const bg = JSON.parse(savedBackground);
            document.documentElement.style.setProperty('--background-hue', bg.h.toString());
            document.documentElement.style.setProperty('--background-saturation', `${bg.s}%`);
            document.documentElement.style.setProperty('--background-lightness', `${bg.l}%`);
        }
        if (savedAccent) {
            const accent = JSON.parse(savedAccent);
            document.documentElement.style.setProperty('--accent-hue', accent.h.toString());
            document.documentElement.style.setProperty('--accent-saturation', `${accent.s}%`);
            document.documentElement.style.setProperty('--accent-lightness', `${accent.l}%`);
        }
    }, []); // Only run once on mount

    // Apply dark mode changes
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('darkMode', darkMode ? 'true' : 'false');

        // Reload colors for the new mode
        const bgKey = `backgroundColor-${darkMode ? 'dark' : 'light'}`;
        const accentKey = `accentColor-${darkMode ? 'dark' : 'light'}`;
        const savedBackground = localStorage.getItem(bgKey);
        const savedAccent = localStorage.getItem(accentKey);
        if (savedBackground) {
            const bg = JSON.parse(savedBackground);
            document.documentElement.style.setProperty('--background-hue', bg.h.toString());
            document.documentElement.style.setProperty('--background-saturation', `${bg.s}%`);
            document.documentElement.style.setProperty('--background-lightness', `${bg.l}%`);
        }
        if (savedAccent) {
            const accent = JSON.parse(savedAccent);
            document.documentElement.style.setProperty('--accent-hue', accent.h.toString());
            document.documentElement.style.setProperty('--accent-saturation', `${accent.s}%`);
            document.documentElement.style.setProperty('--accent-lightness', `${accent.l}%`);
        }
    }, [darkMode]);

    // Background colors (matching client pattern)
    const [headerBg, setHeaderBg] = useState(() => {
        if (typeof document === 'undefined') return `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) - 2%))`;
        const isDark = document.documentElement.classList.contains('dark');
        return isDark
            ? `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) - 52%))`
            : `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) - 2%))`;
    });
    const [panelBg, setPanelBg] = useState(() => {
        if (typeof document === 'undefined') return `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) + 10%))`;
        const isDark = document.documentElement.classList.contains('dark');
        return isDark
            ? `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) - 50%))`
            : `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) + 10%))`;
    });

    useEffect(() => {
        const updateColors = () => {
            if (typeof document === 'undefined') return;
            const isDark = document.documentElement.classList.contains('dark');
            setHeaderBg(isDark
                ? `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) - 52%))`
                : `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) - 2%))`);
            setPanelBg(isDark
                ? `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) - 50%))`
                : `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) + 10%))`);
        };
        updateColors();

        const observer = new MutationObserver(updateColors);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, []);

    const toggleDarkMode = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        localStorage.setItem('darkMode', newMode.toString());
    };

    const toggleParticles = () => {
        const newState = !particlesEnabled;
        setParticlesEnabled(newState);
        localStorage.setItem('particlesEnabled', newState.toString());
    };

    const handleParticleOpacityChange = (value) => {
        const clamped = Math.min(1, Math.max(0.2, value));
        setParticleOpacity(clamped);
        localStorage.setItem('particleOpacity', clamped.toString());
    };

    const handleLogout = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                credentials: 'include',
            });
            if (res.ok) {
                clearAuth();
                navigate('/client');
            }
        } catch (err) {
            console.error('Logout failed', err);
        }
    };

    // Find active nav item - check exact match first, then prefix match
    // Dashboard needs special handling since /admin matches everything
    const activeKey = (() => {
        // First check for exact match or /admin with nothing after
        if (location.pathname === '/admin' || location.pathname === '/admin/') {
            return 'dashboard';
        }
        // Then check other paths (excluding dashboard)
        const otherItems = NAV_ITEMS.filter(item => item.path !== '/admin');
        const matched = otherItems.find((item) => location.pathname.startsWith(item.path));
        return matched?.key || 'dashboard';
    })();

    // Priority Season accent color class
    const prioritySeasonClass = isPrioritySeason ? 'priority-season' : '';

    return (
        <>
            {particlesEnabled && (
                <Suspense fallback={
                    <div
                        className="fixed inset-0 pointer-events-none"
                        style={{
                            backgroundColor: `hsl(var(--background-hue), var(--background-saturation), var(--background-lightness))`,
                            zIndex: 0
                        }}
                    />
                }>
                    <ParticleBackground opacity={particleOpacity} />
                </Suspense>
            )}
            <div className={`relative h-screen w-screen overflow-hidden ${prioritySeasonClass}`} style={particlesEnabled ? { backgroundColor: 'transparent' } : {}}>
                <div className="relative z-20 flex h-full flex-col" style={particlesEnabled ? { backgroundColor: 'transparent' } : {}}>
                    {/* Header */}
                    <header
                        className="glass-panel border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between relative z-50"
                        style={{
                            boxShadow: '0 12px 20px -4px rgba(0, 0, 0, 0.15), 0 6px 10px -3px rgba(0, 0, 0, 0.1)',
                            backgroundColor: headerBg
                        }}
                    >
                        <div className="flex items-center gap-4">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Admin Control
                            </h1>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Priority Season Toggle */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isPrioritySeason}
                                        onChange={(e) => setPrioritySeason(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Priority Season
                                    </span>
                                </label>
                                {isPrioritySeason && (
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                        Active
                                    </span>
                                )}
                            </div>
                            {/* User info */}
                            {username && (
                                <span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:inline">
                                    {username}
                                </span>
                            )}
                            {/* Customization menu */}
                            <AccessibilityMenu
                                darkMode={darkMode}
                                toggleDarkMode={toggleDarkMode}
                                particlesEnabled={particlesEnabled}
                                toggleParticles={toggleParticles}
                                particleOpacity={particleOpacity}
                                onParticleOpacityChange={handleParticleOpacityChange}
                            />
                            {/* Back to client */}
                            <button
                                onClick={() => {
                                    setIsNavigating(true);
                                    navigate('/client');
                                }}
                                className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                            >
                                Client View
                            </button>
                            {/* Logout */}
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </header>

                    {/* Loading overlay */}
                    {isNavigating && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-3">
                                <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }} />
                                <p className="text-white text-sm font-medium">Loading...</p>
                            </div>
                        </div>
                    )}

                    {/* Main layout */}
                    <div className="flex-1 flex overflow-hidden relative" style={particlesEnabled ? { backgroundColor: 'transparent' } : {}}>
                        {/* Mobile overlay backdrop when sidebar is open */}
                        {isSidebarOpen && (
                            <div
                                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                                onClick={() => setIsSidebarOpen(false)}
                                aria-hidden="true"
                            />
                        )}

                        {/* Left sidebar */}
                        <aside
                            className={`relative flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-0 md:w-16'
                                }`}
                            style={{ backgroundColor: panelBg }}
                        >
                            {/* Desktop: sidebar stays in place, mobile: slides in/out as overlay */}
                            <div
                                className={`glass-panel h-full border-r border-gray-200 dark:border-gray-700 overflow-y-auto transition-all duration-300 ease-in-out ${isSidebarOpen
                                    ? 'translate-x-0 opacity-100'
                                    : '-translate-x-full opacity-0 pointer-events-none md:translate-x-0 md:opacity-100 md:pointer-events-auto'
                                    }`}
                                style={{
                                    width: isSidebarOpen ? 256 : (!isMobile ? 64 : 256),
                                    backgroundColor: panelBg,
                                    // On mobile, make it fixed overlay when open
                                    ...(isMobile && isSidebarOpen ? {
                                        position: 'fixed',
                                        left: 0,
                                        top: '4rem',
                                        bottom: 0,
                                        zIndex: 50
                                    } : {
                                        position: 'relative'
                                    })
                                }}
                                aria-hidden={!isSidebarOpen}
                            >
                                {/* Sidebar toggle button - inside the sidebar panel */}
                                <div className="flex justify-center py-2 border-b border-gray-200 dark:border-gray-700">
                                    <button
                                        type="button"
                                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                                        aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                                        title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                                    >
                                        {isSidebarOpen ? (
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                <nav className={`p-4 space-y-1 ${!isSidebarOpen ? 'md:px-2' : ''}`}>
                                    {NAV_ITEMS.map((item) => {
                                        const isActive = activeKey === item.key;
                                        return (
                                            <NavLink
                                                key={item.key}
                                                to={item.path}
                                                end={item.path === '/admin'}
                                                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-gray-700 dark:text-gray-300 ${!isSidebarOpen ? 'md:justify-center md:px-2' : ''}`}
                                                style={isActive ? {
                                                    backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) + 25%))`,
                                                    color: `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) - 15%))`
                                                } : {}}
                                                onMouseEnter={(e) => {
                                                    if (!isActive) {
                                                        const isDark = document.documentElement.classList.contains('dark');
                                                        e.currentTarget.style.backgroundColor = `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) + ${isDark ? 35 : 40}%))`;
                                                        e.currentTarget.style.color = `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) - ${isDark ? 10 : 15}%))`;
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!isActive) {
                                                        e.currentTarget.style.backgroundColor = '';
                                                        e.currentTarget.style.color = '';
                                                    }
                                                }}
                                                title={!isSidebarOpen ? item.label : undefined}
                                                // Only close sidebar on mobile when clicking nav items
                                                onClick={() => {
                                                    // On mobile, close sidebar after navigation
                                                    if (isMobile) {
                                                        setIsSidebarOpen(false);
                                                    }
                                                    // On desktop, keep sidebar open (do nothing)
                                                }}
                                            >
                                                <span className="text-lg">{item.icon}</span>
                                                <span className={isSidebarOpen ? '' : 'md:hidden'}>{item.label}</span>
                                            </NavLink>
                                        );
                                    })}
                                </nav>
                            </div>
                        </aside>

                        {/* Main content */}
                        <main
                            className="flex-1 flex flex-col overflow-hidden"
                            style={{ backgroundColor: `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) + 10%))` }}
                        >
                            <div className="flex-1 overflow-y-auto p-6">
                                <Outlet />
                            </div>
                        </main>
                    </div>
                </div>
            </div>
        </>
    );
}

