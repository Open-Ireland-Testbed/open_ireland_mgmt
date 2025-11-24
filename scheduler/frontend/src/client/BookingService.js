// bookingService.js

// Ireland local time
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { API_BASE_URL } from '../config/api';

dayjs.extend(utc);
dayjs.extend(timezone);
const IRELAND_TZ = 'Europe/Dublin';
/**
 * 
 * @param {*} slots 
 * @returns 
 */
function mergeSlots(slots) {
    if (!slots || slots.length === 0) return [];
    const getValue = (slot) => {
        const dayValue = Math.floor(new Date(slot.dateKey).getTime() / (1000 * 60 * 60 * 24));
        return dayValue * 3 + slot.segIndex;
    };
    const sorted = slots.slice().sort((a, b) => getValue(a) - getValue(b));
    const intervals = [];

    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        const slot = sorted[i];
        if (getValue(slot) === getValue(end) + 1) {
            end = slot;
        } else {
            intervals.push({ startSlot: start, endSlot: end });
            start = slot;
            end = slot;
        }
    }
    intervals.push({ startSlot: start, endSlot: end });
    return intervals;
}

/**
 * 
 * Iterates through globalSelections and generates an array suitable for the backend
 * Each object includes device_type, device_name, start_time, end_time
 */
export function gatherAllIntervals(globalSelections) {
    const results = [];

    const segStartMapping = [7, 12, 18];
    const segEndMapping = [12, 18, 7];

    for (const deviceType in globalSelections) {
        const deviceData = globalSelections[deviceType];
        for (const subName in deviceData) {
            const slots = deviceData[subName];
            // Normal booking & Conflicting booking
            const normalSlots = slots.filter(s => !s.conflict);
            const conflictSlots = slots.filter(s => s.conflict);

            // Submit normal booking 

            function processGroup(groupSlots, status) {
                if (groupSlots.length === 0) return;
                const intervals = mergeSlots(groupSlots);
                intervals.forEach(({ startSlot, endSlot }) => {
                    const startHour = segStartMapping[startSlot.segIndex];
                    const endHour = segEndMapping[endSlot.segIndex];

                    let startDayjs = dayjs.tz(startSlot.dateKey, 'YYYY-MM-DD', IRELAND_TZ)
                        .hour(startHour).minute(0).second(0);
                    let endDayjs = dayjs.tz(endSlot.dateKey, 'YYYY-MM-DD', IRELAND_TZ)
                        .hour(endHour).minute(0).second(0);

                    // 1. 6 PM→7 AM，+ 1 day
                    const isOvernightSegment = endSlot.segIndex === 2;
                    // 2. In the same day, endHour < startHour，也说明跨日
                    const sameDayButBackwards = (endHour < startHour) && endDayjs.isSame(startDayjs, 'day');

                    if (isOvernightSegment || sameDayButBackwards) {
                        endDayjs = endDayjs.add(1, 'day');
                    }

                    results.push({
                        device_type: deviceType,
                        device_name: subName,
                        start_time: startDayjs.format('YYYY-MM-DD HH:mm:ss'),
                        end_time: endDayjs.format('YYYY-MM-DD HH:mm:ss'),
                        status: status
                    });
                });
            }

            processGroup(normalSlots, "PENDING");
            processGroup(conflictSlots, "CONFLICTING");

        }
    }
    return results;
}

/**
 * Submit all information collected in the information 
 */
export async function submitAllBookings(payload) {
    const res = await fetch(`${API_BASE_URL}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: 'include'
    });
    if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to create booking(s)");
    }
    return res.json();
}
