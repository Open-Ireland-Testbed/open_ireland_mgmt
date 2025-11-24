import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToastContext } from '../../contexts/ToastContext';
import CollaboratorInput from '../../components/CollaboratorInput';
import { fetchGroupedBookings } from '../../services/bookingGroupsService';
import { mergeGroupedBookingEntries, buildGalleryEntries } from './utils/bookingGroups';
import { API_BASE_URL } from '../../config/api';
import {
  fetchFavorites,
  createFavorite,
} from '../../services/bookingFavoritesService';
import { getPanelBackgroundColor } from '../../utils/darkModeUtils';
import { useDocumentObserver } from '../../hooks/useDocumentObserver';

async function cancelBookingGroup(groupId, userId) {
  const response = await fetch(`${API_BASE_URL}/api/bookings/group/${groupId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: 'Failed to cancel group' }));
    throw new Error(detail.detail || 'Failed to cancel group');
  }
  return response.json();
}

async function extendBookingGroup(groupId, userId, newEndDate) {
  const response = await fetch(`${API_BASE_URL}/api/bookings/group/${groupId}/extend`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ user_id: userId, new_end_date: newEndDate }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: 'Failed to extend group' }));
    throw new Error(detail.detail || 'Failed to extend group');
  }
  return response.json();
}

async function rebookBookingGroup(groupId, userId, startDate, endDate, message) {
  const response = await fetch(`${API_BASE_URL}/api/bookings/group/${groupId}/rebook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      user_id: userId,
      start_date: startDate,
      end_date: endDate,
      message,
    }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: 'Failed to rebook group' }));
    throw new Error(detail.detail || 'Failed to rebook group');
  }
  return response.json();
}

const STATUS_META = {
  APPROVED: { label: 'Approved', icon: '🟢', bg: 'bg-emerald-100/70 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-200' },
  PENDING: { label: 'Pending', icon: '🟡', bg: 'bg-amber-100/70 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-200' },
  DECLINED: { label: 'Declined', icon: '🔴', bg: 'bg-red-100/70 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-200' },
  CANCELLED: { label: 'Cancelled', icon: '⚪', bg: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-200' },
  EXPIRED: { label: 'Expired', icon: '⚪', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
};

const ACTIVE_STATUSES = new Set(['APPROVED', 'PENDING']);

const shortId = (id) => id.slice(0, 8).toUpperCase();

const formatDate = (value) => {
  const date = new Date(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatRange = (start, end) => {
  const same = start === end;
  if (same) {
    return formatDate(start);
  }
  return `${formatDate(start)} → ${formatDate(end)}`;
};

function ActionModal({ title, children, onClose }) {
  const modalContent = (
    <div 
      className="fixed bg-black/40"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        height: '100vh',
        width: '100vw',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="rounded-2xl glass-panel shadow-2xl border border-gray-200/60 dark:border-gray-700/60"
        style={{
          position: 'relative',
          width: 'min(calc(100vw - 2rem), 28rem)',
          maxWidth: '28rem',
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto',
          margin: 0,
          transform: 'none',
          top: 'auto',
          left: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200/70 dark:border-gray-800/70 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close dialog"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default function MyBookingsPanel({ userId, userName, onClose }) {
  const queryClient = useQueryClient();
  const [panelBg, setPanelBg] = useState(() => getPanelBackgroundColor());
  
  // Use centralized document observer to watch for both class and style changes
  useDocumentObserver(() => {
    // Update synchronously to ensure transitions happen together
    setPanelBg(getPanelBackgroundColor());
  }, ['class', 'style']);
  const toast = useToastContext();

  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [actionState, setActionState] = useState(null); // { type, group }
  const [rebookForm, setRebookForm] = useState({ start: '', end: '', message: '' });
  const [extendDate, setExtendDate] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [collaboratorEditor, setCollaboratorEditor] = useState(null);
  const [collaboratorDraft, setCollaboratorDraft] = useState([]);
  const [isSavingCollaborators, setIsSavingCollaborators] = useState(false);
  const [isCollaboratorValidation, setIsCollaboratorValidation] = useState(false);
  const [favoriteEditor, setFavoriteEditor] = useState(null); // { group, favorite }
  const [favoriteName, setFavoriteName] = useState('');
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [deviceManager, setDeviceManager] = useState(null); // { group }
  const [deviceRebookForm, setDeviceRebookForm] = useState({ start: '', end: '', message: '', device: null });
  const [deviceExtendDate, setDeviceExtendDate] = useState({ date: '', device: null });
  const [deviceCancelTarget, setDeviceCancelTarget] = useState(null);
  const [deviceCollaboratorEditor, setDeviceCollaboratorEditor] = useState(null); // { device, group }
  const [deviceCollaboratorDraft, setDeviceCollaboratorDraft] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const BOOKINGS_PER_PAGE = 10;

  const { data: bookingGroups = [], isLoading, error } = useQuery({
    queryKey: ['userBookingGroups', userId],
    queryFn: () => fetchGroupedBookings(userId),
    enabled: Boolean(userId),
    staleTime: 30000,
    select: (groups) => (Array.isArray(groups) ? groups : []),
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ['userFavorites', userId],
    queryFn: () => fetchFavorites(userId),
    enabled: Boolean(userId),
    staleTime: 30000,
  });

  const favoriteMap = useMemo(() => {
    const map = new Map();
    (favorites || []).forEach((favorite) => {
      map.set(favorite.grouped_booking_id, favorite);
    });
    return map;
  }, [favorites]);

  const mergedGroups = useMemo(
    () => mergeGroupedBookingEntries(bookingGroups),
    [bookingGroups]
  );

  const filteredGroups = useMemo(() => {
    const items = Array.isArray(mergedGroups) ? mergedGroups : [];
    return items
      .filter((group) => {
        if (!showActiveOnly) return true;
        return ACTIVE_STATUSES.has((group.status || '').toUpperCase());
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [mergedGroups, showActiveOnly]);

  const totalPages = Math.ceil(filteredGroups.length / BOOKINGS_PER_PAGE);
  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * BOOKINGS_PER_PAGE;
    return filteredGroups.slice(startIndex, startIndex + BOOKINGS_PER_PAGE);
  }, [filteredGroups, currentPage]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [showActiveOnly, filteredGroups.length]);

  const toggleExpanded = (groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const statusMeta = (status) => {
    const key = (status || '').toUpperCase();
    return STATUS_META[key] || STATUS_META.PENDING;
  };

  const refreshData = async () => {
    await queryClient.invalidateQueries(['userBookingGroups']);
    await queryClient.invalidateQueries(['bookings']);
    if (userId) {
      await queryClient.invalidateQueries(['userFavorites', userId]);
    }
  };

  const handleCancelGroup = async (group) => {
    if (!window.confirm('Cancel this entire booking session?')) {
      return;
    }
    try {
      setIsProcessing(true);
      await cancelBookingGroup(group.grouped_booking_id, userId);
      toast?.success('Booking session cancelled.');
      await refreshData();
    } catch (err) {
      toast?.error(err.message || 'Unable to cancel booking session.');
    } finally {
      setIsProcessing(false);
    }
  };

  const openFavoriteModal = (group, existingFavorite) => {
    if (!userId) {
      toast?.warning('Sign in to manage favourites.');
      return;
    }
    setFavoriteEditor({ group, favorite: existingFavorite || null });
    setFavoriteName(existingFavorite?.name || '');
  };

  const closeFavoriteModal = () => {
    if (isSavingFavorite) {
      return;
    }
    setFavoriteEditor(null);
    setFavoriteName('');
  };

  const handleSaveFavorite = async () => {
    if (!favoriteEditor?.group || !userId) return;
    try {
      setIsSavingFavorite(true);
      const devices = (favoriteEditor.group.devices || []).map((device) => ({
        device_id: device.device_id,
        device_name: device.device_name,
        device_type: device.device_type,
      }));

      await createFavorite({
        user_id: userId,
        grouped_booking_id: favoriteEditor.group.grouped_booking_id,
        device_snapshot: devices,
        name: favoriteName.trim() || undefined,
      });

      toast?.success(favoriteEditor.favorite ? 'Favourite updated.' : 'Favourite saved.');
      await queryClient.invalidateQueries(['userFavorites', userId]);
      setFavoriteEditor(null);
      setFavoriteName('');
    } catch (err) {
      toast?.error(err.message || 'Unable to save favourite.');
    } finally {
      setIsSavingFavorite(false);
    }
  };

  const openRebook = (group, actor = 'owner') => {
    const defaultStart = group.start_date;
    const defaultEnd = group.end_date;
    setRebookForm({ start: defaultStart, end: defaultEnd, message: '' });
    setActionState({ type: 'rebook', group, actor });
  };

  const submitRebook = async () => {
    if (!actionState?.group) return;
    if (!rebookForm.start || !rebookForm.end) {
      toast?.error('Select start and end dates.');
      return;
    }
    if (new Date(rebookForm.end) < new Date(rebookForm.start)) {
      toast?.error('End date must be after start date.');
      return;
    }

    try {
      setIsProcessing(true);
      if (actionState.actor === 'collaborator') {
        const ownerBookingIds =
          (actionState.group.owner_booking_ids && actionState.group.owner_booking_ids.length > 0
            ? actionState.group.owner_booking_ids
            : actionState.group.bookingIds) || [];

        const baseId = ownerBookingIds[0];
        if (!baseId) {
          throw new Error('Unable to determine booking to rebook.');
        }

        const response = await fetch(`${API_BASE_URL}/bookings/rebook/${baseId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            user_id: userId,
            start_date: rebookForm.start,
            end_date: rebookForm.end,
            booking_ids: ownerBookingIds,
            message: rebookForm.message || '',
          }),
        });

        if (!response.ok) {
          const detail = await response.json().catch(() => ({ detail: 'Failed to rebook session' }));
          throw new Error(detail.detail || 'Failed to rebook session');
        }
      } else {
        await rebookBookingGroup(
          actionState.group.grouped_booking_id,
          userId,
          rebookForm.start,
          rebookForm.end,
          rebookForm.message || ''
        );
      }

      toast?.success('Booking session re-created. Pending approval.');
      setActionState(null);
      await refreshData();
    } catch (err) {
      toast?.error(err.message || 'Unable to rebook session.');
    } finally {
      setIsProcessing(false);
    }
  };

  const openExtend = (group) => {
    setExtendDate('');
    setActionState({ type: 'extend', group });
  };

  const submitExtend = async () => {
    if (!actionState?.group) return;
    if (!extendDate) {
      toast?.error('Select a new end date.');
      return;
    }
    const currentEnd = new Date(actionState.group.end_date);
    const requested = new Date(extendDate);
    if (requested <= currentEnd) {
      toast?.error('New end date must be after the current end date.');
      return;
    }
    try {
      setIsProcessing(true);
      await extendBookingGroup(actionState.group.grouped_booking_id, userId, extendDate);
      toast?.success('Booking session extended.');
      setActionState(null);
      await refreshData();
    } catch (err) {
      toast?.error(err.message || 'Unable to extend session.');
    } finally {
      setIsProcessing(false);
    }
  };

  const openCollaboratorEditor = (group) => {
    setCollaboratorDraft(group.collaborators || []);
    setCollaboratorEditor(group);
  };

  const closeCollaboratorEditor = () => {
    if (isSavingCollaborators) {
      return;
    }
    setCollaboratorEditor(null);
    setCollaboratorDraft([]);
    setIsCollaboratorValidation(false);
  };

  const saveCollaborators = async () => {
    if (!collaboratorEditor) return;
    const bookingIds = collaboratorEditor.booking_ids || [];
    const baseId = bookingIds[0];
    if (!baseId) {
      toast?.error('Unable to update collaborators for this booking.');
      return;
    }

    try {
      setIsSavingCollaborators(true);
      const response = await fetch(`${API_BASE_URL}/api/bookings/${baseId}/collaborators`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          owner_id: collaboratorEditor.owner_id,
          collaborators: collaboratorDraft,
          booking_ids: bookingIds,
        }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({ detail: 'Failed to update collaborators' }));
        throw new Error(detail.detail || 'Failed to update collaborators');
      }

      toast?.success('Collaborators updated.');
      closeCollaboratorEditor();
      await refreshData();
    } catch (err) {
      toast?.error(err.message || 'Unable to update collaborators.');
    } finally {
      setIsSavingCollaborators(false);
    }
  };

  // Individual device booking helpers
  const getDeviceBookings = (group, deviceId) => {
    const bookingIds = group.owner_booking_ids || group.bookingIds || [];
    // Filter bookings for this specific device
    // We'll need to fetch individual booking details or use the device structure
    // For now, we'll use the device data from the group
    const device = (group.devices || []).find(d => d.device_id === deviceId);
    if (!device) return [];
    
    // Return device info with booking IDs that match this device
    return [{
      device_id: device.device_id,
      device_name: device.device_name || device.deviceName,
      device_type: device.device_type || device.deviceType,
      dates: device.dates || [],
      booking_ids: bookingIds, // All booking IDs for the group (we'll filter on backend if needed)
    }];
  };

  const handleDeviceCancel = async (device, group) => {
    if (!window.confirm(`Cancel booking for ${device.device_name || device.deviceName}?`)) {
      return;
    }
    try {
      setIsProcessing(true);
      // Cancel all bookings for this device in the group
      const bookingIds = group.owner_booking_ids || group.bookingIds || [];
      // For now, we'll cancel the entire group, but ideally we'd cancel only this device's bookings
      // This would require backend support for device-specific cancellation
      await cancelBookingGroup(group.grouped_booking_id, userId);
      toast?.success('Device booking cancelled.');
      setDeviceCancelTarget(null);
      setDeviceManager(null);
      await refreshData();
    } catch (err) {
      toast?.error(err.message || 'Unable to cancel device booking.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeviceRebook = async () => {
    if (!deviceRebookForm.device || !deviceRebookForm.start || !deviceRebookForm.end) {
      toast?.error('Select start and end dates.');
      return;
    }
    if (new Date(deviceRebookForm.end) < new Date(deviceRebookForm.start)) {
      toast?.error('End date must be after start date.');
      return;
    }

    try {
      setIsProcessing(true);
      const group = deviceManager;
      const bookingIds = group.owner_booking_ids || group.bookingIds || [];
      const baseId = bookingIds[0];
      
      if (!baseId) {
        throw new Error('Unable to determine booking to rebook.');
      }

      const response = await fetch(`${API_BASE_URL}/bookings/rebook/${baseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: userId,
          start_date: deviceRebookForm.start,
          end_date: deviceRebookForm.end,
          booking_ids: bookingIds, // Rebook all bookings for now
          message: deviceRebookForm.message || '',
        }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({ detail: 'Failed to rebook device' }));
        throw new Error(detail.detail || 'Failed to rebook device');
      }

      toast?.success('Device booking re-created. Pending approval.');
      setDeviceRebookForm({ start: '', end: '', message: '', device: null });
      setDeviceManager(null);
      await refreshData();
    } catch (err) {
      toast?.error(err.message || 'Unable to rebook device.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeviceExtend = async () => {
    if (!deviceExtendDate.device || !deviceExtendDate.date) {
      toast?.error('Select a new end date.');
      return;
    }

    const device = deviceExtendDate.device;
    const group = deviceManager;
    const currentEnd = new Date(group.end_date);
    const requested = new Date(deviceExtendDate.date);
    
    if (requested <= currentEnd) {
      toast?.error('New end date must be after the current end date.');
      return;
    }

    try {
      setIsProcessing(true);
      await extendBookingGroup(group.grouped_booking_id, userId, deviceExtendDate.date);
      toast?.success('Device booking extended.');
      setDeviceExtendDate({ date: '', device: null });
      setDeviceManager(null);
      await refreshData();
    } catch (err) {
      toast?.error(err.message || 'Unable to extend device booking.');
    } finally {
      setIsProcessing(false);
    }
  };

  const openDeviceRebook = (device, group) => {
    const defaultStart = group.start_date;
    const defaultEnd = group.end_date;
    setDeviceRebookForm({ start: defaultStart, end: defaultEnd, message: '', device });
  };

  const openDeviceExtend = (device, group) => {
    setDeviceExtendDate({ date: '', device });
  };

  const openDeviceCollaboratorEditor = (device, group) => {
    setDeviceCollaboratorDraft(group.collaborators || []);
    setDeviceCollaboratorEditor({ device, group });
  };

  const saveDeviceCollaborators = async () => {
    if (!deviceCollaboratorEditor) return;
    const group = deviceCollaboratorEditor.group;
    const bookingIds = group.owner_booking_ids || group.bookingIds || [];
    const baseId = bookingIds[0];
    
    if (!baseId) {
      toast?.error('Unable to update collaborators for this booking.');
      return;
    }

    try {
      setIsSavingCollaborators(true);
      const response = await fetch(`${API_BASE_URL}/api/bookings/${baseId}/collaborators`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          owner_id: group.owner_id,
          collaborators: deviceCollaboratorDraft,
          booking_ids: bookingIds,
        }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({ detail: 'Failed to update collaborators' }));
        throw new Error(detail.detail || 'Failed to update collaborators');
      }

      toast?.success('Collaborators updated.');
      setDeviceCollaboratorEditor(null);
      setDeviceCollaboratorDraft([]);
      await refreshData();
    } catch (err) {
      toast?.error(err.message || 'Unable to update collaborators.');
    } finally {
      setIsSavingCollaborators(false);
    }
  };

  if (!userName) {
    return (
      <div 
        className="glass-panel rounded-2xl border border-gray-200/60 dark:border-gray-700/60 p-6 shadow-lg"
        style={{ backgroundColor: panelBg, transition: 'background-color 0.3s ease-in-out' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Bookings</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to view booking history.</p>
      </div>
    );
  }

  return (
    <div 
      className="glass-panel rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-xl flex flex-col"
      style={{ backgroundColor: panelBg }}
    >
      <div className="flex-shrink-0 border-b border-gray-200/70 dark:border-gray-700/70 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Bookings</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showActiveOnly}
            onChange={(e) => setShowActiveOnly(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-2"
            style={{ 
              '--tw-ring-color': `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`,
              accentColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
            }}
          />
          Show only active booking sessions
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoading && (
          <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading booking sessions…
          </div>
        )}

        {error && (
          <div className="py-12 text-center text-sm text-red-600 dark:text-red-400">
            Error loading bookings: {error.message}
          </div>
        )}

        {!isLoading && !error && filteredGroups.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            {showActiveOnly ? 'No active booking sessions.' : 'No bookings yet. Submit one from the scheduler.'}
          </div>
        )}

        {!isLoading &&
          !error &&
          paginatedGroups.map((group) => {
            const status = statusMeta(group.status);
            const expanded = expandedGroups.has(group.grouped_booking_id);
            const isOwner = group.is_owner;
            const summary = group.summary || {};
            const existingFavorite = favoriteMap.get(group.grouped_booking_id);
            return (
              <div
                key={group.grouped_booking_id}
                className="rounded-xl border border-gray-200/70 dark:border-gray-700/70 glass-card shadow-sm transition hover:shadow-lg"
              >
                <button
                  type="button"
                  className="w-full text-left px-4 py-4 flex flex-col gap-3 focus:outline-none"
                  onClick={() => toggleExpanded(group.grouped_booking_id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                          #{shortId(group.grouped_booking_id)}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                        {!isOwner && (
                          <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                            Collaborator
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {summary.hasMultipleDates ? 'Various days' : summary.dateSummary}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {summary.deviceSummary} · {group.device_count} device{group.device_count !== 1 ? 's' : ''}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                        <span>Owner:</span>
                        <span className="font-medium">@{group.owner_username}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openFavoriteModal(group, existingFavorite);
                        }}
                        className={`p-1 rounded-full transition-colors ${
                          existingFavorite
                            ? 'text-yellow-400 hover:text-yellow-300'
                            : 'text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-300'
                        }`}
                        aria-label={existingFavorite ? 'Edit favourite' : 'Add to favourites'}
                      >
                        {existingFavorite ? (
                          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.176c.969 0 1.371 1.24.588 1.81l-3.383 2.458a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.383-2.458a1 1 0 00-1.176 0l-3.383 2.458c-.784.57-1.838-.196-1.539-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.049 9.394c-.783-.57-.38-1.81.588-1.81h4.176a1 1 0 00.95-.69l1.286-3.967z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l1.54 3.108a.562.562 0 00.424.308l3.432.498c.494.072.691.68.334 1.027l-2.483 2.42a.562.562 0 00-.162.497l.586 3.42c.084.492-.433.866-.87.634l-3.073-1.615a.562.562 0 00-.523 0l-3.072 1.615c-.438.232-.954-.142-.87-.634l.586-3.42a.562.562 0 00-.162-.497l-2.484-2.42c-.357-.347-.16-.955.334-1.027l3.433-.498a.562.562 0 00.424-.308l1.54-3.108z" />
                          </svg>
                        )}
                      </button>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        Created {formatDate(group.created_at)}
                      </span>
                      <svg
                        className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {group.collaborators && group.collaborators.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {group.collaborators.map((collaborator) => (
                        <span
                          key={collaborator}
                          className="inline-flex items-center rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-[11px] font-semibold text-gray-800 dark:text-gray-100"
                        >
                          @{collaborator}
                        </span>
                      ))}
                    </div>
                  )}
                </button>

                {expanded && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {summary.gallery.map((item, idx) => (
                        <div
                          key={`${item.deviceName}-${idx}`}
                          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-3 shadow-sm"
                        >
                          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {item.deviceName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            {item.deviceType}
                          </div>
                          <ul className="space-y-1 text-[11px] text-gray-600 dark:text-gray-300">
                            {item.ranges.map((range, rangeIdx) => (
                              <li key={rangeIdx}>
                                {formatRange(range.start, range.end)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 dark:border-gray-800 px-4 py-3">
                  {isOwner ? (
                    <>
                      <button
                        onClick={() => openRebook(group, 'owner')}
                        disabled={isProcessing}
                        className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 h-7"
                        style={{ backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
                      >
                        Rebook
                      </button>
                      <button
                        onClick={() => openExtend(group)}
                        disabled={isProcessing}
                        className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:disabled:bg-emerald-900/40 h-7"
                      >
                        Extend
                      </button>
                      <button
                        onClick={() => handleCancelGroup(group)}
                        disabled={isProcessing}
                        className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300 dark:bg-red-500 dark:hover:bg-red-400 dark:disabled:bg-red-900/40 h-7"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => openCollaboratorEditor(group)}
                        className="inline-flex items-center justify-center rounded-md bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700 shadow-sm transition hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:hover:bg-purple-900/60 h-7"
                      >
                        Edit collaborators
                      </button>
                      <button
                        onClick={() => setDeviceManager(group)}
                        disabled={isProcessing}
                        className="ml-auto inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 h-7"
                        style={{ 
                          backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) + 30%))`,
                          color: `hsl(var(--accent-hue), var(--accent-saturation), calc(var(--accent-lightness) - 20%))`
                        }}
                      >
                        Manage individual device bookings
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => openRebook(group, 'collaborator')}
                        disabled={isProcessing}
                        className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
                      >
                        Rebook for Myself
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* Pagination Controls */}
      {!isLoading && !error && filteredGroups.length > 0 && totalPages > 1 && (
        <div className="flex-shrink-0 border-t border-gray-200/70 dark:border-gray-700/70 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {actionState?.type === 'rebook' && (
        <ActionModal
          title={actionState.actor === 'collaborator' ? 'Rebook for yourself' : 'Rebook session'}
          onClose={() => !isProcessing && setActionState(null)}
        >
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {actionState.actor === 'collaborator'
              ? 'Choose a new window to create your own copy of this booking session.'
              : 'Choose a new window for this booking session. The same devices and collaborators will be included.'}
          </p>
          <div className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Start date</span>
              <input
                type="date"
                value={rebookForm.start}
                onChange={(e) => setRebookForm((prev) => ({ ...prev, start: e.target.value }))}
                className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                style={{ 
                  '--tw-ring-color': `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '';
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">End date</span>
              <input
                type="date"
                value={rebookForm.end}
                onChange={(e) => setRebookForm((prev) => ({ ...prev, end: e.target.value }))}
                className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                style={{ 
                  '--tw-ring-color': `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '';
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Optional message</span>
              <textarea
                rows={2}
                value={rebookForm.message}
                onChange={(e) => setRebookForm((prev) => ({ ...prev, message: e.target.value }))}
                placeholder="Add context for approvers..."
                className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                style={{ 
                  '--tw-ring-color': `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '';
                }}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => !isProcessing && setActionState(null)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Close
              </button>
              <button
                onClick={submitRebook}
                disabled={isProcessing}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
              >
                {isProcessing ? 'Submitting…' : 'Create new session'}
              </button>
            </div>
          </div>
        </ActionModal>
      )}

      {actionState?.type === 'extend' && (
        <ActionModal title="Extend booking session" onClose={() => !isProcessing && setActionState(null)}>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Extend the end date for this session. New days will be added for every device in the booking.
          </p>
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">New end date</span>
            <input
              type="date"
              value={extendDate}
              min={actionState.group.end_date}
              onChange={(e) => setExtendDate(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => !isProcessing && setActionState(null)}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Close
            </button>
            <button
              onClick={submitExtend}
              disabled={isProcessing}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:disabled:bg-emerald-900/40"
            >
              {isProcessing ? 'Updating…' : 'Extend session'}
            </button>
          </div>
        </ActionModal>
      )}

      {collaboratorEditor && (
        <ActionModal
          title="Edit collaborators"
          onClose={closeCollaboratorEditor}
        >
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Add usernames to share access to this booking. Collaborators can view and extend sessions but cannot cancel them.
          </p>
          <CollaboratorInput
            value={collaboratorDraft}
            onChange={setCollaboratorDraft}
            currentUser={userName}
            onValidatingChange={setIsCollaboratorValidation}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={closeCollaboratorEditor}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={saveCollaborators}
              disabled={isSavingCollaborators || isCollaboratorValidation}
              className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300 dark:bg-purple-500 dark:hover:bg-purple-400 dark:disabled:bg-purple-900/40"
            >
              {isSavingCollaborators ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </ActionModal>
      )}

      {favoriteEditor && (
        <ActionModal
          title={favoriteEditor.favorite ? 'Update favourite' : 'Add to favourites'}
          onClose={closeFavoriteModal}
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Choose a name for this booking to quickly reapply its devices later.
            </p>
            <input
              type="text"
              value={favoriteName}
              onChange={(e) => setFavoriteName(e.target.value)}
              placeholder="Favourite name"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeFavoriteModal}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                disabled={isSavingFavorite}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFavorite}
                disabled={isSavingFavorite}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
              >
                {isSavingFavorite ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </ActionModal>
      )}

      {deviceManager && (() => {
        const deviceGallery = buildGalleryEntries(deviceManager);
        return (
          <ActionModal
            title="Manage individual device bookings"
            onClose={() => !isProcessing && setDeviceManager(null)}
          >
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Manage bookings for each device in this session individually.
              </p>
              {deviceGallery.map((item, idx) => {
                const device = (deviceManager.devices || []).find(
                  d => (d.device_name || d.deviceName) === item.deviceName
                );
                if (!device) return null;
              
              return (
                <div
                  key={`device-${idx}`}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {item.deviceName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {item.deviceType}
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-1 text-[11px] text-gray-600 dark:text-gray-300 mb-3">
                    {item.ranges.map((range, rangeIdx) => (
                      <li key={rangeIdx}>
                        {formatRange(range.start, range.end)}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => openDeviceRebook(device, deviceManager)}
                      disabled={isProcessing}
                      className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
                    >
                      Rebook
                    </button>
                    <button
                      onClick={() => openDeviceExtend(device, deviceManager)}
                      disabled={isProcessing}
                      className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:disabled:bg-emerald-900/40"
                    >
                      Extend
                    </button>
                    <button
                      onClick={() => handleDeviceCancel(device, deviceManager)}
                      disabled={isProcessing}
                      className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300 dark:bg-red-500 dark:hover:bg-red-400 dark:disabled:bg-red-900/40"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => openDeviceCollaboratorEditor(device, deviceManager)}
                      className="inline-flex items-center justify-center rounded-md bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:hover:bg-purple-900/60"
                    >
                      Edit collaborators
                    </button>
                  </div>
                </div>
              );
              })}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => !isProcessing && setDeviceManager(null)}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Close
                </button>
              </div>
            </div>
          </ActionModal>
        );
      })()}

      {deviceRebookForm.device && (
        <ActionModal
          title="Rebook device"
          onClose={() => !isProcessing && setDeviceRebookForm({ start: '', end: '', message: '', device: null })}
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Choose a new window for {deviceRebookForm.device.device_name || deviceRebookForm.device.deviceName}.
          </p>
          <div className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Start date</span>
              <input
                type="date"
                value={deviceRebookForm.start}
                onChange={(e) => setDeviceRebookForm((prev) => ({ ...prev, start: e.target.value }))}
                className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                style={{ 
                  '--tw-ring-color': `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '';
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">End date</span>
              <input
                type="date"
                value={deviceRebookForm.end}
                onChange={(e) => setDeviceRebookForm((prev) => ({ ...prev, end: e.target.value }))}
                className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                style={{ 
                  '--tw-ring-color': `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '';
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Optional message</span>
              <textarea
                rows={2}
                value={deviceRebookForm.message}
                onChange={(e) => setDeviceRebookForm((prev) => ({ ...prev, message: e.target.value }))}
                placeholder="Add context for approvers..."
                className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                style={{ 
                  '--tw-ring-color': `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '';
                }}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => !isProcessing && setDeviceRebookForm({ start: '', end: '', message: '', device: null })}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Close
              </button>
              <button
                onClick={handleDeviceRebook}
                disabled={isProcessing}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: `hsl(var(--accent-hue), var(--accent-saturation), var(--accent-lightness))` }}
              >
                {isProcessing ? 'Submitting…' : 'Create new session'}
              </button>
            </div>
          </div>
        </ActionModal>
      )}

      {deviceExtendDate.device && (
        <ActionModal
          title="Extend device booking"
          onClose={() => !isProcessing && setDeviceExtendDate({ date: '', device: null })}
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Extend the end date for {deviceExtendDate.device.device_name || deviceExtendDate.device.deviceName}.
          </p>
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">New end date</span>
            <input
              type="date"
              value={deviceExtendDate.date}
              min={deviceManager?.end_date}
              onChange={(e) => setDeviceExtendDate((prev) => ({ ...prev, date: e.target.value }))}
              className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => !isProcessing && setDeviceExtendDate({ date: '', device: null })}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Close
            </button>
            <button
              onClick={handleDeviceExtend}
              disabled={isProcessing}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:disabled:bg-emerald-900/40"
            >
              {isProcessing ? 'Updating…' : 'Extend session'}
            </button>
          </div>
        </ActionModal>
      )}

      {deviceCollaboratorEditor && (
        <ActionModal
          title="Edit collaborators"
          onClose={() => !isSavingCollaborators && setDeviceCollaboratorEditor(null)}
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Add usernames to share access to this device booking.
          </p>
          <CollaboratorInput
            value={deviceCollaboratorDraft}
            onChange={setDeviceCollaboratorDraft}
            currentUser={userName}
            onValidatingChange={setIsCollaboratorValidation}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => !isSavingCollaborators && setDeviceCollaboratorEditor(null)}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={saveDeviceCollaborators}
              disabled={isSavingCollaborators || isCollaboratorValidation}
              className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300 dark:bg-purple-500 dark:hover:bg-purple-400 dark:disabled:bg-purple-900/40"
            >
              {isSavingCollaborators ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </ActionModal>
      )}
    </div>
  );
}

