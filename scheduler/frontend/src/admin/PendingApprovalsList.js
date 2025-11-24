import React, { useState, useEffect } from 'react';
import './admin.css';
import '../App.css';
import eventBus from '../eventBus';
import searchDevice from '../image/search.png';
import Fuse from 'fuse.js';
import { API_BASE_URL } from '../config/api';


const PendingApprovalsList = () => {
    const [bookings, setBookings] = useState([]);
    const [allRecords, setAllRecords] = useState([]);
    const [showDialog, setShowDialog] = useState(false);
    const [showRecords, setShowRecords] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Remove useless recordings
    const [removedIds, setRemovedIds] = useState(() => {
        const saved = localStorage.getItem('removedBookingIds');
        return saved ? JSON.parse(saved) : [];
    });

    // Get pending bookings
    const fetchPendingBookings = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/bookings/pending`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to fetch pending bookings');
            const data = await response.json();
            setBookings(data);
        } catch (err) {
            setError(err.message);
        }
    };

    // Get all current recordings 
    const fetchAllRecords = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/bookings/all`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to fetch records');
            const data = await response.json();
            // Filter the removed recordings & Sort by the start time 
            const filteredData = data.filter(r => !removedIds.includes(r.booking_id));
            setAllRecords(filteredData.sort((a, b) =>
                new Date(b.start_time) - new Date(a.start_time)
            ));
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        fetchPendingBookings();
        const interval = setInterval(fetchPendingBookings, 10000);
        return () => clearInterval(interval);
    }, []);

    // Handle the status update 
    const handleStatusUpdate = async (bookingId, status) => {

        if (status === 'CONFIRMED') {
            const isConfirmed = window.confirm('Are you sure you want to confirm this booking?');
            if (!isConfirmed) return;
        }

        if (status === 'REJECTED') {
            const isConfirmed = window.confirm('Are you sure you want to reject this booking?');
            if (!isConfirmed) return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/admin/bookings/${bookingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Update failed');
            fetchAllRecords();
            setShowDialog(false);
            eventBus.emit('refreshScheduleData');
        } catch (err) {
            setError(err.message);
        }

        setBookings(prev => prev.map(
            item => item.booking_id === bookingId
                ? { ...item, isExiting: true }
                : item
        ));

        setTimeout(() => {
            setBookings(prev => prev.filter(item => item.booking_id !== bookingId));
        }, 1000);
    };

    // Format the time 
    const formatDateTime = (dateString) => {
        return new Date(dateString).toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Search function in pending approval list 
    const fuse = new Fuse(bookings, {
        keys: ['device_type', 'device_name', 'ip_address', 'username'],
        threshold: 0.4,
        ignoreLocation: true
    });

    const filteredBookings = searchTerm.trim() ? fuse.search(searchTerm).map(res => res.item) : bookings;

    // filteredBookings.sort((a, b) => {
    //     const typeCompare = a.deviceType.localeCompare(b.deviceType, undefined, { sensitivity: 'base' });
    //     if (typeCompare !== 0)
    //         return typeCompare;
    //     return a.deviceName.localeCompare(b.deviceName, undefined, { sensitivity: 'base' });
    // });

    const handleViewAll = async () => {
        await fetchAllRecords();
        setShowRecords(true);
    };

    const handleTemporaryRemove = (bookingId) => {
        setRemovedIds(prev => {
            const newIds = [...prev, bookingId];
            localStorage.setItem('removedBookingIds', JSON.stringify(newIds));
            return newIds;
        });
    };

    const handleResetRemoved = () => {
        localStorage.removeItem('removedBookingIds');
        setRemovedIds([]);
        fetchAllRecords();
    };


    return (
        <div className="pending-container">
            {error && <div className="error-message">{error}</div>}

            <div className="header-section">
                <h3>Pending Approvals ({bookings.length})</h3>
                <div className="search-box">
                    <img
                        src={searchDevice}
                        alt="Search"
                        className="search-icon"
                    />
                    <input
                        type="text"
                        placeholder="Search (By type/name/ip address/user)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    className="records-btn"
                    onClick={handleViewAll}
                >
                    View All Records
                </button>

            </div>

            {/* Pending approval list */}
            <div className="approval-table-container">
                <table className="approval-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Device Type</th>
                            <th>Device Name</th>
                            <th>IP Address</th>
                            <th>User</th>
                            <th>Start Time</th>
                            <th>End Time</th>
                            <th>Comment</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBookings.map(booking => (
                            <tr key={booking.booking_id} className={booking.isExiting ? 'row-exit' : ''}>
                                <td>#{booking.booking_id}</td>
                                <td>{booking.device_type}</td>
                                <td>{booking.device_name}</td>
                                <td>{booking.ip_address || '-'}</td>
                                <td>{booking.username || `User ${booking.user_id}`}</td>
                                <td>{formatDateTime(booking.start_time)}</td>
                                <td>{formatDateTime(booking.end_time)}</td>
                                <td>{booking.comment || 'None'}</td>
                                <td>
                                    <span className={`status-tag ${booking.status.toLowerCase()}`}>
                                        {booking.status}
                                        {booking.status === 'CONFLICTING'}
                                    </span>
                                </td>
                                <td>
                                    <div className="action-buttons">
                                        <button
                                            className={`confirm-btn ${booking.status.toLowerCase() === 'conflicting' ? 'resolve-btn' : ''}`}
                                            onClick={() => handleStatusUpdate(booking.booking_id, 'CONFIRMED')}
                                        >
                                            {booking.status === 'CONFLICTING' ? 'Resolve' : 'Confirm'}
                                        </button>
                                        <button
                                            className="decline-btn"
                                            onClick={() => handleStatusUpdate(booking.booking_id, 'REJECTED')}
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* View all records pop-up window  */}
            {showRecords && (
                <ShowAllRecords
                    records={allRecords.filter(r => !removedIds.includes(r.booking_id))}
                    onClose={() => setShowRecords(false)}
                    onRemove={handleTemporaryRemove}
                    onClearRemoved={handleResetRemoved}
                />
            )}
        </div>
    );
};

// View all records window
function ShowAllRecords({ records, onClose, onRemove, onClearRemoved }) {
    const formatDateTime = (dateString) => {
        return new Date(dateString).toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Search logic
    const [searchTerm, setSearchTerm] = useState('');


    const fuse = new Fuse(records, {
        keys: ['device_type', 'device_name', 'ip_address', 'username', 'status', 'comment'],
        threshold: 0.4,
        ignoreLocation: true
    });

    const filteredRecords = searchTerm.trim() ? fuse.search(searchTerm).map(res => res.item) : records;

    const handleRemove = (bookingId) => {
        onRemove(bookingId);
    };


    // filteredRecords.sort((a, b) => {
    //     const typeCompare = a.deviceType.localeCompare(b.deviceType, undefined, { sensitivity: 'base' });
    //     if (typeCompare !== 0)
    //         return typeCompare;
    //     return a.deviceName.localeCompare(b.deviceName, undefined, { sensitivity: 'base' });
    // });

    return (
        <div className="add-device-overlay">
            <div className="add-device records-dialog">
                <div className="add-device-header">
                    <h3>Reservation Records ({records.length})</h3>


                    <div className="records-search">
                        <input
                            type="text"
                            placeholder="Search records..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button
                        className="records-btn"
                        onClick={onClearRemoved}
                    >
                        Reset All Removals
                    </button>

                    <button className="close-button" onClick={onClose} />

                </div>

                <div className="add-device-body" style={{ padding: '0' }}>
                    <div className="records-table-container">
                        <table className="records-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Device</th>
                                    <th>IP Address</th>
                                    <th>User</th>
                                    <th>Time Slot</th>
                                    <th>Comment</th>
                                    <th>Status</th>
                                    <th>Delete</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map(record => (
                                    <tr key={record.booking_id}>
                                        <td>#{record.booking_id}</td>
                                        <td>{record.device_type} - {record.device_name}</td>
                                        <td>{record.ip_address || '-'}</td>
                                        <td>{record.username || `User ${record.user_id}`}</td>
                                        <td>
                                            {formatDateTime(record.start_time)}
                                            <br />
                                            →
                                            <br />
                                            {formatDateTime(record.end_time)}
                                        </td>
                                        <td>{record.comment || 'None'}</td>
                                        <td>
                                            <span className={`status-tag ${record.status.toLowerCase()}`}>
                                                {record.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="delete-btn" onClick={() => handleRemove(record.booking_id)}>
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PendingApprovalsList;