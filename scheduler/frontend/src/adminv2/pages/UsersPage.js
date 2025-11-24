import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchUsers, inviteUser, updateUserRole, updateUserStatus } from '../api';
import DataTable from '../components/DataTable';
import FilterBar from '../components/FilterBar';
import { useToastContext } from '../../contexts/ToastContext';
import { useAdminContext } from '../context/AdminContext';
import { canEditUsers } from '../utils/permissions';
import useBulkSelection from '../hooks/useBulkSelection';

const ROLE_TABS = [
  { key: '', label: 'All users' },
  { key: 'Admin', label: 'Admins' },
  { key: 'Approver', label: 'Approvers' },
  { key: 'Viewer', label: 'Viewers' },
];

export default function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToastContext();
  const queryClient = useQueryClient();
  const { permissions } = useAdminContext();

  const role = searchParams.get('role') || undefined;
  const status = searchParams.get('status') || undefined;

  const usersQuery = useQuery({
    queryKey: ['admin-users', { role, status }],
    queryFn: () => fetchUsers({ role, status }),
    keepPreviousData: true,
  });

  const selection = useBulkSelection(usersQuery.data?.items || [], (row) => row.id);

  const inviteMutation = useMutation({
    mutationFn: (payload) => inviteUser(payload),
    onSuccess: () => {
      toast.success('Invitation created.');
    },
    onError: (err) => toast.error(err?.message || 'Unable to send invitation.'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, newRole }) => updateUserRole(userId, { role: newRole }),
    onSuccess: async () => {
      toast.success('Role updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(err?.message || 'Unable to update role.'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, nextStatus }) => updateUserStatus(userId, { status: nextStatus }),
    onSuccess: async () => {
      toast.success('Status updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(err?.message || 'Unable to update status.'),
  });

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (row) => (
          <div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{row.username}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{row.email || 'No email'}</div>
          </div>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        render: (row) => (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
            {row.role}
          </span>
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
        key: 'bookings',
        header: 'Bookings',
        accessor: (row) => row.bookings_count,
      },
      {
        key: 'last_active',
        header: 'Last active',
        render: (row) => (row.last_active ? new Date(row.last_active).toLocaleString() : '—'),
      },
    ],
    []
  );

  const filterChips = useMemo(() => {
    const chips = [];
    ROLE_TABS.forEach((tab) => {
      const isActive = (role || '') === tab.key;
      chips.push({
        key: `role-${tab.key || 'all'}`,
        label: tab.label,
        active: isActive,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          if (isActive) {
            next.delete('role');
          } else if (tab.key) {
            next.set('role', tab.key);
          } else {
            next.delete('role');
          }
          setSearchParams(next, { replace: true });
        },
      });
    });
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
    return chips;
  }, [role, status, searchParams, setSearchParams]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users & roles</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage admin access, approvals, and visibility.
          </p>
        </div>
        {canEditUsers(permissions) && (
          <button
            type="button"
            onClick={() => {
              const email = window.prompt('Enter email or handle to invite:');
              if (!email) return;
              const roleInput = window.prompt('Assign role (Super Admin, Admin, Approver, Viewer):', 'Viewer');
              if (!roleInput) return;
              inviteMutation.mutate({ email, role: roleInput });
            }}
            className="px-3 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Invite user
          </button>
        )}
      </div>

      <FilterBar
        filters={filterChips}
        onReset={() => setSearchParams(new URLSearchParams(), { replace: true })}
      />

      <DataTable
        rows={usersQuery.data?.items || []}
        columns={columns}
        selection={canEditUsers(permissions) ? selection : null}
        bulkActions={
          canEditUsers(permissions)
            ? () => (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const roleInput = window.prompt('Set role for selected users:', 'Viewer');
                      if (!roleInput) return;
                      Array.from(selection.state.ids).forEach((userId) =>
                        roleMutation.mutate({ userId, newRole: roleInput })
                      );
                      selection.clear();
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Set role
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextStatus = window.prompt('Set status (active/disabled):', 'active');
                      if (!nextStatus) return;
                      Array.from(selection.state.ids).forEach((userId) =>
                        statusMutation.mutate({ userId, nextStatus })
                      );
                      selection.clear();
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Set status
                  </button>
                </div>
              )
            : null
        }
        loading={usersQuery.status === 'pending'}
      />
    </div>
  );
}

