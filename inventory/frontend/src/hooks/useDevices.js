import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchDevices,
    fetchDevice,
    createDevice,
    updateDevice,
    deleteDevice,
    bulkUpdateDevices,
    fetchDeviceHistory,
    fetchDeviceTags,
    assignTagsToDevice,
    removeTagFromDevice,
} from '../api/inventoryApi';

// Hook for listing devices with filters and pagination
export function useDevicesList({ filters = {}, pagination = { page: 1, pageSize: 50 } }) {
    const { page, pageSize } = pagination;
    const limit = pageSize;
    const offset = (page - 1) * pageSize;

    // Map filters to API params, filtering out empty values and converting tag_id to tag_ids
    const params = {
        limit,
        offset,
    };

    // Add non-empty filter values
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
            params[key] = value;
        }
    });

    // Convert tag_id to tag_ids array for API
    if (params.tag_id) {
        params.tag_ids = [params.tag_id];
        delete params.tag_id;
    }

    return useQuery({
        queryKey: ['devices', filters, pagination],
        queryFn: () => fetchDevices(params),
        keepPreviousData: true, // Keep previous data while fetching new data
    });
}

// Hook for fetching a single device
export function useDevice(deviceId) {
    return useQuery({
        queryKey: ['device', deviceId],
        queryFn: () => fetchDevice(deviceId),
        enabled: !!deviceId,
    });
}

// Hook for creating a device
export function useCreateDevice() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createDevice,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['devices'] });
        },
    });
}

// Hook for updating a device
export function useUpdateDevice() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ deviceId, data }) => updateDevice(deviceId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['devices'] });
            queryClient.invalidateQueries({ queryKey: ['device', variables.deviceId] });
        },
    });
}

// Hook for deleting a device
export function useDeleteDevice() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteDevice,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['devices'] });
        },
    });
}

// Hook for bulk updating devices
export function useBulkUpdateDevices() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ deviceIds, updates }) => bulkUpdateDevices(deviceIds, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['devices'] });
        },
    });
}

// Hook for fetching device history
export function useDeviceHistory(deviceId) {
    return useQuery({
        queryKey: ['deviceHistory', deviceId],
        queryFn: () => fetchDeviceHistory(deviceId),
        enabled: !!deviceId,
    });
}

// Hook for fetching device tags
export function useDeviceTags(deviceId) {
    return useQuery({
        queryKey: ['deviceTags', deviceId],
        queryFn: () => fetchDeviceTags(deviceId),
        enabled: !!deviceId,
    });
}

// Hook for assigning tags to a device
export function useAssignTagsToDevice(deviceId) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload) => assignTagsToDevice(deviceId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deviceTags', deviceId] });
            queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
            queryClient.invalidateQueries({ queryKey: ['devices'] });
        },
    });
}

// Hook for removing a tag from a device
export function useRemoveTagFromDevice(deviceId) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (tagId) => removeTagFromDevice(deviceId, tagId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deviceTags', deviceId] });
            queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
            queryClient.invalidateQueries({ queryKey: ['devices'] });
        },
    });
}

