import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../App.css';
import Fuse from 'fuse.js';
import searchDevice from '../image/search.png';
import { API_BASE_URL } from '../config/api';


/**
 * Adds a given number of days to a date.
 * @param {*} baseDate 
 * @param {*} days 
 * @returns 
 */
export function addDays(baseDate, days) {
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
}

/**
 * Returns the Sundat for the given date 
 * @param {*} date 
 * @returns {date} The sunday of that week
 */
export function getStartOfWeek(date) {
    const day = new Date(date);
    const dayOfWeek = day.getDay();
    day.setDate(day.getDate() - dayOfWeek);
    return day;
}

// Format "YYYY-MM-DD". Dictionary key 
/**
 * 
 * @param {*} date 
 * @returns 
 */
export function formatDateKey(date) {
    return date.toISOString().split('T')[0];
}

// Formats the date as "Month Year"， March 2025
export function formatMonthYear(date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Returns the week days 
export function formatDayOfWeek(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

// Returns the day number 
export function formatDayNum(date) {
    return date.getDate();
}

// Check if two dates are the same calendar day
export function isSameDay(d1, d2) {
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
}

// Check if day in [start, end]
export function isWithinRange(day, start, end) {
    return day >= start && day <= end;
}

// Converts a time segment label (e.g., "7:00 AM - 12:00 PM") to an array [startHour, endHour].
export function parseTimeSegment(label) {
    if (label === '7 AM - 12 PM') return [7, 12];
    if (label === '12 PM - 6 PM') return [12, 18];
    if (label === '6 PM - 11 PM') return [18, 23];
    if (label === '6 PM - 7 AM') return [18, 7];
    return [0, 24];
}

// Return true if (day + segment) ends on or after now => future
export function isSegmentInFuture(day, label) {
    const [startHour, endHour] = parseTimeSegment(label);
    const segEnd = new Date(day);
    if (endHour < startHour) {
        segEnd.setDate(segEnd.getDate() + 1);
    }
    segEnd.setHours(endHour, 0, 0, 0);
    return segEnd >= new Date();
}

/** Convert a dayIndex on the current displayed week -> an absolute Date object. */
/*
function getDateOfDayIndex(weekStart, dayIndex) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dayIndex);
    return d;
}
*/

/** Return all absolute date+segment pairs from (startDate, startSeg) to (endDate, endSeg), inclusive. */
export function getSlotsInRange(startDate, startSeg, endDate, endSeg, TIME_SEGMENTS) {
    // Iterate date by date from minDate to maxDate
    let minDate;
    let maxDate;
    // Determine the earlier and later dates.
    if (startDate < endDate) {
        minDate = startDate;
        maxDate = endDate;
    } else {
        minDate = endDate;
        maxDate = startDate;
    }

    // Determine the minimum and maximum segment indices.
    const minSeg = Math.min(startSeg, endSeg);
    const maxSeg = Math.max(startSeg, endSeg);

    const results = [];
    let cur = new Date(minDate);

    // Iterate from minDate up to maxDate by 1 day
    while (cur <= maxDate) {
        for (let seg = minSeg; seg <= maxSeg; seg++) {
            // Only add if it's in the future
            const [sH, eH] = parseTimeSegment(TIME_SEGMENTS[seg]);
            const segEnd = new Date(cur);
            if (eH < sH) {
                segEnd.setDate(segEnd.getDate() + 1);
            }



            segEnd.setHours(eH, 0, 0, 0);
            if (segEnd >= new Date()) {
                results.push({
                    dateKey: formatDateKey(cur), // e.g. '2025-03-10'
                    segIndex: seg,
                });
            }
        }
        // Next day
        cur.setDate(cur.getDate() + 1);
    }
    return results;
}

function parseMaintenanceTime(maintenanceStr, isEnd = false) {
    if (!maintenanceStr) return null;
    let [timeSegment, dateStr] = maintenanceStr.split('/');
    if (timeSegment === "6 PM - 11 PM") {
        timeSegment = "6 PM - 7 AM";
    }

    const [startHour, endHour] = parseTimeSegment(timeSegment);
    const date = new Date(dateStr);
    if (timeSegment === "6 PM - 7 AM" && isEnd) {
        date.setDate(date.getDate() + 1);
    }
    date.setHours(isEnd ? endHour : startHour, 0, 0, 0);
    return date;
}

// Sort by number
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


/* --------------- Flatten device data ---------------*/

/**
 * 
 * @param {*} groupedDevices [{ name: 'TypeA', expanded: true, subDevices: [{ name: 'Device1', ... }, ...] }, ...]
 * @returns {Array<Object>} A flat array of individual device objects. 
 * 
 * Each object contains a `deviceType` property (taken from the parent group’s `name`) along with all properties from the corresponding sub-device 
 * (e.g., `name` as `deviceName`, `status`, `maintenance_start`, etc.).
 * 
 * The purpose of the flattenDevices function is to convert the grouped device data
 * (which is organized by device type with each group containing multiple sub-devices)
 * into a single flat array of individual device objects. 
 */
const flattenDevices = (groupedDevices) => {
    const flat = [];
    groupedDevices.forEach(group => {
        group.subDevices.forEach(sub => {
            flat.push({
                deviceType: group.name,
                deviceName: sub.name,
                ...sub
            });
        });
    });
    return flat;
};




/* ----------------- Main Component ----------------- */
export default function ScheduleTable({ calendarValue, globalSelections, setGlobalSelections, userId, fetchTrigger }) {

    // Detect if the mouse is outside the left and right boundaries 

    // const tableRef = useRef(null);
    // const [lastAutoScrollingTime, setLastAutoScrollTime] = useState(0);
    // const AUTO_SCROLL_INTERVAL = 500;

    // Loading device 
    const [isLoadingDevices, setIsLoadingDevices] = useState(true);

    // Determine a reference date from external props
    let referenceDate = new Date();
    if (calendarValue instanceof Date) {
        referenceDate = calendarValue;
    } else if (Array.isArray(calendarValue) && calendarValue.length === 2) {
        const [s, e] = calendarValue;
        referenceDate = s < e ? s : e;
    }

    // Show 7 days => "weekStart" is Sunday
    const [weekStart, setWeekStart] = useState(getStartOfWeek(referenceDate));

    // Show devices, Search Box 
    const [devices, setDevices] = useState([]);
    const [filteredDevices, setFilteredDevices] = useState([]);
    const [devicesInput, setDevicesInput] = useState("");



    /* --------------- Fetch devices from the admin endpoint when component mounts or when fetchTrigger changes ---------------*/
    useEffect(() => {
        setIsLoadingDevices(true);
        async function fetchDevices() {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/devices`, {
                    method: "GET",
                    credentials: "include"
                });
                if (!res.ok) throw new Error("Failed to fetch devices");
                const data = await res.json();
                const grouped = {};
                data.forEach(dev => {
                    const type = dev.deviceType;
                    if (!grouped[type]) {
                        grouped[type] = { name: type, expanded: true, subDevices: [] };
                    }

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

                const sortedDevices = Object.keys(grouped)
                    .sort((a, b) => a.localeCompare(b))
                    .map(typeKey => ({
                        ...grouped[typeKey],
                        subDevices: grouped[typeKey].subDevices.sort((a, b) =>
                            naturalSort(a.name, b.name)
                        ),
                    }));
                setDevices(sortedDevices);
                setFilteredDevices(sortedDevices);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoadingDevices(false);
            }
        }
        fetchDevices();
    }, [fetchTrigger]);

    /* --------------- The logic for searching and showing devices ---------------*/

    // if there is no input, automatically show all devices 
    useEffect(() => {
        if (devicesInput.trim() === '') {
            setFilteredDevices(devices);
        }
    }, [devicesInput, devices]);

    // Search devices and show filtered devices 
    const flatDevices = flattenDevices(devices);
    const fuse = new Fuse(flatDevices, {
        keys: ['deviceType', 'deviceName'],
        threshold: 0.3,
        ignoreLocation: true,
    });

    const handleSearchDevices = () => {
        const input = devicesInput.trim();
        if (!input) {
            setFilteredDevices(devices);
            return;
        }

        const tokens = input.split(/[\s,_-]+/)
            .map(token => token.replace(/["'(){}]/g, '').trim())
            .filter(token => token.length > 0);
        const resultSet = new Set();
        tokens.forEach((token) => {
            const searchResult = fuse.search(token);
            searchResult.forEach(({ item }) => resultSet.add(item));
        });

        const grouped = {};
        Array.from(resultSet).forEach(item => {
            if (!grouped[item.deviceType]) {
                grouped[item.deviceType] = [];
            }
            grouped[item.deviceType].push(item);
        });
        const groupedArray = Object.keys(grouped)
            .sort((a, b) => a.localeCompare(b))
            .map(type => ({
                name: type,
                expanded: true,
                subDevices: grouped[type].sort((a, b) =>
                    naturalSort(a.deviceName, b.deviceName)
                )
            }));
        setFilteredDevices(groupedArray);
    }





    // Time segments
    const TIME_SEGMENTS = [
        '7 AM - 12 PM',
        '12 PM - 6 PM',
        '6 PM - 7 AM',
    ];

    /**
     * Range Selection State:
     * When a user initiates a rectangle selection needs to store 
     * isSelecting: whether a range is in progress.
     * deviceName and subName: the device and subdevice being selected.
     * startDate: the absolute date (from the first click).
     * startSeg: the segment index from the first click.
     * hoverDate and hoverSeg: the current cell being hovered (for tentative highlight).
     */
    const [rangeSelecting, setRangeSelecting] = useState({
        isSelecting: false,
        deviceName: null,
        subName: null,
        startDate: null,
        startSeg: null,
        hoverDate: null,
        hoverSeg: null,
    });

    // When external calendarValue changes, update the displayed week
    useEffect(() => {
        if (!calendarValue) {
            setWeekStart(getStartOfWeek(new Date()));
        } else if (calendarValue instanceof Date) {
            setWeekStart(getStartOfWeek(calendarValue));
        } else if (
            Array.isArray(calendarValue) &&
            calendarValue.length === 2
        ) {
            const [start, end] = calendarValue;
            const earlier = start < end ? start : end;
            setWeekStart(getStartOfWeek(earlier));
        }
    }, [calendarValue]);

    // Bookings from server
    const [bookingsInWeek, setBookingsInWeek] = useState([]);
    useEffect(() => {
        if (!userId) {
            setBookingsInWeek([]);
            return;
        }

        const fetchBookings = () => {
            const startStr = formatDateKey(weekStart);
            fetch(`${API_BASE_URL}/bookings/for-week?start=${startStr}`, {
                method: "GET",
                credentials: "include"
            })
                .then(res => {
                    if (!res.ok) throw new Error("Failed to fetch booking data");
                    return res.json();
                })
                .then(data => setBookingsInWeek(data))
                .catch(err => console.error(err));
        };

        fetchBookings();

        // Refresh the page in every 10 seconds
        const intervalId = setInterval(() => {
            fetchBookings();
        }, 10000);

        return () => clearInterval(intervalId);
    }, [weekStart, userId, fetchTrigger]);

    // Get the booking information from an occupied 
    function getBookingsForSlot(day, segIndex, deviceType, deviceName) {
        const [startHour, endHour] = parseTimeSegment(TIME_SEGMENTS[segIndex]);
        const slotStart = new Date(day);
        slotStart.setHours(startHour, 0, 0, 0);
        const slotEnd = new Date(day);
        if (endHour < startHour)
            slotEnd.setDate(slotEnd.getDate() + 1);

        slotEnd.setHours(endHour, 0, 0, 0);

        return bookingsInWeek.filter(bk => {
            if (
                bk.device_type !== deviceType ||
                bk.device_name !== deviceName ||
                ['CANCELLED', 'REJECTED'].includes(bk.status)
            ) return false;
            const bStart = new Date(bk.start_time);
            const bEnd = new Date(bk.end_time);
            return bStart < slotEnd && bEnd > slotStart;
        });
    }

    // Build an array of 7 days for the current view
    const daysOfWeek = Array.from({ length: 7 }, (_, i) =>
        addDays(weekStart, i)
    );

    // Navigation
    const goToPreWeek = () => {
        setWeekStart((cur) => addDays(cur, -7));
    };
    const goToNextWeek = () => {
        setWeekStart((cur) => addDays(cur, 7));
    };

    // Expand/collapse single device
    function toggleExpand(deviceIndex) {
        setDevices((prev) =>
            prev.map((dev, i) =>
                i === deviceIndex ? { ...dev, expanded: !dev.expanded } : dev
            )
        );
    }

    // Expand/collapse all devices
    const allExpanded = devices.every(dev => dev.expanded);
    function toggleAll() {
        setDevices(
            prev => prev.map(
                dev => ({ ...dev, expanded: !allExpanded })
            )
        );
    }



    /**
     * Right-click to cancel the range selection.
     * 
     * 1. If the user finish the selection, right-click to remove the slot from globalSelections
     * 2. If the range selection is in progress, and the righ-clicked slot is the same as start slot, 
     *    then cancle the selection.
     */
    function handleSlotRightClick(e, deviceName, subName, dateObj, segIndex) {
        e.preventDefault();

        // chech the right-clicked slot is the same as the start slot 
        if (rangeSelecting.isSelecting &&
            rangeSelecting.deviceName === deviceName &&
            rangeSelecting.subName === subName &&
            formatDateKey(dateObj) === formatDateKey(rangeSelecting.startDate) &&
            segIndex === rangeSelecting.startSeg
        ) {
            hoverStateRef.current = { deviceName: null, subName: null, dateKey: null, segIndex: null }; // Reset ref
            setRangeSelecting({
                isSelecting: false,
                deviceName: null,
                subName: null,
                startDate: null,
                startSeg: null,
                hoverDate: null,
                hoverSeg: null,
            });
        }

        const dateKey = formatDateKey(dateObj); // e.g. "2025-03-10"
        // Store deviceName => subName => array of slots
        const deviceData = globalSelections[deviceName] || {};
        const subArray = deviceData[subName] || [];

        // Filter out the slot
        const newSubArray = subArray.filter(
            (slot) => !(slot.dateKey === dateKey && slot.segIndex === segIndex)
        );
        if (newSubArray.length !== subArray.length) {
            // Something was removed => update
            const newDeviceData = {
                ...deviceData,
                [subName]: newSubArray,
            };
            const newGlobal = {
                ...globalSelections,
                [deviceName]: newDeviceData,
            };
            setGlobalSelections(newGlobal);
        }
    }

    /**
     * Check if this slot is already in "globalSelections"
     */
    // function isSlotSelected(deviceName, subName, dateObj, segIndex) {
    //     const deviceData = globalSelections[deviceName];
    //     if (!deviceData) return false;
    //     const subArray = deviceData[subName];
    //     if (!subArray) return false;
    //     const dateKey = formatDateKey(dateObj);
    //     return subArray.some(
    //         (slot) => slot.dateKey === dateKey && slot.segIndex === segIndex
    //     );
    // }

    /**
     * Is this slot in the "tentative" range?
     * If rangeSelecting is in progress and matches deviceName + subName,
     * we see if its date + segment are in [start..hover].
     * We'll only highlight if the user is still on the same subdevice
     * they started with.
     */
    function isSlotInTentativeRange(
        deviceName,
        subName,
        dateObj,
        segIndex
    ) {
        if (!rangeSelecting.isSelecting) return false;
        if (rangeSelecting.deviceName !== deviceName) return false;
        if (rangeSelecting.subName !== subName) return false;
        if (!rangeSelecting.hoverDate || rangeSelecting.hoverSeg == null)
            return false;

        // We'll figure out if dateObj+segIndex is in the min..max rectangle
        const slots = getSlotsInRange(
            rangeSelecting.startDate,
            rangeSelecting.startSeg,
            rangeSelecting.hoverDate,
            rangeSelecting.hoverSeg,
            TIME_SEGMENTS
        );
        // Now check if we match dateObj+segIndex
        const dateKey = formatDateKey(dateObj);
        return slots.some(
            (slot) => slot.dateKey === dateKey && slot.segIndex === segIndex
        );
    }

    /**
     * check if the slot is available for the selection 
     */

    function isSlotAvailableForSelection(day, segIndex, deviceName, subName) {

        // Check the device status
        const device = devices.find(d => d.name === deviceName)
            ?.subDevices.find(s => s.name === subName);

        // If the device is in maintenance and has maintenance time data, only the slots in the maintenance time period are disabled.
        if (device && device.status === 'Maintenance' && device.maintenance_start && device.maintenance_end) {
            const maintenanceStart = parseMaintenanceTime(device.maintenance_start);
            const maintenanceEnd = parseMaintenanceTime(device.maintenance_end, true);
            const [startH, endH] = parseTimeSegment(TIME_SEGMENTS[segIndex]);
            const slotStart = new Date(day);
            slotStart.setHours(startH, 0, 0, 0);
            const slotEnd = new Date(day);
            slotEnd.setHours(endH, 0, 0, 0);
            // If the current slot overlaps the maintenance time interval, false is returned (not selectable)
            if (maintenanceStart && maintenanceEnd && slotStart < maintenanceEnd && slotEnd > maintenanceStart) {
                return false;
            }
        }

        // check server booking
        const cl = getSlotSatusClass(day, segIndex, deviceName, subName);
        // if cl === "" => means not occupied => true
        if (!cl) return true;

        // if cl includes "my-cancelled-slot" or "my-rejected-slot"
        if (cl.includes("my-cancelled-slot") || cl.includes("my-rejected-slot")) {
            return true;
        }

        if (cl.includes("others-slot"))
            return true
        // everything else => false
        return false;
    }

    function getSelectedSlot(deviceName, subName, dateObj, segIndex) {
        const deviceData = globalSelections[deviceName];
        if (!deviceData)
            return null;
        const subArray = deviceData[subName];
        if (!subArray)
            return null;
        const dateKey = formatDateKey(dateObj);
        return subArray.find(slot => slot.dateKey === dateKey && slot.segIndex === segIndex);
    }


    /**
     * Left-click => if not isSelecting, start; if isSelecting, finalize
     * 1. Can select idle sliots
     * 2. Can select occupied slots, but the limitation of each slot is 2, if it's over 2, can't select 
     * 3. Can't select slots that are already submitted 
     */
    function handleSlotLeftClick(e, deviceName, subName, dateObj, segIndex, label) {
        e.preventDefault();

        if (!isSlotAvailableForSelection(dateObj, segIndex, deviceName, subName)) {
            return;
        }
        // Must be in the future to matter
        if (!isSegmentInFuture(dateObj, label)) return;

        if (!rangeSelecting.isSelecting) {
            // Start the range
            hoverStateRef.current = { deviceName: null, subName: null, dateKey: null, segIndex: null }; // Reset ref
            setRangeSelecting({
                isSelecting: true,
                deviceName,
                subName,
                startDate: dateObj,
                startSeg: segIndex,
                hoverDate: dateObj,
                hoverSeg: segIndex,
            });
            return;
        }

        // If already in selection mode, but user clicked a different subdevice => new start
        if (
            rangeSelecting.deviceName !== deviceName ||
            rangeSelecting.subName !== subName
        ) {
            hoverStateRef.current = { deviceName: null, subName: null, dateKey: null, segIndex: null }; // Reset ref
            setRangeSelecting({
                isSelecting: true,
                deviceName,
                subName,
                startDate: dateObj,
                startSeg: segIndex,
                hoverDate: dateObj,
                hoverSeg: segIndex,
            });
            return;
        }

        // Otherwise, finalize selection and generate all slots 
        let newSlots = getSlotsInRange(
            rangeSelecting.startDate,
            rangeSelecting.startSeg,
            dateObj,
            segIndex,
            TIME_SEGMENTS
        );

        // Filter for the time slost
        newSlots = newSlots.filter(s => {
            const slotDate = new Date(s.dateKey);

            // if this slot is occupied, skip
            return !getSelectedSlot(deviceName, subName, slotDate, s.segIndex) &&
                isSlotAvailableForSelection(slotDate, s.segIndex, deviceName, subName);

        });

        // Add them to globalSelections
        const deviceData = globalSelections[deviceName] || {};
        const subArray = deviceData[subName] || [];

        // Merge newSlots with subArray
        const merged = [...subArray];

        newSlots.forEach(s => {
            // check if the time slots has other's(conflicting) status
            const dayForSlot = new Date(s.dateKey);
            const serverClass = getSlotSatusClass(dayForSlot, s.segIndex, deviceName, subName);

            //if the server return others-slot, then mark as the conflicting status 
            s.conflict = serverClass.includes("others-slot");
            merged.push(s);

        });

        const newDeviceData = {
            ...deviceData,
            [subName]: merged,
        };
        const newGlobal = {
            ...globalSelections,
            [deviceName]: newDeviceData,
        };
        setGlobalSelections(newGlobal);

        // Reset rangeSelecting
        hoverStateRef.current = { deviceName: null, subName: null, dateKey: null, segIndex: null }; // Reset ref
        setRangeSelecting({
            isSelecting: false,
            deviceName: null,
            subName: null,
            startDate: null,
            startSeg: null,
            hoverDate: null,
            hoverSeg: null,
        });
    }

    /**
     * Update hover effect if isSelecting & same subdevice & slot is in the future
     * Memoized and throttled to prevent flickering
     */
    const hoverStateRef = useRef({ deviceName: null, subName: null, dateKey: null, segIndex: null });
    
    const handleSlotMouseOver = useCallback((deviceName, subName, dateObj, segIndex) => {
        // Check if this slot is in the future (otherwise, do not highlight).
        const label = TIME_SEGMENTS[segIndex];
        if (!isSegmentInFuture(dateObj, label)) return; // no hover effect on expired/past slot

        // If not select a range.
        if (!rangeSelecting.isSelecting) return;

        // If this slot doesn't belong to the same device / subdevice, do nothing.
        if (rangeSelecting.deviceName !== deviceName) return;
        if (rangeSelecting.subName !== subName) return;

        // Use ref to track the last hover state to avoid unnecessary updates
        const dateKey = formatDateKey(dateObj);
        const lastHover = hoverStateRef.current;
        
        // Only update if the hover position actually changed
        if (lastHover.deviceName === deviceName &&
            lastHover.subName === subName &&
            lastHover.dateKey === dateKey &&
            lastHover.segIndex === segIndex) {
            return; // Same position, no update needed
        }

        // Update the ref
        hoverStateRef.current = { deviceName, subName, dateKey, segIndex };

        // Update the hover state to indicate a tentative selection up to this slot.
        setRangeSelecting((prev) => ({
            ...prev,
            hoverDate: dateObj,
            hoverSeg: segIndex,
        }));
    }, [rangeSelecting.isSelecting, rangeSelecting.deviceName, rangeSelecting.subName]);


    // When the mouse is in selection state and moves out of the left and right boundaries.
    // function handleMouseMove(e) {
    //     if (!rangeSelecting.isSelecting)
    //         return
    //     const now = Date.now();

    //     if (now - lastAutoScrollingTime < AUTO_SCROLL_INTERVAL)
    //         return;

    //     const container = tableRef.current;

    //     if (!container)
    //         return;

    //     const rect = container.getBoundingClientRect();
    //     const mouseX = e.clientX;

    //     // A small threshold is reserved so that the user can trigger the page 
    //     // turn by slightly crossing the boundary

    //     const LEFT_THRESHOLD = rect.left + 20;
    //     const RIGHT_THRESHOLD = rect.right - 20;

    //     if (mouseX < LEFT_THRESHOLD) {
    //         goToPreWeek();
    //         setLastAutoScrollTime(now);
    //     }
    //     if (mouseX > RIGHT_THRESHOLD) {
    //         goToNextWeek();
    //         setLastAutoScrollTime(now);
    //     }

    // }

    /**
     * 
     * @param {*} day 
     * @param {*} segIndex 
     * @param {*} deviceName Device Type
     * @param {*} subName Sub-device 
     * @returns 
     * 
     * 
     * 
     * 
     * Render the time slot 
     */

    function getSlotSatusClass(day, segIndex, deviceName, subName) {


        if (!userId) return "";
        const [startH, endH] = parseTimeSegment(TIME_SEGMENTS[segIndex]);
        const slotStart = new Date(day);
        slotStart.setHours(startH, 0, 0, 0);
        const slotEnd = new Date(day);
        if (endH < startH) {
            slotEnd.setDate(slotEnd.getDate() + 1);
        }
        slotEnd.setHours(endH, 0, 0, 0);

        const label = TIME_SEGMENTS[segIndex];
        if (!isSegmentInFuture(day, label)) {
            return "";
        }

        // Show the maintenance status slots
        const device = devices.find(d => d.name === deviceName)?.subDevices.find(s => s.name === subName);

        // if the maintenanced slots include 6om-7am， then color it.
        if (device?.status === 'Maintenance') {
            // Scenario 1: All day
            if (device.maintenance_start?.startsWith("All Day")) {
                // Parse the maintenance date range
                const [__, startDateStr] = device.maintenance_start.split('/');
                const [_, endDateStr] = device.maintenance_end.split('/');
                const currentDateKey = formatDateKey(day);

                // Determine whether the current date is within the maintenance range
                if (currentDateKey >= startDateStr && currentDateKey <= endDateStr) {
                    return " maintenance-slot";
                }
            }
            // Scenario 2: Maintenance window 
            else if (device.maintenance_start && device.maintenance_end) {

                const maintenanceStart = parseMaintenanceTime(device.maintenance_start);
                const maintenanceEnd = parseMaintenanceTime(device.maintenance_end, true);

                // Handle the mapping from 6PM-11PM to 6PM-7AM
                if (device.maintenance_start.includes("6 PM - 11 PM") && segIndex === 2) {
                    // Corresponding time period on the user side: 6PM-7AM(+1 Day)
                    const mappedSlotStart = new Date(day);
                    mappedSlotStart.setHours(18, 0, 0, 0);
                    const mappedSlotEnd = new Date(day);
                    mappedSlotEnd.setDate(mappedSlotEnd.getDate() + 1);
                    mappedSlotEnd.setHours(7, 0, 0, 0);

                    // Check if time slots is overlapped 
                    if (maintenanceStart < mappedSlotEnd && maintenanceEnd > mappedSlotStart) {
                        return " maintenance-slot";
                    }
                }
                // Normal time slot check 
                else if (maintenanceStart && maintenanceEnd) {
                    if (slotStart < maintenanceEnd && slotEnd > maintenanceStart) {
                        return " maintenance-slot";
                    }
                }
            }
        }

        // Get the overlapping bookings
        const overlappingBookings = [];
        for (const bk of bookingsInWeek) {
            if (bk.device_type !== deviceName || bk.device_name !== subName) continue;
            const bStart = new Date(bk.start_time);
            const bEnd = new Date(bk.end_time);
            // Overlook the cancelled booking
            if (bEnd > slotStart && bStart < slotEnd && (bk.status || "") !== "CANCELLED" && (bk.status || "") !== "REJECTED") {
                overlappingBookings.push(bk);
            }
        }

        // if multiple people make a reservation for the same slot, 
        // the status won't affect the first one's, athe rest will be displayed as conflicts.
        if (overlappingBookings.length === 0) return "";

        // Multiple overlapping bookings 
        if (overlappingBookings.length > 1) {
            if (overlappingBookings[0].user_id === userId) {
                const myBooking = overlappingBookings.find(bk => bk.user_id === userId);
                if (myBooking) {
                    // Return the specific CSS accoring to the status 
                    switch ((myBooking.status || "").toLowerCase()) {
                        case "pending": return " my-pending-slot";
                        case "confirmed": return " my-confirmed-slot";
                        case "expired": return " my-expired-slot";
                        default: return " my-selected-slot";
                    }
                }
                return "";
            } else {
                return " conflicting-slot";
            }
        } else {
            // There is only 1 booking
            const onlyBooking = overlappingBookings[0];
            if (onlyBooking.user_id === userId) {
                switch ((onlyBooking.status || "").toLowerCase()) {
                    case "pending": return " my-pending-slot";
                    case "confirmed": return " my-confirmed-slot";
                    case "expired": return " my-expired-slot";
                    default: return " my-selected-slot";
                }
            } else {
                return " others-slot";
            }
        }
    }



    return (
        <div className="schedule-table-container">
            {/* Header row */}
            <div className="schedule-table-header">

                {/* Search box */}
                <div className="sche-search-box">
                    <img src={searchDevice} alt="Search" className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search devices..."
                        value={devicesInput}
                        onChange={(e) => {
                            const inputValue = e.target.value;
                            setDevicesInput(inputValue);
                            handleSearchDevices(devicesInput);
                        }}
                    />
                    {/* <button className="sche-search-button" onClick={handleSearchDevices}>
                        Search
                    </button> */}
                </div>

                {/* Navagation button */}
                <div className="sche-navigation-controls">
                    <button onClick={goToPreWeek}>{'<'}</button>
                    <span className="month-year">{formatMonthYear(weekStart)}</span>
                    <button onClick={goToNextWeek}>{'>'}</button>
                </div>
            </div>

            {/* Days row */}
            <div className="days-row">
                <div className="day-column-header placeholder-cell header-with-toggle" >
                    <span className='device-label'>Device</span>
                    <button onClick={toggleAll} className="collapse-all-btn">
                        {allExpanded ? 'Collapse All' : 'Expand All'}
                    </button>


                </div>
                {daysOfWeek.map((day) => {
                    let highlightClass = '';
                    if (calendarValue instanceof Date && isSameDay(day, calendarValue)) {
                        highlightClass = 'highlight';
                    } else if (
                        Array.isArray(calendarValue) &&
                        calendarValue.length === 2
                    ) {
                        const [start, end] = calendarValue;
                        const left = start < end ? start : end;
                        const right = start < end ? end : start;
                        if (isWithinRange(day, left, right)) {
                            highlightClass = 'highlight';
                        }
                    }

                    return (
                        <div
                            key={day.toISOString()}
                            className="day-column-header ${highlightClass"
                        >
                            <div className={`user-weekday ${highlightClass}`}>{formatDayOfWeek(day)}</div>
                            <div className={`user-daynum ${highlightClass}`}>{formatDayNum(day)}</div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="legend-container">
                <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: '#7c3aed' }} />
                    <span>MY SELECTED</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: '#f59e0b' }} />
                    <span>MY PENDING</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: '#10b981' }} />
                    <span>MY CONFIRMED</span>
                </div>
                {/* <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: 'gray' }} />
                    <span>My past</span>
                </div> */}
                <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: '#9333ea' }} />
                    <span>OTHERS'</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: '#ef4444' }} />
                    <span>CONFLICTING</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: 'gray' }} />
                    <span>MAINTENANCE</span>
                </div>
            </div>

            {/** ref={tableRef} onMouseMove={handleMouseMove} */}

            {/* Loading indicator */}
            {isLoadingDevices && (
                <div className="loading-devices-indicator">
                    <div className="loading-spinner" />
                    <p>Loading devices...</p>
                </div>
            )}

            {/* Main schedule table */}
            <div className="devices-scroll-container">
                <div className="schedule-table">
                    {filteredDevices.map((device, dIndex) => (
                        <React.Fragment key={device.name}>
                            <div className="device-row device-type">
                                <div className="device-type-name">
                                    {device.name}
                                    <button className="expand-button" onClick={() => toggleExpand(dIndex)}
                                    >
                                        {device.expanded ? '▲' : '▼'}
                                    </button>
                                </div>
                            </div>
                            {device.expanded &&
                                device.subDevices.map((subDevice, subIndex) => (
                                    <React.Fragment key={subDevice.name}>
                                        <div className="device-row sub-device-row">
                                            <div className="device-name">{subDevice.name}</div>
                                            {/* For each of the 7 days */}
                                            {daysOfWeek.map((day) => (
                                                <div key={day.toISOString()} className="day-column">
                                                    {/* For each time segment */}
                                                    {TIME_SEGMENTS.map((label, segIndex) => {
                                                        let slotClass = 'time-slot';
                                                        const isExpired = !isSegmentInFuture(day, label);
                                                        if (isExpired) {
                                                            slotClass += " expired-slot"
                                                        } else {
                                                            const serverClass = getSlotSatusClass(day, segIndex, device.name, subDevice.name);
                                                            const selectedSlot = getSelectedSlot(device.name, subDevice.name, day, segIndex);

                                                            // if the server returns the confliction, then use confliction status 
                                                            if (serverClass === " conflicting-slot") {
                                                                slotClass += " conflicting-slot";
                                                            } else if (selectedSlot) {
                                                                slotClass += selectedSlot.conflict ? " conflicting-slot" : " my-selected-slot";
                                                            }

                                                            // Only attach if the server status is not conflicting
                                                            if (serverClass && serverClass !== " conflicting-slot") {
                                                                slotClass += serverClass;
                                                            }

                                                            // Tentative selection removed to eliminate flicker
                                                            // Users can still select by clicking - no preview shown
                                                            // if (isSlotInTentativeRange(device.name, subDevice.name, day, segIndex)) {
                                                            //     if (getSlotSatusClass(day, segIndex, device.name, subDevice.name).includes("others-slot")) {
                                                            //         slotClass += " conflicting-slot";
                                                            //     } else {
                                                            //         slotClass += " tentative-slot"
                                                            //     }
                                                            // }
                                                            if (!isSegmentInFuture(day, label)) {
                                                                slotClass += " expired-slot";
                                                            }
                                                        }

                                                        // Get the user name for this time slost
                                                        const slotBookings = getBookingsForSlot(day, segIndex, device.name, subDevice.name);
                                                        const names = slotBookings.map(bk => bk.username);

                                                        return (
                                                            <div
                                                                key={`${day.toISOString()}-${segIndex}`}
                                                                className={slotClass + (names.length ? ' booked-slot' : '')}
                                                                onClick={(e) =>
                                                                    handleSlotLeftClick(
                                                                        e,
                                                                        device.name,
                                                                        subDevice.name,
                                                                        day,
                                                                        segIndex,
                                                                        label
                                                                    )
                                                                }
                                                                onContextMenu={(e) =>
                                                                    handleSlotRightClick(
                                                                        e,
                                                                        device.name,
                                                                        subDevice.name,
                                                                        day,
                                                                        segIndex
                                                                    )
                                                                }
                                                                // MouseOver handler disabled to eliminate flicker
                                                                // Users select by clicking instead of hover preview
                                                                // onMouseOver={() =>
                                                                //     handleSlotMouseOver(
                                                                //         device.name,
                                                                //         subDevice.name,
                                                                //         day,
                                                                //         segIndex
                                                                //     )
                                                                // }
                                                                title={`${subDevice.name} : ${label}`}
                                                            >
                                                                {names.length ? names.join(' & ') : label}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>

                                        {subIndex < device.subDevices.length - 1 && (
                                            <div className="subdevice-divider" />
                                        )}

                                    </React.Fragment>
                                ))}

                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
}
