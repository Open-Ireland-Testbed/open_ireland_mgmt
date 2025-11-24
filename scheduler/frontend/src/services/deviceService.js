import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config/api';
import useAuthStore from '../store/authStore';

/**
 * Fetch all devices from the API
 * Uses public /api/devices endpoint which is available to all authenticated users
 * @returns {Object} React Query result with devices data, loading, and error states
 */
export function useDevices() {
    const { authenticated } = useAuthStore();
    
    return useQuery({
        queryKey: ['devices'],
        queryFn: async () => {
            // Only attempt to fetch if user is authenticated
            if (!authenticated) {
                return [];
            }

            // Use public devices endpoint - available to all authenticated users
            const response = await fetch(`${API_BASE_URL}/api/devices`, {
                credentials: 'include',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch devices' }));
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        },
        staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
        retry: 1,
        enabled: authenticated, // Only fetch if user is authenticated
    });
}

















