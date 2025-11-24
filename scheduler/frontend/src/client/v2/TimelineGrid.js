import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { FixedSizeList } from 'react-window';
import useBookingState from '../../store/useBookingState';
import useSchedulerStore from '../../store/schedulerStore';
import { findConflicts } from '../../services/bookingServiceV2';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useDocumentObserver } from '../../hooks/useDocumentObserver';
import { getPanelBackgroundColor, getBookedCellBackgroundColor, getBookedCellBorderColor } from '../../utils/darkModeUtils';

const DAYS_IN_WEEK = 7;
const CELL_WIDTH = 100; // Width of each day cell in pixels (reduced for multi-week)
const DEVICE_NAME_WIDTH = 220; // Width of device name column (increased for checkbox)
const ROW_HEIGHT = 60; // Height of each device row
const GROUP_HEADER_HEIGHT = 40; // Height of device group header
const HEADER_HEIGHT = 50; // Height of the header row
const FOOTER_HEIGHT = 60; // Height of the footer/legend
const TOP_HEADER_HEIGHT = 80; // Height of the top header (increased for navigation)
const INACTIVE_BOOKING_STATUSES = new Set(['CANCELLED', 'EXPIRED', 'REJECTED', 'DECLINED']);
const CONFIRMED_BOOKING_STATUSES = new Set(['CONFIRMED', 'APPROVED']);
const PENDING_BOOKING_STATUSES = new Set(['PENDING', 'CONFLICTING']);

/**
 * TimelineGrid component that displays devices as rows and days as columns
 */
export default function TimelineGrid({ devices, selectedDate, bookings = [], currentUserName, isLoading = false }) {
    const toggleDay = useBookingState((state) => state.toggleDay);
    const isDaySelected = useBookingState((state) => state.isDaySelected);
    const getDayKey = useBookingState((state) => state.getDayKey);
    const getSelections = useBookingState((state) => state.getSelections);
    const selectedSlots = useBookingState((state) => state.selectedSlots);
    const selectedDevices = useBookingState((state) => state.selectedDevices);
    const toggleDevice = useBookingState((state) => state.toggleDevice);
    const addDeviceDates = useBookingState((state) => state.addDeviceDates);
    const { navigateWeek, timeline, ui } = useSchedulerStore();
    const filters = useSchedulerStore((state) => state.filters);
    const [conflicts, setConflicts] = useState(new Set()); // Store conflicting day keys
    const [collapsedGroups, setCollapsedGroups] = useState(() => {
        // Load from localStorage
        try {
            const saved = localStorage.getItem('scheduler_collapsedGroups');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    }); // Store collapsed device type groups
    const [listHeight, setListHeight] = useState(600); // Dynamic height for virtualized list
    const [listWidth, setListWidth] = useState(1000); // Dynamic width for virtualized list
    const [isDragging, setIsDragging] = useState(false); // Track drag selection
    const [dragStart, setDragStart] = useState(null); // Track drag start cell { deviceId, date }
    const [dragEnd, setDragEnd] = useState(null); // Track drag end cell
    const hasDraggedRef = useRef(false); // Track if mouse actually moved (to distinguish click from drag)
    const justDraggedRef = useRef(false); // Track if we just finished a drag (to prevent click handler from toggling)
    const containerRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const headerScrollRef = useRef(null);
    const bodyScrollRef = useRef(null);

    // Track panel background color for dark mode
    const [panelBg, setPanelBg] = useState(() => getPanelBackgroundColor());
    const [bookedBg, setBookedBg] = useState(() => getBookedCellBackgroundColor());
    const [bookedBorder, setBookedBorder] = useState(() => getBookedCellBorderColor());
    
    // Update colors function
    const updateColors = useCallback(() => {
        // Update all colors synchronously to ensure transitions happen together
        setPanelBg(getPanelBackgroundColor());
        setBookedBg(getBookedCellBackgroundColor());
        setBookedBorder(getBookedCellBorderColor());
    }, []);
    
    // Use centralized document observer to reduce multiple observers
    // Watch both 'class' and 'style' since CSS variables are updated via style attribute
    useDocumentObserver(updateColors, ['class', 'style']);

    // Get newly confirmed days for highlighting
    const newlyConfirmedDays = ui.newlyConfirmedDays || new Set();
    const hasActiveSearchFilters =
        Boolean(filters?.searchQuery?.trim()) ||
        (filters?.deviceTypes?.length ?? 0) > 0 ||
        (filters?.deviceIds?.length ?? 0) > 0;

    // Generate days - support multi-week view if date range is set
    const weekDays = useMemo(() => {
        const days = [];

        // If date range is set, show all days in range
        if (ui.dateRange?.start && ui.dateRange?.end) {
            const start = new Date(ui.dateRange.start);
            const end = new Date(ui.dateRange.end);
            const current = new Date(start);

            while (current <= end) {
                days.push({
                    date: current.toISOString().split('T')[0],
                    label: current.toLocaleDateString('en-US', { weekday: 'short' }),
                    fullLabel: current.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                    }),
                    dayObj: new Date(current),
                });
                current.setDate(current.getDate() + 1);
            }

            return days;
        }

        // Otherwise, show single week (Monday to Sunday)
        const startDate = selectedDate ? new Date(selectedDate) : new Date();
        const dayOfWeek = startDate.getDay();
        const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(startDate);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);

        for (let i = 0; i < DAYS_IN_WEEK; i++) {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            days.push({
                date: day.toISOString().split('T')[0],
                label: day.toLocaleDateString('en-US', { weekday: 'short' }),
                fullLabel: day.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                }),
                dayObj: day,
            });
        }

        return days;
    }, [selectedDate, timeline.ui?.dateRange]);

    // Calculate available height and width for the list
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const availableHeight =
                    containerRef.current.clientHeight - HEADER_HEIGHT - FOOTER_HEIGHT - TOP_HEADER_HEIGHT;
                setListHeight(Math.max(300, availableHeight)); // Minimum 300px
            }
            if (scrollContainerRef.current) {
                const containerWidth = scrollContainerRef.current.clientWidth || 1000;
                // Calculate required width based on number of days (could be multi-week)
                const daysCount = weekDays?.length || DAYS_IN_WEEK;
                const requiredWidth = DEVICE_NAME_WIDTH + CELL_WIDTH * Math.max(DAYS_IN_WEEK, daysCount);
                setListWidth(Math.max(containerWidth, requiredWidth));
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        const resizeObserver = new ResizeObserver(updateDimensions);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }
        if (scrollContainerRef.current) {
            resizeObserver.observe(scrollContainerRef.current);
        }

        return () => {
            window.removeEventListener('resize', updateDimensions);
            resizeObserver.disconnect();
        };
    }, [weekDays]);

    // Sync horizontal scrolling between header and body
    useEffect(() => {
        const headerEl = headerScrollRef.current;
        const bodyEl = bodyScrollRef.current;

        if (!headerEl || !bodyEl) return;

        const handleBodyScroll = () => {
            if (headerEl.scrollLeft !== bodyEl.scrollLeft) {
                headerEl.scrollLeft = bodyEl.scrollLeft;
            }
        };

        const handleHeaderScroll = () => {
            if (bodyEl.scrollLeft !== headerEl.scrollLeft) {
                bodyEl.scrollLeft = headerEl.scrollLeft;
            }
        };

        bodyEl.addEventListener('scroll', handleBodyScroll);
        headerEl.addEventListener('scroll', handleHeaderScroll);

        return () => {
            bodyEl.removeEventListener('scroll', handleBodyScroll);
            headerEl.removeEventListener('scroll', handleHeaderScroll);
        };
    }, [weekDays]);

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

    // Get sorted device types
    const deviceTypes = useMemo(() => {
        return Object.keys(devicesByType).sort();
    }, [devicesByType]);

    const allGroupsCollapsed = useMemo(
        () => deviceTypes.length > 0 && deviceTypes.every((type) => collapsedGroups.has(type)),
        [deviceTypes, collapsedGroups]
    );

    const handleToggleCollapseAll = useCallback(() => {
        if (deviceTypes.length === 0) {
            return;
        }
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            const currentlyAllCollapsed = deviceTypes.every((type) => next.has(type));
            if (currentlyAllCollapsed) {
                next.clear();
            } else {
                deviceTypes.forEach((type) => next.add(type));
            }
            try {
                localStorage.setItem('scheduler_collapsedGroups', JSON.stringify(Array.from(next)));
            } catch (e) {
                console.warn('Failed to save collapsed groups:', e);
            }
            return next;
        });
    }, [deviceTypes]);

    // Get visible devices (filter out collapsed groups)
    const visibleDevices = useMemo(() => {
        const visible = [];
        deviceTypes.forEach(type => {
            const groupCollapsed = !hasActiveSearchFilters && collapsedGroups.has(type);
            if (!groupCollapsed) {
                visible.push(...(devicesByType[type] || []));
            }
        });
        return visible;
    }, [devicesByType, deviceTypes, collapsedGroups, hasActiveSearchFilters]);

    const isGridLoading = Boolean(isLoading);
    const showCollapsedNotice =
        !hasActiveSearchFilters && visibleDevices.length === 0 && deviceTypes.length > 0;
    const showTodayButton = timeline.currentWeekOffset !== 0;

    // Toggle group collapse
    const toggleGroup = useCallback((deviceType) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(deviceType)) {
                next.delete(deviceType);
            } else {
                next.add(deviceType);
            }
            // Persist to localStorage
            try {
                localStorage.setItem('scheduler_collapsedGroups', JSON.stringify(Array.from(next)));
            } catch (e) {
                console.warn('Failed to save collapsed groups:', e);
            }
            return next;
        });
    }, []);

    // Check if a date is in the past
    const isPastDate = useCallback((dateStr) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);
        return date < today;
    }, []);

    // Convert bookings to a map of booked days for quick lookup
    // Format: "deviceId-date" -> booking info
    // A day is considered booked if any booking overlaps with the full day range (07:00-19:00)
    // Supports collapsed device groups (devices with multiple IDs)
    const bookedDays = useMemo(() => {
        const booked = new Map();
        const weekDateStrs = new Set(weekDays.map(d => d.date));

        // Create a map of device IDs to device objects for quick lookup
        const deviceIdMap = new Map();
        devices.forEach(device => {
            // Handle both single ID and multiple IDs (collapsed groups)
            const deviceIds = device.ids || [device.id];
            deviceIds.forEach(id => {
                if (!deviceIdMap.has(id)) {
                    deviceIdMap.set(id, device);
                }
            });
        });

        bookings.forEach((booking) => {
            const statusKey = (booking.status || '').toUpperCase();
            if (INACTIVE_BOOKING_STATUSES.has(statusKey)) {
                return;
            }
            const bookingStart = new Date(booking.start_time);
            const bookingEnd = new Date(booking.end_time);
            const device = deviceIdMap.get(booking.device_id);

            if (!device) return; // Skip if device not in current view

            // Use the device's primary ID for the day key (the displayed device)
            const displayDeviceId = device.id;

            // Check each day in the week to see if this booking overlaps
            weekDays.forEach((day) => {
                if (!weekDateStrs.has(day.date)) return;

                // Check if booking overlaps with the full day range
                const dayStart = new Date(`${day.date}T00:00:00`);
                const dayEnd = new Date(`${day.date}T23:59:59`);

                // Check for overlap
                if (bookingStart < dayEnd && bookingEnd > dayStart) {
                    const dayKey = getDayKey(displayDeviceId, day.date);
                    const existing = booked.get(dayKey);
                    const shouldReplace =
                        !existing ||
                        ((existing.booking?.is_collaborator ?? false) && !booking.is_collaborator);
                    if (shouldReplace) {
                        booked.set(dayKey, {
                            booking,
                            isCollaborator: Boolean(booking.is_collaborator),
                            ownerUsername: booking.owner_username || booking.username || null,
                            collaborators: Array.isArray(booking.collaborators)
                                ? booking.collaborators.filter(Boolean)
                                : [],
                            status: statusKey,
                        });
                    }
                }
            });
        });

        return booked;
    }, [bookings, weekDays, getDayKey, devices]);

    // Get selections and check for conflicts
    const selections = useMemo(() => getSelections(), [selectedSlots, getSelections]);

    useEffect(() => {
        const weekDateStrs = new Set(weekDays.map(d => d.date));
        const weekSelections = selections.filter((s) => weekDateStrs.has(s.date));

        if (weekSelections.length > 0 && bookings.length > 0) {
            const conflictKeys = findConflicts(weekSelections, bookings, {
                currentUsername: currentUserName ?? null,
            });
            setConflicts(new Set(conflictKeys));
        } else {
            setConflicts(new Set());
        }
    }, [selections, bookings, weekDays, getSelections, currentUserName]);

    // Get cell state (available, selected, booked, conflicting, past, newlyConfirmed)
    const getCellState = useCallback(
        (deviceId, dateStr) => {
            const dayKey = getDayKey(deviceId, dateStr);

            if (isPastDate(dateStr)) {
                return 'past';
            }

            // Check if newly confirmed (highlight in green)
            if (newlyConfirmedDays.has(dayKey)) {
                return 'newlyConfirmed';
            }

            if (isDaySelected(deviceId, dateStr)) {
                if (conflicts.has(dayKey)) {
                    return 'conflicting';
                }
                return 'selected';
            }

        if (bookedDays.has(dayKey)) {
            const bookingInfo = bookedDays.get(dayKey);
            const statusKey = bookingInfo?.status || '';
            const ownerLower = (bookingInfo?.ownerUsername || '').toLowerCase();
            const currentUserLower = currentUserName ? currentUserName.toLowerCase() : null;
            const isOwner = currentUserLower && ownerLower === currentUserLower;

            if (isOwner) {
                if (CONFIRMED_BOOKING_STATUSES.has(statusKey)) {
                    return 'ownedConfirmed';
                }
                if (PENDING_BOOKING_STATUSES.has(statusKey)) {
                    return 'ownedPending';
                }
            }

            const collaborators = bookingInfo?.collaborators || [];
            if (
                currentUserLower &&
                collaborators.some(
                    (name) => typeof name === 'string' && name.toLowerCase() === currentUserLower
                )
            ) {
                if (CONFIRMED_BOOKING_STATUSES.has(statusKey)) {
                    return 'ownedConfirmed';
                }
                if (PENDING_BOOKING_STATUSES.has(statusKey)) {
                    return 'ownedPending';
                }
            }

            return 'booked';
            }

            return 'available';
        },
        [isDaySelected, bookedDays, conflicts, isPastDate, getDayKey, newlyConfirmedDays, currentUserName]
    );

    // Add keyboard shortcuts
    useKeyboardShortcuts({
        'ArrowLeft': () => navigateWeek(-1),
        'ArrowRight': () => navigateWeek(1),
        'Alt+ArrowLeft': () => navigateWeek(-1),
        'Alt+ArrowRight': () => navigateWeek(1),
        'Ctrl+a': (e) => {
            e.preventDefault();
            // Select all available days for all visible devices
            visibleDevices.forEach(device => {
                weekDays.forEach(day => {
                    if (!isPastDate(day.date) && !bookedDays.has(getDayKey(device.id, day.date))) {
                        if (!isDaySelected(device.id, day.date)) {
                            toggleDay(device.id, day.date);
                        }
                    }
                });
            });
        },
    }, [navigateWeek, visibleDevices, weekDays, isPastDate, bookedDays, getDayKey, isDaySelected, toggleDay]);

    // Handle day click - toggle selection (used for keyboard events and non-virtualized rendering)
    const handleDayClick = useCallback(
        (deviceId, dateStr, event = null) => {
            // Don't allow selecting past dates or booked days
            if (isPastDate(dateStr)) {
                return;
            }

            const dayKey = getDayKey(deviceId, dateStr);
            if (bookedDays.has(dayKey)) {
                return;
            }

            // Handle Shift+Click for range selection
            if (event && event.shiftKey && dragStart) {
                // Select range from dragStart to current cell
                const startDevice = visibleDevices.findIndex(d => d.id === dragStart.deviceId);
                const endDevice = visibleDevices.findIndex(d => d.id === deviceId);
                const startDateIdx = weekDays.findIndex(d => d.date === dragStart.date);
                const endDateIdx = weekDays.findIndex(d => d.date === dateStr);

                if (startDevice >= 0 && endDevice >= 0 && startDateIdx >= 0 && endDateIdx >= 0) {
                    const deviceStart = Math.min(startDevice, endDevice);
                    const deviceEnd = Math.max(startDevice, endDevice);
                    const dateStart = Math.min(startDateIdx, endDateIdx);
                    const dateEnd = Math.max(startDateIdx, endDateIdx);

                    for (let d = deviceStart; d <= deviceEnd; d++) {
                        for (let dt = dateStart; dt <= dateEnd; dt++) {
                            const dev = visibleDevices[d];
                            const date = weekDays[dt].date;
                            if (!isPastDate(date)) {
                                const key = getDayKey(dev.id, date);
                                if (!bookedDays.has(key)) {
                                    if (!isDaySelected(dev.id, date)) {
                                        toggleDay(dev.id, date);
                                    }
                                }
                            }
                        }
                    }
                    return;
                }
            }

            // Simple click - toggle selection
            toggleDay(deviceId, dateStr);
            setDragStart({ deviceId, date: dateStr });
        },
        [toggleDay, bookedDays, isPastDate, getDayKey, dragStart, visibleDevices, weekDays, isDaySelected]
    );

    // Handle drag start
    const handleDragStart = useCallback((deviceId, dateStr, event) => {
        if (isPastDate(dateStr)) return;
        const dayKey = getDayKey(deviceId, dateStr);
        if (bookedDays.has(dayKey)) return;

        hasDraggedRef.current = false; // Reset drag tracking
        justDraggedRef.current = false; // Reset drag completion flag
        setIsDragging(true);
        setDragStart({ deviceId, date: dateStr });
        setDragEnd({ deviceId, date: dateStr });
    }, [isPastDate, getDayKey, bookedDays]);

    // Handle drag over
    const handleDragOver = useCallback((deviceId, dateStr, event) => {
        if (!isDragging || !dragStart) return;
        event.preventDefault();

        if (isPastDate(dateStr)) return;
        const dayKey = getDayKey(deviceId, dateStr);
        if (bookedDays.has(dayKey)) return;

        // Only mark as dragged if this is a different cell than the start (actual drag)
        // This prevents tiny mouse movements from being considered a drag
        if (dragStart.deviceId !== deviceId || dragStart.date !== dateStr) {
            hasDraggedRef.current = true;
        }

        setDragEnd({ deviceId, date: dateStr });
    }, [isDragging, dragStart, isPastDate, getDayKey, bookedDays]);

    // Handle drag end - also handles simple clicks
    const handleDragEnd = useCallback((deviceId, dateStr) => {
        // Check if this was actually a drag (mouse moved) or just a click
        const wasDrag = hasDraggedRef.current && isDragging && dragStart && dragEnd;
        
        if (wasDrag) {
            // Process drag selection
            justDraggedRef.current = true;
            
            const startDeviceIdx = visibleDevices.findIndex(d => d.id === dragStart.deviceId);
            const endDeviceIdx = visibleDevices.findIndex(d => d.id === dragEnd.deviceId);
            const startDateIdx = weekDays.findIndex(d => d.date === dragStart.date);
            const endDateIdx = weekDays.findIndex(d => d.date === dragEnd.date);

            if (startDeviceIdx >= 0 && endDeviceIdx >= 0 && startDateIdx >= 0 && endDateIdx >= 0) {
                const deviceStart = Math.min(startDeviceIdx, endDeviceIdx);
                const deviceEnd = Math.max(startDeviceIdx, endDeviceIdx);
                const dateStart = Math.min(startDateIdx, endDateIdx);
                const dateEnd = Math.max(startDateIdx, endDateIdx);

                for (let d = deviceStart; d <= deviceEnd; d++) {
                    for (let dt = dateStart; dt <= dateEnd; dt++) {
                        const dev = visibleDevices[d];
                        const date = weekDays[dt].date;
                        if (!isPastDate(date)) {
                            const key = getDayKey(dev.id, date);
                            if (!bookedDays.has(key) && !isDaySelected(dev.id, date)) {
                                toggleDay(dev.id, date);
                            }
                        }
                    }
                }
            }
        } else if (isDragging && dragStart) {
            // It was a simple click (mouse down and up on same cell) - toggle selection
            if (!isPastDate(dragStart.date)) {
                const dayKey = getDayKey(dragStart.deviceId, dragStart.date);
                if (!bookedDays.has(dayKey)) {
                    toggleDay(dragStart.deviceId, dragStart.date);
                }
            }
        } else if (deviceId && dateStr) {
            // Fallback: handle click directly if drag state wasn't set up
            if (!isPastDate(dateStr)) {
                const dayKey = getDayKey(deviceId, dateStr);
                if (!bookedDays.has(dayKey)) {
                    toggleDay(deviceId, dateStr);
                }
            }
        }

        // Reset drag state
        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
        hasDraggedRef.current = false;
        
        // Clear the justDragged flag after a short delay
        setTimeout(() => {
            justDraggedRef.current = false;
        }, 100);
    }, [isDragging, dragStart, dragEnd, visibleDevices, weekDays, isPastDate, getDayKey, bookedDays, isDaySelected, toggleDay]);

    // Check if cell is in drag range
    const isInDragRange = useCallback((deviceId, dateStr) => {
        if (!isDragging || !dragStart || !dragEnd) return false;

        const deviceIdx = visibleDevices.findIndex(d => d.id === deviceId);
        const dateIdx = weekDays.findIndex(d => d.date === dateStr);
        const startDeviceIdx = visibleDevices.findIndex(d => d.id === dragStart.deviceId);
        const endDeviceIdx = visibleDevices.findIndex(d => d.id === dragEnd.deviceId);
        const startDateIdx = weekDays.findIndex(d => d.date === dragStart.date);
        const endDateIdx = weekDays.findIndex(d => d.date === dragEnd.date);

        if (deviceIdx < 0 || dateIdx < 0 || startDeviceIdx < 0 || endDeviceIdx < 0 || startDateIdx < 0 || endDateIdx < 0) {
            return false;
        }

        const deviceMin = Math.min(startDeviceIdx, endDeviceIdx);
        const deviceMax = Math.max(startDeviceIdx, endDeviceIdx);
        const dateMin = Math.min(startDateIdx, endDateIdx);
        const dateMax = Math.max(startDateIdx, endDateIdx);

        return deviceIdx >= deviceMin && deviceIdx <= deviceMax && dateIdx >= dateMin && dateIdx <= dateMax;
    }, [isDragging, dragStart, dragEnd, visibleDevices, weekDays]);

    // Render a single row (device)
    const Row = ({ index, style }) => {
        const device = visibleDevices[index];
        if (!device) return null;

        return (
            <div
                style={{
                  ...style,
                  backgroundColor: panelBg,
                  transition: 'background-color 0.3s ease-in-out'
                }}
                className="flex border-b border-gray-200 dark:border-gray-700 glass-panel"
            >
                {/* Device name column (sticky) */}
                <div
                    className="flex-shrink-0 flex items-center px-4 border-r border-gray-200 dark:border-gray-700 glass-panel sticky left-0 z-10 shadow-sm"
                    style={{ 
                      width: DEVICE_NAME_WIDTH, 
                      height: ROW_HEIGHT,
                      backgroundColor: panelBg
                    }}
                >
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {device.deviceName || 'Unnamed Device'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {device.deviceType || 'N/A'}
                        </span>
                    </div>
                </div>

                {/* Day cells */}
                <div className="flex gap-1.5 px-1.5" style={{ width: CELL_WIDTH * DAYS_IN_WEEK }}>
                    {weekDays.map((day) => {
                        const cellState = getCellState(device.id, day.date);

                        let cellClasses = 'flex-1 border border-gray-200 dark:border-gray-700 transition-colors duration-150 rounded-lg ';

                        if (cellState === 'past') {
                            cellClasses += 'bg-neutral-100 dark:bg-neutral-800 opacity-50 cursor-not-allowed';
                        } else if (cellState === 'selected') {
                            cellClasses += 'cursor-pointer shadow-md';
                        } else if (cellState === 'conflicting') {
                            cellClasses += 'bg-red-500 dark:bg-red-400 hover:bg-red-600 dark:hover:bg-red-500 cursor-pointer border-red-600 dark:border-red-500 shadow-sm';
                        } else if (cellState === 'ownedPending') {
                            cellClasses += 'cursor-not-allowed shadow-sm pattern-diagonal-lines';
                        } else if (cellState === 'ownedConfirmed') {
                            cellClasses += 'cursor-not-allowed shadow-md pattern-diagonal-lines';
                        } else if (cellState === 'booked') {
                            cellClasses += 'cursor-not-allowed opacity-60';
                        } else {
                            // Use CSS :hover for available cells - no React state needed
                            cellClasses += 'bg-neutral-100 dark:bg-neutral-800 cursor-pointer';
                        }

                        const bookedInfo = bookedDays.get(getDayKey(device.id, day.date));
                        let title;
                        if (cellState === 'past') {
                            title = `${device.deviceName} - ${day.fullLabel} (Past)`;
                        } else if (cellState === 'booked') {
                            const ownerLabel = bookedInfo?.ownerUsername || 'Another user';
                            const collaboratorsList = bookedInfo?.collaborators || [];
                            const isOwnedByUser =
                                currentUserName &&
                                ownerLabel &&
                                ownerLabel.toLowerCase() === currentUserName.toLowerCase();
                            if (isOwnedByUser) {
                                title = `${device.deviceName} - ${day.fullLabel} (Booked by You${collaboratorsList.length ? ` with ${collaboratorsList.join(', ')}` : ''})`;
                            } else if (collaboratorsList.length > 0) {
                                title = `${device.deviceName} - ${day.fullLabel} (Shared booking by ${ownerLabel} with ${collaboratorsList.join(', ')})`;
                            } else {
                                title = `${device.deviceName} - ${day.fullLabel} (Booked by ${ownerLabel})`;
                            }
                        } else if (cellState === 'conflicting') {
                            title = `${device.deviceName} - ${day.fullLabel} (Conflict: Already booked)`;
                        } else {
                            title = `${device.deviceName} - ${day.fullLabel} (${cellState})`;
                        }

                        const cellStyle = {
                            height: ROW_HEIGHT - 8,
                            minWidth: CELL_WIDTH - 16,
                            ...(cellState === 'selected' ? {
                                backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`,
                                borderColor: `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) - 5%))`,
                            } : cellState === 'ownedPending' ? {
                                backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`,
                                borderColor: `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) - 5%))`,
                                opacity: 0.6,
                            } : cellState === 'ownedConfirmed' ? {
                                backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`,
                                borderColor: `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) - 5%))`,
                                opacity: 0.6,
                            } : cellState === 'booked' ? {
                                backgroundColor: bookedBg,
                                borderColor: bookedBorder,
                                transition: 'background-color 0.3s ease-in-out, border-color 0.3s ease-in-out',
                            } : {})
                        };

                        const isHoverable = cellState === 'selected' || cellState === 'ownedPending' || cellState === 'ownedConfirmed';
                        const hoverableClass = isHoverable ? 'timeline-cell-hoverable' : '';
                        
                        return (
                            <div
                                key={day.date}
                                style={cellStyle}
                                className={`${cellClasses} ${hoverableClass}`}
                                onClick={() => handleDayClick(device.id, day.date)}
                                title={title}
                            />
                        );
                    })}
                </div>
            </div>
        );
    };

    if (devices.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-gray-500 dark:text-gray-400 mb-2">No devices to display</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                        Adjust your filters to see devices
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative h-full flex flex-col glass-panel overflow-hidden" data-timeline-container>
            <div
                className={`absolute left-0 right-0 top-0 h-[3px] z-20 overflow-hidden transition-opacity duration-200 ${
                    isGridLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
            >
                <div className="timeline-loading-bar" />
            </div>
            {/* Header with week info and navigation */}
            <div 
              className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 glass-panel"
              style={{
                backgroundColor: panelBg,
                transition: 'background-color 0.3s ease-in-out'
              }}
            >
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {weekDays.length > 7
                            ? `${weekDays.length} days (${weekDays[0]?.fullLabel} - ${weekDays[weekDays.length - 1]?.fullLabel})`
                            : `Week of ${weekDays[0]?.fullLabel} - ${weekDays[weekDays.length - 1]?.fullLabel}`
                        }
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                const { setWeekOffset } = useSchedulerStore.getState();
                                setWeekOffset(0);
                            }}
                            className={`w-[72px] px-3 py-1.5 text-xs font-medium hover:underline transition-opacity duration-200 ${
                                showTodayButton ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                            }`}
                            style={{ color: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
                            title="Go to current week"
                            aria-label="Go to current week"
                        >
                            Today
                        </button>
                        <button
                            onClick={() => navigateWeek(-1)}
                            className="w-[80px] px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                            title="Previous week"
                            aria-label="Navigate to previous week"
                        >
                            ← Prev
                        </button>
                        <button
                            onClick={() => navigateWeek(1)}
                            className="w-[80px] px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                            title="Next week"
                            aria-label="Navigate to next week"
                        >
                            Next →
                        </button>
                    </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    {visibleDevices.length} device{visibleDevices.length !== 1 ? 's' : ''} • Click days to select
                </div>
                {showCollapsedNotice && (
                    <div className="mt-2 text-xs text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-md px-3 py-2">
                        All device groups are collapsed. Expand a group to see devices.
                    </div>
                )}
            </div>

            {/* Scrollable container for grid */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Sticky header row with day labels */}
                <div 
                  className="flex-shrink-0 flex border-b-2 border-gray-300 dark:border-gray-600 glass-panel overflow-x-auto"
                  style={{
                    backgroundColor: panelBg
                  }}
                >
                    {/* Device name column header (sticky) */}
                    <div
                        className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 glass-panel sticky left-0 z-30 shadow-sm"
                        style={{ 
                          width: DEVICE_NAME_WIDTH, 
                          height: HEADER_HEIGHT,
                          backgroundColor: panelBg
                        }}
                    >
                        <div className="h-full flex items-center justify-between px-3">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                Devices
                            </span>
                            {deviceTypes.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleToggleCollapseAll}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 dark:disabled:text-gray-500"
                                    aria-label={allGroupsCollapsed ? 'Expand all device groups' : 'Collapse all device groups'}
                                    disabled={deviceTypes.length === 0}
                                >
                                    {allGroupsCollapsed ? 'Expand All' : 'Collapse All'}
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Day headers - scrollable */}
                    <div 
                      className="flex gap-1.5 px-1.5" 
                      style={{ 
                        minWidth: CELL_WIDTH * Math.max(DAYS_IN_WEEK, weekDays.length),
                        backgroundColor: panelBg
                      }}
                    >
                        {weekDays.map((day) => {
                            const isPast = isPastDate(day.date);
                            return (
                                <div
                                    key={day.date}
                                    style={{ minWidth: CELL_WIDTH - 16, height: HEADER_HEIGHT }}
                                    className="flex-1 flex flex-col items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300 flex-shrink-0"
                                >
                                    <div className={isPast ? 'opacity-50' : 'text-gray-900 dark:text-gray-100'}>
                                        {day.fullLabel}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Device groups with collapsible headers */}
                <div 
                  ref={(el) => { scrollContainerRef.current = el; bodyScrollRef.current = el; }} 
                  className="flex-1 overflow-auto" 
                  style={{ 
                    scrollbarGutter: 'stable',
                    backgroundColor: panelBg
                  }}
                >
                    {deviceTypes.map((type) => {
                        const typeDevices = devicesByType[type];
                        const isCollapsed = !hasActiveSearchFilters && collapsedGroups.has(type);

                        return (
                            <div key={type} className="border-b border-gray-200 dark:border-gray-700">
                                {/* Group Header */}
                                <div
                                    className="flex items-center justify-between px-4 py-2 glass-panel cursor-pointer hover:bg-gray-200/70 dark:hover:bg-gray-800/70 transition-all duration-200 ease-in-out relative"
                                    onClick={() => toggleGroup(type)}
                                    style={{ 
                                      height: GROUP_HEADER_HEIGHT,
                                      backgroundColor: panelBg,
                                      transition: 'background-color 0.3s ease-in-out',
                                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.08)',
                                      zIndex: 5
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    aria-expanded={!isCollapsed}
                                    aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${type} device group`}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleGroup(type);
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <svg
                                            className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {type}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            ({typeDevices.length})
                                        </span>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Select all days in current week for all devices in this group
                                            typeDevices.forEach(device => {
                                                const candidateDates = weekDays
                                                    .filter(day => !isPastDate(day.date) && !bookedDays.has(getDayKey(device.id, day.date)))
                                                    .map(day => day.date);
                                                if (candidateDates.length > 0) {
                                                    addDeviceDates(device.id, candidateDates);
                                                } else if (!selectedDevices.includes(device.id)) {
                                                    toggleDevice(device.id);
                                                }
                                            });
                                        }}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                        title="Select all days in this week for all devices in this group"
                                    >
                                        Select All
                                    </button>
                                </div>

                                {/* Group Devices */}
                                <div
                                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'
                                        }`}
                                >
                                    {!isCollapsed && (
                                        <FixedSizeList
                                            height={Math.min(listHeight, typeDevices.length * ROW_HEIGHT)}
                                            itemCount={typeDevices.length}
                                            itemSize={ROW_HEIGHT}
                                            width={listWidth}
                                        >
                                            {({ index, style }) => {
                                                const device = typeDevices[index];
                                                return (
                                                    <div 
                                                      style={{
                                                        ...style,
                                                        backgroundColor: panelBg
                                                      }} 
                                                      className="flex border-b border-gray-200 dark:border-gray-700 transition-colors duration-150"
                                                    >
                                                        {/* Device name column (sticky) */}
                                                        <div
                                                            className="flex-shrink-0 flex items-center gap-2 px-4 border-r border-gray-200 dark:border-gray-700 sticky left-0 z-10 shadow-sm"
                                                            style={{ 
                                                              width: DEVICE_NAME_WIDTH, 
                                                              height: ROW_HEIGHT,
                                                              backgroundColor: panelBg
                                                            }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedDevices?.includes(device.id) || false}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleDevice(device.id);
                                                                }}
                                                                className="w-4 h-4 bg-gray-100 border-gray-300 rounded dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                                                                style={{ 
                                                                    '--tw-ring-color': `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`,
                                                                    accentColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                    {device.deviceName || 'Unnamed Device'}
                                                                </span>
                                                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                                    {device.deviceType || 'N/A'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Day cells */}
                                                        <div className="flex gap-1.5 px-1.5" style={{ width: CELL_WIDTH * DAYS_IN_WEEK }}>
                                                            {weekDays.map((day) => {
                                                                const cellState = getCellState(device.id, day.date);
                                                                const inDragRange = isInDragRange(device.id, day.date);

                                                                let cellClasses = 'flex-1 border border-gray-200 dark:border-gray-700 transition-colors duration-150 rounded-lg ';

                                                                if (cellState === 'past') {
                                                                    cellClasses += 'bg-neutral-100 dark:bg-neutral-800 opacity-50 cursor-not-allowed';
                                                                    // Add pattern for past dates
                                                                    cellClasses += ' pattern-diagonal-lines';
                                                                } else if (cellState === 'newlyConfirmed') {
                                                                    // Green highlight that fades to booked
                                                                    cellClasses += 'bg-emerald-400 dark:bg-emerald-600 animate-pulse cursor-not-allowed border-emerald-500 dark:border-emerald-700 shadow-md';
                                                                } else if (cellState === 'selected') {
                                                                    cellClasses += 'cursor-pointer shadow-md';
                                                                } else if (cellState === 'conflicting') {
                                                                    cellClasses += 'bg-red-500 dark:bg-red-400 hover:bg-red-600 dark:hover:bg-red-500 cursor-pointer border-red-600 dark:border-red-500 shadow-sm';
                                                                } else if (cellState === 'ownedPending') {
                                                                    cellClasses += 'cursor-not-allowed shadow-sm pattern-diagonal-lines';
                                                                } else if (cellState === 'ownedConfirmed') {
                                                                    cellClasses += 'cursor-not-allowed shadow-md pattern-diagonal-lines';
                                                                } else if (cellState === 'booked') {
                                                                    cellClasses += 'cursor-not-allowed opacity-60';
                                                                    // Add pattern for booked dates
                                                                    cellClasses += ' pattern-diagonal-lines';
                                                                } else {
                                                                    if (inDragRange) {
                                                                        // Highlight cells in drag range (for drag selection)
                                                                        cellClasses += 'cursor-pointer ring-2';
                                                                    } else {
                                                                        // Use CSS :hover for available cells - no React state needed
                                                                        cellClasses += 'bg-neutral-100 dark:bg-neutral-800 cursor-pointer';
                                                                    }
                                                                }

                                                                const bookedInfo = bookedDays.get(getDayKey(device.id, day.date));
                                                                let title;
                                                                if (cellState === 'past') {
                                                                    title = `${device.deviceName} - ${day.fullLabel} (Past)`;
                                                                } else if (cellState === 'ownedPending') {
                                                                    title = `${device.deviceName} - ${day.fullLabel} (Awaiting approval for your booking)`;
                                                                } else if (cellState === 'ownedConfirmed') {
                                                                    title = `${device.deviceName} - ${day.fullLabel} (Your booking is confirmed)`;
                                                                } else if (cellState === 'booked') {
                                                                    const ownerLabel = bookedInfo?.ownerUsername || 'Another user';
                                                                    const collaboratorsList = bookedInfo?.collaborators || [];
                                                                    if (collaboratorsList.length > 0) {
                                                                        title = `${device.deviceName} - ${day.fullLabel} (Shared booking by ${ownerLabel} (with ${collaboratorsList.join(', ')}))`;
                                                                    } else {
                                                                        title = `${device.deviceName} - ${day.fullLabel} (Booked by ${ownerLabel})`;
                                                                    }
                                                                } else if (cellState === 'conflicting') {
                                                                    title = `${device.deviceName} - ${day.fullLabel} (Conflict: Already booked)`;
                                                                } else {
                                                                    title = `${device.deviceName} - ${day.fullLabel} (${cellState})`;
                                                                }

                                                                const cellStyle = {
                                                                    height: ROW_HEIGHT - 8,
                                                                    minWidth: CELL_WIDTH - 16,
                                                                    userSelect: 'none',
                                                                    WebkitUserSelect: 'none',
                                                                    ...(cellState === 'selected' ? {
                                                                        backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`,
                                                                        borderColor: `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) - 5%))`,
                                                                    } : cellState === 'ownedPending' ? {
                                                                        backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`,
                                                                        borderColor: `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) - 5%))`,
                                                                        opacity: 0.6,
                                                                    } : cellState === 'ownedConfirmed' ? {
                                                                        backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`,
                                                                        borderColor: `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) - 5%))`,
                                                                        opacity: 0.6,
                                                                    } : cellState === 'booked' ? {
                                                                        backgroundColor: bookedBg,
                                                                        borderColor: bookedBorder,
                                                                    } : inDragRange ? {
                                                                        backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) + 20%))`,
                                                                        borderColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`,
                                                                    } : {})
                                                                };

                                                                const isHoverable = cellState === 'selected' || cellState === 'ownedPending' || cellState === 'ownedConfirmed';
                                                                const hoverableClass = isHoverable ? 'timeline-cell-hoverable' : '';

                                                                return (
                                                                    <div
                                                                        key={day.date}
                                                                        data-date={day.date}
                                                                        style={cellStyle}
                                                                        className={`${cellClasses} ${hoverableClass}`}
                                                                        onMouseDown={(e) => {
                                                                            handleDragStart(device.id, day.date, e);
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            // Process mouseEnter first to update drag state before mouseUp
                                                                            // Only handle drag range highlighting here - hover for selected cells is handled by CSS
                                                                            if (inDragRange) {
                                                                                e.currentTarget.style.borderColor = `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`;
                                                                                e.currentTarget.style.backgroundColor = `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) + 20%))`;
                                                                            }
                                                                            // Handle drag over during drag selection - update dragEnd before mouseUp processes it
                                                                            if (isDragging) {
                                                                                handleDragOver(device.id, day.date, e);
                                                                            }
                                                                        }}
                                                                        onMouseUp={(e) => {
                                                                            // Ensure current cell is included in drag selection by updating dragEnd if dragging
                                                                            if (isDragging && dragStart) {
                                                                                // Update dragEnd to current cell to ensure it's included
                                                                                setDragEnd({ deviceId: device.id, date: day.date });
                                                                                // Small delay to ensure dragEnd state is updated before handleDragEnd processes it
                                                                                setTimeout(() => {
                                                                                    handleDragEnd(device.id, day.date);
                                                                                }, 0);
                                                                            } else {
                                                                                // Handle click via mouseup - handleDragEnd will determine if it was a drag or click
                                                                                handleDragEnd(device.id, day.date);
                                                                            }
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            // Only handle drag range highlighting here - hover for selected cells is handled by CSS
                                                                            if (inDragRange) {
                                                                                e.currentTarget.style.borderColor = `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`;
                                                                                e.currentTarget.style.backgroundColor = `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) + 20%))`;
                                                                            }
                                                                            // If mouse leaves while dragging, don't interfere
                                                                            // But if not dragging, make sure drag state is cleared
                                                                            if (!isDragging) {
                                                                                hasDraggedRef.current = false;
                                                                            }
                                                                        }}
                                                                        title={title}
                                                                        role="button"
                                                                        tabIndex={['past', 'booked', 'newlyConfirmed', 'ownedPending', 'ownedConfirmed'].includes(cellState) ? -1 : 0}
                                                                        aria-label={title}
                                                                        aria-disabled={['past', 'booked', 'newlyConfirmed', 'ownedPending', 'ownedConfirmed'].includes(cellState)}
                                                                        onKeyDown={(e) => {
                                                                            if ((e.key === 'Enter' || e.key === ' ') && !['past', 'booked', 'newlyConfirmed', 'ownedPending', 'ownedConfirmed'].includes(cellState)) {
                                                                                e.preventDefault();
                                                                                handleDayClick(device.id, day.date, e);
                                                                            }
                                                                        }}
                                                                        onFocus={(e) => {
                                                                            e.target.style.setProperty('--tw-ring-color', `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`);
                                                                            e.target.classList.add('ring-2', 'ring-offset-2');
                                                                        }}
                                                                        onBlur={(e) => {
                                                                            e.target.classList.remove('ring-2', 'ring-offset-2');
                                                                        }}
                                                                    />
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            }}
                                        </FixedSizeList>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sticky Legend */}
            <div 
              className="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 glass-panel sticky bottom-0 z-20"
              style={{
                backgroundColor: panelBg,
                transition: 'background-color 0.3s ease-in-out'
              }}
            >
                <div className="flex items-center gap-4 text-xs flex-wrap">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-neutral-100 dark:bg-neutral-800 rounded-sm border border-gray-300 dark:border-gray-600" />
                        <span className="text-gray-600 dark:text-gray-400">Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-sm" 
                          style={{ backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
                        />
                        <span className="text-gray-600 dark:text-gray-400">Selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 dark:bg-red-400 rounded-sm" />
                        <span className="text-gray-600 dark:text-gray-400">Conflict</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-300 dark:bg-yellow-500 rounded-sm border border-yellow-500 dark:border-yellow-600" />
                        <span className="text-gray-600 dark:text-gray-400">Awaiting Approval (You)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 dark:bg-green-600 rounded-sm border border-green-600 dark:border-green-700" />
                        <span className="text-gray-600 dark:text-gray-400">Confirmed (You)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-400 dark:bg-gray-600 rounded-sm opacity-75" />
                        <span className="text-gray-600 dark:text-gray-400">Booked (Other user)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-neutral-100 dark:bg-neutral-800 rounded-sm opacity-50" />
                        <span className="text-gray-600 dark:text-gray-400">Past</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
