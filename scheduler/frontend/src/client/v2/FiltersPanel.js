import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDevices } from '../../services/deviceService';
import useSchedulerStore from '../../store/schedulerStore';
import useBookingState from '../../store/useBookingState';
import BookingTemplates from './BookingTemplates';
import PatchListPanel from './PatchListPanel';
import DateRangeSelector from './DateRangeSelector';
import { fetchGroupedBookings } from '../../services/bookingGroupsService';
import { fetchFavorites, updateFavoriteName, deleteFavorite } from '../../services/bookingFavoritesService';
import { mergeGroupedBookingEntries, summarizeDevices } from './utils/bookingGroups';
import { useToastContext } from '../../contexts/ToastContext';
import { getPanelBackgroundColor } from '../../utils/darkModeUtils';
import { useDocumentObserver } from '../../hooks/useDocumentObserver';

const STATUS_META = {
  APPROVED: { label: 'Approved', icon: '🟢', bg: 'bg-emerald-100/70 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-200' },
  PENDING: { label: 'Pending', icon: '🟡', bg: 'bg-amber-100/70 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-200' },
  DECLINED: { label: 'Declined', icon: '🔴', bg: 'bg-red-100/70 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-200' },
  CANCELLED: { label: 'Cancelled', icon: '⚪', bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-200' },
  EXPIRED: { label: 'Expired', icon: '⚪', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
};

const DATE_PREFERENCE_STORAGE_KEY = 'scheduler_date_preference';

const shortId = (id = '') => id.slice(0, 8).toUpperCase();

const formatDateLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const enumerateDatesInclusive = (start, end) => {
  if (!start || !end) return [];
  const result = [];
  const current = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(current.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }
  current.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  while (current <= endDate) {
    result.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return result;
};

const normalizeText = (value = '') =>
  value
    .toLowerCase()
    .replace(/[\s-_]+/g, '')
    .replace(/[^a-z0-9]/g, '');

const levenshteinDistance = (a = '', b = '') => {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[a.length][b.length];
};

const closestSubstringDistance = (query, target) => {
  if (!query || !target) return Infinity;
  if (query.length >= target.length) {
    return levenshteinDistance(query, target);
  }
  let best = Infinity;
  for (let i = 0; i <= target.length - query.length; i += 1) {
    const segment = target.slice(i, i + query.length);
    const distance = levenshteinDistance(query, segment);
    if (distance < best) {
      best = distance;
      if (best === 0) break;
    }
  }
  return best;
};

const getDeviceLabel = (device = {}) =>
  device.deviceName ||
  device.polatis_name ||
  device.deviceType ||
  device.ip_address ||
  '';

export default function FiltersPanel({ userId, userName, onResetSelection, onHideSidebar }) {
  const { data: devices = [], isLoading, error } = useDevices();
  const { 
    filters, 
    ui,
    setSearchQuery, 
    toggleDeviceType,
    setDateRange,
    setWeekOffset,
    setDeviceTypes,
    setDeviceIds,
  } = useSchedulerStore();
  const setSelectedRangeState = useBookingState((state) => state.setSelectedRange);
  const clearAllSelections = useBookingState((state) => state.clearAllSelections);
  const setDeviceDates = useBookingState((state) => state.setDeviceDates);
  const setCollaboratorsState = useBookingState((state) => state.setCollaborators);
  const toast = useToastContext();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('search'); // 'search', 'templates', 'patch', 'favorites', 'past-topologies'
  const [openFavoriteMenu, setOpenFavoriteMenu] = useState(null);
  const searchInputRef = useRef(null);
  const [panelBg, setPanelBg] = useState(() => getPanelBackgroundColor());
  
  // Use centralized document observer to watch for both class and style changes
  useDocumentObserver(() => {
    // Update synchronously to ensure transitions happen together
    setPanelBg(getPanelBackgroundColor());
  }, ['class', 'style']);

  // Extract unique device types from devices
  const deviceTypes = useMemo(() => {
    const types = new Set();
    devices.forEach(device => {
      if (device.deviceType) {
        types.add(device.deviceType);
      }
    });
    return Array.from(types).sort();
  }, [devices]);

  // Common device types for reference (can be static as requested)
  const commonDeviceTypes = ['Fiber', 'ROADM', 'ILA', 'Router', 'Switch'];

  // Use common types, but add any additional types found in the API
  const allDeviceTypes = useMemo(() => {
    const combined = new Set([...commonDeviceTypes, ...deviceTypes]);
    return Array.from(combined).sort();
  }, [deviceTypes]);

  const {
    data: rawBookingGroups = [],
    isLoading: isLoadingPastGroups,
    error: pastGroupsError,
  } = useQuery({
    queryKey: ['userBookingGroups', userId],
    queryFn: () => fetchGroupedBookings(userId),
    enabled: Boolean(userId),
    staleTime: 30000,
    select: (groups) => (Array.isArray(groups) ? groups : []),
  });

  const pastBookingGroups = useMemo(
    () => mergeGroupedBookingEntries(rawBookingGroups),
    [rawBookingGroups]
  );

  const {
    data: favoriteList = [],
    isLoading: isLoadingFavorites,
    error: favoritesError,
  } = useQuery({
    queryKey: ['userFavorites', userId],
    queryFn: () => fetchFavorites(userId),
    enabled: Boolean(userId),
    staleTime: 30000,
  });

  const statusMeta = useCallback((status) => {
    const key = (status || '').toUpperCase();
    return STATUS_META[key] || STATUS_META.PENDING;
  }, []);

  const handleResetSelection = useCallback(() => {
    setSearchQuery('');
    setDeviceTypes([]);
    setDeviceIds([]);
    setDateRange({ start: null, end: null });
    setSelectedRangeState({ start: null, end: null });
    setWeekOffset(0);
    clearAllSelections();
    try {
      localStorage.removeItem(DATE_PREFERENCE_STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to clear stored date preference:', err);
    }
    if (typeof onResetSelection === 'function') {
      onResetSelection();
    }
  }, [clearAllSelections, onResetSelection, setDateRange, setDeviceIds, setDeviceTypes, setSearchQuery, setSelectedRangeState, setWeekOffset]);

  useEffect(() => {
    if (activeTab !== 'favorites') {
      setOpenFavoriteMenu(null);
    }
  }, [activeTab]);

  const adjustWeekOffset = useCallback((startDateStr) => {
    if (!startDateStr) return;
    const targetDate = new Date(startDateStr);
    if (Number.isNaN(targetDate.getTime())) return;
    targetDate.setHours(0, 0, 0, 0);

    const targetDay = targetDate.getDay();
    const targetWeekStart = new Date(targetDate);
    targetWeekStart.setDate(targetDate.getDate() - targetDay + (targetDay === 0 ? -6 : 1));
    targetWeekStart.setHours(0, 0, 0, 0);

    const today = new Date();
    const todayDay = today.getDay();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - todayDay + (todayDay === 0 ? -6 : 1));
    currentWeekStart.setHours(0, 0, 0, 0);

    const diffWeeks = Math.round(
      (targetWeekStart.getTime() - currentWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    setWeekOffset(diffWeeks);
  }, [setWeekOffset]);

  const handleApplyGroup = useCallback((group) => {
    if (!group) return;

    clearAllSelections();

    const hasCurrentRange =
      ui?.dateRange?.start && ui?.dateRange?.end;
    const targetStart = hasCurrentRange ? ui.dateRange.start : group.start_date;
    const targetEnd = hasCurrentRange ? ui.dateRange.end : group.end_date;

    const activeDates = hasCurrentRange
      ? enumerateDatesInclusive(ui.dateRange.start, ui.dateRange.end)
      : null;

    (group.devices || []).forEach((device) => {
      const datesToApply = hasCurrentRange
        ? activeDates
        : Array.from(new Set(device.dates || []));
      if (datesToApply && datesToApply.length > 0) {
        setDeviceDates(device.device_id, datesToApply);
      }
    });

    setCollaboratorsState(group.collaborators || []);

    if (targetStart && targetEnd) {
      setSelectedRangeState({ start: targetStart, end: targetEnd });
      if (hasCurrentRange) {
        setDateRange({ start: targetStart, end: targetEnd });
      } else {
        setDateRange({ start: null, end: null });
      }
      adjustWeekOffset(targetStart);
    }
  }, [adjustWeekOffset, clearAllSelections, setCollaboratorsState, setDateRange, setDeviceDates, setSelectedRangeState, ui?.dateRange]);

  useEffect(() => {
    if (ui?.dateRange?.start || ui?.dateRange?.end) {
      return;
    }
    try {
      const stored = localStorage.getItem(DATE_PREFERENCE_STORAGE_KEY);
      if (!stored) {
        return;
      }
      const parsed = JSON.parse(stored);
      const { range } = parsed || {};
      if (range?.start && range?.end) {
        setDateRange({ start: range.start, end: range.end });
        setSelectedRangeState({ start: range.start, end: range.end });
        adjustWeekOffset(range.start);
      }
    } catch (err) {
      console.warn('Failed to restore stored date preference:', err);
    }
  }, [adjustWeekOffset, setDateRange, setSelectedRangeState, ui?.dateRange?.end, ui?.dateRange?.start]);

  const handleApplyFavorite = useCallback((favorite) => {
    if (!favorite) return;
    setOpenFavoriteMenu(null);
    if (!ui?.dateRange?.start || !ui?.dateRange?.end) {
      toast?.warning('Select a date range before applying a favourite.');
      return;
    }
    const dates = enumerateDatesInclusive(ui.dateRange.start, ui.dateRange.end);
    if (dates.length === 0) {
      toast?.warning('Select a valid date range before applying a favourite.');
      return;
    }
    clearAllSelections();
    (favorite.device_snapshot || []).forEach((device) => {
      setDeviceDates(device.device_id, dates);
    });
    setCollaboratorsState([]);
  }, [clearAllSelections, setCollaboratorsState, setDeviceDates, toast, ui?.dateRange]);

  const handleRenameFavorite = useCallback(async (favorite) => {
    const initial = favorite?.name || '';
    const nextName = window.prompt('Favourite name', initial);
    if (nextName === null) {
      return;
    }
    try {
      await updateFavoriteName(favorite.id, nextName.trim());
      toast?.success('Favourite renamed.');
      await queryClient.invalidateQueries(['userFavorites', userId]);
    } catch (err) {
      toast?.error(err.message || 'Failed to rename favourite.');
    }
  }, [queryClient, toast, userId]);

  const handleDeleteFavorite = useCallback(async (favorite) => {
    if (!window.confirm(`Remove favourite "${favorite.name}"?`)) {
      return;
    }
    try {
      await deleteFavorite(favorite.id);
      toast?.success('Favourite removed.');
      await queryClient.invalidateQueries(['userFavorites', userId]);
    } catch (err) {
      toast?.error(err.message || 'Failed to remove favourite.');
    }
  }, [queryClient, toast, userId]);

  const trimmedSearchQuery = filters.searchQuery?.trim() || '';

  const fuzzyDeviceSearch = useMemo(() => {
    if (!devices || devices.length === 0) {
      return null;
    }
    return new Fuse(devices, {
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2,
      distance: 150,
      keys: [
        { name: 'deviceName', weight: 0.5 },
        { name: 'polatis_name', weight: 0.3 },
        { name: 'deviceType', weight: 0.2 },
        { name: 'ip_address', weight: 0.2 },
      ],
    });
  }, [devices]);

  const searchSuggestion = useMemo(() => {
    if (!trimmedSearchQuery || !fuzzyDeviceSearch) {
      return null;
    }

    const normalizedQuery = normalizeText(trimmedSearchQuery);

    let results = fuzzyDeviceSearch.search(trimmedSearchQuery, { limit: 10 });
    if (!results || results.length === 0) {
      results = [];
    }

    const findLabel = (item) => getDeviceLabel(item);

    let matchedResult =
      results.find(({ item }) => {
        const label = findLabel(item);
        if (!label) return false;
        const normalizedLabel = normalizeText(label);
        return normalizedLabel.includes(normalizedQuery);
      }) || results[0];

    if ((!matchedResult || !matchedResult.item) && normalizedQuery.length >= 3) {
      let bestDevice = null;
      let bestLabel = '';
      let bestDistance = Infinity;

      devices.forEach((device) => {
        const label = getDeviceLabel(device);
        const normalizedLabel = normalizeText(label);
        if (!normalizedLabel) return;
        const distance = closestSubstringDistance(normalizedQuery, normalizedLabel);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestDevice = device;
          bestLabel = label;
        }
      });

      const maxAllowedDistance = Math.max(1, Math.round(normalizedQuery.length * 0.4));
      if (bestDevice && bestDistance <= maxAllowedDistance) {
        matchedResult = { item: bestDevice, label: bestLabel };
      }
    }

    const candidateItem = matchedResult?.item;
    const candidateName = matchedResult?.label || findLabel(candidateItem);

    if (!candidateName) {
      return null;
    }

    if (candidateName.toLowerCase() === trimmedSearchQuery.toLowerCase()) {
      return null;
    }

    if (typeof matchedResult?.score === 'number' && matchedResult.score > 0.5) {
      return null;
    }

    return {
      label: candidateName,
      item: matchedResult.item,
    };
  }, [devices, fuzzyDeviceSearch, trimmedSearchQuery]);

  useEffect(() => {
    const handleGlobalShortcut = (event) => {
      if (event.key !== '/' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      event.preventDefault();
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    };

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, []);

  if (error) {
    return (
      <div className="h-full glass-panel border-r border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Filters
        </h2>
        <div className="text-sm text-red-600 dark:text-red-400">
          Error loading devices: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-full glass-panel border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
      style={{
        backgroundColor: panelBg,
        transition: 'background-color 0.3s ease-in-out'
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Quick Book
          </h2>
          {typeof onHideSidebar === 'function' && (
            <button
              type="button"
              onClick={onHideSidebar}
              className="inline-flex items-center justify-center w-9 h-9 text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Hide Sidebar"
              aria-label="Hide sidebar"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 6L10 12L16 18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6L6 12L12 18" />
              </svg>
            </button>
          )}
        </div>

        <div className="mt-4">
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search devices by name, type, or IP..."
            className="w-full px-4 py-3 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2"
            style={{ 
              '--tw-ring-color': `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
            }}
            onFocus={(e) => {
              e.target.style.borderColor = `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '';
            }}
            autoFocus
            ref={searchInputRef}
            title="Search (/)"
            aria-label="Search devices"
          />
          {searchSuggestion && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Did you mean{' '}
              <button
                type="button"
                onClick={() => {
                  const suggestionValue =
                    searchSuggestion.item?.deviceName ||
                    searchSuggestion.item?.polatis_name ||
                    searchSuggestion.label;
                  if (suggestionValue) {
                    setSearchQuery(suggestionValue);
                  }
                }}
                className="hover:underline font-medium"
                style={{ color: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
              >
                {searchSuggestion.label}
              </button>
              ?
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mt-4 mb-4">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 min-w-[80px] px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'search'
                ? 'text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            style={activeTab === 'search' ? {
              backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
            } : {}}
          >
            Search
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 min-w-[80px] px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'templates'
                ? 'text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            style={activeTab === 'templates' ? {
              backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
            } : {}}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab('patch')}
            className={`flex-1 min-w-[80px] px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'patch'
                ? 'text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            style={activeTab === 'patch' ? {
              backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
            } : {}}
          >
            Patch List
          </button>
          {userName && (
            <button
              onClick={() => setActiveTab('favorites')}
              className={`flex-1 min-w-[80px] px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'favorites'
                  ? 'text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              style={activeTab === 'favorites' ? {
                backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
              } : {}}
            >
              Favourites
            </button>
          )}
          {userName && (
            <button
              onClick={() => setActiveTab('past-topologies')}
              className={`flex-1 min-w-[80px] px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'past-topologies'
                  ? 'text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              style={activeTab === 'past-topologies' ? {
                backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
              } : {}}
            >
              Past Topologies
            </button>
          )}
        </div>

        <DateRangeSelector
          ui={ui}
          setDateRange={setDateRange}
          setWeekOffset={setWeekOffset}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Search Tab */}
        {activeTab === 'search' && (
          <>
            {/* Device Type Filters - Collapsible */}
            <div className="mb-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 list-none">
                  <div className="flex items-center justify-between">
                    <span>Device Types</span>
                    <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {allDeviceTypes.map((type) => {
                    const isSelected = filters.deviceTypes.includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleDeviceType(type)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white dark:bg-blue-500'
                            : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
                {filters.deviceTypes.length > 0 && (
                  <button
                    onClick={() => {
                      const { setDeviceTypes } = useSchedulerStore.getState();
                      setDeviceTypes([]);
                    }}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Clear all
                  </button>
                )}
              </details>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Loading devices...
              </div>
            )}

            {/* Device Count */}
            {!isLoading && devices.length > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                {devices.length} device{devices.length !== 1 ? 's' : ''} found
              </div>
            )}
          </>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <BookingTemplates onApply={() => setActiveTab('search')} />
        )}

        {/* Patch List Tab */}
        {activeTab === 'patch' && (
          <PatchListPanel />
        )}

        {activeTab === 'favorites' && userName && (
          <div className="space-y-3">
            {isLoadingFavorites && (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                Loading favourites…
              </div>
            )}
            {favoritesError && (
              <div className="py-12 text-center text-sm text-red-600 dark:text-red-400">
                {favoritesError.message || 'Failed to load favourites'}
              </div>
            )}
            {!isLoadingFavorites && !favoritesError && favoriteList.length === 0 && (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                Mark a booking as a favourite to see it here.
              </div>
            )}
            {!isLoadingFavorites && !favoritesError && favoriteList.length > 0 && (
              <div className="space-y-3">
                {favoriteList.map((favorite) => {
                  const deviceSummary = summarizeDevices(favorite.device_snapshot || []);
                  return (
                    <div
                      key={favorite.id}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 glass-card px-3 py-3 shadow-sm hover:shadow-md transition"
                      onClick={() => handleApplyFavorite(favorite)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {favorite.name || 'Untitled favourite'}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {deviceSummary}
                          </p>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">
                            Updated {formatDateLabel(favorite.updated_at)}
                          </span>
                        </div>
                        <div
                          className="relative"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenFavoriteMenu((prev) =>
                              prev === favorite.id ? null : favorite.id
                            );
                          }}
                        >
                          <button
                            type="button"
                            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                            aria-label="Favourite options"
                          >
                            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
                            </svg>
                          </button>
                          {openFavoriteMenu === favorite.id && (
                            <div className="absolute right-0 mt-2 w-36 rounded-md border border-gray-200 dark:border-gray-700 glass-panel shadow-lg z-10 backdrop-blur">
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenFavoriteMenu(null);
                                  handleRenameFavorite(favorite);
                                }}
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/40"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenFavoriteMenu(null);
                                  handleDeleteFavorite(favorite);
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Past Topologies Tab */}
        {activeTab === 'past-topologies' && userName && (
          <div className="space-y-3">
            {isLoadingPastGroups && (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                Loading booking history…
              </div>
            )}
            {pastGroupsError && (
              <div className="py-12 text-center text-sm text-red-600 dark:text-red-400">
                {pastGroupsError.message || 'Failed to load past bookings'}
              </div>
            )}
            {!isLoadingPastGroups && !pastGroupsError && pastBookingGroups.length === 0 && (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                No past bookings found. Submit bookings to see them here.
              </div>
            )}
            {!isLoadingPastGroups && !pastGroupsError && pastBookingGroups.length > 0 && (
              <div className="space-y-3">
                {pastBookingGroups.map((group) => {
                  const status = statusMeta(group.status);
                  return (
                    <button
                      key={group.grouped_booking_id || group.booking_id}
                      type="button"
                      onClick={() => handleApplyGroup(group)}
                      className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 glass-card px-3 py-3 shadow-sm hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                              #{shortId(group.grouped_booking_id || group.booking_id || '')}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.bg} ${status.text}`}>
                              {status.icon} {status.label}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {group.summary?.hasMultipleDates ? 'Various days' : group.summary?.dateSummary}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {group.summary?.deviceSummary}
                          </p>
                        </div>
                        <svg
                          className="h-4 w-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={handleResetSelection}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          Reset Selection
        </button>
      </div>
    </div>
  );
}
