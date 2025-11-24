import React, { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MyBookingsPanel from './v2/MyBookingsPanel';
import { getHeaderBackgroundColor } from '../utils/darkModeUtils';
import AccessibilityMenu from '../components/AccessibilityMenu';
import { useDocumentObserver } from '../hooks/useDocumentObserver';
const ParticleBackground = lazy(() => import('../components/ParticleBackground'));

export default function BookingsPage({ userId, userName }) {
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(true);
  const [pageBg, setPageBg] = useState(() => getHeaderBackgroundColor());
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });
  const [particlesEnabled, setParticlesEnabled] = useState(() => {
    const saved = localStorage.getItem('particlesEnabled');
    return saved !== null ? saved === 'true' : false; // Default to false
  });
  const [particleOpacity, setParticleOpacity] = useState(() => {
    const saved = localStorage.getItem('particleOpacity');
    return saved ? parseFloat(saved) : 0.6;
  });

  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode') === 'true';
    if (savedMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setDarkMode(savedMode);
    
    // Load colors for the current mode
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
    
    // Update page background
    setPageBg(getHeaderBackgroundColor());
    
    // Hide loading after a short delay to show the animation
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 300);
    
    return () => {
      clearTimeout(timer);
    };
  }, []);
  
  // Use centralized document observer to watch for both class and style changes
  useDocumentObserver(() => {
    // Update synchronously to ensure transitions happen together
    setPageBg(getHeaderBackgroundColor());
  }, ['class', 'style']);

  const applyDarkMode = useCallback((enable) => {
    if (enable) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

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
    if (window.__documentObserver && window.__documentObserver.triggerUpdate) {
      setTimeout(() => {
        window.__documentObserver.triggerUpdate();
      }, 0);
    }
    
    setPageBg(getHeaderBackgroundColor());
  }, []);

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

  useEffect(() => {
    if (particlesEnabled) {
      const originalBodyBg = document.body.style.backgroundColor;
      const originalHtmlBg = document.documentElement.style.backgroundColor;
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
      return () => {
        document.body.style.backgroundColor = originalBodyBg;
        document.documentElement.style.backgroundColor = originalHtmlBg;
      };
    }
    document.body.style.backgroundColor = '';
    document.documentElement.style.backgroundColor = '';
    return undefined;
  }, [particlesEnabled]);

  const handleBack = () => {
    setIsNavigating(true);
    setTimeout(() => {
      navigate('/client');
    }, 100);
  };

  return (
    <>
      {particlesEnabled && (
        <Suspense fallback={null}>
          <ParticleBackground opacity={particleOpacity} />
        </Suspense>
      )}
      {/* Loading overlay for navigation */}
      {isNavigating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }} />
            <p className="text-white text-sm font-medium">Loading...</p>
          </div>
        </div>
      )}
      <div 
        className="relative min-h-screen w-full py-10 px-4 sm:px-6 lg:px-8"
        style={{
          backgroundColor: particlesEnabled ? 'transparent' : pageBg,
          transition: 'background-color 0.3s ease-in-out'
        }}
      >
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors inline-flex items-center gap-2 hover:opacity-90"
              style={{ backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
            >
              <span aria-hidden="true">←</span>
              Back to Scheduler
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  // Placeholder for Analysis page - will be implemented later
                  // TODO: Implement Analysis page
                }}
                disabled
                className="px-4 py-2 text-sm font-medium glass-button rounded-md transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Analysis page (coming soon)"
              >
                Analysis
              </button>
              <AccessibilityMenu
                darkMode={darkMode}
                toggleDarkMode={toggleDarkMode}
                particlesEnabled={particlesEnabled}
                toggleParticles={toggleParticles}
                particleOpacity={particleOpacity}
                onParticleOpacityChange={handleParticleOpacityChange}
              />
            </div>
          </div>
          <MyBookingsPanel userId={userId} userName={userName} />
        </div>
      </div>
    </>
  );
}

