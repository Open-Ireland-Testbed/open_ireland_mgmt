import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { API_BASE_URL } from '../config/api';

/**
 * Fetch bookings with retry logic for transient errors
 */
async function fetchBookingsWithRetry(weekStart, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(
                `${API_BASE_URL}/bookings/for-week?start=${weekStart}`,
                {
                    credentials: 'include',
                }
            );

            if (!response.ok) {
                // Retry on 5xx errors (server errors) but not 4xx (client errors)
                if (response.status >= 500 && i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
                    continue;
                }
                const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch bookings' }));
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            // Retry on network errors
            if (error.name === 'TypeError' && i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                continue;
            }
            throw error;
        }
    }
}

/**
 * Fetch bookings for a specific week
 * @param {string} weekStart - Start date of the week in YYYY-MM-DD format
 * @returns {Object} React Query result with bookings data, loading, and error states
 */
export function useBookings(weekStart) {
    return useQuery({
        queryKey: ['bookings', 'week', weekStart],
        queryFn: () => fetchBookingsWithRetry(weekStart),
        enabled: !!weekStart,
        staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
        cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
        retry: false, // We handle retries manually
    });
}

/**
 * Pre-fetch bookings for adjacent weeks (previous and next)
 * @param {string} currentWeekStart - Current week start date
 * @returns {Object} React Query results for previous, current, and next week
 */
export function useBookingsWithAdjacentWeeks(currentWeekStart) {
    const weekOffsets = [-2, -1, 0, 1, 2];

    const weeks = useMemo(() => {
        if (!currentWeekStart) return [];

        const base = new Date(currentWeekStart);
        if (Number.isNaN(base.getTime())) {
            return [];
        }

        return weekOffsets.map((offset) => {
            const d = new Date(base);
            d.setDate(d.getDate() + offset * 7);
            return d.toISOString().split('T')[0];
        });
    }, [currentWeekStart]);

    const queries = useQueries({
        queries: weeks.map((weekStart) => ({
            queryKey: ['bookings', 'week', weekStart],
            queryFn: () => fetchBookingsWithRetry(weekStart),
            enabled: !!weekStart,
            staleTime: 2 * 60 * 1000,
            cacheTime: 10 * 60 * 1000,
            retry: false,
            placeholderData: (previousData) => previousData ?? [],
        })),
    });

    if (weeks.length === 0) {
        return {
            prev2Week: null,
            prevWeek: null,
            currentWeek: null,
            nextWeek: null,
            next2Week: null,
            isLoading: false,
            isFetching: false,
            isError: false,
        };
    }

    const currentIndex = weekOffsets.indexOf(0);
    const prevIndex = weekOffsets.indexOf(-1);
    const prev2Index = weekOffsets.indexOf(-2);
    const nextIndex = weekOffsets.indexOf(1);
    const next2Index = weekOffsets.indexOf(2);

    return {
        prev2Week: queries[prev2Index],
        prevWeek: queries[prevIndex],
        currentWeek: queries[currentIndex],
        nextWeek: queries[nextIndex],
        next2Week: queries[next2Index],
        isLoading: queries.some(q => q?.isLoading),
        isFetching: queries.some(q => q?.isFetching),
        isError: queries.some(q => q?.isError),
    };
}

/**
 * Fetch bookings for a date range (multiple weeks)
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Object} React Query result with bookings data, loading, and error states
 */
export function useBookingsForRange(startDate, endDate) {
    return useQuery({
        queryKey: ['bookings', 'range', startDate, endDate],
        queryFn: async () => {
            if (!startDate || !endDate) {
                return [];
            }

            // Fetch bookings week by week for the range
            const bookings = [];
            const start = new Date(startDate);
            const end = new Date(endDate);

            // Calculate all weeks in the range
            const weeks = [];
            const current = new Date(start);
            // Find Monday of the week containing start date
            const dayOfWeek = current.getDay();
            const diff = current.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            current.setDate(diff);
            current.setHours(0, 0, 0, 0);

            while (current <= end) {
                const weekStart = current.toISOString().split('T')[0];
                weeks.push(weekStart);
                current.setDate(current.getDate() + 7);
            }

            // Fetch bookings for each week in parallel
            const responses = await Promise.all(
                weeks.map(weekStart =>
                    fetch(`${API_BASE_URL}/bookings/for-week?start=${weekStart}`, {
                        credentials: 'include',
                    }).then(res => {
                        if (!res.ok) {
                            throw new Error(`Failed to fetch bookings for week ${weekStart}`);
                        }
                        return res.json();
                    })
                )
            );

            // Combine all bookings and filter by date range
            responses.forEach(weekBookings => {
                bookings.push(...weekBookings.filter(booking => {
                    const bookingStart = new Date(booking.start_time);
                    return bookingStart >= start && bookingStart <= end;
                }));
            });

            return bookings;
        },
        enabled: !!startDate && !!endDate,
        staleTime: 2 * 60 * 1000,
        retry: 1,
    });
}

