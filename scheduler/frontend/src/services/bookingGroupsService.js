import { API_BASE_URL } from '../config/api';

export async function fetchGroupedBookings(userId) {
  if (!userId) {
    return [];
  }

  const response = await fetch(`${API_BASE_URL}/bookings/user/${userId}?grouped=true`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to load bookings');
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

