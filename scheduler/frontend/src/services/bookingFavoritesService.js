import { API_BASE_URL } from '../config/api';

export async function fetchFavorites(userId) {
  if (!userId) {
    return [];
  }
  const response = await fetch(`${API_BASE_URL}/bookings/favorites/${userId}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to load favourites');
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function createFavorite(payload) {
  const response = await fetch(`${API_BASE_URL}/bookings/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: 'Failed to save favourite' }));
    throw new Error(detail.detail || 'Failed to save favourite');
  }
  return response.json();
}

export async function updateFavoriteName(favoriteId, name) {
  const response = await fetch(`${API_BASE_URL}/bookings/favorites/${favoriteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: 'Failed to update favourite' }));
    throw new Error(detail.detail || 'Failed to update favourite');
  }
  return response.json();
}

export async function deleteFavorite(favoriteId) {
  const response = await fetch(`${API_BASE_URL}/bookings/favorites/${favoriteId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: 'Failed to delete favourite' }));
    throw new Error(detail.detail || 'Failed to delete favourite');
  }
  return response.json();
}

