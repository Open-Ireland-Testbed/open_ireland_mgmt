import { create } from 'zustand';

/**
 * Admin UI state store
 * Manages admin-specific UI state like Priority Season toggle
 * Separate from scheduler state to keep admin and client views independent
 */
const useAdminStore = create((set, get) => ({
    // Priority Season toggle state
    isPrioritySeason: false,

    // Actions
    setPrioritySeason: (enabled) => {
        set({ isPrioritySeason: enabled });
        // Persist to localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem('admin_priority_season', enabled ? 'true' : 'false');
        }
    },

    // Initialize from localStorage
    initialize: () => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('admin_priority_season');
            if (saved !== null) {
                set({ isPrioritySeason: saved === 'true' });
            }
        }
    },
}));

export default useAdminStore;

