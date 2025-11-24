// admin.js
import React, { useState, useEffect } from 'react';
import 'react-calendar/dist/Calendar.css';
import '../App.css';
import logo from '../image/logo.png';
import userIcon from '../image/user.png';
import userIcon_hover from '../image/user-hover.png';


import AdminLoginRegisterPopup from './adminLogin';
import ManageDevices from './ManageDevices';
import AdminScheduleTable from './AdminScheduleTable';
import PendingApprovalsList from './PendingApprovalsList';
import './admin.css';
import SimpleControlPanel from './PduControlPanel';

import { Link } from 'react-router-dom';

import { enable, disable } from 'darkreader';
import { API_BASE_URL } from '../config/api';

export default function AdminPage() {
    // ==================== Switch dark/light mode ====================
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        const savedMode = localStorage.getItem('darkMode') === 'true';
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


    const [isHovered, setIsHovered] = useState(false);
    const [userName, setUserName] = useState(null);
    const [, setUserId] = useState(null);
    const [showLoginPopup, setShowLoginPopup] = useState(false);

    const [activePage, setActivePage] = useState(() => {
        const savedPage = localStorage.getItem('adminActivePage');
        return savedPage || 'home'
    });

    useEffect(() => {
        localStorage.setItem('adminActivePage', activePage);
    }, [activePage]);

    const handleUserIconClick = () => {
        setShowLoginPopup(!showLoginPopup);
    };

    const handleClosePopup = () => {
        setShowLoginPopup(false);
    };

    const handleLoginSuccess = (username, newUserId) => {
        setUserName(username);
        setUserId(newUserId);
    };

    const handleSignOutSuccess = () => {
        setUserName(null);
        setUserId(null);
        setActivePage('home');
    };

    const handleDeviceManagementClick = () => {
        if (!userName) {
            alert("Please sign in first to manage devices.");
            return;
        }
        setActivePage('devices');
    };

    const handleReservationManagementClick = () => {
        if (!userName) {
            alert("Please sign in first to manage reservations.");
            return;
        }
        setActivePage('reservations');
    };

    const handleControlPanelClick = () => {
        if (!userName) {
            alert("Please sign in first to manage reservations.");
            return;
        }
        setActivePage('control');
    }

    const handleReturnToMain = () => {
        setActivePage('home');
    };

    // ==================== Check admin session ====================
    useEffect(() => {
        async function checkSession() {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/checkAdminSession`, {
                    credentials: "include"
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.logged_in && data.is_admin) {
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

    return (
        <div className={`app-container ${darkMode ? 'dark-mode' : 'light-mode'}`}>
            <header className="app-header">
                <img src={logo} alt="Scheduler Icon" className="app-logo dark-keep-original" />
                <h1 className="app-title">Admin Portal</h1>
                <Link
                    to="/client"
                    className="admin-link-button"
                    title="Go to Client Panel"
                >
                    Go to Client Page
                </Link>
                {userName && <div className="welcome-username">Hello, {userName}</div>}
                <div className="login-container">
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

                    <AdminLoginRegisterPopup
                        show={showLoginPopup}
                        onClose={handleClosePopup}
                        userName={userName}
                        onLoginSuccess={handleLoginSuccess}
                        onSignOutSuccess={handleSignOutSuccess}
                    />
                </div>
                <button className="dark-mode-toggle" onClick={toggleDarkMode}>
                    {darkMode ? '☀️' : '🌙'}
                </button>
            </header>
            <div className="main-container">
                <div className="left-panel">
                    <div className="reservation-buttons">
                        <button
                            className={`reservation-button ${activePage === 'devices' ? 'active' : ''}`}
                            onClick={handleDeviceManagementClick}
                        >
                            Device Management
                        </button>

                        <button
                            className={`reservation-button ${activePage === 'reservations' ? 'active' : ''}`}
                            onClick={handleReservationManagementClick}
                        >
                            Reservation Management
                        </button>

                        <button
                            className={`reservation-button ${activePage === 'control' ? 'active' : ''}`}
                            onClick={handleControlPanelClick}
                        >
                            Control Panel
                        </button>
                    </div>
                </div>

                <div className="admin-center-panel">
                    {/* Device Management & Reservation Management & Home Page & Control Panel Page*/}
                    {
                        activePage === 'control' ? (
                            <SimpleControlPanel onReturn={handleReturnToMain} />
                        ) :
                            activePage === 'devices' ? (
                                <ManageDevices onReturn={handleReturnToMain} />
                            ) :
                                activePage === 'reservations' ? (
                                    <div className="reservation-management-container">
                                        <div className="admin-schedule-section">
                                            <AdminScheduleTable />
                                        </div>
                                        <div className="pending-approvals-section">
                                            <PendingApprovalsList />
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <h2>Welcome, Admin!</h2>
                                        <p>
                                            Please click "Device Management" to manage your devices or "Reservation Management" to manage reservations.
                                        </p>
                                    </div>
                                )}
                </div>
            </div>
        </div>
    );
}
