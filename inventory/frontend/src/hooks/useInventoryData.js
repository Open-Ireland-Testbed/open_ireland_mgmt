import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchDeviceTypes,
    fetchManufacturers,
    fetchSites,
    fetchTags,
    fetchInventoryStats,
    createDeviceType,
    updateDeviceType,
    deleteDeviceType,
    createManufacturer,
    updateManufacturer,
    deleteManufacturer,
    createSite,
    updateSite,
    deleteSite,
    createTag,
    updateTag,
    deleteTag,
} from '../api/inventoryApi';

// Hook for fetching device types
export function useDeviceTypes(params = {}) {
    return useQuery({
        queryKey: ['device-types', params],
        queryFn: () => fetchDeviceTypes(params),
        staleTime: 10 * 60 * 1000, // 10 minutes - these don't change often
    });
}

// Hook for fetching manufacturers
export function useManufacturers(params = {}) {
    return useQuery({
        queryKey: ['manufacturers', params],
        queryFn: () => fetchManufacturers(params),
        staleTime: 10 * 60 * 1000,
    });
}

// Hook for fetching sites
export function useSites(params = {}) {
    return useQuery({
        queryKey: ['sites', params],
        queryFn: () => fetchSites(params),
        staleTime: 10 * 60 * 1000,
    });
}

// Hook for fetching tags
export function useTags(params = {}) {
    return useQuery({
        queryKey: ['tags', params],
        queryFn: () => fetchTags(params),
        staleTime: 10 * 60 * 1000,
    });
}

// Hook for fetching inventory stats
export function useInventoryStats() {
    return useQuery({
        queryKey: ['inventory-stats'],
        queryFn: fetchInventoryStats,
        staleTime: 1 * 60 * 1000, // 1 minute
    });
}

// ================== Device Type Mutations ==================

export function useCreateDeviceType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createDeviceType,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['device-types'] });
        },
    });
}

export function useUpdateDeviceType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => updateDeviceType(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['device-types'] });
        },
    });
}

export function useDeleteDeviceType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteDeviceType,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['device-types'] });
        },
    });
}

// ================== Manufacturer Mutations ==================

export function useCreateManufacturer() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createManufacturer,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
        },
    });
}

export function useUpdateManufacturer() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => updateManufacturer(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
        },
    });
}

export function useDeleteManufacturer() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteManufacturer,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
        },
    });
}

// ================== Site Mutations ==================

export function useCreateSite() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createSite,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sites'] });
        },
    });
}

export function useUpdateSite() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => updateSite(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sites'] });
        },
    });
}

export function useDeleteSite() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteSite,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sites'] });
        },
    });
}

// ================== Tag Mutations ==================

export function useCreateTag() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createTag,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] });
        },
    });
}

export function useUpdateTag() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => updateTag(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] });
        },
    });
}

export function useDeleteTag() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteTag,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] });
        },
    });
}

