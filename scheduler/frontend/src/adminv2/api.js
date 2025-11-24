import { API_BASE_URL } from '../config/api';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

async function parseResponse(response) {
  if (response.status === 204) {
    return null;
  }
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse admin API response', error, text);
    throw new Error('Unexpected response format');
  }
}

export async function adminRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 401) {
    const error = new Error('Not authenticated');
    error.status = 401;
    throw error;
  }

  if (!response.ok) {
    const payload = await parseResponse(response).catch(() => null);
    const detail = payload?.detail || payload?.message;
    const error = new Error(detail || `Admin request failed with ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return parseResponse(response);
}

export function getSession() {
  return adminRequest('/admin/v2/session', { method: 'GET' });
}

export function fetchDashboard() {
  return adminRequest('/admin/v2/dashboard', { method: 'GET' });
}

export function fetchBookings(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
    } else {
      searchParams.set(key, value);
    }
  });
  return adminRequest(`/admin/v2/bookings?${searchParams.toString()}`, { method: 'GET' });
}

export function fetchBookingDetail(bookingId) {
  return adminRequest(`/admin/v2/bookings/${bookingId}`, { method: 'GET' });
}

export function approveBookings(payload) {
  return adminRequest('/admin/v2/bookings/approve', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function declineBookings(payload) {
  return adminRequest('/admin/v2/bookings/decline', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function resolveConflicts(payload) {
  return adminRequest('/admin/v2/bookings/conflicts/resolve', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchDevices(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, value);
  });
  return adminRequest(`/admin/v2/devices?${searchParams.toString()}`, { method: 'GET' });
}

export function updateDeviceStatus(payload) {
  return adminRequest('/admin/v2/devices/status', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateDeviceOwner(payload) {
  return adminRequest('/admin/v2/devices/assign-owner', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateDeviceTags(payload) {
  return adminRequest('/admin/v2/devices/tags', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchUsers(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, value);
  });
  return adminRequest(`/admin/v2/users?${searchParams.toString()}`, { method: 'GET' });
}

export function inviteUser(payload) {
  return adminRequest('/admin/v2/users/invite', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUserRole(userId, payload) {
  return adminRequest(`/admin/v2/users/${userId}/role`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUserStatus(userId, payload) {
  return adminRequest(`/admin/v2/users/${userId}/status`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchTopologies(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, value);
  });
  return adminRequest(`/admin/v2/topologies?${searchParams.toString()}`, { method: 'GET' });
}

export function actOnTopology(topologyId, payload) {
  return adminRequest(`/admin/v2/topologies/${topologyId}/action`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchLogs(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, value);
  });
  return adminRequest(`/admin/v2/logs?${searchParams.toString()}`, { method: 'GET' });
}

export function fetchSettings() {
  return adminRequest('/admin/v2/settings', { method: 'GET' });
}

export function updateSettings(payload) {
  return adminRequest('/admin/v2/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function globalSearch(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (!value) return;
    searchParams.set(key, value);
  });
  return adminRequest(`/admin/v2/search?${searchParams.toString()}`, { method: 'GET' });
}

