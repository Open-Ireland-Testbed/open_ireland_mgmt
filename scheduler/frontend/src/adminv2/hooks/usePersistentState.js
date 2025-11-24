import { useCallback, useEffect, useState } from 'react';

export default function usePersistentState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined' || !key) return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null || stored === undefined) {
        return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
      }
      return JSON.parse(stored);
    } catch (error) {
      console.warn('Failed to read persistent state for', key, error);
      return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Failed to persist state for', key, error);
    }
  }, [key, value]);

  const reset = useCallback(() => {
    setValue(typeof defaultValue === 'function' ? defaultValue() : defaultValue);
  }, [defaultValue]);

  return [value, setValue, reset];
}

