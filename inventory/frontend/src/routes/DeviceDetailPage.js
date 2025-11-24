import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, Tabs, Button, Tag, Alert, Input, Select, Modal } from '@tcdona/ui';
import { useDevice, useDeviceHistory, useDeviceTags, useAssignTagsToDevice, useRemoveTagFromDevice, useUpdateDevice } from '../hooks/useDevices';
import { useTags } from '../hooks/useInventoryData';
import { useToastContext } from '../contexts/ToastContext';
import DeviceForm from '../components/DeviceForm';

const STATUS_VARIANTS = {
  active: 'success',
  in_maintenance: 'warning',
  retired: 'default',
  spare: 'default',
  planned: 'info',
};

function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleString();
}

function formatDateShort(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

function OverviewTab({ device }) {
  if (!device) return null;

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <Card title="Basic Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              OI ID
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {device.oi_id || '—'}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Name
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{device.name || '—'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Device Type
            </label>
            <p className="mt-1">
              {device.device_type ? (
                <Tag variant="default">{device.device_type.name}</Tag>
              ) : (
                <span className="text-sm text-gray-900 dark:text-gray-100">—</span>
              )}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Manufacturer
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {device.manufacturer?.name || '—'}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Model
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{device.model || '—'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Serial Number
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {device.serial_number || '—'}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Status
            </label>
            <p className="mt-1">
              <Tag variant={STATUS_VARIANTS[device.status] || 'default'}>
                {device.status?.replace('_', ' ') || '—'}
              </Tag>
            </p>
          </div>
        </div>
      </Card>

      {/* Location */}
      <Card title="Location">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Site
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {device.site?.name || '—'}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Rack
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{device.rack || '—'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              U Position
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {device.u_position !== null && device.u_position !== undefined
                ? device.u_position
                : '—'}
            </p>
          </div>
        </div>
      </Card>

      {/* Network */}
      <Card title="Network">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Hostname
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {device.hostname || '—'}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Management IP
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {device.mgmt_ip || '—'}
            </p>
          </div>
        </div>
      </Card>

      {/* Polatis */}
      {(device.polatis_name || device.polatis_port_range) && (
        <Card title="Polatis">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Polatis Name
              </label>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {device.polatis_name || '—'}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Polatis Port Range
              </label>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {device.polatis_port_range || '—'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Meta */}
      <Card title="Metadata">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Owner Group
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {device.owner_group || '—'}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Notes
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
              {device.notes || '—'}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Created At
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {formatDate(device.created_at)}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Updated At
            </label>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {formatDate(device.updated_at)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TagsTab({ deviceId }) {
  const toast = useToastContext();
  const { data: deviceTags, isLoading: isLoadingDeviceTags } = useDeviceTags(deviceId);
  const { data: allTags, isLoading: isLoadingAllTags } = useTags();
  const assignTagsMutation = useAssignTagsToDevice(deviceId);
  const removeTagMutation = useRemoveTagFromDevice(deviceId);
  const [selectedTagId, setSelectedTagId] = useState('');

  const assignedTagIds = useMemo(() => {
    if (!deviceTags) return [];
    return deviceTags.map((tag) => tag.id);
  }, [deviceTags]);

  const availableTags = useMemo(() => {
    if (!allTags) return [];
    return allTags.filter((tag) => !assignedTagIds.includes(tag.id));
  }, [allTags, assignedTagIds]);

  const tagOptions = useMemo(() => {
    return [
      { value: '', label: 'Select a tag...' },
      ...availableTags.map((tag) => ({ value: String(tag.id), label: tag.name })),
    ];
  }, [availableTags]);

  const handleAddTag = () => {
    if (!selectedTagId) {
      toast.warning('Please select a tag');
      return;
    }

    assignTagsMutation.mutate(
      { tag_ids: [Number(selectedTagId)] },
      {
        onSuccess: () => {
          toast.success('Tag assigned successfully');
          setSelectedTagId('');
        },
        onError: (err) => {
          toast.error(err?.message || 'Failed to assign tag');
        },
      }
    );
  };

  const handleRemoveTag = (tagId) => {
    removeTagMutation.mutate(tagId, {
      onSuccess: () => {
        toast.success('Tag removed successfully');
      },
      onError: (err) => {
        toast.error(err?.message || 'Failed to remove tag');
      },
    });
  };

  const isLoading = isLoadingDeviceTags || isLoadingAllTags;
  const isMutating = assignTagsMutation.isLoading || removeTagMutation.isLoading;

  return (
    <div className="space-y-6">
      <Card title="Assigned Tags">
        {isLoading ? (
          <div className="py-4 text-sm text-gray-500 dark:text-gray-400">Loading tags...</div>
        ) : deviceTags && deviceTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {deviceTags.map((tag) => (
              <Tag
                key={tag.id}
                variant="primary"
                onRemove={() => handleRemoveTag(tag.id)}
              >
                {tag.name}
              </Tag>
            ))}
          </div>
        ) : (
          <div className="py-4 text-sm text-gray-500 dark:text-gray-400">
            No tags assigned to this device.
          </div>
        )}
      </Card>

      <Card title="Add Tag">
        <div className="flex gap-2">
          <div className="flex-1">
            <Select
              value={selectedTagId}
              onChange={(e) => setSelectedTagId(e.target.value)}
              options={tagOptions}
              disabled={isMutating || availableTags.length === 0}
            />
          </div>
          <Button
            variant="primary"
            onClick={handleAddTag}
            disabled={!selectedTagId || isMutating}
            loading={assignTagsMutation.isLoading}
          >
            Add Tag
          </Button>
        </div>
        {availableTags.length === 0 && allTags && allTags.length > 0 && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            All available tags are already assigned to this device.
          </p>
        )}
      </Card>
    </div>
  );
}

function HistoryTab({ deviceId }) {
  const { data: history, isLoading, isError, error } = useDeviceHistory(deviceId);

  if (isLoading) {
    return (
      <Card>
        <div className="py-4 text-sm text-gray-500 dark:text-gray-400">Loading history...</div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Alert type="error">
        {error?.message || 'Failed to load device history'}
      </Alert>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          No history entries yet for this device.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry) => (
        <Card key={entry.id}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {entry.action?.replace('_', ' ') || 'Unknown action'}
                </span>
                {entry.field_name && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({entry.field_name})
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(entry.created_at)}
              </span>
            </div>
            {entry.old_value !== null && entry.new_value !== null && (
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <span className="line-through text-gray-500">{entry.old_value}</span>
                {' → '}
                <span className="font-medium">{entry.new_value}</span>
              </div>
            )}
            {entry.notes && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{entry.notes}</p>
            )}
            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
              <details className="text-xs text-gray-500 dark:text-gray-400">
                <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                  View metadata
                </summary>
                <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded overflow-auto">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function DeviceDetailPage() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const toast = useToastContext();
  const { data: device, isLoading, isError, error } = useDevice(deviceId);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const updateDeviceMutation = useUpdateDevice();

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'tags', label: 'Tags' },
    { key: 'history', label: 'History' },
  ];

  // Handle edit device - must be defined before early returns (React hooks rule)
  const handleEditDevice = useCallback(
    (payload) => {
      updateDeviceMutation.mutate(
        { deviceId, data: payload },
        {
          onSuccess: () => {
            toast.success('Device updated successfully');
            setIsEditOpen(false);
          },
          onError: (err) => {
            toast.error(err?.message || 'Failed to update device');
          },
        }
      );
    },
    [deviceId, updateDeviceMutation, toast]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader title="Device" />
        <div className="mt-6 space-y-4">
          <Card>
            <div className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="p-6">
        <PageHeader
          title="Device"
          breadcrumbs={[{ label: 'Devices', path: '/devices' }]}
        />
        <div className="mt-6">
          <Alert type="error">
            {error?.message || 'Failed to load device'}
          </Alert>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => navigate('/devices')}>
              Back to Devices
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!device) {
    return (
      <div className="p-6">
        <PageHeader
          title="Device Not Found"
          breadcrumbs={[{ label: 'Devices', path: '/devices' }]}
        />
        <div className="mt-6">
          <Card>
            <div className="p-6 text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Device not found
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                The device you're looking for doesn't exist or has been removed.
              </p>
              <Button variant="primary" onClick={() => navigate('/devices')}>
                Back to Devices
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Render tabs content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab device={device} />;
      case 'tags':
        return <TagsTab deviceId={deviceId} />;
      case 'history':
        return <HistoryTab deviceId={deviceId} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title={device.name || 'Device'}
        subtitle={device.oi_id || 'No OI ID assigned'}
        breadcrumbs={[
          { label: 'Devices', path: '/devices' },
          { label: device.name || `Device ${deviceId}`, path: null },
        ]}
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsEditOpen(true)}>
              Edit
            </Button>
            <Button variant="danger" onClick={() => { }}>
              Delete
            </Button>
          </>
        }
      />
      <div className="mt-6">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="mt-6">{renderTabContent()}</div>
      </div>

      {/* Edit Device Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Device"
        size="lg"
      >
        <DeviceForm
          mode="edit"
          initialValues={device}
          onSubmit={handleEditDevice}
          onCancel={() => setIsEditOpen(false)}
          isSubmitting={updateDeviceMutation.isLoading}
        />
      </Modal>
    </div>
  );
}
