import React, { useState, useEffect, useCallback } from 'react';
import backArrow from '../image/back.png'
import deleteAll from '../image/bin.png'
import eventBus from '../eventBus';
import searchDevice from '../image/search.png';
import { API_BASE_URL } from '../config/api';

export default function ManageBookings({ userId, onReturnToMain }) {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    // ===================== Acquire all bookings =====================
    const fetchBookings = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/bookings/user/${userId}`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail);
            }

            const data = await res.json();

            // Sort by start_time
            data.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
            setBookings(data);

        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (userId) {
            fetchBookings();
        }
    }, [userId, fetchBookings]);


    // ===================== Search the booking =====================

    const [searchTerm, setSearchTerm] = useState('');

    const filteredBookings = bookings.filter(booking => {
        const lowerTerm = searchTerm.toLowerCase();
        return (
            booking.device_type?.toLowerCase().includes(lowerTerm) ||
            booking.device_name?.toLowerCase().includes(lowerTerm) ||
            booking.ip_address?.toLowerCase().includes(lowerTerm) ||
            booking.status?.toLowerCase().includes(lowerTerm)
        );
    });




    // ===================== Handle cancel the booking =====================

    const handleCancel = async (booking_id) => {
        if (!window.confirm("Are you sure want to cancel this booking?")) {
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/api/bookings/${booking_id}/cancel`, {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Failed to cancel booking");
            }
            eventBus.emit('refreshAdminSchedule');
            fetchBookings();
        } catch (err) {
            alert(err.message)
        }
    };

    const handleDelete = async (booking_id) => {
        if (!window.confirm("Are you sure want to delete this booking?")) {
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/bookings/${booking_id}`, {
                method: "DELETE",
                credentials: "include"
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Failed to delete booking");
            }

            //const data = await res.json();
            eventBus.emit('refreshBookings');
            fetchBookings();

        } catch (err) {
            alert(err.message);
        }

    };

    // Delete all cancelled or expired bookings

    const handleDeleteAll = async () => {
        if (!window.confirm("Are you sure want to delete ALL cancelled or expired bookings?")) {
            return;
        }
        try {
            const deletableBookings = bookings.filter(b => {
                const lowerStatus = b.status?.toLowerCase();
                return ["cancelled", "expired"].includes(lowerStatus);
            });

            await Promise.all(
                deletableBookings.map(async (b) => {
                    const res = await fetch(`${API_BASE_URL}/bookings/${b.booking_id}`, {
                        method: "DELETE",
                        credentials: "include"
                    });
                    if (!res.ok) {
                        const errData = await res.json();
                        throw new Error(errData.detail || "Failed to delete booking");
                    }
                })
            );
            fetchBookings();

        } catch (err) {
            alert(err.message);
        }
    };


    if (!userId) {
        return <div>Please login first.</div>;
    }

    if (loading) {
        return <div>Loading bookings...</div>;
    }

    return (
        <div className="manage-bookings-container">
            <h2>My Bookings</h2>

            <div className="bookings-header">
                <div className="left-controls">
                    <button className="icon-button" onClick={onReturnToMain}>
                        <img src={backArrow} alt="Back" className="button-icon" />
                        <span>Back</span>
                    </button>

                    <div className="search-box">
                        <img src={searchDevice} alt="Search" className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search bookings..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <button className="delete-all-button" onClick={handleDeleteAll}>
                    <img src={deleteAll} alt="Delete" className="back-icon" />
                    Clean Cancelled/Expired
                </button>
            </div>


            <div className="table-scroll-container">
                {filteredBookings.length === 0 ? (
                    <p style={{ fontSize: '1.5rem' }}>No bookings found.</p>
                ) : (
                    <table className="booking-table">
                        <thead>
                            <tr>
                                <th>Device Type</th>
                                <th>Device Name</th>
                                <th>IP Address</th>
                                <th>Start Time</th>
                                <th>End Time</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredBookings.map((b) => {
                                // Check the status on Client side 
                                const lowerStatus = b.status?.toLowerCase();

                                // Check if the slot can be cancelled 
                                const canCancel = ["pending", "confirmed", "in progress", "conflicting"].includes(lowerStatus);

                                // Check if the slot can be deleted 
                                const canDelete = ["cancelled", "expired", "rejected"].includes(lowerStatus);
                                return (
                                    <tr key={b.booking_id}>
                                        <td>{b.device_type}</td>
                                        <td>{b.device_name}</td>
                                        <td>{b.ip_address}</td>
                                        <td>{new Date(b.start_time).toLocaleString()}</td>
                                        <td>{new Date(b.end_time).toLocaleString()}</td>
                                        <td>
                                            {b.status ? (
                                                <span className={`status-tag ${b.status.toLowerCase()}`}>
                                                    {b.status.toUpperCase()}
                                                </span>
                                            ) : (
                                                <span className="status-tag unknown">UNKNOWN</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                {canCancel && (
                                                    <button
                                                        className="cancel-btn"
                                                        onClick={() => handleCancel(b.booking_id)}
                                                    >
                                                        CANCEL
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        className="delete-btn"
                                                        onClick={() => handleDelete(b.booking_id)}
                                                    >
                                                        DELETE
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}