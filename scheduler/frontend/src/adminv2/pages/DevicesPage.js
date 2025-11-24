import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import useBulkSelection from '../hooks/useBulkSelection';
import {
  fetchDevices,
  updateDeviceOwner,
  updateDeviceStatus,
  updateDeviceTags,
} from '../api';
import DataTable from '../components/DataTable';
import FilterBar from '../components/FilterBar';
import { formatDateTime } from '../utils/formatters';
import { useToastContext } from '../../contexts/ToastContext';
import { useAdminContext } from '../context/AdminContext';
import { canEditDevices } from '../utils/permissions';

const STATUS_OPTIONS = ['Available', 'Maintenance', 'Offline'];

export default function DevicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToastContext();
  const queryClient = useQueryClient();
  const { permissions } = useAdminContext();

  const params = useMemo(() => {
    const status = searchParams.get('status') || undefined;
    const owner = searchParams.get('owner') || undefined;
    const tag = searchParams.get('tag') || undefined;
    return { status, owner, tag };
  }, [searchParams]);

  const devicesQuery = useQuery({
    queryKey: ['admin-devices', params],
    queryFn: () => fetchDevices(params),
    keepPreviousData: true,
  });

  const selection = useBulkSelection(devicesQuery.data?.items || [], (row) => row.id);

  const statusMutation = useMutation({
    mutationFn: ({ status }) =>
      updateDeviceStatus({ device_ids: Array.from(selection.state.ids), status }),
    onSuccess: async () => {
      toast.success('Device status updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
      selection.clear();
    },
    onError: (err) => toast.error(err?.message || 'Unable to update device status.'),
  });

  const ownerMutation = useMutation({
    mutationFn: ({ ownerId }) =>
      updateDeviceOwner({ device_ids: Array.from(selection.state.ids), owner_id: ownerId }),
    onSuccess: async () => {
      toast.success('Device ownership updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
      selection.clear();
    },
    onError: (err) => toast.error(err?.message || 'Unable to assign owner.'),
  });

  const tagsMutation = useMutation({
    mutationFn: ({ tags, mode }) =>
      updateDeviceTags({ device_ids: Array.from(selection.state.ids), tags, mode }),
    onSuccess: async () => {
      toast.success('Device tags updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
      selection.clear();
    },
    onError: (err) => toast.error(err?.message || 'Unable to update tags.'),
  });

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (row) => (
          <div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{row.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{row.type}</div>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {row.status}
          </span>
        ),
      },
      {
        key: 'owner',
        header: 'Owner',
        render: (row) => (row.owner?.username ? row.owner.username : '—'),
      },
      {
        key: 'tags',
        header: 'Tags',
        render: (row) =>
          row.tags && row.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {row.tags.map((tag) => (
                <span key={tag} className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">No tags</span>
          ),
      },
      {
        key: 'last_updated',
        header: 'Updated',
        render: (row) => (row.last_updated ? formatDateTime(row.last_updated) : '—'),
      },
    ],
    []
  );

  const filterChips = useMemo(() => {
    const chips = [];
    const status = searchParams.get('status');
    if (status) {
      chips.push({
        key: `status-${status}`,
        label: `Status: ${status}`,
        active: true,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          next.delete('status');
          setSearchParams(next, { replace: true });
        },
      });
    }
    const owner = searchParams.get('owner');
    if (owner) {
      chips.push({
        key: `owner-${owner}`,
        label: `Owner: ${owner}`,
        active: true,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          next.delete('owner');
          setSearchParams(next, { replace: true });
        },
      });
    }
    const tag = searchParams.get('tag');
    if (tag) {
      chips.push({
        key: `tag-${tag}`,
        label: `Tag: ${tag}`,
        active: true,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          next.delete('tag');
          setSearchParams(next, { replace: true });
        },
      });
    }
    STATUS_OPTIONS.forEach((option) => {
      chips.push({
        key: `option-${option}`,
        label: option,
        active: option === status,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          if (status === option) {
            next.delete('status');
          } else {
            next.set('status', option);
          }
          setSearchParams(next, { replace: true });
        },
      });
    });
    return chips;
  }, [searchParams, setSearchParams]);

  const bulkActions = () => {
    const disabled = selection.state.count === 0;
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => statusMutation.mutate({ status: 'Available' })}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          disabled={disabled || statusMutation.isPending}
        >
          Set Available
        </button>
        <button
          type="button"
          onClick={() => statusMutation.mutate({ status: 'Maintenance' })}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60"
          disabled={disabled || statusMutation.isPending}
        >
          Set Maintenance
        </button>
        <button
          type="button"
          onClick={() => statusMutation.mutate({ status: 'Offline' })}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
          disabled={disabled || statusMutation.isPending}
        >
          Set Offline
        </button>
        <button
          type="button"
          onClick={() => {
            const input = window.prompt('Enter owner user ID (leave blank to clear):');
            if (input === null) return;
            const ownerId = input.trim() === '' ? null : Number(input.trim());
            ownerMutation.mutate({ ownerId });
          }}
          className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60"
          disabled={disabled || ownerMutation.isPending}
        >
          Assign owner
        </button>
        <button
          type="button"
          onClick={() => {
            const input = window.prompt('Enter comma-separated tags to set:');
            if (input === null) return;
            const tags = input
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean);
            tagsMutation.mutate({ tags, mode: 'set' });
          }}
          className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60"
          disabled={disabled || tagsMutation.isPending}
        >
          Set tags
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Devices inventory</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          View device health, ownership, and apply bulk actions.
        </p>
      </div>

      <FilterBar
        filters={filterChips}
        onReset={() => {
          const next = new URLSearchParams();
          setSearchParams(next, { replace: true });
        }}
      />

      <DataTable
        rows={devicesQuery.data?.items || []}
        columns={columns}
        selection={canEditDevices(permissions) ? selection : null}
        bulkActions={canEditDevices(permissions) ? bulkActions : null}
        loading={devicesQuery.status === 'pending'}
      />
    </div>
  );
}

