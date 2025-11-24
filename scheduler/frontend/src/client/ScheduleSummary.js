// ScheduleSummary.js
import React from 'react';


// Ireland Time Zone
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);


const IRELAND_TZ = 'Europe/Dublin';


/**
 * Merget slot function 
 * Given an array of slots(each slot is {dayIndex, segIndex}), sort them by date and time. 
 * Then merge thise consecutive time slots
 * @param {Array} slots - Array of slot objects  
 * @returns {Array} Array of merged intervals, each in the format. 
 */
function mergeSlots(slots) {
    if (!slots || slots.length === 0)
        return [];
    // Convert each slot to a numeric value
    const getValue = (slot) => {
        const d = dayjs.tz(slot.dateKey, 'YYYY-MM-DD', IRELAND_TZ);
        const dayValue = d.diff(dayjs.tz('1970-01-01', 'YYYY-MM-DD', IRELAND_TZ), 'day');
        return dayValue * 3 + slot.segIndex;
    };
    // Sort by the value
    const sorted = slots.slice().sort((a, b) => getValue(a) - getValue(b));
    const intervals = [];
    let start = sorted[0];
    let end = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        const slot = sorted[i];
        if (getValue(slot) === getValue(end) + 1) {
            // If the slot is consecutive (value equals previous value + 1), merge it.
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
 * Formats the date string DD/MM/YY
 * @param {string} dateKey 
 * @returns {string}
 */
function formatDateDDMMYY(dateKey) {
    const d = dayjs.tz(dateKey, IRELAND_TZ);
    return d.format('DD/MM/YY');
}

/**
 * Define the display texts for each time segment.
 */
const SEGMENT_START_TIMES = ["7:00 AM", "12:00 PM", "6:00 PM"];
const SEGMENT_END_TIMES = ["12:00 PM", "6:00 PM", "7:00 AM"];

/**
 * ScheduleSummary component
 * This component displays the reservation summary information 
 * Device Type: Device A
 *  Device Name: A1
 *      Start Time: DD/MM/YY [start] -- End Time: DD/MM/YY [end]
 *  Device Name: A1
 *      Start Time: DD/MM/YY [start] -- End Time: DD/MM/YY [end]
 * --------------------------------------------------
 * Device Type: Device B
 *   Device Name: B1
 *   From: ...
 *   To:   ...
 * 
 * If there are multiple intervals for the same device that are not continuous,
 * they are shown as seperate entries 
 * 
 * If there is no selections, show "No selections made yet."
 * @param {Object} props.globalSelections
 * @returns 
 */
const ScheduleSummary = ({ globalSelections }) => {

    // Reduce over each device type in globalSelections to build a filtered selections object
    const filteredSelections = Object.keys(globalSelections).reduce((acc, deviceType) => {
        const deviceData = globalSelections[deviceType];
        const filteredSubDevices = {};

        // Loop through each sub-device under the current device type
        Object.keys(deviceData).forEach((subName) => {
            const slots = deviceData[subName];
            // Separating normal and conflicting slots
            const normalSlots = slots.filter(s => !s.conflict);
            const conflictSlots = slots.filter(s => s.conflict);
            const intervals = {};
            if (normalSlots.length > 0) {
                intervals.normal = mergeSlots(normalSlots);
            }
            if (conflictSlots.length > 0) {
                intervals.conflict = mergeSlots(conflictSlots);
            }
            if (Object.keys(intervals).length > 0) {
                filteredSubDevices[subName] = intervals;
            }
        });
        if (Object.keys(filteredSubDevices).length > 0) {
            acc[deviceType] = filteredSubDevices;
        }
        return acc;
    }, {});

    const hasSelections = Object.keys(filteredSelections).length > 0;

    return (
        <div className="summary-panel">
            <div className="summary-panel-header">
                <h2 className="summary-header">Summary</h2>
                {!hasSelections && <p className="summary-empty">No selections made yet.</p>}
            </div>


            {hasSelections &&
                <div className="summary-panel-content">
                    {Object.keys(filteredSelections).map((deviceType) => {
                        const deviceData = filteredSelections[deviceType];
                        return (
                            <div key={deviceType} className="summary-device-type">
                                <h3 className="device-type-header">Device Type: {deviceType}</h3>
                                {Object.keys(deviceData).map((subName) => {
                                    const { normal, conflict } = deviceData[subName];
                                    return (
                                        <div key={subName} className="summary-subdevice">
                                            <h4 className="subdevice-header">Device Name: {subName}</h4>
                                            {normal && normal.map((interval, idx) => {
                                                const startTime = SEGMENT_START_TIMES[interval.startSlot.segIndex];
                                                const endTime = SEGMENT_END_TIMES[interval.endSlot.segIndex];
                                                const isOvernight = interval.endSlot.segIndex === 2; // Check if the time slot is cross-day
                                                let endDate = dayjs.tz(interval.endSlot.dateKey, "YYYY-MM-DD", IRELAND_TZ);
                                                if (isOvernight) {
                                                    endDate = endDate.add(1, 'day'); // End date +1 day
                                                }
                                                return (
                                                    <div key={`normal-${idx}`} className="interval">
                                                        <div className="interval-row">
                                                            <span className="interval-label" style={{ color: '#2874a6' }}>From:</span>
                                                            <span className="interval-value">
                                                                {formatDateDDMMYY(interval.startSlot.dateKey)} {startTime}
                                                            </span>
                                                        </div>
                                                        <div className="interval-row">
                                                            <span className="interval-label">To:</span>
                                                            <span className="interval-value">
                                                                {formatDateDDMMYY(endDate)} {endTime}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {conflict && conflict.map((interval, idx) => {
                                                const startTime = SEGMENT_START_TIMES[interval.startSlot.segIndex];
                                                const endTime = SEGMENT_END_TIMES[interval.endSlot.segIndex];
                                                const isOvernight = interval.endSlot.segIndex === 2; // Check if the time slot is cross-day
                                                const endDate = new Date(interval.endSlot.dateKey);
                                                if (isOvernight) {
                                                    endDate.setDate(endDate.getDate() + 1);
                                                }
                                                return (
                                                    <div key={`conflict-${idx}`} className="interval">
                                                        <div className="interval-row">
                                                            <span className="interval-label" style={{ color: 'red' }}>From:</span>
                                                            <span className="conflict-font">
                                                                {formatDateDDMMYY(interval.startSlot.dateKey)} {startTime}
                                                            </span>
                                                        </div>
                                                        <div className="interval-row">
                                                            <span className="interval-label" style={{ color: 'red' }}>To:</span>
                                                            <span className="conflict-font">
                                                                {formatDateDDMMYY(endDate)} {endTime} {/** Change the endate to cross-day of enddate */}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                                <hr className="summary-divider" />
                            </div>
                        );
                    })}
                </div>
            }
        </div>
    );
};


export default ScheduleSummary;
