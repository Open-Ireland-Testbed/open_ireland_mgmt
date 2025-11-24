import { API_BASE_URL } from '../config/api';

/**
 * Submit bookings to the backend
 * @param {number} userId - User ID
 * @param {Array} selections - Array of { deviceId, date, hour } objects
 * @param {Array} devices - Array of device objects with id, deviceType, deviceName
 * @param {string} message - Optional message
 * @param {string} bookingStatus - Optional status to apply to each booking (default: 'PENDING')
 * @returns {Promise<Object>} Response from the API
 */
/**
 * Submit bookings with support for partial failures
 * @param {number} userId - User ID
 * @param {Array} selections - Array of { deviceId, date, hour } objects
 * @param {Array} devices - Array of device objects with id, deviceType, deviceName
 * @param {string} message - Optional message
 * @param {Function} onProgress - Optional progress callback (progress: number)
 * @param {Array} collaborators - Collaborator usernames
 * @param {string} bookingStatus - Optional status to apply to each booking (default: 'PENDING')
 * @returns {Promise<Object>} Response with { success: boolean, confirmed: number, conflicts: number, errors: Array }
 */
export async function submitBookings(
    userId,
    selections,
    devices,
    message = '',
    onProgress = null,
    collaborators = [],
    bookingStatus = 'PENDING'
) {
    // Create a map of deviceId to device info for quick lookup
    const deviceMap = new Map();
    devices.forEach((device) => {
        deviceMap.set(device.id, device);
    });

    // Group selections by device and date
    const bookingRanges = [];
    const grouped = {};

    const addRange = (device, startDate, endDate) => {
        bookingRanges.push({
            device_type: device.deviceType,
            device_name: device.deviceName,
            start: startDate,
            end: endDate,
        });
    };

    selections.forEach((slot) => {
        const key = `${slot.deviceId}-${slot.date}`;
        if (!grouped[key]) {
            grouped[key] = {
                deviceId: slot.deviceId,
                date: slot.date,
                hours: [],
                isDaily: slot.hour === null, // Check if this is a daily selection
            };
        }
        if (slot.hour !== null) {
            grouped[key].hours.push(slot.hour);
        } else {
            grouped[key].isDaily = true;
        }
    });

    // Convert grouped selections to booking ranges
    Object.values(grouped).forEach((group) => {
        const device = deviceMap.get(group.deviceId);
        if (!device) {
            console.warn(`Device ${group.deviceId} not found`);
            return;
        }

        if (group.isDaily) {
            const startDate = new Date(`${group.date}T00:01:00`);
            const endDate = new Date(`${group.date}T23:59:00`);
            addRange(device, startDate, endDate);
        } else if (group.hours.length > 0) {
            // Hourly selection: merge consecutive hours
            const sortedHours = [...group.hours].sort((a, b) => a - b);
            let startHour = sortedHours[0];
            let endExclusive = startHour + 1;

            for (let i = 1; i < sortedHours.length; i++) {
                if (sortedHours[i] === endExclusive) {
                    // Consecutive hour, extend the range
                    endExclusive = sortedHours[i] + 1;
                } else {
                    // Non-consecutive, save current range and start a new one
                    const startDate = new Date(`${group.date}T${startHour.toString().padStart(2, '0')}:00:00`);
                    const endDate = new Date(startDate);
                    endDate.setHours(endDate.getHours() + (endExclusive - startHour));
                    addRange(device, startDate, endDate);

                    startHour = sortedHours[i];
                    endExclusive = sortedHours[i] + 1;
                }
            }

            // Add the last range
            const startDate = new Date(`${group.date}T${startHour.toString().padStart(2, '0')}:00:00`);
            const endDate = new Date(startDate);
            endDate.setHours(endDate.getHours() + (endExclusive - startHour));
            addRange(device, startDate, endDate);
        }
    });

    // Convert booking ranges to API format
    const bookings = bookingRanges.map((range) => {
        return {
            device_type: range.device_type,
            device_name: range.device_name,
            start_time: range.start.toISOString(),
            end_time: range.end.toISOString(),
            status: bookingStatus,
        };
    });

    // Simulate progress for better UX
    if (onProgress) {
        onProgress(25);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                user_id: userId,
                message,
                bookings,
                collaborators,
            }),
        });

        if (onProgress) {
            onProgress(75);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to create bookings' }));

            // Check for conflict errors
            if (response.status === 409 || errorData.detail?.includes('conflict') || errorData.detail?.includes('already booked')) {
                // Try to parse which bookings had conflicts
                const conflictCount = bookings.length; // Conservative estimate
                return {
                    confirmed: 0,
                    conflicts: conflictCount,
                    errors: [],
                };
            }

            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        if (onProgress) {
            onProgress(100);
        }

        const data = await response.json();

        // Return success - all bookings confirmed
        return {
            confirmed: bookings.length,
            conflicts: 0,
            errors: [],
        };
    } catch (error) {
        // Network or other errors
        return {
            confirmed: 0,
            conflicts: 0,
            errors: [{
                error: error.message || 'Network error',
            }],
        };
    }
}

/**
 * Check for conflicts in selected slots
 * @param {Array} selections - Array of { deviceId, date, hour } objects (hour can be null for daily)
 * @param {Array} bookings - Array of existing bookings from the API
 * @returns {Array} Array of conflicting slot keys (deviceId-date or deviceId-date-hour)
 */
export function findConflicts(selections, bookings, options = {}) {
    const { currentUserId = null, currentUsername = null } = options || {};
    const conflicts = new Set();
    const inactiveStatuses = new Set(['CANCELLED', 'EXPIRED', 'REJECTED', 'DECLINED']);
    const currentUsernameLower = currentUsername ? currentUsername.toLowerCase() : null;

    selections.forEach((slot) => {
        let slotStart, slotEnd;

        if (slot.hour === null) {
            // Daily selection: check overlap with 07:00-19:00
            slotStart = new Date(`${slot.date}T00:01:00`);
            slotEnd = new Date(`${slot.date}T23:59:00`);
        } else {
            // Hourly selection: check overlap with specific hour
            slotStart = new Date(`${slot.date}T${slot.hour.toString().padStart(2, '0')}:00:00`);
            slotEnd = new Date(slotStart);
            slotEnd.setHours(slotEnd.getHours() + 1);
        }

        // Check if this slot overlaps with any existing booking
        const hasConflict = bookings.some((booking) => {
            const statusKey = (booking.status || '').toUpperCase();
            if (inactiveStatuses.has(statusKey)) {
                return false;
            }

            if (currentUserId !== null && booking.user_id === currentUserId) {
                return false;
            }

            const bookingOwnerLower = (booking.owner_username || booking.username || '').toLowerCase();
            if (currentUsernameLower && bookingOwnerLower === currentUsernameLower) {
                return false;
            }

            const collaborators = Array.isArray(booking.collaborators) ? booking.collaborators : [];
            if (
                currentUsernameLower &&
                collaborators.some((name) => typeof name === 'string' && name.toLowerCase() === currentUsernameLower)
            ) {
                return false;
            }

            if (booking.device_id !== slot.deviceId) return false;

            const bookingStart = new Date(booking.start_time);
            const bookingEnd = new Date(booking.end_time);

            // Check for overlap
            return slotStart < bookingEnd && slotEnd > bookingStart;
        });

        if (hasConflict) {
            // Use appropriate key format based on selection type
            if (slot.hour === null) {
                conflicts.add(`${slot.deviceId}-${slot.date}`);
            } else {
                conflicts.add(`${slot.deviceId}-${slot.date}-${slot.hour}`);
            }
        }
    });

    return Array.from(conflicts);
}

