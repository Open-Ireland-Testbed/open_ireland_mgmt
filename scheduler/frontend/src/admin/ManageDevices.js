// ManageDevices.js
import React, { useState, useEffect } from 'react';

import backArrow from '../image/back.png'
import addNewDevice from '../image/addNewDevice.png'
import showAll from '../image/showAll.png'
import searchDevice from '../image/search.png'
import '../App.css';

import Fuse from 'fuse.js';
import { API_BASE_URL } from '../config/api';

export default function ManageDevices({ onReturn }) {
    const [devices, setDevices] = useState([]);
    const [searchInput, setSearchInput] = useState('');
    const [showAddDevice, setShowAddDevice] = useState(false);
    const [newDevice, setNewDevice] = useState({
        polatis_name: '',
        deviceType: '',
        deviceName: '',
        ip_address: '',
        status: 'Available',
        maintenance_start_segment: '',
        maintenance_start_date: '',
        maintenance_end_segment: '',
        maintenance_end_date: ''

    });
    const [editDevice, setEditDevice] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch existed devices
    useEffect(() => {
        setIsLoading(true)
        async function fetchDevices() {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/devices`, {
                    credentials: 'include'
                });
                if (!res.ok) {
                    throw new Error('Failed to fetch devices');
                }
                const data = await res.json();
                setDevices(data);
            } catch (err) {
                alert(err.message);
            } finally {
                setIsLoading(false);
            }
        }
        fetchDevices();
    }, []);

    // ================= Add new devices =================
    const handleAddDevice = () => setShowAddDevice(true);
    const handleClosePopup = () => {
        setShowAddDevice(false);
        setNewDevice({ deviceType: '', deviceName: '', ip_address: '', status: 'Available' });
    };

    const handleSubmit = async () => {
        if (!newDevice.deviceType.trim() ||
            !newDevice.deviceName.trim() ||
            !newDevice.ip_address.trim() ||
            !newDevice.Out_Port ||
            !newDevice.In_Port) {
            alert('Please fill in required fields');
            return;
        }

        // Merge the maintenance time fields
        let deviceToSubmit = { ...newDevice };
        if (newDevice.status === "Maintenance") {
            if (!newDevice.maintenance_start_date || !newDevice.maintenance_end_date) {
                alert('Please fill in the complete maintenance start and end date');
                return;
            }

            const startDate = new Date(newDevice.maintenance_start_date);
            const endDate = new Date(newDevice.maintenance_end_date);
            if (startDate > endDate) {
                alert("The end date cannot be earlier than the start date");
                return;
            }

            if (!newDevice.maintenance_start_segment && !newDevice.maintenance_end_segment) {
                deviceToSubmit.maintenance_start = `All Day/${newDevice.maintenance_start_date}`;
                deviceToSubmit.maintenance_end = `All Day/${newDevice.maintenance_end_date}`;
            } else {
                deviceToSubmit.maintenance_start =
                    `${newDevice.maintenance_start_segment}/${newDevice.maintenance_start_date}`;
                deviceToSubmit.maintenance_end = `${newDevice.maintenance_end_segment}/${newDevice.maintenance_end_date}`;
            }
        } else {
            deviceToSubmit.maintenance_start = null;
            deviceToSubmit.maintenance_end = null;
        }


        try {
            const res = await fetch(`${API_BASE_URL}/admin/devices`, {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify(deviceToSubmit)
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Failed to add device');
            }
            const addedDevice = await res.json();
            setDevices(prev => [...prev, addedDevice].sort(deviceSorter));
            handleClosePopup();
            alert('Device added successfully!');
        } catch (err) {
            alert(err.message)
        }
    };
    // ================= Device Sorter =================
    const deviceSorter = (a, b) => {

        const typeCompare = a.deviceType.localeCompare(b.deviceType, undefined, { sensitivity: 'base' });

        if (typeCompare !== 0)
            return typeCompare;


        const regex = /(.*?)(\d+)?$/;
        const [, aBase, aNum] = a.deviceName.match(regex) || [];
        const [, bBase, bNum] = b.deviceName.match(regex) || [];

        const baseCompare = (aBase || a.deviceName).localeCompare(bBase || b.deviceName, undefined, { sensitivity: 'base' });
        if (baseCompare !== 0)
            return baseCompare;

        return (parseInt(aNum || 0) - parseInt(bNum || 0));
    };


    // ================= Delete a device =================
    const handleDelete = async (deviceId) => {
        if (!window.confirm(`Are you sure to delete device ${deviceId}?`)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/admin/devices/${deviceId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Failed to delete device');
            }
            // Remove from local state
            setDevices((prev) => prev.filter((dev) => dev.id !== deviceId));
            alert(`Device ${deviceId} deleted.`);
        } catch (err) {
            alert(err.message);
        }
    };

    // ================= Search devices =================
    const fuse = new Fuse(devices, {
        keys: ['deviceType', 'deviceName', 'ip_address'],
        threshold: 0.4,
        ignoreLocation: true
    });

    const filteredDevices = React.useMemo(() => {
        const input = searchInput.trim();

        // Show all of no input
        if (!input) return devices;

        // Split the woreds
        const tokens = input
            .split(/[\s,_-]+/)
            .map(t => t.replace(/["'(){}]/g, '').trim())
            .filter(t => t.length > 0);

        // Run fuse search for each word
        const resultSet = new Set();
        tokens.forEach(token => {
            fuse.search(token).forEach(r => resultSet.add(r.item));
        });

        // Convert to array and sort. 
        // Device Type => Device Name
        return Array.from(resultSet).sort((a, b) => {

            const t = a.deviceType.localeCompare(b.deviceType, undefined, { sensitivity: 'base' });
            if (t !== 0) return t;
            // Number sorting
            const regex = /(.*?)(\d+)?$/;
            const [, aBase, aNum] = a.deviceName.match(regex);
            const [, bBase, bNum] = b.deviceName.match(regex);
            const baseCmp = aBase.localeCompare(bBase, undefined, { sensitivity: 'base' });
            if (baseCmp !== 0) return baseCmp;
            return (parseInt(aNum || 0) - parseInt(bNum || 0));
        });
    }, [devices, searchInput]);


    // ================= Edit devices =================
    const handleEditSubmit = async () => {
        if (editDevice.status === "Maintenance") {
            if (!editDevice.maintenance_start_date || !editDevice.maintenance_end_date) {
                alert('Please fill in the complete maintenance start and end date');
                return;
            }
            const startDate = new Date(editDevice.maintenance_start_date);
            const endDate = new Date(editDevice.maintenance_end_date);
            if (startDate > endDate) {
                alert("The end date cannot be earlier than the start date");
                return;
            }
        }

        // Merge the maintenance time fields
        let deviceToSubmit = { ...editDevice };
        if (editDevice.status === "Maintenance") {
            if (!editDevice.maintenance_start_segment && !editDevice.maintenance_end_segment) {
                deviceToSubmit.maintenance_start = `All Day/${editDevice.maintenance_start_date}`;
                deviceToSubmit.maintenance_end = `All Day/${editDevice.maintenance_end_date}`;
            } else {
                deviceToSubmit.maintenance_start =
                    `${editDevice.maintenance_start_segment}/${editDevice.maintenance_start_date}`;
                deviceToSubmit.maintenance_end =
                    `${editDevice.maintenance_end_segment}/${editDevice.maintenance_end_date}`;
            }
        } else {
            deviceToSubmit.maintenance_start = null;
            deviceToSubmit.maintenance_end = null;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/admin/devices/${editDevice.id}`, {
                method: 'PUT',
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify(deviceToSubmit)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Update failed');
            }

            // Update the status of local device 
            setDevices(prev => prev.map(device => {
                if (device.id === editDevice.id) {
                    return deviceToSubmit;
                } else {
                    return device;
                }
            }));
            setEditDevice(null);
        } catch (err) {
            alert(err.message);
        }
    };

    // ================= Page turning Component  =================

    const [currentPage, setCurrentPage] = useState(1);
    const devPerPage = 15; // The number of devices in one page

    const paginatedDevices = filteredDevices.slice(
        (currentPage - 1) * devPerPage,
        currentPage * devPerPage
    );

    function Pagination({ totalItems, itemsPerPage, currentPage, onPageChange }) {
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const maxVisiblePages = 5;

        const getPageNumbers = () => {
            let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
            let end = Math.min(start + maxVisiblePages - 1, totalPages);

            if (end - start < maxVisiblePages - 1) {
                start = Math.max(1, end - maxVisiblePages + 1);
            }

            return Array.from({ length: end - start + 1 }, (_, i) => start + i);
        };

        return (
            <div className="pagination-container">
                <button
                    className="pagination-btn"
                    onClick={() => onPageChange(1)}
                    disabled={currentPage === 1}
                >
                    Front Page
                </button>
                <button
                    className="pagination-btn"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    Previous
                </button>

                {getPageNumbers().map(page => (
                    <button
                        key={page}
                        className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                        onClick={() => onPageChange(page)}
                    >
                        {page}
                    </button>
                ))}

                <button
                    className="pagination-btn"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                >
                    Next
                </button>
                <button
                    className="pagination-btn"
                    onClick={() => onPageChange(totalPages)}
                    disabled={currentPage === totalPages}
                >
                    End page
                </button>
            </div>
        );
    }


    return (
        <div className="device-management-container">
            <h2>Device Management</h2>

            {/** Header */}
            <div className="device-management-header">
                <div className="header-controls">
                    <button className="icon-button" onClick={onReturn}>
                        <img src={backArrow} alt="Back" className="button-icon" />
                        <span>Back</span>
                    </button>

                    <button className="icon-button" onClick={handleAddDevice}>
                        <img src={addNewDevice} alt="Add" className="button-icon" />
                        <span>Add New Device</span>
                    </button>

                    <button className="icon-button" onClick={() => setSearchInput('')}>
                        <img src={showAll} alt="Show All" className="button-icon" />
                        <span>Show All</span>
                    </button>

                    <div className="search-box">
                        <img
                            src={searchDevice}
                            alt="Search"
                            className="search-icon"
                        />
                        <input
                            type="text"
                            placeholder="Search (By type/name)"
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                        />
                    </div>
                </div>
            </div>



            {/**  Table */}
            {isLoading ? (
                <div className="loading-indicator">
                    <div className="spinner" />
                    <p>Loading devices...</p>
                </div>
            ) : (
                <>
                    <table className="device-management-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Device Type</th>
                                <th>Device Name</th>
                                <th>Polatis Name</th>
                                <th>IP Address</th>
                                <th>In Port</th>
                                <th>Out Port</th>
                                <th>Status</th>
                                <th>Operation</th>
                            </tr>
                        </thead>

                        <tbody>
                            {paginatedDevices.map((dev) => (
                                <tr key={dev.id}>
                                    <td>{dev.id}</td>
                                    <td>{dev.deviceType}</td>
                                    <td>{dev.deviceName}</td>
                                    <td>{dev.polatis_name}</td>
                                    <td>{dev.ip_address || '-'}</td>
                                    <td>{dev.In_Port}</td>
                                    <td>{dev.Out_Port}</td>
                                    <td>{dev.status}</td>
                                    <td className="operation-cell">
                                        <div className="operation-buttons">
                                            <button
                                                className="edit-btn"
                                                onClick={() => {
                                                    const [startSeg, startDate] = dev.maintenance_start?.split('/') || ['', ''];
                                                    const [endSeg, endDate] = dev.maintenance_end?.split('/') || ['', ''];


                                                    setEditDevice({
                                                        ...dev,
                                                        maintenance_start_segment: startSeg,
                                                        maintenance_start_date: startDate,
                                                        maintenance_end_segment: endSeg,
                                                        maintenance_end_date: endDate
                                                    });
                                                }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="delete-btn"
                                                onClick={() => handleDelete(dev.id)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/*  Page turning function */}
                    <Pagination
                        totalItems={filteredDevices.length}
                        itemsPerPage={devPerPage}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                    />
                </>
            )}


            {/* Add Devices Panel */}
            {showAddDevice && (
                <DevicePanel
                    title="Add New Device"
                    device={newDevice}
                    setDevice={setNewDevice}
                    onClose={() => {
                        setShowAddDevice(false);
                        setNewDevice({ deviceType: '', deviceName: '', ip_address: '', status: 'Available' });
                    }}
                    onSubmit={handleSubmit}
                />
            )}

            {/* Edit Device Panel */}
            {editDevice && (
                <DevicePanel
                    title="Edit Device"
                    device={editDevice}
                    setDevice={setEditDevice}
                    onClose={() => setEditDevice(null)}
                    onSubmit={handleEditSubmit}
                />
            )}

        </div>
    );
}

// ================== Add/Edit devices popup window ==================
function DevicePanel({ title, device, setDevice, onClose, onSubmit }) {
    const [isDailyMode, setIsDailyMode] = useState(!device.maintenance_start_segment &&
        !device.maintenance_end_segment);

    return (
        <div className="add-device-overlay">
            <div className="add-device">
                <div className="add-device-header">
                    <h3>{title}</h3>
                    <button className="close-button" onClick={onClose} />
                </div>

                <div className="add-device-body">

                    <div className="form-group horizontal">
                        <label>Device Type:</label>
                        <input
                            type="text"
                            name="deviceType"
                            value={device.deviceType}
                            onChange={(e) => setDevice({ ...device, deviceType: e.target.value })}
                        />
                    </div>

                    <div className="form-group horizontal">
                        <label>Device Name:</label>
                        <input
                            type="text"
                            name="deviceName"
                            value={device.deviceName}
                            onChange={(e) => setDevice({ ...device, deviceName: e.target.value })}
                        />
                    </div>

                    <div className="form-group horizontal">
                        <label>Polatis Name:</label>
                        <input
                            type="text"
                            name="polatis_name"
                            value={device.polatis_name || ''}
                            onChange={e => setDevice({ ...device, polatis_name: e.target.value })}
                        />
                    </div>

                    <div className="form-group horizontal">
                        <label>IP Address:</label>
                        <input
                            type="text"
                            name="ip_address"
                            value={device.ip_address || ''}
                            onChange={(e) => setDevice({ ...device, ip_address: e.target.value })}
                        />
                    </div>

                    <div className="form-group horizontal">
                        <label>In Port:</label>
                        <input
                            type="number"
                            name="in_port"
                            value={device.In_Port}
                            onChange={(e) => setDevice({ ...device, In_Port: e.target.value })}
                        />
                    </div>

                    <div className="form-group horizontal">
                        <label>Out Port:</label>
                        <input
                            type="number"
                            name="out_port"
                            value={device.Out_Port}
                            onChange={(e) => setDevice({ ...device, Out_Port: e.target.value })}
                        />
                    </div>

                    <div className="form-group horizontal">
                        <label className="status-label">Status:</label>
                        <select className="custom-select" value={device.status} onChange={(e) => setDevice({ ...device, status: e.target.value })}>
                            <option value="Available">Available</option>
                            <option value="Maintenance">Maintenance</option>
                        </select>
                    </div>

                    {device.status === "Maintenance" && (
                        <>
                            {/** Daily/Time period maintenance button*/}
                            <div className="mode-toggle-group">
                                <button
                                    type="button"
                                    className={`mode-toggle ${isDailyMode ? '' : 'active'}`}
                                    onClick={() => setIsDailyMode(false)}
                                >
                                    Maintenance Window
                                </button>
                                <button
                                    type="button"
                                    className={`mode-toggle ${isDailyMode ? 'active' : ''}`}
                                    onClick={() => setIsDailyMode(true)}
                                >
                                    All-day Maintenance
                                </button>
                            </div>

                            {isDailyMode ? (
                                <div className="daily-maintenance">
                                    <div className="form-group horizontal">
                                        <label>Start Date: </label>
                                        <input
                                            type="date"
                                            className="date-picker"
                                            name="maintenance_start_date"
                                            value={device.maintenance_start_date || ''}
                                            onChange={(e) =>
                                                setDevice({ ...device, maintenance_start_date: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="form-group horizontal">
                                        <label>End Date: </label>
                                        <input
                                            type="date"
                                            className="date-picker"
                                            name="maintenance_end_date"
                                            value={device.maintenance_end_date || ''}
                                            onChange={(e) =>
                                                setDevice({ ...device, maintenance_end_date: e.target.value })
                                            }
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="maintenance-time-group">
                                    <div className="form-group horizontal">
                                        <label>Start Time:</label>
                                        <div className="time-input-group">
                                            <select className="time-segment-select"
                                                name="maintenance_start_segment"
                                                value={device.maintenance_start_segment || ''}
                                                onChange={(e) =>
                                                    setDevice({ ...device, maintenance_start_segment: e.target.value })
                                                }
                                            >
                                                <option value="">Time Slot</option>
                                                <option value="7 AM - 12 PM">7 AM - 12 PM</option>
                                                <option value="12 PM - 6 PM">12 PM - 6 PM</option>
                                                <option value="6 PM - 11 PM">6 PM - 11 PM</option>
                                            </select>
                                            <input
                                                type="date"
                                                className="date-picker"
                                                name="maintenance_start_date"
                                                value={device.maintenance_start_date || ''}
                                                onChange={(e) =>
                                                    setDevice({ ...device, maintenance_start_date: e.target.value })
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group horizontal">
                                        <label>End Time:</label>
                                        <div className="time-input-group">
                                            <select className="time-segment-select"
                                                name="maintenance_end_segment"
                                                value={device.maintenance_end_segment || ''}
                                                onChange={(e) =>
                                                    setDevice({ ...device, maintenance_end_segment: e.target.value })
                                                }
                                            >
                                                <option value="">Time Slot</option>
                                                <option value="7 AM - 12 PM">7 AM - 12 PM</option>
                                                <option value="12 PM - 6 PM">12 PM - 6 PM</option>
                                                <option value="6 PM - 11 PM">6 PM - 11 PM</option>
                                            </select>
                                            <input
                                                type="date"
                                                className="date-picker"
                                                name="maintenance_end_date"
                                                value={device.maintenance_end_date || ''}
                                                onChange={(e) =>
                                                    setDevice({ ...device, maintenance_end_date: e.target.value })
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>

                    )}

                </div>

                <div className="add-device-footer">
                    <button className="cancel-btn" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="submit-btn" onClick={onSubmit}>
                        {title.startsWith('Add') ? 'Create' : 'Save'}
                    </button>
                </div>
            </div>
        </div >
    );
}
