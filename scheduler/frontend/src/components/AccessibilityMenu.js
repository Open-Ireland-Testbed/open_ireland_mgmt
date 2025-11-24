import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ColorPicker from './ColorPicker';

export default function AccessibilityMenu({ 
  darkMode, 
  toggleDarkMode, 
  particlesEnabled, 
  toggleParticles,
  particleOpacity = 0.6,
  onParticleOpacityChange = () => {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen, showColorPicker]);
  
  // Reset color picker view when menu closes
  useEffect(() => {
    if (!isOpen) {
      setShowColorPicker(false);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedColorPicker = event.target.closest('[data-color-picker-dropdown]');
      const clickedColorPickerContent = event.target.closest('[data-color-picker-content]');
      // Don't close if clicking inside color picker
      if (clickedColorPicker || clickedColorPickerContent) return;
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
        aria-label="Accessibility options"
        title="Accessibility options"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] glass-panel border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 overflow-hidden"
          style={{
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
            width: showColorPicker ? '320px' : '288px',
            transition: 'width 0.3s ease-in-out',
          }}
        >
          {!showColorPicker && (
          <div
            className="transition-all duration-300 ease-in-out"
            style={{
              opacity: 1,
              transform: 'scale(1)',
            }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Accessibility</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Color Picker Button */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Colors</label>
                <button
                  onClick={() => setShowColorPicker(true)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Customize Colors</span>
                  </div>
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

          {/* Dark Mode Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Theme</label>
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                {darkMode ? (
                  <svg className="w-4 h-4 dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M12 19.5V21M4.219 4.219l1.061 1.061M18.72 18.72l1.06 1.06M3 12h1.5M19.5 12H21M4.219 19.781l1.061-1.061M18.72 5.28l1.06-1.06M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {darkMode ? 'Light Mode' : 'Dark Mode'}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {darkMode ? 'Switch to light' : 'Switch to dark'}
              </span>
            </button>
          </div>

          {/* Particle Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Particles</label>
            <button
              onClick={toggleParticles}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                {particlesEnabled ? (
                  <svg className="w-4 h-4 dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {particlesEnabled ? 'Particles On' : 'Particles Off'}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {particlesEnabled ? 'Disable' : 'Enable'}
              </span>
            </button>
          </div>

          {/* Particle Opacity */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Particle Opacity</label>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.1"
              value={particleOpacity}
              onChange={(e) => onParticleOpacityChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-right text-xs text-gray-500 dark:text-gray-400">
              {Math.round(particleOpacity * 100)}%
            </div>
          </div>
            </div>
          </div>
          )}
          {showColorPicker && (
          <div
            className="transition-all duration-300 ease-in-out"
            style={{
              opacity: 1,
              transform: 'scale(1)',
            }}
          >
            <ColorPicker inline={true} onBack={() => setShowColorPicker(false)} />
          </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

