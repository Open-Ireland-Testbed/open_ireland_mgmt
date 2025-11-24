import React, { useMemo, useEffect, useState } from 'react';
import Fuse from 'fuse.js';
import { useDevices } from '../../services/deviceService';
import { useBookingsWithAdjacentWeeks, useBookingsForRange } from '../../services/bookingService';
import useSchedulerStore from '../../store/schedulerStore';
import TimelineGrid from './TimelineGrid';

export default function TimelinePanel({ userName }) {
  const { data: devices = [], isLoading, error } = useDevices();
  const { filters, timeline, setWeekStart, ui } = useSchedulerStore();
  const {
    searchQuery = '',
    deviceTypes: filterDeviceTypes = [],
    deviceIds: filterDeviceIds = [],
  } = filters || {};
  const trimmedSearchQuery = searchQuery?.trim();

  // Calculate current week based on offset
  const currentWeekStart = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    // Add week offset (each offset is 7 days)
    monday.setDate(monday.getDate() + (timeline.currentWeekOffset * 7));
    return monday;
  }, [timeline.currentWeekOffset]);

  // Update weekStart in store when currentWeekStart changes
  useEffect(() => {
    const weekStartStr = currentWeekStart.toISOString().split('T')[0];
    setWeekStart(weekStartStr);
  }, [currentWeekStart, setWeekStart]);

  // Get selected date (use Monday of current week)
  const selectedDate = currentWeekStart;
  const weekStart = currentWeekStart.toISOString().split('T')[0];

  // Fetch bookings - use range if set, otherwise use week
  const {
    currentWeek,
    isLoading: bookingsLoading,
    isFetching: bookingsFetching,
  } = useBookingsWithAdjacentWeeks(weekStart);
  const {
    data: rangeBookings = [],
    isLoading: rangeBookingsLoading,
    isFetching: rangeBookingsFetching,
  } = useBookingsForRange(
    ui.dateRange.start,
    ui.dateRange.end
  );
  
  // Use range bookings if date range is set, otherwise use week bookings
  const bookings = (ui.dateRange.start && ui.dateRange.end) ? rangeBookings : (currentWeek?.data || []);
  const isLoadingBookings = (ui.dateRange.start && ui.dateRange.end) ? rangeBookingsLoading : bookingsLoading;
  const isFetchingBookings = (ui.dateRange.start && ui.dateRange.end) ? rangeBookingsFetching : bookingsFetching;

  const [stableBookings, setStableBookings] = useState([]);

  useEffect(() => {
    if (!isLoadingBookings && !isFetchingBookings && bookings !== undefined) {
      setStableBookings(bookings);
    }
  }, [bookings, isFetchingBookings, isLoadingBookings]);

  const effectiveBookings =
    isLoadingBookings || isFetchingBookings
      ? stableBookings
      : bookings;

  const fuzzyDeviceSearch = useMemo(() => {
    if (!devices || devices.length === 0) {
      return null;
    }
    return new Fuse(devices, {
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2,
      distance: 150,
      keys: [
        { name: 'deviceName', weight: 0.5 },
        { name: 'polatis_name', weight: 0.3 },
        { name: 'deviceType', weight: 0.2 },
        { name: 'ip_address', weight: 0.2 },
      ],
    });
  }, [devices]);

  // Filter and group devices by deviceName (collapse duplicates)
  const filteredDevices = useMemo(() => {
    let filtered = [...devices];

    // Apply search filter
    if (trimmedSearchQuery) {
      if (fuzzyDeviceSearch) {
        const fuseResults = fuzzyDeviceSearch.search(trimmedSearchQuery);
        if (fuseResults.length > 0) {
          const uniqueResults = [];
          const seenIds = new Set();
          fuseResults.forEach(({ item }) => {
            if (item && !seenIds.has(item.id)) {
              seenIds.add(item.id);
              uniqueResults.push(item);
            }
          });
          filtered = uniqueResults;
        } else {
          filtered = [];
        }
      } else {
        const query = trimmedSearchQuery.toLowerCase();
        filtered = filtered.filter(
          (device) =>
            device.deviceName?.toLowerCase().includes(query) ||
            device.deviceType?.toLowerCase().includes(query) ||
            device.ip_address?.toLowerCase().includes(query) ||
            device.polatis_name?.toLowerCase().includes(query)
        );
      }
    }

    // Apply device type filter
    if (filterDeviceTypes.length > 0) {
      filtered = filtered.filter((device) =>
        filterDeviceTypes.includes(device.deviceType)
      );
    }

    // Apply device ID filter (for linked groups)
    // Check if any of the device's IDs match the filter
    if (filterDeviceIds.length > 0) {
      filtered = filtered.filter((device) => {
        // For collapsed groups, check all IDs
        if (device.ids) {
          return device.ids.some(id => filterDeviceIds.includes(id));
        }
        return filterDeviceIds.includes(device.id);
      });
    }

    // Group devices by deviceType and deviceName (collapse duplicates)
    // Devices with the same deviceName but different polatis_name will be merged
    const groupedByTypeAndName = {};
    filtered.forEach(device => {
      const type = device.deviceType || 'Other';
      const name = device.deviceName || 'Unnamed';
      const key = `${type}::${name}`;
      
      if (!groupedByTypeAndName[key]) {
        // Create a merged device object
        groupedByTypeAndName[key] = {
          id: device.id, // Use the first device's ID as primary
          ids: [device.id], // Store all IDs for booking matching
          deviceType: device.deviceType,
          deviceName: device.deviceName,
          ip_address: device.ip_address,
          status: device.status,
          maintenance_start: device.maintenance_start,
          maintenance_end: device.maintenance_end,
        };
      } else {
        // Add this device's ID to the group
        groupedByTypeAndName[key].ids.push(device.id);
        
        // Status logic: If any device is Maintenance, the group shows Maintenance
        // Otherwise, if any device is Available, the group shows Available
        // Priority: Maintenance > Available > other statuses
        if (device.status === 'Maintenance') {
          groupedByTypeAndName[key].status = 'Maintenance';
        } else if (device.status === 'Available' && groupedByTypeAndName[key].status !== 'Maintenance') {
          groupedByTypeAndName[key].status = 'Available';
        }
        
        // Merge maintenance windows if needed (use earliest start, latest end)
        if (device.maintenance_start && (!groupedByTypeAndName[key].maintenance_start || 
            device.maintenance_start < groupedByTypeAndName[key].maintenance_start)) {
          groupedByTypeAndName[key].maintenance_start = device.maintenance_start;
        }
        if (device.maintenance_end && (!groupedByTypeAndName[key].maintenance_end || 
            device.maintenance_end > groupedByTypeAndName[key].maintenance_end)) {
          groupedByTypeAndName[key].maintenance_end = device.maintenance_end;
        }
      }
    });

    // Convert grouped object back to array and sort
    const groupedDevices = Object.values(groupedByTypeAndName);
    return groupedDevices.sort((a, b) => {
      const nameA = a.deviceName || '';
      const nameB = b.deviceName || '';
      return nameA.localeCompare(nameB);
    });
  }, [devices, filterDeviceIds, filterDeviceTypes, fuzzyDeviceSearch, trimmedSearchQuery]);

  if (error) {
    return (
      <div className="h-full glass-panel flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Timeline
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-sm text-red-600 dark:text-red-400">
            Error loading devices: {error.message}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full glass-panel flex-1 flex flex-col overflow-hidden">
      {isLoading || isLoadingBookings ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse space-y-4 w-full max-w-md px-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto"></div>
            <div className="space-y-2">
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              No devices found
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {trimmedSearchQuery || filterDeviceTypes.length > 0 || filterDeviceIds.length > 0
                ? 'Try adjusting your filters'
                : 'No devices available'}
            </p>
          </div>
        </div>
      ) : (
        <TimelineGrid
          devices={filteredDevices}
          selectedDate={selectedDate}
          bookings={effectiveBookings}
          currentUserName={userName}
          isLoading={isLoading || isLoadingBookings || isFetchingBookings}
        />
      )}
    </div>
  );
}
