import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useAuthStore from '../store/authStore';

// Custom retry function that handles network errors better
const retryFunction = (failureCount, error) => {
  // Don't retry on 4xx errors (client errors like 401, 403, 404)
  if (error?.status >= 400 && error?.status < 500) {
    return false;
  }
  
  // Retry network errors and 5xx errors up to 3 times
  // Network errors (TypeError, failed to fetch) should be retried
  if (error?.message?.includes('fetch') || error?.message?.includes('network') || error?.status >= 500) {
    return failureCount < 3;
  }
  
  // Default: retry once for other errors
  return failureCount < 1;
};

// Create a client with improved error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: retryFunction,
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Add retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Handle errors globally
      onError: (error) => {
        // If it's a network error or 401/403, refresh auth to check session
        if (
          error?.message?.includes('fetch') ||
          error?.message?.includes('network') ||
          error?.status === 401 ||
          error?.status === 403
        ) {
          // Refresh auth to check if session is still valid
          useAuthStore.getState().refreshAuth();
        }
      },
    },
    mutations: {
      retry: retryFunction,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      onError: (error) => {
        // Handle mutation errors similarly
        if (
          error?.message?.includes('fetch') ||
          error?.message?.includes('network') ||
          error?.status === 401 ||
          error?.status === 403
        ) {
          useAuthStore.getState().refreshAuth();
        }
      },
    },
  },
});

export default function QueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

















