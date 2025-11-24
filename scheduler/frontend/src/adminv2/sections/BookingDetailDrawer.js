import React, { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchBookingDetail, approveBookings, declineBookings } from '../api';
import { formatDateTime } from '../utils/formatters';
import { useToastContext } from '../../contexts/ToastContext';
import { useAdminContext } from '../context/AdminContext';
import { canEditBookings } from '../utils/permissions';

function Timeline({ label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-2">{label}</div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={`${label}-${item.booking_id}`} className="border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {formatDateTime(item.start_time)} → {formatDateTime(item.end_time)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Status: {item.status}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Owner: {item.owner?.username}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConflictList({ conflicts }) {
  if (!conflicts || conflicts.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No overlapping bookings detected.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {conflicts.map((conflict) => (
        <li key={conflict.booking_id} className="border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2">
          <div className="text-sm font-semibold text-orange-700 dark:text-orange-200">
            Booking #{conflict.booking_id} · {conflict.owner?.username}
          </div>
          <div className="text-xs text-orange-600 dark:text-orange-300">
            {formatDateTime(conflict.overlap_start)} → {formatDateTime(conflict.overlap_end)} ({conflict.status})
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function BookingDetailDrawer({ bookingId, open, onClose }) {
  const toast = useToastContext();
  const { permissions } = useAdminContext();
  const queryClient = useQueryClient();

  const bookingQuery = useQuery({
    queryKey: ['admin-booking-detail', bookingId],
    queryFn: () => fetchBookingDetail(bookingId),
    enabled: open && Boolean(bookingId),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveBookings({ booking_ids: [bookingId] }),
    onSuccess: async () => {
      toast.success('Booking approved.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-booking-detail', bookingId] }),
      ]);
      onClose?.();
    },
    onError: (err) => toast.error(err?.message || 'Unable to approve booking.'),
  });

  const declineMutation = useMutation({
    mutationFn: () => declineBookings({ booking_ids: [bookingId] }),
    onSuccess: async () => {
      toast.success('Booking declined.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-booking-detail', bookingId] }),
      ]);
      onClose?.();
    },
    onError: (err) => toast.error(err?.message || 'Unable to decline booking.'),
  });

  useEffect(() => {
    if (!open) return;
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const booking = bookingQuery.data?.booking;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
        role="presentation"
      />
      <aside className="relative z-10 w-full max-w-xl h-full bg-white dark:bg-gray-950 shadow-xl border-l border-gray-200 dark:border-gray-800 overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Booking detail</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              #{bookingId}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Close
          </button>
        </div>

        {bookingQuery.status === 'pending' ? (
          <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Loading booking details…</div>
        ) : bookingQuery.status === 'error' ? (
          <div className="p-6 text-sm text-red-600 dark:text-red-300">
            Unable to load booking details. Please try again later.
          </div>
        ) : booking ? (
          <div className="p-6 space-y-6">
            <section>
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-2">
                Summary
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">User</span>
                  <span className="text-gray-900 dark:text-gray-100">{booking.user.username}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Device</span>
                  <span className="text-gray-900 dark:text-gray-100">{booking.device.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Status</span>
                  <span className="text-gray-900 dark:text-gray-100">{booking.status}</span>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Comment</div>
                  <div className="mt-1 text-gray-900 dark:text-gray-100 text-sm">
                    {booking.comment || '—'}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <Timeline label="Timeline" items={bookingQuery.data.timeline} />
            </section>

            <section>
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-2">
                Conflicts
              </div>
              <ConflictList conflicts={bookingQuery.data.conflicts} />
            </section>

            {bookingQuery.data.device_health && (
              <section>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-2">
                  Device health snapshot
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-200">
                  <div>Status: {bookingQuery.data.device_health.status}</div>
                  {bookingQuery.data.device_health.heartbeat_at && (
                    <div>Last heartbeat: {formatDateTime(bookingQuery.data.device_health.heartbeat_at)}</div>
                  )}
                </div>
              </section>
            )}

            <section>
              <Timeline label="Historical usage" items={bookingQuery.data.history} />
            </section>

            {canEditBookings(permissions) && (
              <section>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => declineMutation.mutate()}
                    disabled={declineMutation.isPending}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    Decline
                  </button>
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Booking not found.</div>
        )}
      </aside>
    </div>
  );
}

