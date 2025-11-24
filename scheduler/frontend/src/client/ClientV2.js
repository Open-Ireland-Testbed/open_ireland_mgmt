import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import CryptoJS from 'crypto-js';
import { useNavigate, useLocation } from 'react-router-dom';
import FiltersPanel from './v2/FiltersPanel';
import TimelinePanel from './v2/TimelinePanel';
import BookingCartPanel from './v2/BookingCartPanel';
import useSchedulerStore from '../store/schedulerStore';
import useAuthStore from '../store/authStore';
import { API_BASE_URL } from '../config/api';
import { ToastProvider, useToastContext } from '../contexts/ToastContext';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import AccessibilityMenu from '../components/AccessibilityMenu';
const ParticleBackground = lazy(() => import('../components/ParticleBackground'));

const SIDEBAR_PREFERENCE_STORAGE_KEY = 'scheduler_filters_sidebar_open';

export default function ClientV2() {
  return (
    <ToastProvider>
      <ClientV2Inner />
    </ToastProvider>
  );
}

function ClientV2Inner() {
  const navigate = useNavigate();
  const location = useLocation();

  // Use centralized auth store
  const { authenticated, userId, username: userName, isAdmin, loading: isCheckingAuth, refreshAuth, clearAuth } = useAuthStore();
  
  // Use ref to track if auth refresh is in progress to prevent race conditions
  const authRefreshInProgress = useRef(false);
  const hasInitialized = useRef(false);

  const [darkMode, setDarkMode] = useState(false);
  const [authModal, setAuthModal] = useState(null); // 'login' | 'register' | null
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const { setWeekStart, initializeDefaultTemplates } = useSchedulerStore();
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [particlesEnabled, setParticlesEnabled] = useState(() => {
    const saved = localStorage.getItem('particlesEnabled');
    return saved !== null ? saved === 'true' : false; // Default to false
  });
  const [particleOpacity, setParticleOpacity] = useState(() => {
    const saved = localStorage.getItem('particleOpacity');
    return saved ? parseFloat(saved) : 0.6;
  });
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

  const toast = useToastContext();
  const isAuthenticated = authenticated;

  // Safe refresh auth function that prevents race conditions
  const safeRefreshAuth = useCallback(async () => {
    if (authRefreshInProgress.current) {
      return; // Already refreshing, skip
    }
    authRefreshInProgress.current = true;
    try {
      await refreshAuth();
    } finally {
      authRefreshInProgress.current = false;
    }
  }, [refreshAuth]);

  // Clear navigation loading when location changes and auth check completes
  useEffect(() => {
    // Always check auth for /client route (but only if not already refreshing)
    if (location.pathname === '/client' || location.pathname.startsWith('/client')) {
      if (!authRefreshInProgress.current) {
        safeRefreshAuth();
      }
      
      // Check if we were redirected from admin route and show toast
      if (location.state?.adminRedirect) {
        setTimeout(() => {
          toast.error(location.state.adminRedirect);
        }, 300); // Small delay to ensure toast context is ready
      }
    }
  }, [location.pathname, location.state, safeRefreshAuth, toast]);

  // Clear navigation state when route changes (separate effect to avoid dependency issues)
  useEffect(() => {
    if (isNavigating) {
      // Small delay to allow navigation to complete
      const timer = setTimeout(() => {
        setIsNavigating(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isNavigating]);

  // Enable live updates (polling every 30 seconds)
  useLiveUpdates(30000);

  // Initialize default templates on mount
  useEffect(() => {
    initializeDefaultTemplates();
  }, [initializeDefaultTemplates]);

  // Initialize UI state on mount (only once) - separate from auth
  useEffect(() => {
    const storedSidebarPreference = localStorage.getItem(SIDEBAR_PREFERENCE_STORAGE_KEY);
    if (storedSidebarPreference !== null) {
      setIsFiltersOpen(storedSidebarPreference !== 'false');
    }

    // Check for saved dark mode preference
    const savedMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedMode);
    applyDarkMode(savedMode);

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

    // Initialize week start date (start of current week, Monday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    const weekStartStr = monday.toISOString().split('T')[0]; // YYYY-MM-DD format
    setWeekStart(weekStartStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - don't include setWeekStart to avoid re-runs

  // Initialize auth on mount (separate effect)
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      safeRefreshAuth();
    }
  }, [safeRefreshAuth]);

  const applyDarkMode = (enable) => {
    if (enable) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Reload colors for the new mode
    const bgKey = `backgroundColor-${enable ? 'dark' : 'light'}`;
    const accentKey = `accentColor-${enable ? 'dark' : 'light'}`;
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
    
    // Manually trigger observer updates after CSS variables are set
    // This ensures panels update immediately with the new mode's colors
    if (window.__documentObserver && window.__documentObserver.triggerUpdate) {
      // Use setTimeout to ensure CSS variables are fully applied
      setTimeout(() => {
        // Check again inside setTimeout in case it becomes undefined
        if (window.__documentObserver && window.__documentObserver.triggerUpdate) {
          window.__documentObserver.triggerUpdate();
        }
      }, 0);
    }
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
    applyDarkMode(newMode);
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

  const handleToggleFilters = useCallback(() => {
    setIsFiltersOpen((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_PREFERENCE_STORAGE_KEY, next.toString());
      return next;
    });
  }, []);

  const handleResetSelection = useCallback(() => {
    setIsFiltersOpen(true);
    localStorage.setItem(SIDEBAR_PREFERENCE_STORAGE_KEY, 'true');
  }, []);

  const openLoginModal = useCallback(() => setAuthModal('login'), []);
  const openRegisterModal = useCallback(() => setAuthModal('register'), []);

  const handleLoginSubmit = useCallback(
    async ({ username, password }) => {
      if (!username || !password) {
        toast.error('Please enter both username and password.');
        return;
      }

      setAuthSubmitting(true);
      try {
        // Send SHA256 hashed password (never send plain text)
        const hashedPassword = CryptoJS.SHA256(password).toString();
        const res = await fetch(`${API_BASE_URL}/login`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password: hashedPassword }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const message = errData?.detail || 'Login failed. Please check your credentials.';
          throw new Error(message);
        }

        const data = await res.json();
        toast.success(data?.message || 'Signed in successfully.');
        setAuthModal(null);
        // Refresh auth after login - give browser a moment to process the Set-Cookie header
        // The session cookie is set by the login response, but we need to wait for it to be available
        setTimeout(async () => {
          await safeRefreshAuth();
          // Show admin hint if user is admin
          // Use setTimeout to ensure state is updated
          setTimeout(() => {
            const authState = useAuthStore.getState();
            if (authState.isAdmin) {
              toast.info('You\'re an admin. Use the Admin button in the header to open the admin panel.');
            }
          }, 100);
        }, 200);
      } catch (err) {
        toast.error(err.message || 'Unable to sign in.');
      } finally {
        setAuthSubmitting(false);
      }
    },
    [toast, safeRefreshAuth]
  );

  const handleRegisterSubmit = useCallback(
    async ({ username, email, password, confirmPassword }) => {
      if (!username || !password || !confirmPassword) {
        toast.error('Username and both password fields are required.');
        return;
      }
      if (password.length < 8) {
        toast.error('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match.');
        return;
      }

      setAuthSubmitting(true);
      try {
        const hashedPassword = CryptoJS.SHA256(password).toString();
        const hashedConfirm = CryptoJS.SHA256(confirmPassword).toString();
        const res = await fetch(`${API_BASE_URL}/users/register`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            email: email || null,
            password: hashedPassword,
            password2: hashedConfirm,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const message = errData?.detail || 'Registration failed.';
          throw new Error(message);
        }

        await res.json();
        toast.success('Account created successfully. You are now signed in.');
        setAuthModal(null);
        await safeRefreshAuth();
      } catch (err) {
        toast.error(err.message || 'Unable to register at this time.');
      } finally {
        setAuthSubmitting(false);
      }
    },
    [toast, safeRefreshAuth]
  );

  const handleLogout = useCallback(async () => {
    setLogoutPending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const message = errData?.detail || 'Logout failed.';
        throw new Error(message);
      }

      const data = await res.json().catch(() => ({}));
      toast.success(data?.message || 'Signed out successfully.');
      clearAuth();
    } catch (err) {
      toast.error(err.message || 'Unable to sign out.');
    } finally {
      setLogoutPending(false);
    }
  }, [toast]);

  // Set body and html background to transparent when showing particles
  // Add fallback background in case particles fail to load
  useEffect(() => {
    if (!isAuthenticated || particlesEnabled) {
      const originalBodyBg = document.body.style.backgroundColor;
      const originalHtmlBg = document.documentElement.style.backgroundColor;
      // Get fallback background from CSS variables
      const computedStyle = getComputedStyle(document.documentElement);
      const bgHue = computedStyle.getPropertyValue('--background-hue') || '270';
      const bgSat = computedStyle.getPropertyValue('--background-saturation') || '70%';
      const bgLight = computedStyle.getPropertyValue('--background-lightness') || '95%';
      const fallbackBg = `hsl(${bgHue}, ${bgSat}, ${bgLight})`;
      
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
      
      // Set fallback background on a wrapper to ensure visibility if particles fail
      const fallbackTimeout = setTimeout(() => {
        // Check if particles actually rendered by checking for particle canvas
        const particleCanvas = document.querySelector('#particle-background canvas');
        if (!particleCanvas && (document.body.style.backgroundColor === 'transparent' || !document.body.style.backgroundColor)) {
          document.body.style.backgroundColor = fallbackBg;
          document.documentElement.style.backgroundColor = fallbackBg;
        }
      }, 1000);
      
      return () => {
        clearTimeout(fallbackTimeout);
        document.body.style.backgroundColor = originalBodyBg;
        document.documentElement.style.backgroundColor = originalHtmlBg;
      };
    } else {
      document.body.style.backgroundColor = '';
      document.documentElement.style.backgroundColor = '';
    }
  }, [isAuthenticated, particlesEnabled]);

  return (
    <>
      {(!isAuthenticated || particlesEnabled) && (
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
      <div className="relative h-screen w-screen overflow-hidden" style={(!isAuthenticated || particlesEnabled) ? { backgroundColor: 'transparent' } : {}}>
        <div className="relative z-20 flex h-full flex-col" style={(!isAuthenticated || particlesEnabled) ? { backgroundColor: 'transparent' } : {}}>
          {/* Minimal accessibility controls for unauthenticated users */}
          {!isAuthenticated && (
            <div className="flex justify-end px-6 py-2 absolute top-0 right-0 z-50">
              <AccessibilityMenu
                darkMode={darkMode}
                toggleDarkMode={toggleDarkMode}
                particlesEnabled={particlesEnabled}
                toggleParticles={toggleParticles}
                particleOpacity={particleOpacity}
                onParticleOpacityChange={handleParticleOpacityChange}
              />
            </div>
          )}
          {/* Header */}
          {isAuthenticated && (
            <header className="glass-panel border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between relative z-50" style={{
              boxShadow: '0 12px 20px -4px rgba(0, 0, 0, 0.15), 0 6px 10px -3px rgba(0, 0, 0, 0.1)',
              backgroundColor: headerBg
            }}>
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Lab Scheduler
                </h1>
              </div>
              <div className="flex items-center gap-3">
                {userName ? (
                  <>
                    <span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:inline">
                      Signed in as <span className="font-semibold">{userName}</span>
                    </span>
                    {/* Admin button - always visible but disabled for non-admins */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isAdmin) {
                          setIsNavigating(true);
                          navigate('/admin');
                        }
                      }}
                      disabled={!isAdmin || isNavigating}
                      title={isAdmin ? 'Open Admin Panel' : 'Admin only'}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        isAdmin
                          ? 'text-white hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                          : 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-60'
                      }`}
                      style={isAdmin ? { backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` } : {}}
                    >
                      Admin Panel
                    </button>
                    <button
                      onClick={() => navigate('/topology')}
                      className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                    >
                      Composer
                    </button>
                    <button
                      onClick={() => {
                        setIsNavigating(true);
                        setTimeout(() => {
                          navigate('/bookings');
                        }, 100);
                      }}
                      className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                    >
                      My Bookings
                    </button>
                    <button
                      onClick={handleLogout}
                      disabled={logoutPending}
                      className="px-4 py-2 text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {logoutPending ? 'Signing out…' : 'Logout'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={openLoginModal}
                      className="px-4 py-2 text-sm font-medium text-white rounded-md hover:opacity-90 transition-colors"
                      style={{ backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
                    >
                      Login
                    </button>
                    <button
                      onClick={openRegisterModal}
                      className="px-4 py-2 text-sm font-medium text-white rounded-md hover:opacity-90 transition-colors"
                      style={{ backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
                    >
                      Register
                    </button>
                  </>
                )}
                {isAuthenticated && (
                  <AccessibilityMenu
                    darkMode={darkMode}
                    toggleDarkMode={toggleDarkMode}
                    particlesEnabled={particlesEnabled}
                    toggleParticles={toggleParticles}
                    particleOpacity={particleOpacity}
                    onParticleOpacityChange={handleParticleOpacityChange}
                  />
                )}
              </div>
            </header>
          )}

          {/* Loading overlay for navigation and initial auth check */}
          {(isNavigating || isCheckingAuth) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }} />
                <p className="text-white text-sm font-medium">Loading...</p>
              </div>
            </div>
          )}

          {/* Main 3-pane layout - only render after auth check completes */}
        {!isCheckingAuth && (
          <div className="flex-1 flex overflow-hidden relative" style={(!isAuthenticated || particlesEnabled) ? { backgroundColor: 'transparent' } : {}}>
              {isAuthenticated ? (
                <>
                  {/* Left sidebar - Filters */}
                  <div
                    className="relative flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
                    style={{ 
                      width: isFiltersOpen ? 360 : 72,
                      backgroundColor: panelBg
                    }}
                  >
                    <aside
                      className={`glass-panel h-full border-r border-gray-200 dark:border-gray-700 overflow-y-auto transition-all duration-300 ease-in-out ${isFiltersOpen
                        ? 'translate-x-0 opacity-100'
                        : '-translate-x-8 opacity-0 pointer-events-none'
                        }`}
                      style={{
                        width: 360,
                        backgroundColor: panelBg
                      }}
                      aria-hidden={!isFiltersOpen}
                    >
                      <FiltersPanel
                        userId={userId}
                        userName={userName}
                        onResetSelection={handleResetSelection}
                        onHideSidebar={handleToggleFilters}
                      />
                    </aside>
                    <div
                      className={`absolute top-4 left-1/2 -translate-x-1/2 transition-all duration-300 ease-in-out ${isFiltersOpen
                        ? 'opacity-0 pointer-events-none -translate-y-2'
                        : 'opacity-100 translate-y-0'
                        }`}
                    >
                      <button
                        type="button"
                        onClick={handleToggleFilters}
                        className="inline-flex items-center justify-center w-9 h-9 text-gray-500 dark:text-gray-300 rounded-md border border-gray-200 dark:border-gray-600 transition-colors shadow-sm"
                        style={{
                          backgroundColor: panelBg
                        }}
                        onMouseEnter={(e) => {
                          const isDark = document.documentElement.classList.contains('dark');
                          e.currentTarget.style.backgroundColor = isDark
                            ? `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) - 45%))`
                            : `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) + 15%))`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = panelBg;
                        }}
                        title="Show Sidebar"
                        aria-label="Show sidebar"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6L14 12L8 18" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6L18 12L12 18" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Center area - Timeline */}
                  <main
                    className="flex-1 flex flex-col overflow-hidden"
                    style={{ backgroundColor: `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) + 10%))` }}
                  >
                    <div className="flex-1 overflow-hidden">
                      <TimelinePanel userName={userName} />
                    </div>
                  </main>

                  {/* Right sidebar - Booking Cart */}
                  <aside
                    className="w-64 flex-shrink-0 overflow-y-auto"
                    style={{
                      backgroundColor: `hsl(var(--background-hue), var(--background-saturation), calc(var(--background-lightness) + 5%))`
                    }}
                  >
                    <BookingCartPanel userId={userId} userName={userName} />
                  </aside>
                </>
              ) : (
                <UnauthenticatedLanding onLogin={openLoginModal} onRegister={openRegisterModal} />
              )}
            </div>
          )}
        </div>
      </div>

      {authModal && (
        <AuthModal
          mode={authModal}
          submitting={authSubmitting}
          onClose={() => setAuthModal(null)}
          onSwitchMode={() => setAuthModal((prev) => (prev === 'login' ? 'register' : 'login'))}
          onLogin={handleLoginSubmit}
          onRegister={handleRegisterSubmit}
        />
      )}
    </>
  );
}

function AuthModal({ mode, onClose, onSwitchMode, onLogin, onRegister, submitting }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [mode]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (mode === 'login') {
      onLogin({ username, password });
    } else {
      onRegister({ username, email, password, confirmPassword });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl glass-panel shadow-2xl border border-gray-200/60 dark:border-gray-700/60 backdrop-blur"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200/70 dark:border-gray-700/70 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100 transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="auth-username">
              Username
            </label>
            <input
              id="auth-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full glass-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
              onFocus={(e) => e.target.style.setProperty('--tw-ring-color', `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`)}
              required
              autoFocus
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="auth-email">
                Email (optional)
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full glass-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
                onFocus={(e) => e.target.style.setProperty('--tw-ring-color', `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`)}
                placeholder="you@example.com"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="auth-password">
              Password
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full glass-input rounded-md px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="auth-confirm-password">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full glass-input rounded-md px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full glass-button flex items-center justify-center py-2 text-sm font-semibold uppercase tracking-wide disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="border-t border-gray-200/60 dark:border-gray-700/60 px-6 py-4 text-sm text-center text-gray-600 dark:text-gray-300">
          {mode === 'login' ? (
            <>
              Need an account?{' '}
              <button type="button" onClick={onSwitchMode} className="font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300">
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={onSwitchMode} className="font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300">
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function UnauthenticatedLanding({ onLogin, onRegister }) {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-10 relative z-10">
      <div className="max-w-xl w-full glass-panel border border-gray-200/60 dark:border-gray-700/60 rounded-3xl shadow-2xl p-10 text-center space-y-6">
        <h1 className="text-5xl font-light tracking-tight text-gray-900 dark:text-white mb-2" style={{
          color: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          letterSpacing: '-0.02em'
        }}>
          Open Ireland Testbed
        </h1>
        <div
          className="mx-auto w-20 h-20 rounded-full glass-card flex items-center justify-center text-4xl shadow-lg"
          style={{ color: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-light-lightness))` }}
        >
          🔐
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Sign in to manage lab bookings
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Access the lab schedule, manage your bookings, and collaborate with your team. Log in or create an account to get started.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onLogin}
            className="w-full sm:w-auto flex items-center justify-center px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white rounded-md hover:opacity-90 transition-colors"
            style={{ backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
          >
            Login
          </button>
          <button
            onClick={onRegister}
            className="w-full sm:w-auto flex items-center justify-center px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white rounded-md hover:opacity-90 transition-colors"
            style={{ backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}

