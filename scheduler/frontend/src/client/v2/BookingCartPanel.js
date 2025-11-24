import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useBookingState from '../../store/useBookingState';
import { useDevices } from '../../services/deviceService';
import { useBookings } from '../../services/bookingService';
import { findConflicts, submitBookings } from '../../services/bookingServiceV2';
import useSchedulerStore from '../../store/schedulerStore';
import { useToastContext } from '../../contexts/ToastContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import CollaboratorInput from '../../components/CollaboratorInput';
import { getPanelBackgroundColor } from '../../utils/darkModeUtils';
import { useDocumentObserver } from '../../hooks/useDocumentObserver';

export default function BookingCartPanel({ userId, userName }) {
  const selectedSlots = useBookingState((state) => state.selectedSlots);
  const selectedDevices = useBookingState((state) => state.selectedDevices);
  const selectedRange = useBookingState((state) => state.selectedRange);
  const setSelectedRange = useBookingState((state) => state.setSelectedRange);
  const getGroupedSelections = useBookingState((state) => state.getGroupedSelections);
  const getSelections = useBookingState((state) => state.getSelections);
  const removeDeviceDates = useBookingState((state) => state.removeDeviceDates);
  const removeDay = useBookingState((state) => state.removeDay);
  const clearAllSelections = useBookingState((state) => state.clearAllSelections);
  const toggleDaySelection = useBookingState((state) => state.toggleDay);
  const getDayKey = useBookingState((state) => state.getDayKey);
  const { data: devices = [] } = useDevices();
  const timeline = useSchedulerStore((state) => state.timeline);
  const setNewlyConfirmedDays = useSchedulerStore((state) => state.setNewlyConfirmedDays);
  const clearNewlyConfirmedDays = useSchedulerStore((state) => state.clearNewlyConfirmedDays);
  const queryClient = useQueryClient();

  const [message, setMessage] = useState('');
  const collaborators = useBookingState((state) => state.collaborators);
  const setCollaborators = useBookingState((state) => state.setCollaborators);
  const clearCollaborators = useBookingState((state) => state.clearCollaborators);
  const [isValidatingCollaborators, setIsValidatingCollaborators] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowConflictSubmission, setAllowConflictSubmission] = useState(false);
  const toast = useToastContext();
  const submitButtonRef = useRef(null);
  const [panelBg, setPanelBg] = useState(() => getPanelBackgroundColor());
  
  // Use centralized document observer to watch for both class and style changes
  useDocumentObserver(() => {
    // Update synchronously to ensure transitions happen together
    setPanelBg(getPanelBackgroundColor());
  }, ['class', 'style']);

  // Get bookings for conflict detection
  const weekStart = timeline.weekStart;
  const { data: bookings = [] } = useBookings(weekStart);

  // Get selections - will re-render when selectionsSet changes
  const selections = useMemo(() => getSelections(), [selectedSlots, getSelections]);
  const groupedSelections = useMemo(() => getGroupedSelections(), [selectedSlots, getGroupedSelections]);
  const selectionDates = useMemo(() => {
    if (selections.length === 0) {
      return [];
    }
    const unique = new Set(selections.map((selection) => selection.date));
    return Array.from(unique).sort();
  }, [selections]);
  const effectiveRangeStart = selectedRange.start || (selectionDates[0] ?? null);
  const effectiveRangeEnd =
    selectedRange.end || (selectionDates.length > 0 ? selectionDates[selectionDates.length - 1] : null);

  useEffect(() => {
    if (!userName) {
      clearCollaborators();
    }
  }, [userName, clearCollaborators]);

  useEffect(() => {
    if (!selectedRange.start && !selectedRange.end && selectionDates.length > 0) {
      const derivedEnd = selectionDates[selectionDates.length - 1] ?? selectionDates[0];
      setSelectedRange({ start: selectionDates[0], end: derivedEnd });
    }
  }, [selectedRange.start, selectedRange.end, selectionDates, setSelectedRange]);

  const handleRemoveDeviceSelections = useCallback((deviceId, dates) => {
    removeDeviceDates(deviceId, dates);
  }, [removeDeviceDates]);

  const handleClearAllSelections = useCallback(() => {
    if (groupedSelections.length === 0) {
      return;
    }

    clearAllSelections();
    setMessage('');
    clearCollaborators();
    setSelectedRange({ start: null, end: null });
    setAllowConflictSubmission(false);

    if (toast) {
      toast.info('All selections cleared.');
    }
  }, [groupedSelections.length, clearAllSelections, toast]);

  // Create device map for quick lookup
  const deviceMap = useMemo(() => {
    const map = new Map();
    devices.forEach((device) => {
      map.set(device.id, device);
    });
    return map;
  }, [devices]);

  // Check for conflicts (must be after selections and bookings are declared)
  const conflicts = useMemo(() => {
    if (selections.length === 0 || bookings.length === 0) return new Set();
    return new Set(
      findConflicts(selections, bookings, {
        currentUserId: userId ?? null,
        currentUsername: userName ?? null,
      })
    );
  }, [selections, bookings, userId, userName]);

  // Keyboard shortcuts (must be after conflicts and selections are declared)
  useKeyboardShortcuts({
    'Enter': () => {
      if (!isSubmitting && conflicts.size === 0 && selections.length > 0 && submitButtonRef.current) {
        submitButtonRef.current.click();
      }
    },
    'Escape': () => {
      if (selections.length > 0) {
        clearAllSelections();
        toast.info('Selection cleared');
      }
    },
  }, [isSubmitting, conflicts.size, selections.length, clearAllSelections, toast]);

  // Create summary by device type and date ranges
  const summaryByType = useMemo(() => {
    const summary = {};
    groupedSelections.forEach((group) => {
      const device = deviceMap.get(group.deviceId);
      if (!device) return;

      const type = device.deviceType || 'Other';
      if (!summary[type]) {
        summary[type] = {
          type,
          devices: new Map(), // deviceId -> { device, dates: Set }
        };
      }

      if (!summary[type].devices.has(group.deviceId)) {
        summary[type].devices.set(group.deviceId, {
          device,
          dates: new Set(),
        });
      }

      const deviceSummary = summary[type].devices.get(group.deviceId);
      const dates = Array.isArray(group.dates) && group.dates.length > 0
        ? group.dates
        : group.date
          ? [group.date]
          : [];
      dates.forEach((date) => deviceSummary.dates.add(date));
    });

    // Convert Sets to sorted arrays
    Object.values(summary).forEach(typeSummary => {
      typeSummary.devices = Array.from(typeSummary.devices.values()).map(item => ({
        ...item,
        dates: Array.from(item.dates).sort(),
      }));
    });

    return summary;
  }, [groupedSelections, deviceMap]);

  const deviceCount = useMemo(
    () => Object.values(summaryByType).reduce((sum, typeSummary) => sum + typeSummary.devices.length, 0),
    [summaryByType]
  );

  const totalSelectedDays = selections.length;
  const hasValidRange = Boolean(effectiveRangeStart && effectiveRangeEnd);
  const hasConflicts = conflicts.size > 0;
  const hasDevicesSelected = selectedDevices.length > 0;
  const canSubmit =
    hasDevicesSelected &&
    hasValidRange &&
    totalSelectedDays > 0 &&
    (!hasConflicts || allowConflictSubmission) &&
    !isSubmitting &&
    !isValidatingCollaborators;

  useEffect(() => {
    if (!hasConflicts && allowConflictSubmission) {
      setAllowConflictSubmission(false);
    }
  }, [hasConflicts, allowConflictSubmission]);

  const rangeLabel = hasValidRange
    ? `${new Date(effectiveRangeStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(effectiveRangeEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : 'No date range selected';

  // Format date range from sorted dates
  const formatDateRange = (dates) => {
    if (dates.length === 0) return '';
    if (dates.length === 1) {
      return new Date(dates[0]).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }

    // Check if dates are consecutive
    const sorted = [...dates].sort();
    const ranges = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const current = new Date(sorted[i]);
      const prev = new Date(sorted[i - 1]);
      const diffDays = Math.floor((current - prev) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        end = sorted[i];
      } else {
        ranges.push({ start, end });
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push({ start, end });

    return ranges.map(range => {
      const startDate = new Date(range.start);
      const endDate = new Date(range.end);
      if (range.start === range.end) {
        return startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }).join(', ');
  };

  // Remove a specific day or slot
  const handleRemove = (deviceId, date, hour = null) => {
    if (hour === null) {
      removeDay(deviceId, date);
    } else {
      toggleDaySelection(deviceId, date);
    }
  };

  // Handle submit booking with grouped payload
  const handleSubmitBooking = useCallback(async () => {
    if (!userId) {
      toast.error('Please sign in to submit bookings');
      return;
    }

    if (!hasDevicesSelected) {
      toast.warning('Please select at least one device');
      return;
    }

    if (!hasValidRange) {
      toast.warning('Please choose a start and end date');
      return;
    }

    if (selections.length === 0) {
      toast.warning('Please select at least one day');
      return;
    }

    if (hasConflicts && !allowConflictSubmission) {
      toast.warning('Resolve conflicting days before submitting');
      return;
    }

    setIsSubmitting(true);

    const slotSet = new Set();
    const slots = [];
    selections.forEach((selection) => {
      const key = `${selection.deviceId}-${selection.date}`;
      if (!slotSet.has(key)) {
        slotSet.add(key);
        slots.push({
          device_id: selection.deviceId,
          date: selection.date,
        });
      }
    });

    if (slots.length === 0) {
      toast.warning('No valid slots selected');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await submitBookings(
        userId,
        selections,
        devices,
        message,
        null,
        collaborators,
        allowConflictSubmission ? 'CONFLICTING' : 'PENDING',
      );

      if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors[0].error || 'Booking failed – please retry.');
      }

      if (result.conflicts > 0 && result.confirmed === 0) {
        toast.warning('Selections conflict with existing bookings. Please adjust and try again.');
        return;
      }

      const daysToConfirm = Array.from(slotSet);
      setNewlyConfirmedDays(daysToConfirm);
      setTimeout(() => {
        clearNewlyConfirmedDays();
      }, 3000);

      toast.success('Booking request sent successfully — awaiting approval.');

      clearAllSelections();
      setMessage('');
      clearCollaborators();
      setSelectedRange({ start: null, end: null });
      setAllowConflictSubmission(false);

      await queryClient.invalidateQueries(['bookings']);
    } catch (error) {
      toast.error(error.message || 'Booking failed. Please try again or check network.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    userId,
    hasDevicesSelected,
    hasValidRange,
    selections,
    hasConflicts,
    selectedDevices,
    message,
    collaborators,
    devices,
    toast,
    clearAllSelections,
    setNewlyConfirmedDays,
    clearNewlyConfirmedDays,
    queryClient,
    clearCollaborators,
    setSelectedRange,
  ]);
  // Check if a specific day or slot has a conflict
  const hasConflict = (deviceId, date, hour = null) => {
    if (hour === null) {
      // Daily selection
      const dayKey = getDayKey(deviceId, date);
      return conflicts.has(dayKey);
    } else {
      // Hourly selection
      const slotKey = `${deviceId}-${date}-${hour}`;
      return conflicts.has(slotKey);
    }
  };

  if (!userName) {
    return (
      <div className="h-full glass-panel border-l border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Booking Cart
        </h2>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Please sign in to make bookings
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-full glass-panel border-l border-gray-200 dark:border-gray-700 flex flex-col"
      style={{
        backgroundColor: panelBg,
        transition: 'background-color 0.3s ease-in-out'
      }}
    >
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Booking Cart
          </h2>
          {groupedSelections.length > 0 && (
            <button
              onClick={handleClearAllSelections}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear All
            </button>
          )}
        </div>
        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
          <div>
            <span className="font-medium text-gray-900 dark:text-white">Date range:</span>{' '}
            {rangeLabel}
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-white">Devices:</span>{' '}
            {deviceCount}
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-white">Total days:</span>{' '}
            {totalSelectedDays}
          </div>
        </div>
        {hasConflicts && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            Resolve conflicts highlighted below before submitting.
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {groupedSelections.length === 0 ? (
          <div className="text-center py-12 px-4 animate-slide-in">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Your cart is empty
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Select days in the timeline to start booking. You can drag across multiple cells or click individual days.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Tip: Use templates or linked device groups for faster selection
            </p>
          </div>
        ) : (
          Object.entries(summaryByType)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([type, typeSummary]) => {
              // Check for conflicts in this type
              const typeHasConflicts = typeSummary.devices.some(deviceItem => {
                return deviceItem.dates.some(date => hasConflict(deviceItem.device.id, date, null));
              });

              return (
                <div
                  key={type}
                  className={`p-3 rounded-lg border ${typeHasConflicts
                    ? 'bg-red-100/40 dark:bg-red-900/25 border-red-200 dark:border-red-700 backdrop-blur'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                    }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {type}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {typeSummary.devices.length} device{typeSummary.devices.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {typeHasConflicts && (
                    <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/40 rounded text-xs text-red-700 dark:text-red-300">
                      ⚠️ Some days have conflicts
                    </div>
                  )}

                  <div className="space-y-2">
                    {typeSummary.devices.map((deviceItem) => {
                      const device = deviceItem.device;
                      const dateRange = formatDateRange(deviceItem.dates);
                      const hasDeviceConflict = deviceItem.dates.some(date => hasConflict(device.id, date, null));

                      return (
                        <div
                          key={device.id}
                          className={`p-2 rounded border ${hasDeviceConflict
                            ? 'bg-red-100/40 dark:bg-red-900/15 border-red-300 dark:border-red-700 backdrop-blur'
                            : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                            }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                {device.deviceName}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {dateRange}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                                {deviceItem.dates.length} day{deviceItem.dates.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemoveDeviceSelections(device.id, deviceItem.dates)}
                              className="ml-2 p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Remove all days for this device"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
        )}
      </div>

      {groupedSelections.length > 0 && (
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <div>
            <label htmlFor="booking-message" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message / Notes
            </label>
            <textarea
              id="booking-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add any context or requirements..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
              aria-label="Optional message for booking"
            />
          </div>
          <div className="space-y-1">
            <CollaboratorInput
              value={collaborators}
              onChange={setCollaborators}
              currentUser={userName}
              disabled={!userName}
              label="Add Collaborators (usernames)"
              placeholder="Type a username and press Enter"
              onValidatingChange={setIsValidatingCollaborators}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Collaborators share access to these devices for the same dates. Only you can cancel or change the list.
            </p>
          </div>
          <button
            ref={submitButtonRef}
            onClick={handleSubmitBooking}
            disabled={!canSubmit}
            className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${!canSubmit
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'text-white shadow-sm hover:shadow-md hover:opacity-90'
              }`}
            style={canSubmit ? (() => {
              // Calculate hue with wrap-around to ensure it stays within 0-360
              const root = document.documentElement;
              const computedStyle = getComputedStyle(root);
              const baseHue = parseInt(computedStyle.getPropertyValue('--accent-hue') || '270', 10);
              const saturation = computedStyle.getPropertyValue('--accent-saturation') || '70%';
              const lightness = computedStyle.getPropertyValue('--accent-lightness') || '50%';
              const gradientHue = (baseHue + 30) % 360;
              return {
                background: `linear-gradient(to right, 
                  hsl(${baseHue}, ${saturation}, ${lightness}),
                  hsl(${gradientHue}, ${saturation}, ${lightness}))`
              };
            })() : {}}
            aria-label={isSubmitting ? 'Submitting booking' : 'Submit booking (Press Enter)'}
            aria-disabled={!canSubmit}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Submit Booking
              </>
            )}
          </button>

          {conflicts.size > 0 && (
            <div className="space-y-2 text-xs text-red-600 dark:text-red-400" role="alert">
              <p className="text-center">
                These selections overlap with an existing booking. Submitting will mark your request as <span className="font-semibold">CONFLICTING</span>.
              </p>
              <label className="flex items-center justify-center gap-2 text-red-600 dark:text-red-300">
                <input
                  type="checkbox"
                  checked={allowConflictSubmission}
                  onChange={(e) => setAllowConflictSubmission(e.target.checked)}
                  className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500 dark:border-red-400 dark:bg-gray-800"
                />
                Submit anyway (admin will resolve conflicts)
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
