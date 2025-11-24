import React, { useMemo } from 'react';
import { useDevices } from '../../services/deviceService';
import useSchedulerStore from '../../store/schedulerStore';
import useBookingState from '../../store/useBookingState';
import { useToastContext } from '../../contexts/ToastContext';

export default function BulkBookingPanel({ userId, userName }) {
  const { data: devices = [] } = useDevices();
  const { bulkBooking, setBulkDateRange, toggleBulkDevice, clearBulkDevices, toggleBulkBookingMode, setDateRange } = useSchedulerStore();
  const addDeviceDates = useBookingState((state) => state.addDeviceDates);
  const setSelectedRange = useBookingState((state) => state.setSelectedRange);
  const toast = useToastContext();

  // Group devices by type
  const devicesByType = useMemo(() => {
    const groups = {};
    devices.forEach(device => {
      const type = device.deviceType || 'Other';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(device);
    });
    return groups;
  }, [devices]);

  // Get all days in the date range
  const dateRangeDays = useMemo(() => {
    if (!bulkBooking.dateRange.start || !bulkBooking.dateRange.end) {
      return [];
    }
    const days = [];
    const start = new Date(bulkBooking.dateRange.start);
    const end = new Date(bulkBooking.dateRange.end);
    const current = new Date(start);
    
    while (current <= end) {
      days.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [bulkBooking.dateRange]);

  // Handle bulk apply - select all days in range for all selected devices
  const handleBulkApply = () => {
    if (!bulkBooking.dateRange.start || !bulkBooking.dateRange.end) {
      toast?.warning('Select a date range before applying.');
      return;
    }

    if (bulkBooking.selectedDevices.length === 0) {
      toast?.warning('Select at least one device to apply.');
      return;
    }

    setDateRange({
      start: bulkBooking.dateRange.start,
      end: bulkBooking.dateRange.end,
    });
    setSelectedRange({
      start: bulkBooking.dateRange.start,
      end: bulkBooking.dateRange.end,
    });

    bulkBooking.selectedDevices.forEach((deviceId) => {
      addDeviceDates(deviceId, dateRangeDays);
    });

    toast?.success('Selections added to the booking cart. Review and submit on the right.');
  };

  // Select all devices in a type
  const handleSelectAllInType = (type) => {
    const typeDevices = devicesByType[type] || [];
    typeDevices.forEach(device => {
      if (!bulkBooking.selectedDevices.includes(device.id)) {
        toggleBulkDevice(device.id);
      }
    });
  };

  if (!bulkBooking.enabled) {
    return null;
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
      {/* Sticky header */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 pb-2 -mx-4 px-4 border-b border-gray-200 dark:border-gray-700 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Bulk Booking Mode
          </h3>
          <button
            onClick={toggleBulkBookingMode}
            className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
            aria-label="Close bulk booking mode"
          >
            Close
          </button>
        </div>

        {/* Date Range Selection - Sticky */}
        <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Date Range
        </label>
        <div className="flex gap-2">
          <input
            type="date"
            value={bulkBooking.dateRange.start || ''}
            onChange={(e) => setBulkDateRange({ start: e.target.value })}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <input
            type="date"
            value={bulkBooking.dateRange.end || ''}
            onChange={(e) => setBulkDateRange({ end: e.target.value })}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        </div>
          {dateRangeDays.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {dateRangeDays.length} day{dateRangeDays.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      </div>

      {/* Device Selection by Type */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Devices
        </label>
        <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 dark:border-gray-700 rounded-md p-2">
          {Object.entries(devicesByType)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([type, typeDevices]) => {
              const allSelected = typeDevices.every(d => bulkBooking.selectedDevices.includes(d.id));
              const someSelected = typeDevices.some(d => bulkBooking.selectedDevices.includes(d.id));

              return (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = someSelected && !allSelected;
                        }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleSelectAllInType(type);
                          } else {
                            typeDevices.forEach(device => {
                              if (bulkBooking.selectedDevices.includes(device.id)) {
                                toggleBulkDevice(device.id);
                              }
                            });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="ml-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                        {type} ({typeDevices.length})
                      </span>
                    </label>
                  </div>
                  <div className="ml-6 space-y-1">
                    {typeDevices.map(device => (
                      <label key={device.id} className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bulkBooking.selectedDevices.includes(device.id)}
                          onChange={() => toggleBulkDevice(device.id)}
                          className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-1 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="ml-2 text-xs text-gray-600 dark:text-gray-400 truncate">
                          {device.deviceName}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
        {bulkBooking.selectedDevices.length > 0 && (
          <button
            onClick={clearBulkDevices}
            className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Action Button */}
      <button
        onClick={handleBulkApply}
        disabled={!bulkBooking.dateRange.start || !bulkBooking.dateRange.end || bulkBooking.selectedDevices.length === 0}
        className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Add to Booking Cart
      </button>
    </div>
  );
}

