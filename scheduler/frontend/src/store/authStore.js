import { create } from 'zustand';
import { API_BASE_URL } from '../config/api';

const useAuthStore = create((set, get) => ({
  // Auth state
  authenticated: false,
  userId: null,
  username: null,
  isAdmin: false,
  loading: true, // Initial loading state

  // Actions
  refreshAuth: async (retryCount = 0) => {
    set({ loading: true });
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // Handle network errors or non-OK responses
      if (!res.ok) {
        // 401/403 are expected for unauthenticated users, don't log as errors
        if (res.status === 401 || res.status === 403) {
          set({
            authenticated: false,
            userId: null,
            username: null,
            isAdmin: false,
            loading: false,
          });
          return;
        }
        // Other errors (500, network issues, etc.) - retry if it's a server error
        if (res.status >= 500 && retryCount < 2) {
          // Retry server errors up to 2 times with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return get().refreshAuth(retryCount + 1);
        }
        // Don't clear auth on transient errors - keep current state
        console.warn('Auth check failed with status:', res.status);
        set({ loading: false });
        return;
      }

      let data;
      try {
        data = await res.json();
      } catch (parseError) {
        console.error('Failed to parse auth response', parseError);
        // Don't clear auth on parse errors - might be transient
        set({ loading: false });
        return;
      }

      if (data?.authenticated) {
        set({
          authenticated: true,
          userId: data.user_id,
          username: data.username,
          isAdmin: Boolean(data.is_admin),
          loading: false,
        });
      } else {
        set({
          authenticated: false,
          userId: null,
          username: null,
          isAdmin: false,
          loading: false,
        });
      }
    } catch (err) {
      // Network errors, CORS issues, timeout, etc.
      // Retry network errors up to 2 times
      if (
        (err.name === 'TypeError' && err.message.includes('fetch')) ||
        err.name === 'AbortError' ||
        err.name === 'TimeoutError'
      ) {
        if (retryCount < 2) {
          // Retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return get().refreshAuth(retryCount + 1);
        }
        // After retries, don't clear auth - might be temporary network issue
        // Only clear if we're sure it's a permanent issue
        console.warn('Network error during auth check, keeping current auth state');
        set({ loading: false });
        return;
      }
      
      // For other errors, log but don't clear auth state
      console.error('Failed to refresh auth', err);
      set({ loading: false });
    }
  },

  clearAuth: () => {
    set({
      authenticated: false,
      userId: null,
      username: null,
      isAdmin: false,
      loading: false,
    });
  },

  // Initialize auth on store creation (called from app startup)
  initialize: async () => {
    await get().refreshAuth();
  },
}));

export default useAuthStore;

