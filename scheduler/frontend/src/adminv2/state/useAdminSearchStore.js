import { create } from 'zustand';

const SCOPES = ['bookings', 'devices', 'users', 'topologies', 'logs'];

const useAdminSearchStore = create((set) => ({
  query: '',
  scope: 'bookings',
  suggestions: {},
  isOpen: false,
  setQuery: (query) => set({ query }),
  setScope: (scope) => {
    if (!SCOPES.includes(scope)) return;
    set({ scope });
  },
  setSuggestions: (suggestions) => set({ suggestions }),
  setOpen: (isOpen) => set({ isOpen }),
  reset: () => set({ query: '', suggestions: {}, isOpen: false }),
}));

export default useAdminSearchStore;
export { SCOPES as SEARCH_SCOPES };

