import React, { useState, useEffect } from 'react';
import BookingsPage from './BookingsPage';
import { API_BASE_URL } from '../config/api';
import { ToastProvider } from '../contexts/ToastContext';

export default function BookingsPageWrapper() {
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState(null);

  useEffect(() => {
    // Check session status
    async function checkSession() {
      try {
        const res = await fetch(`${API_BASE_URL}/session`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.logged_in) {
            setUserId(data.user_id);
            setUserName(data.username);
          }
        }
      } catch (err) {
        console.error('Session check failed:', err);
      }
    }
    checkSession();
  }, []);

  return (
    <ToastProvider>
      <BookingsPage userId={userId} userName={userName} />
    </ToastProvider>
  );
}


