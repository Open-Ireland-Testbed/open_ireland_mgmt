import React, { useMemo } from 'react';
import useBookingState from '../../store/useBookingState';

const DATE_PREFERENCE_STORAGE_KEY = 'scheduler_date_preference';

const persistDatePreference = (label, start, end) => {
  if (!start || !end) return;
  try {
    localStorage.setItem(
      DATE_PREFERENCE_STORAGE_KEY,
      JSON.stringify({
        label,
        range: { start, end },
      })
    );
  } catch (error) {
    console.warn('Failed to persist date preference:', error);
  }
};

const clearDatePreference = () => {
  try {
    localStorage.removeItem(DATE_PREFERENCE_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear date preference:', error);
  }
};

export default function DateRangeSelector({ ui, setDateRange, setWeekOffset }) {
  if (!ui || !setDateRange || !setWeekOffset) {
    throw new Error('DateRangeSelector requires ui, setDateRange, and setWeekOffset props');
  }
  const setSelectedRange = useBookingState((state) => state.setSelectedRange);

  // Calculate date range presets
  const presets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentWeek = new Date(today);
    const dayOfWeek = currentWeek.getDay();
    const diff = currentWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    currentWeek.setDate(diff);

    const nextWeek = new Date(currentWeek);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const twoWeeks = new Date(currentWeek);
    twoWeeks.setDate(twoWeeks.getDate() + 14);

    const month = new Date(currentWeek);
    month.setDate(month.getDate() + 28);

    return [
      {
        label: 'This Week',
        start: currentWeek.toISOString().split('T')[0],
        end: new Date(currentWeek.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      {
        label: 'Next Week',
        start: nextWeek.toISOString().split('T')[0],
        end: new Date(nextWeek.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      {
        label: '2 Weeks',
        start: currentWeek.toISOString().split('T')[0],
        end: new Date(twoWeeks.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      {
        label: '1 Month',
        start: currentWeek.toISOString().split('T')[0],
        end: new Date(month.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    ];
  }, []);

  const handlePreset = (preset) => {
    setDateRange({
      start: preset.start,
      end: preset.end,
    });
    setSelectedRange({ start: preset.start, end: preset.end });
    persistDatePreference(preset.label, preset.start, preset.end);

    const startDate = new Date(preset.start);
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(diff);
    currentWeekStart.setHours(0, 0, 0, 0);

    const presetWeekStart = new Date(startDate);
    const presetDayOfWeek = presetWeekStart.getDay();
    const presetDiff = presetWeekStart.getDate() - presetDayOfWeek + (presetDayOfWeek === 0 ? -6 : 1);
    presetWeekStart.setDate(presetDiff);
    presetWeekStart.setHours(0, 0, 0, 0);

    const weeksDiff = Math.floor(
      (presetWeekStart - currentWeekStart) / (7 * 24 * 60 * 60 * 1000)
    );
    setWeekOffset(weeksDiff);
  };

  const handleCustomRange = (start, end) => {
    setDateRange({ start, end });
    setSelectedRange({ start, end });
    if (start && end) {
      persistDatePreference('Custom Range', start, end);
    } else if (!start && !end) {
      clearDatePreference();
    }

    if (start) {
      const startDate = new Date(start);
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(diff);
      currentWeekStart.setHours(0, 0, 0, 0);

      const presetWeekStart = new Date(startDate);
      const presetDayOfWeek = presetWeekStart.getDay();
      const presetDiff = presetWeekStart.getDate() - presetDayOfWeek + (presetDayOfWeek === 0 ? -6 : 1);
      presetWeekStart.setDate(presetDiff);
      presetWeekStart.setHours(0, 0, 0, 0);

      const weeksDiff = Math.floor(
        (presetWeekStart - currentWeekStart) / (7 * 24 * 60 * 60 * 1000)
      );
      setWeekOffset(weeksDiff);
    }
  };

  const hasRange = Boolean(ui.dateRange.start && ui.dateRange.end);

  return (
    <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        Date Range
      </h3>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Date range presets">
        {presets.map((preset) => {
          const isActive = ui.dateRange.start === preset.start && ui.dateRange.end === preset.end;
          return (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-blue-600 dark:bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-pressed={isActive}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 text-xs text-gray-700 dark:text-gray-300">
        <label className="flex items-center gap-2">
          <span className="min-w-[48px] text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Start
          </span>
          <input
            type="date"
            value={ui.dateRange.start || ''}
            onChange={(e) => handleCustomRange(e.target.value, ui.dateRange.end)}
            className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            aria-label="Start date"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="min-w-[48px] text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            End
          </span>
          <input
            type="date"
            value={ui.dateRange.end || ''}
            onChange={(e) => handleCustomRange(ui.dateRange.start, e.target.value)}
            className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            aria-label="End date"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between">
        {hasRange ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Selected:{' '}
            {new Date(ui.dateRange.start).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}{' '}
            –{' '}
            {new Date(ui.dateRange.end).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Choose preset or custom range
          </p>
        )}

        {hasRange && (
          <button
            onClick={() => {
              setDateRange({ start: null, end: null });
              setSelectedRange({ start: null, end: null });
              clearDatePreference();
            }}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </section>
  );
}



