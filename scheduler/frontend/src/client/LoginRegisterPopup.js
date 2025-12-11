import React, { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';

import showPasswordIcon from '../image/show.png';
import hidePasswordIcon from '../image/hide.png';
import { API_BASE_URL } from '../config/api';

export default function LoginRegisterPopup({
    show,
    onClose,
    userName,
    onLoginSuccess,
    onSignOutSuccess
}) {
    const [mode, setMode] = useState('login');

    useEffect(() => {
        if (show && !userName) {
            setMode('login');
        }
    }, [show, userName]);

    const switchMode = () => {
        setMode(prev => (prev === 'login' ? 'register' : 'login'));
    };

    // ===================== Handle User Login =====================
    const handleLogin = async (username, password, retryCount = 0) => {
        if (!username || !password) {
            alert('Please enter username and password');
            return;
        }
        try {
            const hashedPassword = CryptoJS.SHA256(password).toString();
            
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            let res;
            try {
                res = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password: hashedPassword }),
                    credentials: 'include',
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
            } catch (fetchError) {
                clearTimeout(timeoutId);
                
                // Handle network errors with retry
                if (
                    (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') &&
                    retryCount < 2
                ) {
                    // Retry on timeout with exponential backoff
                    await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                    return handleLogin(username, password, retryCount + 1);
                }
                
                // Network error or timeout
                if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
                    throw new Error('Connection timeout. Please check your network connection and try again.');
                }
                
                // Other network errors (CORS, DNS, etc.)
                if (fetchError.message?.includes('fetch') || fetchError.message?.includes('network')) {
                    throw new Error('Unable to connect to server. Please check that the backend is running and try again.');
                }
                
                throw fetchError;
            }
            
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || 'Login failed');
            }
            const data = await res.json();
            onLoginSuccess(username, data.user_id);
            onClose();
            alert(data.message);
        } catch (err) {
            // Provide more helpful error messages
            let errorMessage = err.message || 'Unable to sign in.';
            
            // Check if it's a network-related error
            if (
                errorMessage.includes('fetch') ||
                errorMessage.includes('network') ||
                errorMessage.includes('Failed to fetch')
            ) {
                errorMessage = 'Unable to connect to server. Please check that the backend is running and try again.';
            }
            
            alert(errorMessage);
        }
    };

    // ===================== Handle User Register =====================
    const handleRegister = async (username, email, pass1, pass2, discordId) => {
        if (!username || !email || !pass1 || !pass2 || !discordId) {
            alert('All fields are required');
            return;
        }
        if (pass1.length < 8) {
            alert('Password must be at least 8 characters');
            return;
        }
        if (pass1 !== pass2) {
            alert('Passwords do not match');
            return;
        }

        try {
            const hashedPass1 = CryptoJS.SHA256(pass1).toString();
            const hashedPass2 = CryptoJS.SHA256(pass2).toString();
            const res = await fetch(`${API_BASE_URL}/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    email,
                    password: hashedPass1,
                    password2: hashedPass2,
                    discord_id: discordId
                }),
                credentials: 'include'
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Register failed');
            }
            const data = await res.json();
            onLoginSuccess(data.username, data.id);
            onClose();
            alert('Register successfully');
        } catch (err) {
            alert(err.message);
        }
    };

    // ===================== User Logout =====================
    const handleSignOut = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Logout failed');
            }
            const data = await res.json();
            onSignOutSuccess();
            onClose();
            alert(data.message || 'Signed out successfully');
        } catch (err) {
            alert(err.message);
        }
    };

    if (!show) return null;

    if (userName) {
        return (
            <div className="popup-overlay" onClick={onClose}>
                <div className="popup-panel">
                    <SignOutPanel onSignOut={handleSignOut} />
                </div>
            </div>
        );
    }

    return (
        <div className="popup-overlay" onClick={onClose}>
            <div className="popup-panel" onClick={e => e.stopPropagation()}>
                {mode === 'login' ? (
                    <LoginForm onSwitch={switchMode} onLogin={handleLogin} />
                ) : (
                    <RegisterForm onSwitch={switchMode} onRegister={handleRegister} />
                )}
            </div>
        </div>
    );
}

// Login page
function LoginForm({ onSwitch, onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = () => onLogin(username, password);

    return (
        <div>
            <div className="popup-title">User name:</div>
            <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
            />

            <div className="popup-title">Password:</div>
            <div className="password-container">
                <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                />
                <img
                    className="toggle-password-icon"
                    src={showPassword ? hidePasswordIcon : showPasswordIcon}
                    alt="toggle password"
                    onClick={() => setShowPassword(!showPassword)}
                />
            </div>

            <button onClick={handleSubmit}>Sign in</button>
            <div className="switch-link" onClick={onSwitch}>
                No account? Please Register
            </div>
        </div>
    );
}

// Register page
function RegisterForm({ onSwitch, onRegister }) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [pass1, setPass1] = useState('');
    const [pass2, setPass2] = useState('');
    const [showPassword1, setShowPassword1] = useState(false);
    const [showPassword2, setShowPassword2] = useState(false);
    const [discordId, setDiscordId] = useState("");

    const handleSubmit = () => onRegister(username, email, pass1, pass2, discordId);

    return (
        <div>
            <div className="popup-title">User Name:</div>
            <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
            />

            <div className="popup-title">Email:</div>
            <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@domain.com"
            />

            <div className="popup-title">Discord ID:</div>
            <input
                type="text"
                value={discordId}
                onChange={e => setDiscordId(e.target.value)}
                placeholder="123456789012345678"
            />


            <div className="popup-title">Password:</div>
            <div className="password-container">
                <input
                    type={showPassword1 ? 'text' : 'password'}
                    value={pass1}
                    onChange={e => setPass1(e.target.value)}
                />
                <img
                    className="toggle-password-icon"
                    src={showPassword1 ? hidePasswordIcon : showPasswordIcon}
                    alt="toggle password 1"
                    onClick={() => setShowPassword1(!showPassword1)}
                />
            </div>

            <div className="popup-title">Confirm Password:</div>
            <div className="password-container">
                <input
                    type={showPassword2 ? 'text' : 'password'}
                    value={pass2}
                    onChange={e => setPass2(e.target.value)}
                />
                <img
                    className="toggle-password-icon"
                    src={showPassword2 ? hidePasswordIcon : showPasswordIcon}
                    alt="toggle password 2"
                    onClick={() => setShowPassword2(!showPassword2)}
                />
            </div>

            <button onClick={handleSubmit}>Complete</button>
            <div className="switch-link" onClick={onSwitch}>
                Already have an account? Please Sign in
            </div>
        </div>
    );
}

function SignOutPanel({ onSignOut }) {
    return (
        <div>
            <div style={{ marginBottom: '10px' }}>Sign out?</div>
            <button onClick={onSignOut}>Sign out</button>
        </div>
    );
}