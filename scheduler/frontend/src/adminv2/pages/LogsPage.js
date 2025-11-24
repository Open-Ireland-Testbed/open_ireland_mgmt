import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchLogs } from '../api';
import DataTable from '../components/DataTable';
import FilterBar from '../components/FilterBar';
import { formatDateTime } from '../utils/formatters';
import DateRangeControls from '../components/DateRangeControls';
import usePersistentState from '../hooks/usePersistentState';

const ACTIONS = ['approve_bookings', 'decline_bookings', 'update_settings', 'update_device_status'];

export default function LogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dateRange, setDateRange] = usePersistentState('admin-logs-date-range', {
    start: null,
    end: null,
    preset: 'This Week',
  });

  const params = useMemo(() => {
    const action = searchParams.get('action') || undefined;
    const actor = searchParams.get('actor') || undefined;
    const scope = searchParams.get('scope') || undefined;
    const payload = {
      action,
      entity_type: scope,
      actor,
      date_start: dateRange?.start || undefined,
      date_end: dateRange?.end || undefined,
    };
    return payload;
  }, [dateRange, searchParams]);

  const logsQuery = useQuery({
    queryKey: ['admin-logs', params],
    queryFn: () => fetchLogs(params),
  });

  const columns = useMemo(
    () => [
      {
        key: 'timestamp',
        header: 'Time',
        render: (row) => formatDateTime(row.timestamp),
      },
      {
        key: 'actor',
        header: 'Actor',
        render: (row) => row.actor?.name || 'System',
      },
      {
        key: 'action',
        header: 'Action',
        accessor: (row) => row.action,
      },
      {
        key: 'entity',
        header: 'Entity',
        render: (row) => (row.entity ? `${row.entity.type}:${row.entity.id}` : '—'),
      },
      {
        key: 'outcome',
        header: 'Outcome',
        accessor: (row) => row.outcome || 'success',
      },
    ],
    []
  );

  const filterChips = useMemo(() => {
    const chips = [];
    const action = searchParams.get('action');
    ACTIONS.forEach((item) => {
      const isActive = action === item;
      chips.push({
        key: `action-${item}`,
        label: item,
        active: isActive,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          if (isActive) {
            next.delete('action');
          } else {
            next.set('action', item);
          }
          setSearchParams(next, { replace: true });
        },
      });
    });
    const actor = searchParams.get('actor');
    if (actor) {
      chips.push({
        key: `actor-${actor}`,
        label: `Actor: ${actor}`,
        active: true,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          next.delete('actor');
          setSearchParams(next, { replace: true });
        },
      });
    }
    return chips;
  }, [searchParams, setSearchParams]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Logs & audit</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Track who did what, when, and why.
        </p>
      </div>

      <DateRangeControls storageKey="admin-logs" value={dateRange} onChange={setDateRange} />

      <FilterBar
        filters={filterChips}
        onReset={() => setSearchParams(new URLSearchParams(), { replace: true })}
      />

      <DataTable
        rows={logsQuery.data?.items || []}
        columns={columns}
        loading={logsQuery.status === 'pending'}
      />
    </div>
  );
}

