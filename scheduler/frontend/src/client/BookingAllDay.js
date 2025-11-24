import Fuse from 'fuse.js';
import React, { useCallback, useEffect, useState } from 'react';
import '../App.css';
import closeButton from '../image/close.png';
import './BookingAllDay.css';
import { API_BASE_URL } from '../config/api';

const STORAGE_KEY = 'multiDeviceBookingData';

/**
 * Convert "HH:MM" => to the number of minutes of the day relative to 0:00
 * Such as: "07:00" => 420,  "12:00" => 720,  "23:59" => 1439
 */
function timeStrToMinutes(timeStr) {
    const [hh, mm] = timeStr.split(':');
    return parseInt(hh, 10) * 60 + parseInt(mm, 10);
}

/**
 * 
 *  segIndex:
 *     0 => 07:00 - 12:00
 *     1 => 12:00 - 18:00
 *     2 => 18:00 - 07:00 (Next day)
 *
 *  Return the start and end minutes ==> [startMin, endMin)。
 *  In terms of the cross-day time slots: seg2 and endMin will add +1440。
 */
function getSegmentInterval(segIndex) {
    const startArray = ['07:00', '12:00', '18:00'];
    const endArray = ['12:00', '18:00', '07:00'];
    let startMin = timeStrToMinutes(startArray[segIndex]);
    let endMin = timeStrToMinutes(endArray[segIndex]);
    if (segIndex === 2) {
        // Cross-day: 18:00 => Next 07:00
        endMin += 1440;
    }
    return { startMin, endMin };
}

/**
 * Parse "YYYY-MM-DD" => { year, month, day }，pur numberic
 */
function parseYMD(dateStr) {
    const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10));
    return { year: y, month: m, day: d };
}

/**
 * Add n days to { year, month, day }, return the new { year, month, day }
 * month is 1~12，day is 1~31
 */
function addDays(ymd, n) {
    const temp = new Date(ymd.year, ymd.month - 1, ymd.day);
    temp.setDate(temp.getDate() + n);
    return {
        year: temp.getFullYear(),
        month: temp.getMonth() + 1,
        day: temp.getDate()
    };
}

/**
 *  {year, month, day} => "YYYY-MM-DD"
 */
function formatYMD({ year, month, day }) {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}

/**
 * 从patch列表中提取设备名称
 * @param {string} input 输入的patch列表文本
 * @returns {string[]} 提取出的设备名称数组
 */
function extractDevicesFromPatch(input) {
    if (!input) return [];

    // 匹配patch列表中的设备名称
    const deviceRegex = /\('([^']+)',\s*'([^']+)'\)/g;
    const devices = new Set();
    let match;

    while ((match = deviceRegex.exec(input)) !== null) {
        devices.add(match[1]);
        devices.add(match[2]);
    }

    return Array.from(devices);
}

const BookingAllDay = ({
    onClose,
    setGlobalSelections
}) => {
    const [devicesInput, setDevicesInput] = useState('');
    const [devices, setDevices] = useState([]);
    const [filteredDevices, setFilteredDevices] = useState([]);
    const [startDate, setStartDate] = useState('');  // "YYYY-MM-DD"
    const [endDate, setEndDate] = useState('');    // "YYYY-MM-DD"
    const [conflicts, setConflicts] = useState([]);
    const [selectedDevices, setSelectedDevices] = useState([]);

    // ================ Search devices ================
    /**
     * When users complete to input in the search box,
     * split the input and pass it to fuse one by one
     */
    const fuse = new Fuse(devices, {
        keys: [
            { name: 'deviceType', weight: 0.4 },
            { name: 'deviceName', weight: 0.5 },
            { name: 'ip_address', weight: 0.1 }
        ],
        threshold: 0.45,
        ignoreLocation: true,
        useExtendedSearch: true,
        shouldSort: true,
        minMatchCharLength: 1,
        findAllMatches: true,
        ignoreFieldNorm: true
    });

    const handleSearchDevices = () => {
        if (!devicesInput.trim()) {
            alert("Please enter a device(s)");
            return;
        }

        // 检查是否包含patch列表格式
        const isPatchList = devicesInput.includes("('") && devicesInput.includes("')");

        let searchQueries;
        if (isPatchList) {
            // 从patch列表中提取设备名称
            searchQueries = extractDevicesFromPatch(devicesInput);
            if (searchQueries.length === 0) {
                alert("No valid devices found in patch list format");
                return;
            }
        } else {
            // 普通搜索格式
            searchQueries = devicesInput
                .split(/[,;\n]/)
                .map(q =>
                    q.trim()
                        .replace(/^\[|\]$/g, '')
                        .replace(/\s{2,}/g, ' ')
                )
                .filter(q => q.length > 0);
        }

        const allResults = searchQueries.reduce((acc, query) => {
            const isExactMatch = query.startsWith('"') && query.endsWith('"');
            const isTypeSearch = query.toLowerCase().startsWith('type:');
            const isNameSearch = query.toLowerCase().startsWith('name:');

            let fuseQuery;
            if (isExactMatch) {
                fuseQuery = { $eq: query.slice(1, -1) };
            } else if (isTypeSearch) {
                const typeValue = query.slice(5).trim();
                fuseQuery = { deviceType: `^${typeValue}` };
            } else if (isNameSearch) {
                const nameValue = query.slice(5).trim();
                fuseQuery = { deviceName: nameValue };
            } else {
                const normalized = query.replace(/[-_]/g, ' ').toLowerCase();
                fuseQuery = {
                    $or: [
                        { deviceType: `'${normalized}` },
                        { deviceName: `=${normalized}` },
                        { deviceName: `'${normalized}` },
                        { ip_address: `'${normalized}` }
                    ]
                };
            }

            const result = fuse.search(fuseQuery);
            return [...acc, ...result.map(r => r.item)];

        }, []);

        const uniqueResults = allResults.filter((v, i, a) =>
            a.findIndex(t => t.id === v.id) === i
        );

        setFilteredDevices(uniqueResults);
    };

    // Automatically clear results when input is empty
    useEffect(() => {
        if (!devicesInput.trim()) {
            setFilteredDevices([]);
        }
    }, [devicesInput]);

    // ================ Fetech all devices ================
    useEffect(() => {
        async function fetchDevices() {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/devices`, {
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    setDevices(data);
                }
            } catch (err) {
                console.error('Failed to fetch devices:', err);
            }
        }
        fetchDevices();
    }, []);

    // ================ Delete devices from device list ================
    const toggleDeviceSelection = (deviceId) => {
        setSelectedDevices(prevSelected => {
            // find the current selected device
            const clicked = devices.find(d => d.id === deviceId);
            if (!clicked) return prevSelected;

            // Collect all device id with same device type
            const sameNameIds = devices
                .filter(d => d.deviceName === clicked.deviceName)
                .map(d => d.id);

            const allSelected = sameNameIds.every(id => prevSelected.includes(id));

            if (allSelected) {
                return prevSelected.filter(id => !sameNameIds.includes(id));
            } else {
                return Array.from(new Set([
                    ...prevSelected,
                    ...sameNameIds
                ]));
            }
        });
    };

    // ================ Check conflicts ================
    const checkConflicts = useCallback(async () => {
        try {
            if (!startDate || !endDate || selectedDevices.length === 0) {
                setConflicts([]);
                return;
            }
            const res = await fetch(`${API_BASE_URL}/check-conflicts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_ids: selectedDevices,
                    start: `${startDate}T00:00:00`,
                    end: `${endDate}T23:59:59`
                }),
            });
            if (!res.ok) throw new Error('Request failed');
            const data = await res.json();
            setConflicts(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Conflict check failed:', err);
            setConflicts([]);
        }
    }, [startDate, endDate, selectedDevices]);

    useEffect(() => {
        if (!startDate || !endDate || selectedDevices.length === 0) {
            setConflicts([]);
            return;
        }
        checkConflicts();
    }, [startDate, endDate, filteredDevices, checkConflicts]);

    // ================ Save and Automatically select dates ================
    function handleSave() {
        if (!startDate || !endDate) {
            alert("Please select Start Date and End Date.");
            return;
        }

        if (selectedDevices.length === 0) {
            alert("Please select at least one device.");
            return;
        }

        const newGlobalSelections = {};

        // 修复：使用完整设备列表而不是过滤后的列表
        devices.filter(device => selectedDevices.includes(device.id)).forEach(device => {
            const deviceSlots = [];
            let curYMD = parseYMD(startDate);

            while (true) {
                const dateKey = formatYMD(curYMD);
                if (dateKey > endDate) break;

                for (let seg = 0; seg < 3; seg++) {
                    const { startMin, endMin } = getSegmentInterval(seg);
                    let hasConflict = false;

                    const deviceConflict = conflicts.find(c => c.device_id === device.id);
                    if (deviceConflict?.conflicts) {
                        deviceConflict.conflicts.forEach(slot => {
                            if (slot.date === dateKey) {
                                if (slot.start_time === "00:00" && slot.end_time === "23:59") {
                                    hasConflict = true;
                                    return;
                                }

                                let conflictStart = timeStrToMinutes(slot.start_time);
                                let conflictEnd = timeStrToMinutes(slot.end_time);
                                if (conflictEnd <= conflictStart) conflictEnd += 1440;

                                if (conflictEnd > startMin && conflictStart < endMin) {
                                    hasConflict = true;
                                }
                            }
                        });
                    }

                    if (!hasConflict) {
                        deviceSlots.push({ dateKey, segIndex: seg });
                    }
                }

                curYMD = addDays(curYMD, 1);
                if (formatYMD(curYMD) > endDate) break;
            }

            if (deviceSlots.length > 0) {
                if (!newGlobalSelections[device.deviceType]) {
                    newGlobalSelections[device.deviceType] = {};
                }
                newGlobalSelections[device.deviceType][device.deviceName] = deviceSlots;
            }
        });

        setGlobalSelections(prev => {
            const merged = { ...prev };
            // Collect current devoces
            const currentTypes = new Set(Object.keys(newGlobalSelections));

            // Manage the selected devices. New data will overlap old data
            for (const [type, nameMap] of Object.entries(newGlobalSelections)) {
                merged[type] = { ...nameMap };
            }

            // Clean non-selected devices
            for (const type of Object.keys(merged)) {
                if (!currentTypes.has(type)) {
                    delete merged[type];
                }
            }

            return merged;
        });

        const savedData = {
            devicesInput,
            filteredDevices,
            startDate,
            endDate,
            selectedDevices
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedData));

        onClose();
    }

    // ================ Save the local storage ================
    useEffect(() => {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                setDevicesInput(parsed.devicesInput || '');
                setFilteredDevices(parsed.filteredDevices || []);
                setStartDate(parsed.startDate || '');
                setEndDate(parsed.endDate || '');
                setSelectedDevices(parsed.selectedDevices || []);
            } catch (err) {
                console.error('Failed to parse saved data', err);
            }
        }
    }, []);

    // Close and clear the cache 
    const handleClose = () => {
        localStorage.removeItem(STORAGE_KEY);
        onClose();
    };

    return (
        <div className="book-multi-device-overlay">
            <div className="book-multi-device">
                {/* Header */}
                <div className="book-multi-device-header">
                    <h3>Multi-Device Booking</h3>
                    <h3 style={{ color: 'red' }}>DO NOT FORGET TO SAVE</h3>

                    <button className="close-button" onClick={handleClose} />
                </div>

                {/* Body */}
                <div className="book-multi-device-body">
                    {/* ========================= Left panel ========================= */}

                    {/* Search box */}
                    <div className="book-multi-device-left-panel">
                        <div className="book-search-container">
                            <input
                                type="text"
                                placeholder="Enter device info or patch list"
                                value={devicesInput}
                                onChange={(e) => setDevicesInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearchDevices()}
                            />
                            <button onClick={handleSearchDevices}>OK</button>
                        </div>

                        {/* Search help */}
                        <div className="search-help">
                            <p>Search Tips:</p>
                            <ul>
                                <li>Use commas or semicolons to separate multiple devices</li>
                                <li>Exact match: "device_name"</li>
                                <li>Type search: type:device_type</li>
                                <li>Name search: name:device_name</li>
                                <li>Paste patch list format directly</li>
                            </ul>
                        </div>

                        {/* Selected Device List */}
                        <div className="selected-devices-section">
                            <h4>Selected Devices:</h4>
                            <div className="selected-devices-list">
                                {selectedDevices.map(deviceId => {
                                    const device = devices.find(d => d.id === deviceId);
                                    return device ? (
                                        <div key={deviceId} className="selected-device-name">
                                            <span>{device.deviceType} == {device.deviceName}</span>
                                            <button
                                                onClick={() => toggleDeviceSelection(deviceId)}
                                                className="remove-device-button"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : null;
                                })}
                            </div>

                        </div>

                        {/* Searched Device List */}
                        <div className="device-list">
                            {filteredDevices.map(device => (
                                <div key={device.id} className="device-item">
                                    <div className="device-info">
                                        <span>{device.deviceType} == {device.deviceName}</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={selectedDevices.includes(device.id)}
                                        onChange={() => toggleDeviceSelection(device.id)}
                                        className="device-checkbox"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ========================= Right panel：Date picker & Show conflicts =========================*/}
                    <div className="book-multi-device-right-panel">

                        {/* Date Picker */}
                        <div className="book-multi-device-date-picker">
                            <div className="book-date-picker-row">
                                <label>Start date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="book-date-picker-row">
                                <label>End date</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Conflict list */}
                        <div className="conflict-list">
                            <h4 className="conflict-title">Conflicting Devices</h4>
                            {conflicts.length === 0 ? (
                                <div className="no-conflicts">No conflicts detected</div>
                            ) : (
                                conflicts.map(conf => (
                                    <div key={conf.device_id} className="conflict-item">
                                        <div className="device-header">
                                            <span className="device-name">{conf.device_name}</span>
                                        </div>
                                        {conf.conflicts.map((slot, idx) => {
                                            const isAllDay = (slot.start_time === "00:00" && slot.end_time === "23:59");
                                            const timeLabel = isAllDay
                                                ? "All Day"
                                                : `${slot.start_time} - ${slot.end_time}`;
                                            return (
                                                <div
                                                    key={idx}
                                                    className={`time-slot ${slot.conflict_type} ${isAllDay ? 'all-day' : ''}`}
                                                >
                                                    <div className="slot-date-time">
                                                        {slot.date} {timeLabel}
                                                    </div>
                                                    <span className="conflict-tag">{slot.conflict_type}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Save Button */}
                        <div className="mul-booking-button">
                            <button className="mul-booking-save" onClick={handleSave}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BookingAllDay;    