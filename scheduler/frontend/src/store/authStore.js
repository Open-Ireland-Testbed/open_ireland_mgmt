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
  refreshAuth: async () => {
    set({ loading: true });
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
      });

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
        // Other errors (500, network issues, etc.) - log but don't throw
        console.warn('Auth check failed with status:', res.status);
        set({
          authenticated: false,
          userId: null,
          username: null,
          isAdmin: false,
          loading: false,
        });
        return;
      }

      let data;
      try {
        data = await res.json();
      } catch (parseError) {
        console.error('Failed to parse auth response', parseError);
        set({
          authenticated: false,
          userId: null,
          username: null,
          isAdmin: false,
          loading: false,
        });
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
      // Network errors, CORS issues, etc.
      // Only log if it's not a network error (which is common when backend is down)
      if (err.name !== 'TypeError' || !err.message.includes('fetch')) {
        console.error('Failed to refresh auth', err);
      }
      set({
        authenticated: false,
        userId: null,
        username: null,
        isAdmin: false,
        loading: false,
      });
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

