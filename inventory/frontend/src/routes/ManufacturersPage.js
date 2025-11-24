import React, { useState, useMemo, useCallback } from 'react';
import { PageHeader, Button, Card, Table, Modal, Alert } from '@tcdona/ui';
import { useManufacturers, useCreateManufacturer, useUpdateManufacturer, useDeleteManufacturer } from '../hooks/useInventoryData';
import { useToastContext } from '../contexts/ToastContext';
import ManufacturerForm from '../components/ManufacturerForm';

export default function ManufacturersPage() {
  const toast = useToastContext();
  const { data, isLoading, isError, error } = useManufacturers();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingManufacturer, setEditingManufacturer] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const createMutation = useCreateManufacturer();
  const updateMutation = useUpdateManufacturer();
  const deleteMutation = useDeleteManufacturer();

  const handleCreate = useCallback(
    (payload) => {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Manufacturer created successfully');
          setIsCreateOpen(false);
        },
        onError: (err) => {
          toast.error(err?.message || 'Failed to create manufacturer');
        },
      });
    },
    [createMutation, toast]
  );

  const handleUpdate = useCallback(
    (payload) => {
      updateMutation.mutate(
        { id: editingManufacturer.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Manufacturer updated successfully');
            setIsEditOpen(false);
            setEditingManufacturer(null);
          },
          onError: (err) => {
            toast.error(err?.message || 'Failed to update manufacturer');
          },
        }
      );
    },
    [editingManufacturer, updateMutation, toast]
  );

  const handleDelete = useCallback(
    (id) => {
      if (window.confirm('This manufacturer may be in use by devices. Are you sure you want to delete it?')) {
        setDeletingId(id);
        deleteMutation.mutate(id, {
          onSuccess: () => {
            toast.success('Manufacturer deleted successfully');
            setDeletingId(null);
          },
          onError: (err) => {
            toast.error(err?.message || 'Failed to delete manufacturer. It may be in use by devices.');
            setDeletingId(null);
          },
        });
      }
    },
    [deleteMutation, toast]
  );

  const handleEdit = useCallback((manufacturer) => {
    setEditingManufacturer(manufacturer);
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
        key: 'website',
        header: 'Website',
        render: (row) =>
          row.website ? (
            <a
              href={row.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {row.website}
            </a>
          ) : (
            '—'
          ),
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
        title="Manufacturers"
        subtitle="Manage catalog of device manufacturers"
        actions={
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            Add Manufacturer
          </Button>
        }
      />

      {isError && (
        <Alert type="error" className="mt-6">
          {error?.message || 'Failed to load manufacturers'}
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
                No manufacturers found
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Get started by adding a manufacturer.
              </p>
            </div>
          }
        />
      </div>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Manufacturer" size="md">
        <ManufacturerForm
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
          setEditingManufacturer(null);
        }}
        title="Edit Manufacturer"
        size="md"
      >
        <ManufacturerForm
          mode="edit"
          initialValues={editingManufacturer}
          onSubmit={handleUpdate}
          onCancel={() => {
            setIsEditOpen(false);
            setEditingManufacturer(null);
          }}
          isSubmitting={updateMutation.isLoading}
        />
      </Modal>
    </div>
  );
}
