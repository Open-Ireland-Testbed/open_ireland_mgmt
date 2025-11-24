import React, { useState, useMemo, useCallback } from 'react';
import { PageHeader, Button, Card, Table, Modal, Alert } from '@tcdona/ui';
import { useSites, useCreateSite, useUpdateSite, useDeleteSite } from '../hooks/useInventoryData';
import { useToastContext } from '../contexts/ToastContext';
import SiteForm from '../components/SiteForm';

export default function SitesPage() {
  const toast = useToastContext();
  const { data, isLoading, isError, error } = useSites();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const createMutation = useCreateSite();
  const updateMutation = useUpdateSite();
  const deleteMutation = useDeleteSite();

  const handleCreate = useCallback(
    (payload) => {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Site created successfully');
          setIsCreateOpen(false);
        },
        onError: (err) => {
          toast.error(err?.message || 'Failed to create site');
        },
      });
    },
    [createMutation, toast]
  );

  const handleUpdate = useCallback(
    (payload) => {
      updateMutation.mutate(
        { id: editingSite.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Site updated successfully');
            setIsEditOpen(false);
            setEditingSite(null);
          },
          onError: (err) => {
            toast.error(err?.message || 'Failed to update site');
          },
        }
      );
    },
    [editingSite, updateMutation, toast]
  );

  const handleDelete = useCallback(
    (id) => {
      if (window.confirm('This site may be in use by devices. Are you sure you want to delete it?')) {
        setDeletingId(id);
        deleteMutation.mutate(id, {
          onSuccess: () => {
            toast.success('Site deleted successfully');
            setDeletingId(null);
          },
          onError: (err) => {
            toast.error(err?.message || 'Failed to delete site. It may be in use by devices.');
            setDeletingId(null);
          },
        });
      }
    },
    [deleteMutation, toast]
  );

  const handleEdit = useCallback((site) => {
    setEditingSite(site);
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
        key: 'address',
        header: 'Address',
        accessor: (row) => row.address || '—',
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
        title="Sites"
        subtitle="Manage physical locations"
        actions={
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            Add Site
          </Button>
        }
      />

      {isError && (
        <Alert type="error" className="mt-6">
          {error?.message || 'Failed to load sites'}
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
                No sites found
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Get started by adding a site.
              </p>
            </div>
          }
        />
      </div>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Site" size="md">
        <SiteForm
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
          setEditingSite(null);
        }}
        title="Edit Site"
        size="md"
      >
        <SiteForm
          mode="edit"
          initialValues={editingSite}
          onSubmit={handleUpdate}
          onCancel={() => {
            setIsEditOpen(false);
            setEditingSite(null);
          }}
          isSubmitting={updateMutation.isLoading}
        />
      </Modal>
    </div>
  );
}
