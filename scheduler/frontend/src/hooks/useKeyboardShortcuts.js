import { useEffect } from 'react';

/**
 * Hook for keyboard shortcuts
 * @param {Object} shortcuts - Object mapping key combinations to callbacks
 * @param {Array} deps - Dependencies array
 */
export function useKeyboardShortcuts(shortcuts, deps = []) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.isContentEditable
      ) {
        return;
      }

      const key = event.key;
      const keyCombination = [
        event.ctrlKey && 'Ctrl',
        event.metaKey && 'Meta',
        event.shiftKey && 'Shift',
        event.altKey && 'Alt',
        key,
      ]
        .filter(Boolean)
        .join('+');

      // Check for exact match first
      if (shortcuts[keyCombination]) {
        event.preventDefault();
        shortcuts[keyCombination](event);
        return;
      }

      // Check for key only (without modifiers)
      if (shortcuts[key]) {
        event.preventDefault();
        shortcuts[key](event);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, ...deps]);
}

















