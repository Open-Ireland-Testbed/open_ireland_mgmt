import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchTopologies, actOnTopology } from '../api';
import DataTable from '../components/DataTable';
import FilterBar from '../components/FilterBar';
import { formatDateTime } from '../utils/formatters';
import { useToastContext } from '../../contexts/ToastContext';
import { useAdminContext } from '../context/AdminContext';
import { canActOnTopologies } from '../utils/permissions';

const STATUS_FILTERS = [
  { key: '', label: 'Submitted' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'archived', label: 'Archived' },
];

export default function TopologiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToastContext();
  const { permissions } = useAdminContext();
  const queryClient = useQueryClient();

  const status = searchParams.get('status') || undefined;

  const topologiesQuery = useQuery({
    queryKey: ['admin-topologies', { status }],
    queryFn: () => fetchTopologies({ status }),
  });

  const { mutate: performTopologyAction, isPending: actionPending } = useMutation({
    mutationFn: ({ topologyId, action }) => actOnTopology(topologyId, { action }),
    onSuccess: async () => {
      toast.success('Topology updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin-topologies'] });
    },
    onError: (err) => toast.error(err?.message || 'Unable to update topology.'),
  });

  const columns = useMemo(() => {
    const base = [
      {
        key: 'name',
        header: 'Topology',
        render: (row) => (
          <div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{row.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">#{row.id}</div>
          </div>
        ),
      },
      {
        key: 'submitted_by',
        header: 'Submitted by',
        accessor: (row) => row.submitted_by || '—',
      },
      {
        key: 'status',
        header: 'Status',
        accessor: (row) => row.status,
      },
      {
        key: 'conflicts',
        header: 'Conflicts',
        accessor: (row) => row.conflict_count,
      },
      {
        key: 'submitted_at',
        header: 'Submitted',
        render: (row) => formatDateTime(row.submitted_at),
      },
    ];
    if (canActOnTopologies(permissions)) {
      base.push({
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => performTopologyAction({ topologyId: row.id, action: 'resolve' })}
              disabled={actionPending}
              className="px-2 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Resolve
            </button>
            <button
              type="button"
              onClick={() => performTopologyAction({ topologyId: row.id, action: 'archive' })}
              disabled={actionPending}
              className="px-2 py-1 rounded-md bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-60"
            >
              Archive
            </button>
          </div>
        ),
      });
    }
    return base;
  }, [performTopologyAction, actionPending, permissions]);

  const filterChips = useMemo(() => {
    return STATUS_FILTERS.map((filter) => {
      const isActive = (status || '') === filter.key;
      return {
        key: `status-${filter.key || 'submitted'}`,
        label: filter.label,
        active: isActive,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          if (isActive) {
            next.delete('status');
          } else if (filter.key) {
            next.set('status', filter.key);
          } else {
            next.delete('status');
          }
          setSearchParams(next, { replace: true });
        },
      };
    });
  }, [searchParams, setSearchParams, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Topologies</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Evaluate submissions, resolve conflicts, and export templates.
          </p>
        </div>
        {canActOnTopologies(permissions) && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            Use row selection to resolve or archive.
          </div>
        )}
      </div>

      <FilterBar
        filters={filterChips}
        onReset={() => setSearchParams(new URLSearchParams(), { replace: true })}
      />

      <DataTable
        rows={topologiesQuery.data?.items || []}
        columns={columns}
        loading={topologiesQuery.status === 'pending'}
      />
    </div>
  );
}

