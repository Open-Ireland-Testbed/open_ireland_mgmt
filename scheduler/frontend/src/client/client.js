import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import '../App.css';
import { Link } from 'react-router-dom';

import logo from '../image/logo.png';
import userIcon from '../image/user.png';
import userIcon_hover from '../image/user-hover.png';
import record_icon from '../image/records.png'
import booking_icon from '../image/multiBooking.png'

import { enable, disable } from 'darkreader'; // Use Dark Reader extension code for switching dark/light mode 

import ScheduleTable from './ScheduleTable';
import ScheduleSummary from './ScheduleSummary';
import LoginRegisterPopup from './LoginRegisterPopup';
import { gatherAllIntervals, submitAllBookings } from './BookingService';
import ManageBookings from './ManageBookings';
import BookingAllDay from './BookingAllDay';

import { API_BASE_URL } from '../config/api';

function Client() {

    // Store the information selected in the schdedule table
    const [globalSelections, setGlobalSelections] = useState({});



    // =================== Switch to dark mode ===================
    // Modes selection
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        const savedMode = localStorage.getItem('darkMode') === 'true'; // 修正键名和转换逻辑
        setDarkMode(savedMode);
        applyDarkMode(savedMode);
    }, []);

    const applyDarkMode = (enableFlag) => {
        if (enableFlag) {
            enable({
                brightness: 100,
                contrast: 90,
                sepia: 10
            });
        } else {
            disable();
        }
        localStorage.setItem('darkMode', enableFlag);
    }

    const toggleDarkMode = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        applyDarkMode(newMode);
    };

    // =================== User icon logic => Hover effect & Login & register ===================

    const [isHovered, setIsHovered] = useState(false);
    const [userName, setUserName] = useState(null);
    const [showLoginPopup, setShowLoginPopup] = useState(false);
    const [userId, setUserId] = useState(null);


    // Cick the icon
    const handleUserIconClick = () => {
        if (!showLoginPopup) {
            setShowLoginPopup(true);
        } else {
            setShowLoginPopup(false);
        }
    };

    // close the pop-up window 
    const handleClosePopup = () => {
        setShowLoginPopup(false);
    }

    // Login
    const handleLoginSuccess = (username, newUserId) => {
        setUserName(username);
        setUserId(newUserId);
    };

    // Log out
    const handleSignOutSuccess = () => {
        setUserName(null);
        setUserId(null);
    };

    //===================== The schedule part =====================
    const [mode, setMode] = useState('single');
    const [isTodayActive, setIsTodayActive] = useState(false);

    // Display the date
    const [activeStartDate, setActiveStartDate] = useState(new Date());

    // The selected date or range:
    //  - null (no selection)
    //  - a single Date 
    //  - an array: [startDate, endDate]
    const [value, setValue] = useState(null);

    // Chech if it's today
    const isSameDay = (d1, d2) => {
        return (
            d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate()
        );
    };

    // Check the range
    const isWithinRange = (date, start, end) => date >= start && date <= end;

    // ---- Reset the Calendar to a initial state ----
    //  1. No selection => value=null
    //  2. Show current month => activeStartDate = new Date()
    const resetCalendar = () => {
        setValue(null);
        setActiveStartDate(new Date());
    };

    // ---- Mode Buttons ----
    // Always reset the calendar including switching to the same mode

    const handleTodayMode = () => {
        setActiveStartDate(new Date());
        setValue(new Date());
        setMode('single');
        setIsTodayActive(true);
    };

    const handleRangeMode = () => {
        resetCalendar();
        setMode('range');
        setIsTodayActive(false);
    };

    // ---- Calendar Callbacks ----
    // Fired when the user navigates to a new month/year
    const handleActiveStartDateChange = ({ activeStartDate }) => {
        setActiveStartDate(activeStartDate);
    };

    // Fired when the user selects a date (single) or finishes dragging a range
    const handleChange = (nextValue) => {
        setValue(nextValue);
        if (isTodayActive) {
            setIsTodayActive(false);
        }
    };

    // check if there are selected slots
    const isSelected = (selections) => {
        for (const device in selections) {
            const deviceData = selections[device];
            for (const sub in deviceData) {
                if (deviceData[sub].length > 0) {
                    return false
                }
            }
        }
        return true;
    }

    // format the monthe-year and weekdays 
    const formatShortMonth = (locale, date) => {
        const month = date.toLocaleString('en-US', { month: 'short' });
        const year = date.getFullYear();
        return `${month} ${year}`;
    };

    const formatShortWeekday = (locale, date) => {
        return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()];
    };


    // ========== Reservation Submit ==========

    const handleSubmitReservation = async () => {
        // if not login
        if (!userName) {
            alert("Please sign in your account firstly.");
            return;
        }
        // 2. if no selection 
        if (isSelected(globalSelections)) {
            alert("Please select the appropriate device and time period.");
            return;
        }

        // Collect all intervals
        const allIntervals = gatherAllIntervals(globalSelections);
        if (allIntervals.length <= 0) {
            alert("Please select the corresponding device and time period");
            return;
        }

        // Get messages
        const messageBox = document.querySelector(".reservation-message");
        const message = messageBox ? messageBox.value.trim() : "";

        // Call backend 
        const payload = {
            user_id: userId,
            message: message,
            bookings: allIntervals
        };

        // think twice
        const confirmed = window.confirm("Are you sure want to submit the booking");
        if (!confirmed) {
            return;
        }

        // Submit all reservation 
        try {
            const data = await submitAllBookings(payload);
            setGlobalSelections({});
            if (messageBox) {
                messageBox.value = "";
            }
            alert(data.message);

            setFetchTrigger((prev) => prev + 1);

        } catch (err) {
            alert(err.message)
        }

    };

    const [fetchTrigger, setFetchTrigger] = useState(0);

    //========== Reservation Management ==========
    const [showManagement, setShowManagement] = useState(false);


    const handleManagementClick = () => {
        if (!userName) {
            alert("Please sign in first to manage reservations.");
            return;
        }
        setShowManagement(true);
    }

    const handleReturnToMain = () => {
        setShowManagement(false)
    }

    // ========== Multi-Device Booking
    const handleMultiBookingClick = () => {
        if (!userName) {
            alert("Please sign in first to use Multi-Device Booking.");
            return;
        }
        setShowBookingAllDay(true);

    }

    // =================== fetch the booking information ===================

    // Check the session status to keep user is logged in before it's expired
    useEffect(() => {
        async function checkSession() {
            try {
                const res = await fetch(`${API_BASE_URL}/session`, {
                    credentials: "include"
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.logged_in) {
                        setUserId(data.user_id);
                        setUserName(data.username);
                    }
                }
            } catch (err) {
                console.error("Session check failed:", err);
            }
        }
        checkSession();
    }, []);

    // ========== Book multiple devices in all-day ==========
    const [showBookingAllDay, setShowBookingAllDay] = useState(false);




    return (
        <div className={`app-container ${darkMode ? 'dark-mode' : 'light-mode'}`}>
            <header className="app-header">
                <Link to="/" title="return to main">
                    <img src={logo} alt="Scheduler Icon" className="app-logo dark-keep-original" />
                </Link>

                <h1 className="app-title">Lab Scheduler</h1>

                <Link
                    to="/topology"
                    className="admin-link-button"
                    title="Topology Builder"
                    style={{ marginRight: '10px' }}
                >
                    Topology Builder
                </Link>

                <Link
                    to="/admin"
                    className="admin-link-button"
                    title="Go to Admin Page"
                >
                    Admin Sign In
                </Link>

                {userName && <div className="welcome-username">Hello, {userName}</div>}

                <div className='login-container'>
                    <img
                        src={isHovered ? userIcon_hover : userIcon}
                        alt="User Login"
                        className="user-login-icon"
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        onClick={() => {
                            setIsHovered(false);
                            handleUserIconClick();
                        }}

                    />
                    {isHovered && !userName && (
                        <div className="login-tooltip">Sign in</div>
                    )}

                    {isHovered && userName && (
                        <div className="login-tooltip">Sign out</div>
                    )}

                    <LoginRegisterPopup
                        show={showLoginPopup}
                        onClose={handleClosePopup}
                        userName={userName}
                        onLoginSuccess={handleLoginSuccess}
                        onSignOutSuccess={handleSignOutSuccess}
                    />
                </div>

                <button className="dark-mode-toggle" onClick={toggleDarkMode} title={darkMode ? 'Disable Dark Mode' : 'Enable Dark Mode'}>
                    {darkMode ? '☀️' : '🌙'}
                </button>
            </header>


            <div className='main-container'>
                {/* Button Group */}
                <div className="left-panel">
                    <div className="button-group">
                        <button
                            className={`mode-button ${isTodayActive ? 'selected' : ''}`}
                            onClick={handleTodayMode}
                        >
                            Today
                        </button>
                        <button
                            className={`mode-button ${mode === 'range' ? 'selected' : ''}`}
                            onClick={handleRangeMode}
                        >
                            Oth.Days
                        </button>
                    </div>

                    <div className="calendar-container">
                        <Calendar
                            // Force re-mount when "mode" changes, ensuring a fresh state
                            formatShortWeekday={formatShortWeekday}
                            formatMonthYear={formatShortMonth}

                            locale="en-US"
                            key={mode}
                            activeStartDate={activeStartDate}
                            onActiveStartDateChange={handleActiveStartDateChange}

                            // "range"
                            selectRange={mode === 'range'}

                            onChange={handleChange}
                            value={value}

                            next2Label={null}
                            prev2Label={null}

                            // Distinguish styling in tileClassName
                            tileClassName={({ date, view }) => {
                                if (view === 'month') {
                                    // "today" => blue
                                    if (isSameDay(date, new Date())) {
                                        return 'react-calendar-tile--today';
                                    }
                                    // // No selection
                                    // if (!value) return null;

                                    // Range mode: if "value" is [start, end], highlight all in that range
                                    if (Array.isArray(value) && value.length === 2) {
                                        const [start, end] = value;
                                        if (isWithinRange(date, start, end)) {
                                            return 'react-calendar-tile--range';
                                        }
                                    }
                                    // Single mode: if "value" is a single Date, highlight in green
                                    if (value instanceof Date && isSameDay(date, value)) {
                                        return 'react-calendar-tile--selected';
                                    }
                                }
                                return null;
                            }}
                        />
                    </div>

                    {/* Reservation Management / Multi-Device Booking button */}

                    <div className='reservation-buttons'>
                        <button className='reservation-button' onClick={handleManagementClick}>
                            <div className="button-content">
                                <img src={record_icon} alt='Records' className="user-page-button-icon" style={{ width: 30, height: 30 }} />
                                <span>Records</span>
                            </div>
                        </button>

                        <button className='reservation-button' onClick={handleMultiBookingClick}>
                            <div className="button-content">
                                <img src={booking_icon} alt='Multi Booking' className="user-page-button-icon" style={{ width: 30, height: 30 }} />
                                <span>Multi-device Booking</span>
                            </div>
                        </button>
                    </div>

                </div>

                {showBookingAllDay && (
                    <BookingAllDay
                        onClose={() => setShowBookingAllDay(false)}
                        userId={userId}
                        onSubmitSuccess={() => setFetchTrigger(prev => prev + 1)}
                        globalSelections={globalSelections}
                        setGlobalSelections={setGlobalSelections}
                    />
                )}




                {/* Click Reservation Management button show management page, otherwise, show schedule table. */}
                {!showManagement ? (
                    <>
                        <div className="middle-panel">
                            <ScheduleTable calendarValue={value}
                                globalSelections={globalSelections}
                                setGlobalSelections={setGlobalSelections}
                                userId={userId}
                                fetchTrigger={fetchTrigger}
                            />
                        </div>

                        {/* Right Panel: Summary and Reservation Submit */}
                        <div className="right-panel">
                            <div className="summary-container">
                                <ScheduleSummary globalSelections={globalSelections} />
                            </div>
                            <div className="reservation-submit-container">
                                <textarea
                                    className="reservation-message"
                                    placeholder="Leave a message (optional)"
                                />
                                <button className="submit-reservation-button" onClick={handleSubmitReservation}>Submit Reservation</button>
                            </div>
                        </div>

                    </>
                ) : (
                    // Show Reservation Management Component 
                    <div style={{ flex: 1, padding: '10px' }}>
                        <ManageBookings userId={userId} onReturnToMain={handleReturnToMain} />
                    </div>
                )}
            </div>
        </div>
    );
}

export default Client;
