import React, { useState, useMemo, useCallback } from 'react';
import { PageHeader, Button, Card, Table, Modal, Alert, Tag } from '@tcdona/ui';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '../hooks/useInventoryData';
import { useToastContext } from '../contexts/ToastContext';
import TagForm from '../components/TagForm';

export default function TagsPage() {
  const toast = useToastContext();
  const { data, isLoading, isError, error } = useTags();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const createMutation = useCreateTag();
  const updateMutation = useUpdateTag();
  const deleteMutation = useDeleteTag();

  const handleCreate = useCallback(
    (payload) => {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Tag created successfully');
          setIsCreateOpen(false);
        },
        onError: (err) => {
          toast.error(err?.message || 'Failed to create tag');
        },
      });
    },
    [createMutation, toast]
  );

  const handleUpdate = useCallback(
    (payload) => {
      updateMutation.mutate(
        { id: editingTag.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Tag updated successfully');
            setIsEditOpen(false);
            setEditingTag(null);
          },
          onError: (err) => {
            toast.error(err?.message || 'Failed to update tag');
          },
        }
      );
    },
    [editingTag, updateMutation, toast]
  );

  const handleDelete = useCallback(
    (id) => {
      if (window.confirm('This tag may be in use by devices. Are you sure you want to delete it?')) {
        setDeletingId(id);
        deleteMutation.mutate(id, {
          onSuccess: () => {
            toast.success('Tag deleted successfully');
            setDeletingId(null);
          },
          onError: (err) => {
            toast.error(err?.message || 'Cannot delete tag: it is in use by devices.');
            setDeletingId(null);
          },
        });
      }
    },
    [deleteMutation, toast]
  );

  const handleEdit = useCallback((tag) => {
    setEditingTag(tag);
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
        key: 'color',
        header: 'Color',
        render: (row) => {
          if (row.color) {
            return (
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded border border-gray-300 dark:border-gray-700"
                  style={{ backgroundColor: row.color }}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">{row.color}</span>
              </div>
            );
          }
          return '—';
        },
      },
      {
        key: 'description',
        header: 'Description',
        accessor: (row) => row.description || '—',
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
        title="Tags"
        subtitle="Manage tags for categorizing devices"
        actions={
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            Add Tag
          </Button>
        }
      />

      {isError && (
        <Alert type="error" className="mt-6">
          {error?.message || 'Failed to load tags'}
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
                No tags found
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Get started by adding a tag.
              </p>
            </div>
          }
        />
      </div>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Tag" size="md">
        <TagForm
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
          setEditingTag(null);
        }}
        title="Edit Tag"
        size="md"
      >
        <TagForm
          mode="edit"
          initialValues={editingTag}
          onSubmit={handleUpdate}
          onCancel={() => {
            setIsEditOpen(false);
            setEditingTag(null);
          }}
          isSubmitting={updateMutation.isLoading}
        />
      </Modal>
    </div>
  );
}
