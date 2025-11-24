import React, { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { fetchBookingDetail, approveBookings, declineBookings } from '../api';
import { useToastContext } from '../../contexts/ToastContext';
import { useAdminContext } from '../context/AdminContext';
import { canEditBookings } from '../utils/permissions';
import { formatDateTime } from '../utils/formatters';

dayjs.extend(relativeTime);

function GridPlaceholder({ booking, overlaps }) {
  if (!booking) return null;
  const weekStart = dayjs(booking.start_time).startOf('week');
  const cells = Array.from({ length: 7 }).map((_, idx) => weekStart.add(idx, 'day'));

  const cellClass = (cell) => {
    const start = dayjs(booking.start_time);
    const end = dayjs(booking.end_time);
    if (cell.isSame(start, 'day')) return 'bg-blue-500 text-white';
    if (cell.isAfter(start, 'day') && cell.isBefore(end, 'day')) return 'bg-blue-200 text-blue-800';
    return 'bg-slate-100 text-slate-500';
  };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
        Week of {weekStart.format('MMM D')}
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold">
        {cells.map((cell) => (
          <div
            key={cell.toISOString()}
            className={`rounded-md px-2 py-3 ${cellClass(cell)}`}
            title={cell.format('MMM D, YYYY')}
          >
            {cell.format('dd')}
          </div>
        ))}
      </div>
      {overlaps?.length ? (
        <div className="mt-3 space-y-1 text-xs text-amber-600 dark:text-amber-300">
          {overlaps.map((item) => (
            <div key={`conflict-${item.booking_id}`} className="flex items-center justify-between rounded bg-amber-50 dark:bg-amber-900/20 px-2 py-1">
              <span>Conflict with #{item.booking_id}</span>
              <span>{formatDateTime(item.overlap_start)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-xs text-emerald-600 dark:text-emerald-300">
          No conflicts detected in the requested window.
        </div>
      )}
    </div>
  );
}

export default function ApprovalPreviewDrawer({ bookingId, open, onClose }) {
  const toast = useToastContext();
  const { permissions } = useAdminContext();
  const queryClient = useQueryClient();

  const bookingQuery = useQuery({
    queryKey: ['admin-approval-detail', bookingId],
    queryFn: () => fetchBookingDetail(bookingId),
    enabled: open && Boolean(bookingId),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveBookings({ booking_ids: [bookingId] }),
    onSuccess: async () => {
      toast.success('Request approved.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-approvals'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-approval-detail', bookingId] }),
      ]);
      onClose?.();
    },
    onError: (err) => toast.error(err?.message || 'Unable to approve request.'),
  });

  const declineMutation = useMutation({
    mutationFn: () => declineBookings({ booking_ids: [bookingId] }),
    onSuccess: async () => {
      toast.success('Request declined.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-approvals'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-approval-detail', bookingId] }),
      ]);
      onClose?.();
    },
    onError: (err) => toast.error(err?.message || 'Unable to decline request.'),
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
      <div className="fixed inset-0 bg-black/40" onClick={onClose} role="presentation" />
      <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Approval preview
            </div>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">Request #{bookingId}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Close
          </button>
        </div>

        {bookingQuery.status === 'pending' ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading request details…</div>
        ) : bookingQuery.status === 'error' ? (
          <div className="p-6 text-sm text-rose-600 dark:text-rose-300">
            Unable to load approval context. Please refresh and try again.
          </div>
        ) : booking ? (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/20 p-4">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{booking.user.username}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Requested {dayjs(booking.start_time).fromNow()}</div>
                </div>
                <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(booking.start_time)} → {formatDateTime(booking.end_time)}
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Device</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{booking.device.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Type</span>
                  <span>{booking.device.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                    {booking.status}
                  </span>
                </div>
              </div>
            </section>

            <section>
              <GridPlaceholder booking={booking} overlaps={bookingQuery.data?.conflicts} />
            </section>

            <section>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Activity
              </div>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                {bookingQuery.data?.history?.slice(0, 4).map((item) => (
                  <li key={`history-${item.booking_id}`} className="rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">#{item.booking_id}</span>
                      <span>{formatDateTime(item.start_time)}</span>
                    </div>
                    <div className="mt-1 text-slate-500 dark:text-slate-400">{item.status}</div>
                  </li>
                ))}
                {!bookingQuery.data?.history?.length && (
                  <li className="rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2 text-slate-400">
                    No recent activity. This looks like a first-time booking.
                  </li>
                )}
              </ul>
            </section>

            <section>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Device health
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 text-sm text-slate-600 dark:text-slate-300">
                <div>Status: {bookingQuery.data?.device_health?.status || 'Healthy'}</div>
                {bookingQuery.data?.device_health?.heartbeat_at && (
                  <div>Last heartbeat: {formatDateTime(bookingQuery.data.device_health.heartbeat_at)}</div>
                )}
                {bookingQuery.data?.device_health?.metrics && (
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-500 dark:text-slate-400">
                    {JSON.stringify(bookingQuery.data.device_health.metrics, null, 2)}
                  </pre>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Request not found.</div>
        )}

        {canEditBookings(permissions) && (
          <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Resolve & Approve
            </button>
            <button
              type="button"
              onClick={() => declineMutation.mutate()}
              disabled={declineMutation.isPending}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => toast.info('Coming soon: request changes with comment.')}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Request change
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

