import { create } from 'zustand';

const useDateRangeStore = create((set, get) => ({
  ranges: {},
  setRange: (pageKey, range) =>
    set((state) => ({
      ranges: {
        ...state.ranges,
        [pageKey]: range,
      },
    })),
  getRange: (pageKey) => get().ranges[pageKey] || { start: null, end: null, preset: 'This Week' },
}));

export default useDateRangeStore;

