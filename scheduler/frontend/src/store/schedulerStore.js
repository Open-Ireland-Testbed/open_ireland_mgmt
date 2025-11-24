import { create } from 'zustand';

// Load persisted state from localStorage
const loadPersistedFilters = () => {
  const defaults = {
    searchQuery: '',
    deviceTypes: [],
    deviceIds: [],
  };

  try {
    const saved = localStorage.getItem('scheduler_filters');
    if (saved) {
      const parsed = JSON.parse(saved);
      const { showAvailableOnly, ...rest } = parsed || {};
      return { ...defaults, ...rest };
    }
  } catch (e) {
    console.warn('Failed to load persisted filters:', e);
  }
  return defaults;
};

const useSchedulerStore = create((set, get) => ({
  // Filters state
  filters: loadPersistedFilters(),

  // Timeline state
  timeline: {
    selectedDate: new Date(),
    viewMode: 'week', // 'day', 'week', 'month'
    selectedSlots: [],
    weekStart: null, // YYYY-MM-DD format for bookings query
    currentWeekOffset: 0, // Offset from today's week (0 = current week, -1 = previous week, etc.)
  },

  // Booking cart state
  bookingCart: {
    items: [],
    message: '',
  },

  // UI state
  ui: {
    newlyConfirmedDays: new Set(), // Track newly confirmed days for highlighting
    viewMode: 'grid', // 'grid' or 'heatmap'
    dateRange: {
      start: null, // YYYY-MM-DD
      end: null, // YYYY-MM-DD
    },
  },

  // Linked device groups
  linkedDeviceGroups: [], // Array of { id, name, deviceIds: [], createdAt }

  // Booking templates
  bookingTemplates: [], // Array of { id, name, deviceIds: [], duration: number (days), description }

  // Bulk booking mode state
  bulkBooking: {
    enabled: false,
    dateRange: {
      start: null, // YYYY-MM-DD
      end: null, // YYYY-MM-DD
    },
    selectedDevices: [], // Array of device IDs
  },

  // Actions
  setFilters: (filters) => {
    const newFilters = { ...get().filters, ...filters };
    // Persist to localStorage
    try {
      localStorage.setItem('scheduler_filters', JSON.stringify(newFilters));
    } catch (e) {
      console.warn('Failed to save filters:', e);
    }
    set({ filters: newFilters });
  },

  setSearchQuery: (searchQuery) => {
    const newFilters = { ...get().filters, searchQuery };
    try {
      localStorage.setItem('scheduler_filters', JSON.stringify(newFilters));
    } catch (e) {
      console.warn('Failed to save filters:', e);
    }
    set({ filters: newFilters });
  },

  setDeviceTypes: (deviceTypes) => {
    const newFilters = { ...get().filters, deviceTypes };
    try {
      localStorage.setItem('scheduler_filters', JSON.stringify(newFilters));
    } catch (e) {
      console.warn('Failed to save filters:', e);
    }
    set({ filters: newFilters });
  },

  setDeviceIds: (deviceIds) => {
    const newFilters = { ...get().filters, deviceIds };
    // Persist to localStorage
    try {
      localStorage.setItem('scheduler_filters', JSON.stringify(newFilters));
    } catch (e) {
      console.warn('Failed to save filters:', e);
    }
    set({ filters: newFilters });
  },

  toggleDeviceType: (deviceType) => {
    const currentFilters = get().filters;
    const currentTypes = currentFilters.deviceTypes;
    const newTypes = currentTypes.includes(deviceType)
      ? currentTypes.filter((type) => type !== deviceType)
      : [...currentTypes, deviceType];
    const newFilters = { ...currentFilters, deviceTypes: newTypes };
    try {
      localStorage.setItem('scheduler_filters', JSON.stringify(newFilters));
    } catch (e) {
      console.warn('Failed to save filters:', e);
    }
    set({ filters: newFilters });
  },

  setTimeline: (timeline) => set((state) => ({
    timeline: { ...state.timeline, ...timeline }
  })),

  setWeekStart: (weekStart) => set((state) => ({
    timeline: { ...state.timeline, weekStart }
  })),

  setBookingCart: (bookingCart) => set((state) => ({
    bookingCart: { ...state.bookingCart, ...bookingCart }
  })),

  addToCart: (item) => set((state) => ({
    bookingCart: {
      ...state.bookingCart,
      items: [...state.bookingCart.items, item]
    }
  })),

  removeFromCart: (itemId) => set((state) => ({
    bookingCart: {
      ...state.bookingCart,
      items: state.bookingCart.items.filter(item => item.id !== itemId)
    }
  })),

  clearCart: () => set((state) => ({
    bookingCart: {
      ...state.bookingCart,
      items: [],
      message: ''
    }
  })),

  // Bulk booking actions
  setBulkBooking: (bulkBooking) => set((state) => ({
    bulkBooking: { ...state.bulkBooking, ...bulkBooking }
  })),

  toggleBulkBookingMode: () => set((state) => ({
    bulkBooking: {
      ...state.bulkBooking,
      enabled: !state.bulkBooking.enabled
    }
  })),

  setBulkDateRange: (dateRange) => set((state) => ({
    bulkBooking: {
      ...state.bulkBooking,
      dateRange: { ...state.bulkBooking.dateRange, ...dateRange }
    }
  })),

  toggleBulkDevice: (deviceId) => set((state) => {
    const currentDevices = state.bulkBooking.selectedDevices;
    const newDevices = currentDevices.includes(deviceId)
      ? currentDevices.filter(id => id !== deviceId)
      : [...currentDevices, deviceId];
    return {
      bulkBooking: {
        ...state.bulkBooking,
        selectedDevices: newDevices
      }
    };
  }),

  selectAllDevicesInType: (deviceIds) => set((state) => {
    const currentDevices = new Set(state.bulkBooking.selectedDevices);
    deviceIds.forEach(id => currentDevices.add(id));
    return {
      bulkBooking: {
        ...state.bulkBooking,
        selectedDevices: Array.from(currentDevices)
      }
    };
  }),

  clearBulkDevices: () => set((state) => ({
    bulkBooking: {
      ...state.bulkBooking,
      selectedDevices: []
    }
  })),

  // Week navigation
  setWeekOffset: (offset) => set((state) => ({
    timeline: {
      ...state.timeline,
      currentWeekOffset: offset
    }
  })),

  navigateWeek: (direction) => set((state) => {
    const nextOffset = state.timeline.currentWeekOffset + direction;
    const currentRange = state.ui?.dateRange || {};
    const { start, end } = currentRange;

    const shiftDate = (dateStr, weeks) => {
      if (!dateStr) return dateStr;
      const dateObj = new Date(dateStr);
      if (Number.isNaN(dateObj.getTime())) return dateStr;
      dateObj.setDate(dateObj.getDate() + weeks * 7);
      return dateObj.toISOString().split('T')[0];
    };

    const nextDateRange =
      start && end
        ? {
            start: shiftDate(start, direction),
            end: shiftDate(end, direction),
          }
        : currentRange;

    return {
      timeline: {
        ...state.timeline,
        currentWeekOffset: nextOffset,
      },
      ui: {
        ...state.ui,
        dateRange: {
          ...state.ui.dateRange,
          ...nextDateRange,
        },
      },
    };
  }),

  // UI actions
  setNewlyConfirmedDays: (days) => set((state) => ({
    ui: {
      ...state.ui,
      newlyConfirmedDays: days instanceof Set ? days : new Set(days)
    }
  })),

  clearNewlyConfirmedDays: () => set((state) => ({
    ui: {
      ...state.ui,
      newlyConfirmedDays: new Set()
    }
  })),

  // View mode
  setViewMode: (mode) => set((state) => ({
    ui: {
      ...state.ui,
      viewMode: mode
    }
  })),

  // Date range
  setDateRange: (range) => set((state) => ({
    ui: {
      ...state.ui,
      dateRange: { ...state.ui.dateRange, ...range }
    }
  })),

  // Linked device groups
  addLinkedDeviceGroup: (group) => set((state) => ({
    linkedDeviceGroups: [...state.linkedDeviceGroups, {
      ...group,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }]
  })),

  updateLinkedDeviceGroup: (id, updates) => set((state) => ({
    linkedDeviceGroups: state.linkedDeviceGroups.map(group =>
      group.id === id ? { ...group, ...updates } : group
    )
  })),

  deleteLinkedDeviceGroup: (id) => set((state) => ({
    linkedDeviceGroups: state.linkedDeviceGroups.filter(group => group.id !== id)
  })),

  // Booking templates
  addBookingTemplate: (template) => set((state) => ({
    bookingTemplates: [...state.bookingTemplates, {
      ...template,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }]
  })),

  updateBookingTemplate: (id, updates) => set((state) => ({
    bookingTemplates: state.bookingTemplates.map(template =>
      template.id === id ? { ...template, ...updates } : template
    )
  })),

  deleteBookingTemplate: (id) => set((state) => ({
    bookingTemplates: state.bookingTemplates.filter(template => template.id !== id)
  })),

  // Initialize default templates
  initializeDefaultTemplates: () => set((state) => {
    if (state.bookingTemplates.length > 0) return state; // Don't override existing
    
    return {
      bookingTemplates: [
        {
          id: 'template-field-trial',
          name: 'Field Trial Setup',
          description: 'Standard field trial configuration',
          deviceIds: [],
          duration: 7,
          deviceTypes: ['Fiber', 'ROADM'],
        },
        {
          id: 'template-test-suite',
          name: 'Test Suite',
          description: 'Complete test suite setup',
          deviceIds: [],
          duration: 3,
          deviceTypes: ['Router', 'Switch'],
        },
      ]
    };
  }),
}));

export default useSchedulerStore;

