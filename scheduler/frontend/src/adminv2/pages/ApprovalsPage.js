import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import useBulkSelection from '../hooks/useBulkSelection';
import { useToastContext } from '../../contexts/ToastContext';
import { useAdminContext } from '../context/AdminContext';
import {
  fetchBookings,
  approveBookings,
  declineBookings,
  resolveConflicts,
} from '../api';
import DataTable from '../components/DataTable';
import FilterBar from '../components/FilterBar';
import ApprovalPreviewDrawer from '../sections/ApprovalPreviewDrawer';
import {
  canEditBookings,
  canExportBookings,
} from '../utils/permissions';
import { formatDateTime, formatRelative } from '../utils/formatters';
import { API_BASE_URL } from '../../config/api';
import useDateRangeStore from '../state/useDateRangeStore';

dayjs.extend(relativeTime);

const DEVICE_TYPES = [
  '8 PSM',
  'ROADM',
  'ILA',
  'OSA',
  'EDFA',
  'Fiber',
  'Switch',
  'PDU',
];

const STATUS_FILTERS = [
  { key: 'pending', label: 'Pending', query: 'PENDING' },
  { key: 'escalated', label: 'Escalated', query: 'CONFLICTING' },
  { key: 'flagged', label: 'Flagged', query: 'ALL' },
  { key: 'all', label: 'All', query: 'ALL' },
];

const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'next-week', label: 'Next Week' },
  { key: 'custom', label: 'Custom' },
];

function computeRiskScore(row) {
  let score = 20;
  if (row.conflict) score += 40;
  if (row.status === 'CONFLICTING') score += 15;
  if (row.device?.status?.toLowerCase().includes('maintenance')) score += 10;
  const hoursUntilStart = dayjs(row.start_time).diff(dayjs(), 'hour');
  if (hoursUntilStart < 4) score += 10;
  if (hoursUntilStart < 0) score += 5;
  return Math.min(100, Math.max(0, score));
}

function RiskBadge({ score }) {
  let tone = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200';
  let label = 'Low';
  if (score >= 70) {
    tone = 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200';
    label = 'Critical';
  } else if (score >= 40) {
    tone = 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
    label = 'High';
  } else if (score >= 25) {
    tone = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200';
    label = 'Moderate';
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      {label} · {score}
    </span>
  );
}

function ConflictStrip({ hasConflict }) {
  return (
    <div
      className={[
        'h-2 w-full rounded-full',
        hasConflict ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-rose-700' : 'bg-gradient-to-r from-emerald-400 to-blue-500',
      ].join(' ')}
      aria-hidden="true"
    />
  );
}

function buildQuery(searchParams, dateRange) {
  const statusKey = searchParams.get('status') || 'pending';
  const filter = STATUS_FILTERS.find((item) => item.key === statusKey) ?? STATUS_FILTERS[0];
  const params = {
    status: filter.query !== 'ALL' ? filter.query : undefined,
    device_type: searchParams.get('deviceType') || undefined,
    conflict_only: searchParams.get('conflictOnly') === '1' ? true : undefined,
    search: searchParams.get('q') || undefined,
    limit: 50,
    offset: 0,
    sort: searchParams.get('sort') || 'start_time:asc',
  };
  if (dateRange?.start) params.date_start = dateRange.start;
  if (dateRange?.end) params.date_end = dateRange.end;
  return params;
}

export default function ApprovalsPage() {
  const { permissions } = useAdminContext();
  const toast = useToastContext();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [focusedBookingId, setFocusedBookingId] = useState(null);
  const [viewMode, setViewMode] = useState('table');
  const globalRange = useDateRangeStore((state) => state.getRange('approvals'));
  const setRange = useDateRangeStore((state) => state.setRange);
  const [datePreset, setDatePreset] = useState(globalRange?.preset || 'This Week');

  useEffect(() => {
    if (!searchParams.get('status')) {
      const next = new URLSearchParams(searchParams);
      next.set('status', 'pending');
      setSearchParams(next, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!globalRange) {
      setRange('approvals', {
        start: dayjs().startOf('week').format('YYYY-MM-DD'),
        end: dayjs().endOf('week').format('YYYY-MM-DD'),
        preset: 'This Week',
      });
    }
  }, [globalRange, setRange]);

  const params = useMemo(() => buildQuery(searchParams, globalRange), [searchParams, globalRange]);

  const bookingsQuery = useQuery({
    queryKey: ['admin-approvals', params],
    queryFn: () => fetchBookings(params),
    keepPreviousData: true,
  });

  const rowsWithRisk = useMemo(() => {
    const items = bookingsQuery.data?.items || [];
    return items.map((item) => ({
      ...item,
      riskScore: computeRiskScore(item),
      relativeStart: dayjs(item.start_time).fromNow(),
      relativeEnd: dayjs(item.end_time).fromNow(),
    }));
  }, [bookingsQuery.data]);

  const flaggedFilterActive = searchParams.get('status') === 'flagged';
  const onlyConflicts = searchParams.get('conflictOnly') === '1';

  const filteredRows = useMemo(() => {
    return rowsWithRisk.filter((row) => {
      if (flaggedFilterActive && row.riskScore < 40) {
        return false;
      }
      if (onlyConflicts && !row.conflict) {
        return false;
      }
      if (searchParams.get('deviceType')) {
        return row.device?.type?.toLowerCase() === searchParams.get('deviceType')?.toLowerCase();
      }
      return true;
    });
  }, [rowsWithRisk, flaggedFilterActive, onlyConflicts, searchParams]);

  const selection = useBulkSelection(filteredRows, (row) => row.booking_id);

  const approveMutation = useMutation({
    mutationFn: (payload) => approveBookings(payload),
    onSuccess: async (result) => {
      toast.success(`Approved ${result.succeeded.length} requests.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
      selection.clear();
    },
    onError: (err) => toast.error(err?.message || 'Unable to approve requests.'),
  });

  const declineMutation = useMutation({
    mutationFn: (payload) => declineBookings(payload),
    onSuccess: async (result) => {
      toast.success(`Declined ${result.succeeded.length} requests.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
      selection.clear();
    },
    onError: (err) => toast.error(err?.message || 'Unable to decline requests.'),
  });

  const resolveMutation = useMutation({
    mutationFn: (payload) => resolveConflicts(payload),
    onSuccess: async () => {
      toast.success('Conflicts resolved.');
      await queryClient.invalidateQueries({ queryKey: ['admin-approvals'] });
      selection.clear();
    },
    onError: (err) => toast.error(err?.message || 'Unable to resolve conflicts.'),
  });

  const handleBulk = (action) => {
    const ids = Array.from(selection.state.ids);
    if (!ids.length) return;
    switch (action) {
      case 'approve':
        approveMutation.mutate({ booking_ids: ids, comment: undefined });
        break;
      case 'decline':
        declineMutation.mutate({ booking_ids: ids, comment: undefined });
        break;
      case 'resolve':
        resolveMutation.mutate({ resolution: ids.map((id) => ({ booking_id: id, status: 'CONFIRMED' })) });
        break;
      case 'request-change':
        toast.info('Request change flow coming soon.');
        break;
      case 'assign':
        toast.info('Assigning approvers will be available shortly.');
        break;
      case 'comment':
        toast.info('Add comment to selection – feature in progress.');
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const handler = (event) => {
      if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      if (event.metaKey || event.ctrlKey) return;
      switch (event.key) {
        case '/':
          event.preventDefault();
          const search = document.querySelector('[data-admin-search]');
          if (search) search.focus();
          break;
        case 'a':
          selection.selectAll();
          break;
        case 'x':
          if (filteredRows.length) {
            event.preventDefault();
            const first = filteredRows[0];
            selection.toggle(first);
          }
          break;
        case 'e':
          if (filteredRows.length) {
            event.preventDefault();
            setFocusedBookingId(filteredRows[0].booking_id);
          }
          break;
        case 'Enter':
          if (event.shiftKey) {
            event.preventDefault();
            handleBulk('approve');
          }
          break;
        case 'd':
          event.preventDefault();
          handleBulk('decline');
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredRows, selection]);

  const handlePresetChange = (preset) => {
    setDatePreset(preset.label);
    const now = dayjs();
    let start = now.startOf('day');
    let end = now.endOf('day');
    if (preset.key === 'week') {
      start = now.startOf('week');
      end = now.endOf('week');
    } else if (preset.key === 'next-week') {
      start = now.startOf('week').add(1, 'week');
      end = start.endOf('week');
    }
    setRange('approvals', {
      start: start.format('YYYY-MM-DD'),
      end: end.format('YYYY-MM-DD'),
      preset: preset.label,
    });
  };

  const filterChips = useMemo(() => {
    const chips = [];
    const activeStatus = searchParams.get('status') || 'pending';
    STATUS_FILTERS.forEach((filter) => {
      chips.push({
        key: `status-${filter.key}`,
        label: filter.label,
        active: activeStatus === filter.key,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          next.set('status', filter.key);
          setSearchParams(next, { replace: true });
        },
      });
    });
    const deviceType = searchParams.get('deviceType');
    DEVICE_TYPES.forEach((type) => {
      chips.push({
        key: `device-${type}`,
        label: type,
        active: deviceType === type,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          if (deviceType === type) {
            next.delete('deviceType');
          } else {
            next.set('deviceType', type);
          }
          setSearchParams(next, { replace: true });
        },
      });
    });
    const conflictsOnly = searchParams.get('conflictOnly') === '1';
    chips.push({
      key: 'conflict-only',
      label: 'Only conflict candidates',
      active: conflictsOnly,
      onRemove: () => {
        const next = new URLSearchParams(searchParams);
        if (conflictsOnly) {
          next.delete('conflictOnly');
        } else {
          next.set('conflictOnly', '1');
        }
        setSearchParams(next, { replace: true });
      },
    });
    return chips;
  }, [searchParams, setSearchParams]);

  const columns = useMemo(
    () => [
      {
        key: 'booking_id',
        header: 'Request',
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">#{row.booking_id}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{row.conflict ? 'Conflict candidate' : 'Clean slate'}</span>
          </div>
        ),
      },
      {
        key: 'user',
        header: 'User',
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-900 dark:text-slate-100">{row.user.username}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">#{row.user.id}</span>
          </div>
        ),
      },
      {
        key: 'request',
        header: 'Device / Topology',
        render: (row) => (
          <div className="flex flex-col gap-1">
            <span className="font-medium text-slate-900 dark:text-slate-100">{row.device.name}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{row.device.type}</span>
            <ConflictStrip hasConflict={row.conflict} />
          </div>
        ),
      },
      {
        key: 'date',
        header: 'Date range',
        render: (row) => (
          <div className="flex flex-col text-sm">
            <span>{formatDateTime(row.start_time)} → {formatDateTime(row.end_time)}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{row.relativeStart} · {row.relativeEnd}</span>
          </div>
        ),
      },
      {
        key: 'risk',
        header: 'Risk',
        render: (row) => <RiskBadge score={row.riskScore} />,
      },
      {
        key: 'comment',
        header: 'Comment',
        render: (row) => (
          <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2" title={row.comment || 'No comment'}>
            {row.comment || 'No comment'}
          </div>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                approveMutation.mutate({ booking_ids: [row.booking_id] });
              }}
              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                declineMutation.mutate({ booking_ids: [row.booking_id] });
              }}
              className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              Decline
            </button>
          </div>
        ),
      },
    ],
    [approveMutation, declineMutation]
  );

  const handleRowClick = (row) => {
    setFocusedBookingId(row.booking_id);
  };

  const handleDrawerClose = () => setFocusedBookingId(null);

  const handleExport = () => {
    if (!canExportBookings(permissions)) {
      toast.error('Export requires additional permissions.');
      return;
    }
    const exportParams = new URLSearchParams(searchParams);
    if (globalRange?.start) exportParams.set('date_start', globalRange.start);
    if (globalRange?.end) exportParams.set('date_end', globalRange.end);
    const url = `${API_BASE_URL}/admin/v2/bookings/export?${exportParams.toString()}`;
    toast.info('Preparing CSV export…');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Approvals</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Triage and unblock lab bookings in real time.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => handlePresetChange(preset)}
            className={[
              'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              datePreset === preset.label
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
            ].join(' ')}
          >
            {preset.label}
          </button>
        ))}
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {globalRange?.start} – {globalRange?.end}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-1 py-1 text-xs">
            {['table', 'grid', 'heatmap'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={[
                  'rounded-full px-2 py-1 font-semibold capitalize transition-colors',
                  viewMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                ].join(' ')}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => handleBulk('approve')}
            disabled={!selection.state.count}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Approve {selection.state.count || ''}
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Export queue
          </button>
        </div>
      </div>

      <FilterBar
        filters={filterChips}
        onReset={() => {
          const next = new URLSearchParams();
          setSearchParams(next, { replace: true });
        }}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="space-y-4 lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Quick actions</h2>
            <div className="mt-3 space-y-2 text-sm">
              <button
                type="button"
                onClick={() => handleBulk('resolve')}
                className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <span>Resolve conflict-free</span>
                <span className="text-xs text-slate-400">{selection.state.count}</span>
              </button>
              <button
                type="button"
                onClick={() => toast.info('Maintenance wizard coming soon.')}
                className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <span>Maintenance wizard</span>
                <span aria-hidden="true">↗</span>
              </button>
              <button
                type="button"
                onClick={() => toast.info('User provisioning coming soon.')}
                className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <span>Invite new approver</span>
                <span aria-hidden="true">+</span>
              </button>
            </div>
          </div>
        </aside>

        <section className="lg:col-span-6">
          {viewMode === 'table' ? (
            <DataTable
              rows={filteredRows}
              columns={columns}
              selection={selection}
              loading={bookingsQuery.status === 'pending'}
              bulkActions={() => (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button type="button" onClick={() => handleBulk('approve')} className="rounded-md bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700">
                    Approve
                  </button>
                  <button type="button" onClick={() => handleBulk('decline')} className="rounded-md bg-rose-600 px-3 py-1 text-white hover:bg-rose-700">
                    Decline
                  </button>
                  <button type="button" onClick={() => handleBulk('request-change')} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                    Request change
                  </button>
                  <button type="button" onClick={() => handleBulk('assign')} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                    Assign approver
                  </button>
                  <button type="button" onClick={() => handleBulk('comment')} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                    Add comment
                  </button>
                </div>
              )}
              onRowClick={handleRowClick}
              rowId={(row) => row.booking_id}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {viewMode === 'grid'
                ? 'Grid view is coming soon. Use table mode in the meantime.'
                : 'Heatmap view is coming soon. Switch to table view to continue triaging.'}
            </div>
          )}
        </section>

        <aside className="space-y-4 lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Alerts</h2>
              <span className="text-xs text-slate-400">{dayjs().format('HH:mm')}</span>
            </div>
            <ul className="mt-3 space-y-3 text-sm">
              {filteredRows
                .filter((row) => row.conflict || row.riskScore >= 70)
                .slice(0, 4)
                .map((row) => (
                  <li key={`alert-${row.booking_id}`} className="rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-2 w-2 rounded-full ${row.riskScore >= 70 ? 'bg-rose-500' : 'bg-amber-400'}`} />
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {row.device.name}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {row.conflict ? 'Conflict detected · requires resolution.' : 'High contention risk pending approval.'}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>{formatRelative(row.start_time)}</span>
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        onClick={() => setFocusedBookingId(row.booking_id)}
                      >
                        Assign
                      </button>
                    </div>
                  </li>
                ))}
              {!filteredRows.some((row) => row.conflict || row.riskScore >= 70) && (
                <li className="rounded-md border border-slate-200 dark:border-slate-800 px-3 py-4 text-xs text-slate-500 dark:text-slate-400">
                  No active alerts. Tip: broaden filters or switch to “All”.
                </li>
              )}
            </ul>
          </div>
        </aside>
      </div>

      <ApprovalPreviewDrawer
        bookingId={focusedBookingId}
        open={Boolean(focusedBookingId)}
        onClose={handleDrawerClose}
      />
    </div>
  );
}

