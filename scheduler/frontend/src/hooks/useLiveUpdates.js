import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook for live updates via polling
 * @param {number} interval - Polling interval in milliseconds (default: 30000 = 30s)
 */
export function useLiveUpdates(interval = 30000) {
  const queryClient = useQueryClient();
  const intervalRef = useRef(null);

  useEffect(() => {
    // Only enable live updates if tab is visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // Refresh immediately when tab becomes visible
        queryClient.invalidateQueries(['bookings']);
        
        // Start polling
        intervalRef.current = setInterval(() => {
          queryClient.invalidateQueries(['bookings']);
        }, interval);
      }
    };

    // Start polling if tab is visible
    if (!document.hidden) {
      intervalRef.current = setInterval(() => {
        queryClient.invalidateQueries(['bookings']);
      }, interval);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [interval, queryClient]);
}

















