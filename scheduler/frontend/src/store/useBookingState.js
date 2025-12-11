import { create } from 'zustand';

const SELECTION_STORAGE_KEY = 'scheduler_device_selection';

const selectionDefaults = {
  selectedRange: {
    start: null,
    end: null,
  },
  selectedDevices: [],
  selectedSlots: {},
  collaborators: [],
};

const loadPersistedSelections = () => {
  if (typeof window === 'undefined') {
    return selectionDefaults;
  }

  try {
    const stored = window.localStorage.getItem(SELECTION_STORAGE_KEY);
    if (!stored) {
      return selectionDefaults;
    }

    const parsed = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) {
      return selectionDefaults;
    }

    const selectedRangeRaw = parsed.selectedRange || {};
    const start =
      typeof selectedRangeRaw.start === 'string' || selectedRangeRaw.start === null
        ? selectedRangeRaw.start
        : null;
    const end =
      typeof selectedRangeRaw.end === 'string' || selectedRangeRaw.end === null
        ? selectedRangeRaw.end
        : null;

    const selectedDevices = Array.isArray(parsed.selectedDevices)
      ? parsed.selectedDevices
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id))
      : selectionDefaults.selectedDevices;

    const selectedSlotsRaw =
      parsed.selectedSlots && typeof parsed.selectedSlots === 'object'
        ? parsed.selectedSlots
        : {};
    const selectedSlots = Object.entries(selectedSlotsRaw).reduce((acc, [deviceId, dates]) => {
      if (!Array.isArray(dates)) {
        return acc;
      }
      acc[deviceId] = dates
        .filter((date) => typeof date === 'string' && date.length > 0)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      return acc;
    }, {});

    const collaborators = Array.isArray(parsed.collaborators)
      ? parsed.collaborators.filter((name) => typeof name === 'string')
      : selectionDefaults.collaborators;

    return {
      selectedRange: { start, end },
      selectedDevices,
      selectedSlots,
      collaborators,
    };
  } catch (error) {
    console.warn('Failed to load persisted device selections:', error);
    return selectionDefaults;
  }
};

const persistSelections = (snapshot) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const isDefault =
      (!snapshot.selectedRange?.start && !snapshot.selectedRange?.end) &&
      Array.isArray(snapshot.selectedDevices) &&
      snapshot.selectedDevices.length === 0 &&
      snapshot.selectedSlots &&
      Object.keys(snapshot.selectedSlots).length === 0 &&
      Array.isArray(snapshot.collaborators) &&
      snapshot.collaborators.length === 0;

    if (isDefault) {
      window.localStorage.removeItem(SELECTION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('Failed to persist device selections:', error);
  }
};

const getDatesInRange = (start, end) => {
  if (!start || !end) {
    return [];
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }

  const dates = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

const dedupeAndSortDates = (dates) => {
  const sorted = Array.from(new Set(dates));
  sorted.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted;
};

const buildDayKey = (deviceId, date) => `${deviceId}-${date}`;

const createGroupedSelections = (selectedSlots) => {
  return Object.entries(selectedSlots).map(([deviceIdStr, dates]) => ({
    deviceId: Number(deviceIdStr),
    dates: dedupeAndSortDates(dates),
    hours: [],
    isDaily: true,
  }));
};

const useBookingState = create((set, get) => {
  const persistedSelections = loadPersistedSelections();

  const snapshotAndPersist = (state, overrides = {}) => {
    const snapshot = {
      selectedRange: overrides.selectedRange ?? state.selectedRange,
      selectedDevices: overrides.selectedDevices ?? state.selectedDevices,
      selectedSlots: overrides.selectedSlots ?? state.selectedSlots,
      collaborators: overrides.collaborators ?? state.collaborators,
    };
    persistSelections(snapshot);
  };

  return {
    selectedRange: persistedSelections.selectedRange,
    selectedDevices: persistedSelections.selectedDevices,
    selectedSlots: persistedSelections.selectedSlots,
    collaborators: persistedSelections.collaborators,

    setSelectedRange: ({ start, end }) =>
      set((state) => {
        const nextRange = { start, end };
        snapshotAndPersist(state, { selectedRange: nextRange });
        return {
          selectedRange: nextRange,
        };
      }),

    clearAllSelections: () =>
      set((state) => {
        snapshotAndPersist(state, {
          selectedRange: { start: null, end: null },
          selectedDevices: [],
          selectedSlots: {},
          collaborators: [],
        });
        return {
          selectedRange: { start: null, end: null },
          selectedDevices: [],
          selectedSlots: {},
          collaborators: [],
        };
      }),

  selectDevice: (deviceId) => {
    const { selectedRange } = get();
    const dates = getDatesInRange(selectedRange.start, selectedRange.end);
    get().addDeviceDates(deviceId, dates);
  },

  setCollaborators: (names) =>
    set((state) => {
      const collaborators = Array.isArray(names) ? [...names] : [];
      snapshotAndPersist(state, { collaborators });
      return { collaborators };
    }),

  clearCollaborators: () =>
    set((state) => {
      snapshotAndPersist(state, { collaborators: [] });
      return { collaborators: [] };
    }),

  deselectDevice: (deviceId) =>
    set((state) => {
      if (!state.selectedDevices.includes(deviceId)) {
        return state;
      }

      const selectedDevices = state.selectedDevices.filter((id) => id !== deviceId);
      const selectedSlots = { ...state.selectedSlots };
      delete selectedSlots[deviceId];

      snapshotAndPersist(state, { selectedDevices, selectedSlots });
      return {
        selectedDevices,
        selectedSlots,
      };
    }),

  toggleDevice: (deviceId) => {
    if (get().isDeviceSelected(deviceId)) {
      get().deselectDevice(deviceId);
    } else {
      get().selectDevice(deviceId);
    }
  },

  addDeviceDates: (deviceId, dates) =>
    set((state) => {
      if (!dates || dates.length === 0) {
        if (state.selectedDevices.includes(deviceId)) {
          return state;
        }
        const selectedDevices = [...state.selectedDevices, deviceId];
        const selectedSlots = { ...state.selectedSlots };
        snapshotAndPersist(state, { selectedDevices, selectedSlots });
        return {
          selectedDevices,
          selectedSlots,
        };
      }

      const existingDates = state.selectedSlots[deviceId] || [];
      const combinedDates = dedupeAndSortDates([...existingDates, ...dates]);

      const selectedSlots = {
        ...state.selectedSlots,
        [deviceId]: combinedDates,
      };

      const alreadySelected = state.selectedDevices.includes(deviceId);
      const selectedDevices = alreadySelected
        ? state.selectedDevices
        : [...state.selectedDevices, deviceId];

      snapshotAndPersist(state, { selectedDevices, selectedSlots });
      return {
        selectedDevices,
        selectedSlots,
      };
    }),

  setDeviceDates: (deviceId, dates) =>
    set((state) => {
      const selectedSlots = { ...state.selectedSlots };

      if (!dates || dates.length === 0) {
        delete selectedSlots[deviceId];
      } else {
        selectedSlots[deviceId] = dedupeAndSortDates(dates);
      }

      const hasDates = selectedSlots[deviceId] && selectedSlots[deviceId].length > 0;
      const selectedDevices = hasDates
        ? state.selectedDevices.includes(deviceId)
          ? state.selectedDevices
          : [...state.selectedDevices, deviceId]
        : state.selectedDevices.filter((id) => id !== deviceId);

      snapshotAndPersist(state, { selectedDevices, selectedSlots });
      return {
        selectedDevices,
        selectedSlots,
      };
    }),

  removeDeviceDates: (deviceId, dates) =>
    set((state) => {
      if (!dates || dates.length === 0) {
        return state;
      }

      const existingDates = state.selectedSlots[deviceId];
      if (!existingDates) {
        return state;
      }

      const remainingDates = existingDates.filter((date) => !dates.includes(date));

      const selectedSlots = { ...state.selectedSlots };
      if (remainingDates.length === 0) {
        delete selectedSlots[deviceId];
      } else {
        selectedSlots[deviceId] = remainingDates;
      }

      const selectedDevices =
        remainingDates.length === 0
          ? state.selectedDevices.filter((id) => id !== deviceId)
          : state.selectedDevices;

      snapshotAndPersist(state, { selectedDevices, selectedSlots });
      return {
        selectedDevices,
        selectedSlots,
      };
    }),

  toggleDay: (deviceId, date) => {
    if (get().isDaySelected(deviceId, date)) {
      get().removeDeviceDates(deviceId, [date]);
    } else {
      get().addDeviceDates(deviceId, [date]);
    }
  },

  removeDay: (deviceId, date) => get().removeDeviceDates(deviceId, [date]),

  importDeviceSelections: (deviceIds, dates) => {
    const uniqueDeviceIds = Array.from(new Set(deviceIds || []));
    const uniqueDates = dedupeAndSortDates(dates || []);

    // Batch all device selections into a single state update for better performance
    // and to ensure conflict detection runs after all updates are complete
    set((state) => {
      const selectedSlots = { ...state.selectedSlots };
      const selectedDevices = [...state.selectedDevices];

      uniqueDeviceIds.forEach((deviceId) => {
        if (!uniqueDates || uniqueDates.length === 0) {
          // If no dates, just add device to selectedDevices if not already there
          if (!selectedDevices.includes(deviceId)) {
            selectedDevices.push(deviceId);
          }
        } else {
          // Merge dates for this device
          const existingDates = state.selectedSlots[deviceId] || [];
          const combinedDates = dedupeAndSortDates([...existingDates, ...uniqueDates]);
          selectedSlots[deviceId] = combinedDates;

          // Add device to selectedDevices if not already there
          if (!selectedDevices.includes(deviceId)) {
            selectedDevices.push(deviceId);
          }
        }
      });

      snapshotAndPersist(state, { selectedDevices, selectedSlots });
      return {
        selectedDevices,
        selectedSlots,
      };
    });
  },

  isDeviceSelected: (deviceId) => get().selectedDevices.includes(deviceId),

  isDaySelected: (deviceId, date) => {
    const slots = get().selectedSlots[deviceId];
    return Array.isArray(slots) ? slots.includes(date) : false;
  },

  getDayKey: (deviceId, date) => buildDayKey(deviceId, date),

  getSelections: () => {
    const { selectedSlots } = get();
    const selections = [];

    Object.entries(selectedSlots).forEach(([deviceIdStr, dates]) => {
      const deviceId = Number(deviceIdStr);
      dates.forEach((date) => {
        selections.push({
          deviceId,
          date,
          hour: null,
        });
      });
    });

    return selections;
  },

  getGroupedSelections: () => {
    const { selectedSlots } = get();
    return createGroupedSelections(selectedSlots);
  },
  };
});

export default useBookingState;

