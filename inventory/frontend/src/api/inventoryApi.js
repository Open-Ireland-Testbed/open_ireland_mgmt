import { INVENTORY_API_BASE_URL } from '../config/api';

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
        console.error('Failed to parse inventory API response', error, text);
        throw new Error('Unexpected response format');
    }
}

async function inventoryRequest(path, options = {}) {
    const response = await fetch(`${INVENTORY_API_BASE_URL}${path}`, {
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
        const error = new Error(detail || `Inventory request failed with ${response.status}`);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return parseResponse(response);
}

// Devices API
export function fetchDevices(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        if (Array.isArray(value)) {
            // For tag_ids, send as comma-separated string
            if (key === 'tag_ids') {
                searchParams.set(key, value.join(','));
            } else {
                value.forEach((item) => searchParams.append(key, item));
            }
        } else {
            searchParams.set(key, value);
        }
    });
    return inventoryRequest(`/api/inventory/devices?${searchParams.toString()}`, { method: 'GET' });
}

export function fetchDevice(deviceId) {
    return inventoryRequest(`/api/inventory/devices/${deviceId}`, { method: 'GET' });
}

export function fetchDeviceByOiId(oiId) {
    return inventoryRequest(`/api/inventory/devices/oi/${oiId}`, { method: 'GET' });
}

export function createDevice(deviceData) {
    return inventoryRequest('/api/inventory/devices', {
        method: 'POST',
        body: JSON.stringify(deviceData),
    });
}

export function updateDevice(deviceId, deviceData) {
    return inventoryRequest(`/api/inventory/devices/${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify(deviceData),
    });
}

export function deleteDevice(deviceId) {
    return inventoryRequest(`/api/inventory/devices/${deviceId}`, {
        method: 'DELETE',
    });
}

export function bulkUpdateDevices(deviceIds, updates) {
    return inventoryRequest('/api/inventory/devices/bulk-update', {
        method: 'POST',
        body: JSON.stringify({
            device_ids: deviceIds,
            updates,
        }),
    });
}

export function fetchDeviceHistory(deviceId, params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, value);
        }
    });
    const query = searchParams.toString();
    return inventoryRequest(`/api/inventory/devices/${deviceId}/history${query ? `?${query}` : ''}`, { method: 'GET' });
}

// Device Tags API
export function fetchDeviceTags(deviceId) {
    return inventoryRequest(`/api/inventory/devices/${deviceId}/tags`, { method: 'GET' });
}

export function assignTagsToDevice(deviceId, payload) {
    return inventoryRequest(`/api/inventory/devices/${deviceId}/tags`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function removeTagFromDevice(deviceId, tagId) {
    return inventoryRequest(`/api/inventory/devices/${deviceId}/tags/${tagId}`, {
        method: 'DELETE',
    });
}

// Device Types API
export function fetchDeviceTypes(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, value);
        }
    });
    const query = searchParams.toString();
    return inventoryRequest(`/api/inventory/device-types${query ? `?${query}` : ''}`, { method: 'GET' });
}

export function createDeviceType(payload) {
    return inventoryRequest('/api/inventory/device-types', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function updateDeviceType(id, payload) {
    return inventoryRequest(`/api/inventory/device-types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

export function deleteDeviceType(id) {
    return inventoryRequest(`/api/inventory/device-types/${id}`, {
        method: 'DELETE',
    });
}

// Manufacturers API
export function fetchManufacturers(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, value);
        }
    });
    const query = searchParams.toString();
    return inventoryRequest(`/api/inventory/manufacturers${query ? `?${query}` : ''}`, { method: 'GET' });
}

export function createManufacturer(payload) {
    return inventoryRequest('/api/inventory/manufacturers', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function updateManufacturer(id, payload) {
    return inventoryRequest(`/api/inventory/manufacturers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

export function deleteManufacturer(id) {
    return inventoryRequest(`/api/inventory/manufacturers/${id}`, {
        method: 'DELETE',
    });
}

// Sites API
export function fetchSites(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, value);
        }
    });
    const query = searchParams.toString();
    return inventoryRequest(`/api/inventory/sites${query ? `?${query}` : ''}`, { method: 'GET' });
}

export function createSite(payload) {
    return inventoryRequest('/api/inventory/sites', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function updateSite(id, payload) {
    return inventoryRequest(`/api/inventory/sites/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

export function deleteSite(id) {
    return inventoryRequest(`/api/inventory/sites/${id}`, {
        method: 'DELETE',
    });
}

// Tags API
export function fetchTags(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, value);
        }
    });
    const query = searchParams.toString();
    return inventoryRequest(`/api/inventory/tags${query ? `?${query}` : ''}`, { method: 'GET' });
}

export function createTag(payload) {
    return inventoryRequest('/api/inventory/tags', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function updateTag(id, payload) {
    return inventoryRequest(`/api/inventory/tags/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

export function deleteTag(id) {
    return inventoryRequest(`/api/inventory/tags/${id}`, {
        method: 'DELETE',
    });
}

// Stats API
export function fetchInventoryStats() {
    return inventoryRequest('/api/inventory/stats/summary', { method: 'GET' });
}

