import React, { useEffect, useMemo } from 'react';
import usePersistentState from '../hooks/usePersistentState';

const PRESETS = [
  { key: 'this-week', label: 'This Week', offsetWeeks: 0, durationWeeks: 1 },
  { key: 'next-week', label: 'Next Week', offsetWeeks: 1, durationWeeks: 1 },
  { key: 'two-weeks', label: '2 Weeks', offsetWeeks: 0, durationWeeks: 2 },
  { key: 'one-month', label: '1 Month', offsetWeeks: 0, durationWeeks: 4 },
];

function computeRange(offsetWeeks, durationWeeks) {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(today);
  start.setDate(diff + offsetWeeks * 7);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + durationWeeks * 7 - 1);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function DateRangeControls({ storageKey, value, onChange }) {
  const [presetKey, setPresetKey] = usePersistentState(`${storageKey}-preset`, 'this-week');

  const selectedPreset = useMemo(() => {
    return PRESETS.find((preset) => preset.key === presetKey) || PRESETS[0];
  }, [presetKey]);

  useEffect(() => {
    if (!value?.start || !value?.end) {
      const range = computeRange(selectedPreset.offsetWeeks, selectedPreset.durationWeeks);
      onChange({ ...range, preset: selectedPreset.label });
    }
  }, [onChange, selectedPreset, value]);

  const handlePreset = (preset) => {
    setPresetKey(preset.key);
    const range = computeRange(preset.offsetWeeks, preset.durationWeeks);
    onChange({
      ...range,
      preset: preset.label,
    });
  };

  const handleCustom = (field, date) => {
    const next = {
      start: field === 'start' ? date : value?.start,
      end: field === 'end' ? date : value?.end,
      preset: 'Custom',
    };
    setPresetKey('custom');
    onChange(next);
  };

  return (
    <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 flex flex-col gap-3">
      <div className="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
        Date range
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const isActive = preset.key === presetKey;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => handlePreset(preset)}
              className={[
                'px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors',
                isActive
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
              ].join(' ')}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
        <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
          <span className="font-semibold mb-1">Start</span>
          <input
            type="date"
            value={value?.start || ''}
            onChange={(event) => handleCustom('start', event.target.value)}
            className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
          <span className="font-semibold mb-1">End</span>
          <input
            type="date"
            value={value?.end || ''}
            onChange={(event) => handleCustom('end', event.target.value)}
            className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
      <div className="text-xs text-gray-400 dark:text-gray-500">
        {value?.start && value?.end ? `${value.start} → ${value.end}` : 'Select dates to filter results'}
      </div>
    </div>
  );
}

