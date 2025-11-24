import React, { useState, useEffect, useCallback } from 'react';
import '../App.css';
import './admin.css';
import eventBus from '../eventBus';
import { API_BASE_URL } from '../config/api';


export function addDays(baseDate, days) {
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
}

export function getStartOfWeek(date) {
    const day = new Date(date);
    const dayOfWeek = day.getDay();
    day.setDate(day.getDate() - dayOfWeek);
    return day;
}

export function formatDateKey(date) {
    return date.toISOString().split('T')[0];
}

export function formatMonthYear(date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatDayOfWeek(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function formatDayNum(date) {
    return date.getDate();
}

// Time segments
const TIME_SEGMENTS = [
    '7 AM - 12 PM',
    '12 PM - 6 PM',
    '6 PM - 7 AM',
];

// Parse the time segment label into start and end hours
function parseTimeSegment(label) {
    if (label === 'All Day') return [0, 24];
    if (label === '7 AM - 12 PM') return [7, 12];
    if (label === '12 PM - 6 PM') return [12, 18];
    if (label === '6 PM - 7 AM') return [18, 23];
    return [0, 24];
}

// Parse the maintenance start/end time
function parseMaintenanceTime(maintenanceStr, isEnd = false) {
    if (!maintenanceStr) return null;

    if (maintenanceStr.startsWith("All Day/")) {
        const dateStr = maintenanceStr.split('/')[1];
        const date = new Date(dateStr);

        if (!isEnd) {
            date.setHours(0, 0, 0, 0);
            return date;
        }

        date.setHours(23, 59, 59, 999);
        return date;
    }

    const [timeSegment, dateStr] = maintenanceStr.split('/');
    const [startHour, endHour] = parseTimeSegment(timeSegment);
    const date = new Date(dateStr);


    date.setHours(isEnd ? endHour : startHour, 0, 0, 0);

    if (isEnd && endHour < startHour) {
        date.setDate(date.getDate() + 1);
    }

    return date;
}

// Compare the number in device name
function naturalSort(a, b) {
    const numRegex = /- (\d+) -/;

    const aMatch = a.match(numRegex);
    const bMatch = b.match(numRegex);

    if (aMatch && bMatch) {
        const aNum = parseInt(aMatch[1], 10);
        const bNum = parseInt(bMatch[1], 10);
        return aNum - bNum;
    }
    return a.localeCompare(b, undefined, { numeric: true });
}

export default function AdminScheduleTable() {
    const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()));
    const [devices, setDevices] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);


    const fetchBookings = useCallback(async () => {
        setIsLoading(true);
        try {
            const startStr = formatDateKey(weekStart);
            const res = await fetch(`${API_BASE_URL}/bookings/for-week?start=${startStr}`, {
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to fetch bookings");
            const data = await res.json();
            setBookings(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [weekStart]);

    useEffect(() => {
        const handleRefresh = () => {
            fetchBookings();
        }
        eventBus.on('refreshAdminSchedule', handleRefresh);
        return () => eventBus.off('refreshAdminSchedule', handleRefresh);
    }, [fetchBookings]);

    // ================== Fetch devices and group by device type ==================
    useEffect(() => {
        async function fetchDevices() {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/devices`, {
                    credentials: "include",
                });
                if (!res.ok)
                    throw new Error("Failed to fetch devices");

                const data = await res.json();
                const grouped = {};
                data.forEach(dev => {
                    const type = dev.deviceType;
                    if (!grouped[type]) {
                        grouped[type] = {
                            name: type,
                            expanded: true,
                            subDevices: []
                        };
                    }
                    // Store the sub-devices as objects with their detailed information  
                    const existingSub = grouped[type].subDevices.find(s => s.name === dev.deviceName);
                    if (!existingSub) {
                        grouped[type].subDevices.push({
                            name: dev.deviceName,
                            status: dev.status,
                            maintenance_start: dev.maintenance_start,
                            maintenance_end: dev.maintenance_end
                        });
                    }
                });

                // Sort the devices
                const sortedDevices = Object.keys(grouped)
                    .sort((a, b) => a.localeCompare(b))
                    .map(typeKey => ({
                        ...grouped[typeKey],
                        subDevices: grouped[typeKey].subDevices.sort((a, b) => naturalSort(a.name, b.name)),
                    }));
                setDevices(sortedDevices);
            } catch (err) {
                console.error(err);
            }
        }
        fetchDevices();
    }, []);

    // ================== Fetch bookings for the current week ==================
    useEffect(() => {
        fetchBookings();
        // Refresh bookings every 10 seconds
        const intervalId = setInterval(fetchBookings, 120000);
        return () => clearInterval(intervalId);
    }, [weekStart]);



    // Calculate the 7 days of the current week
    const daysOfWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const goToPreWeek = () => setWeekStart(addDays(weekStart, -7));
    const goToNextWeek = () => setWeekStart(addDays(weekStart, 7));

    // Toggle expand/collapse for a single device
    const toggleExpand = (deviceIndex) => {
        setDevices(prevDevices =>
            prevDevices.map((device, i) =>
                i === deviceIndex ? { ...device, expanded: !device.expanded } : device
            )
        );
    };

    // Toggle expand/collapse for all devices
    const allExpanded = devices.every(dev => dev.expanded);
    function toggleAll() {
        setDevices(
            prev => prev.map(
                dev => ({ ...dev, expanded: !allExpanded })
            )
        );
    }

    // Filter bookings for the specified date, time segment, device type, and sub-device
    const getBookingsForSlot = (day, segIndex, deviceType, deviceName) => {
        const [startHour, endHour] = parseTimeSegment(TIME_SEGMENTS[segIndex]);
        const slotStart = new Date(day);
        slotStart.setHours(startHour, 0, 0, 0);
        const slotEnd = new Date(day);

        // Account for cross-day slots
        if (endHour < startHour) {
            slotEnd.setDate(slotEnd.getDate() + 1);
        }

        slotEnd.setHours(endHour, 0, 0, 0);
        return bookings.filter(bk => {
            if (bk.device_type !== deviceType ||
                bk.device_name !== deviceName ||
                (bk.status?.toLowerCase() === 'cancelled' ||
                    bk.status?.toLowerCase() === 'rejected')

            )
                return false;
            const bStart = new Date(bk.start_time);
            const bEnd = new Date(bk.end_time);
            return bStart < slotEnd && bEnd > slotStart;
        });
    };

    // Check if the time slot is expired 
    const isSlotExpired = (day, segIndex) => {
        const [startHour, endHour] = parseTimeSegment(TIME_SEGMENTS[segIndex]);
        const slotEnd = new Date(day);

        if (endHour < startHour) {
            slotEnd.setDate(slotEnd.getDate() + 1);
        }
        slotEnd.setHours(endHour, 0, 0, 0);
        return new Date() > slotEnd;
    };

    // ================== Render the time slot based on its bookings ==================
    const renderSlotContent = (day, segIndex, deviceType, deviceName) => {

        // Check the device status 
        const device = devices.find(d => d.name === deviceType)?.subDevices.find(s => s.name === deviceName);
        if (device?.status === 'Maintenance') {
            const maintenanceStart = parseMaintenanceTime(device.maintenance_start);
            const maintenanceEnd = parseMaintenanceTime(device.maintenance_end, true);
            const currentDate = new Date(day);

            // All-Day Maintenance
            if (device.maintenance_start?.startsWith("All Day")) {
                const maintenanceStartDate = parseMaintenanceTime(device.maintenance_start);
                const maintenanceEndDate = parseMaintenanceTime(device.maintenance_end, true);

                const [startHour, endHour] = parseTimeSegment(TIME_SEGMENTS[segIndex]);
                const slotStart = new Date(day);
                slotStart.setHours(startHour, 0, 0, 0);

                const slotEnd = new Date(day);
                slotEnd.setHours(endHour, 0, 0, 0);

                // Overlapping time periods
                if (slotStart >= maintenanceStartDate && slotEnd <= maintenanceEndDate) {
                    return {
                        content: "Maintenance",
                        className: "time-slot maintenance-slot"
                    };
                }
            }

            // Maintenance Window 
            if (maintenanceStart && maintenanceEnd) {
                const [startHour, endHour] = parseTimeSegment(TIME_SEGMENTS[segIndex]);

                // Start hour 
                const slotStart = new Date(currentDate);
                slotStart.setHours(startHour, 0, 0, 0);

                const slotEnd = new Date(currentDate);
                if (endHour < startHour) {
                    slotEnd.setDate(slotEnd.getDate() + 1);
                }
                slotEnd.setHours(endHour, 0, 0, 0);

                // Overlapping time periods
                if (slotStart < maintenanceEnd && slotEnd > maintenanceStart) {
                    return {
                        content: "Maintenance",
                        className: "time-slot maintenance-slot"
                    };
                }
            }
        }

        if (isSlotExpired(day, segIndex)) {
            return { content: "", className: "time-slot expired-slot" };
        }

        const slotBookings = getBookingsForSlot(day, segIndex, deviceType, deviceName);

        // Get the user name 
        const formatUsername = (booking) => {
            if (booking.username) return booking.username;
            if (booking.user_id) return `User ${booking.user_id}`;
            return "Unknown";
        };

        if (slotBookings.length === 0) {
            return { content: "", className: "time-slot" };
        }

        if (slotBookings.length === 1) {
            const booking = slotBookings[0];
            let statusClass = "";
            switch ((booking.status || "").toLowerCase()) {
                case "pending":
                    statusClass = " my-pending-slot";
                    break;
                case "confirmed":
                    statusClass = " my-confirmed-slot";
                    break;
                case "cancelled":
                    return { content: "", className: "time-slot" };
                default:
                    break;
            }
            return {
                content: formatUsername(booking),
                className: `time-slot${statusClass}`
            };
        }

        // The confiliting condition: User A & User B
        const names = slotBookings
            .map(formatUsername)
            .join(" & ");
        return {
            content: names,
            className: "time-slot conflicting-slot"
        };
    };

    return (
        <div className="admin-schedule-container">
            {/* Header Navagation */}
            <div className="admin-schedule-header">
                <button
                    className="admin-week-nav-btn"
                    onClick={goToPreWeek}
                >&lt;</button>
                <span className="admin-month-year">
                    {formatMonthYear(weekStart)}
                </span>
                <button
                    className="admin-week-nav-btn"
                    onClick={goToNextWeek}
                >&gt;</button>
            </div>

            {/* Date Row */}
            <div className="admin-days-row">
                <div className="day-column-header placeholder-cell">
                    <span className='device-label'>Device</span>
                    <button onClick={toggleAll} className="collapse-all-btn">
                        {allExpanded ? 'Collapse All' : 'Expand All'}
                    </button>
                </div>
                {daysOfWeek.map(day => (
                    <div
                        key={day.toISOString()}
                        className="admin-day-column-header"
                    >
                        <div className="admin-weekday">{formatDayOfWeek(day)}</div>
                        <div className="admin-daynum">{formatDayNum(day)}</div>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="admin-legend-container">
                <div className="admin-legend-item">
                    <span
                        className="admin-legend-color"
                        style={{ backgroundColor: '#ffb74d' }}
                    />
                    <span>PENDING</span>
                </div>
                <div className="admin-legend-item">
                    <span
                        className="admin-legend-color"
                        style={{ backgroundColor: '#66bb6a' }}
                    />
                    <span>CONFIRMED</span>
                </div>
                <div className="admin-legend-item">
                    <span
                        className="admin-legend-color"
                        style={{ backgroundColor: '#ef5350' }}
                    />
                    <span>CONFLICTING</span>
                </div>
            </div>

            {isLoading && (
                <div className="loading-indicator">
                    <div className="spinner" />
                    <p>Loading devices...</p>
                </div>
            )}

            {/* Device Table */}
            <div className="admin-devices-scroll">
                {devices.map((device, index) => (
                    <div key={device.name}>
                        <div className="admin-device-type-row" onClick={() => toggleExpand(index)}>
                            <div className="admin-device-name">
                                {device.name}
                                <span className="admin-expand-icon">
                                    {device.expanded ? '▲' : '▼'}
                                </span>
                            </div>
                        </div>

                        {/* Sub-device */}
                        {device.expanded && device.subDevices.map(subDevice => (
                            <div key={subDevice.name} className="admin-sub-device-grid">
                                <div className="admin-subdevice-name">{subDevice.name}</div>

                                {/* Time slot */}
                                {daysOfWeek.map(day => (
                                    <div key={day.toISOString()} className="admin-day-column">
                                        {TIME_SEGMENTS.map((label, segIndex) => {
                                            const { content, className } = renderSlotContent(
                                                day,
                                                segIndex,
                                                device.name,
                                                subDevice.name
                                            );
                                            return (
                                                <div
                                                    key={`${day.toISOString()}-${segIndex}`}
                                                    className={`admin-time-slot ${className}`}
                                                    title={`${subDevice.name} : ${label}`}
                                                >
                                                    {content || label}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
