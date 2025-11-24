import React, { useState, useMemo, useCallback } from 'react';
import { PageHeader, Button, Card, Table, Modal, Alert } from '@tcdona/ui';
import { useDeviceTypes, useCreateDeviceType, useUpdateDeviceType, useDeleteDeviceType } from '../hooks/useInventoryData';
import { useToastContext } from '../contexts/ToastContext';
import DeviceTypeForm from '../components/DeviceTypeForm';

export default function DeviceTypesPage() {
  const toast = useToastContext();
  const { data, isLoading, isError, error } = useDeviceTypes();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const createMutation = useCreateDeviceType();
  const updateMutation = useUpdateDeviceType();
  const deleteMutation = useDeleteDeviceType();

  const handleCreate = useCallback(
    (payload) => {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Device type created successfully');
          setIsCreateOpen(false);
        },
        onError: (err) => {
          toast.error(err?.message || 'Failed to create device type');
        },
      });
    },
    [createMutation, toast]
  );

  const handleUpdate = useCallback(
    (payload) => {
      updateMutation.mutate(
        { id: editingType.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Device type updated successfully');
            setIsEditOpen(false);
            setEditingType(null);
          },
          onError: (err) => {
            toast.error(err?.message || 'Failed to update device type');
          },
        }
      );
    },
    [editingType, updateMutation, toast]
  );

  const handleDelete = useCallback(
    (id) => {
      if (window.confirm('This device type may be in use by devices. Are you sure you want to delete it?')) {
        setDeletingId(id);
        deleteMutation.mutate(id, {
          onSuccess: () => {
            toast.success('Device type deleted successfully');
            setDeletingId(null);
          },
          onError: (err) => {
            toast.error(err?.message || 'Failed to delete device type. It may be in use by devices.');
            setDeletingId(null);
          },
        });
      }
    },
    [deleteMutation, toast]
  );

  const handleEdit = useCallback((type) => {
    setEditingType(type);
    setIsEditOpen(true);
  }, []);

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        accessor: (row) => row.name,
      },
      {
        key: 'category',
        header: 'Category',
        accessor: (row) => row.category,
      },
      {
        key: 'is_schedulable',
        header: 'Schedulable',
        accessor: (row) => (row.is_schedulable ? 'Yes' : 'No'),
      },
      {
        key: 'has_ports',
        header: 'Has Ports',
        accessor: (row) => (row.has_ports ? 'Yes' : 'No'),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row);
              }}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row.id);
              }}
              disabled={deletingId === row.id}
              loading={deletingId === row.id}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [handleEdit, handleDelete, deletingId]
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Device Types"
        subtitle="Manage catalog of device types (EDFA, ROADM, Server, etc.)"
        actions={
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            Add Device Type
          </Button>
        }
      />

      {isError && (
        <Alert type="error" className="mt-6">
          {error?.message || 'Failed to load device types'}
        </Alert>
      )}

      <div className="mt-6">
        <Table
          columns={columns}
          rows={data || []}
          loading={isLoading}
          emptyState={
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-950 p-6 text-center">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                No device types found
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Get started by adding a device type.
              </p>
            </div>
          }
        />
      </div>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Device Type" size="md">
        <DeviceTypeForm
          mode="create"
          initialValues={null}
          onSubmit={handleCreate}
          onCancel={() => setIsCreateOpen(false)}
          isSubmitting={createMutation.isLoading}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingType(null);
        }}
        title="Edit Device Type"
        size="md"
      >
        <DeviceTypeForm
          mode="edit"
          initialValues={editingType}
          onSubmit={handleUpdate}
          onCancel={() => {
            setIsEditOpen(false);
            setEditingType(null);
          }}
          isSubmitting={updateMutation.isLoading}
        />
      </Modal>
    </div>
  );
}
