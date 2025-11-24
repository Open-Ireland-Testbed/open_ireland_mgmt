import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Button, Card, Table, Input, Select, Tag, Alert, Modal } from '@tcdona/ui';
import { useDevicesList, useBulkUpdateDevices, useCreateDevice } from '../hooks/useDevices';
import { useDeviceTypes, useSites, useTags } from '../hooks/useInventoryData';
import useBulkSelection from '../hooks/useBulkSelection';
import { useToastContext } from '../contexts/ToastContext';
import DeviceForm from '../components/DeviceForm';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'in_maintenance', label: 'In Maintenance' },
  { value: 'retired', label: 'Retired' },
  { value: 'spare', label: 'Spare' },
  { value: 'planned', label: 'Planned' },
];

const STATUS_VARIANTS = {
  active: 'success',
  in_maintenance: 'warning',
  retired: 'default',
  spare: 'default',
  planned: 'info',
};

function BulkUpdateModal({ isOpen, onClose, selectedIds, onConfirm }) {
  const [newStatus, setNewStatus] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (newStatus) {
      onConfirm(newStatus);
      setNewStatus('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Bulk Update Status</h3>
        <Select
          label="New Status"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
          options={STATUS_OPTIONS.filter((opt) => opt.value !== '')}
          placeholder="Select status"
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!newStatus}>
            Update {selectedIds.length} device(s)
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DevicesListPage() {
  const navigate = useNavigate();
  const toast = useToastContext();

  // Filter state
  const [filters, setFilters] = useState({
    status: '',
    device_type_id: '',
    site_id: '',
    tag_id: '',
    search: '',
  });

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
  });

  // Bulk update modal state
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);

  // Create device modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const createDeviceMutation = useCreateDevice();

  // Fetch devices with filters and pagination
  const { data, isLoading, isError, error } = useDevicesList({ filters, pagination });

  // Fetch filter options
  const { data: deviceTypesData } = useDeviceTypes();
  const { data: sitesData } = useSites();
  const { data: tagsData } = useTags();

  // Bulk update mutation
  const bulkUpdateMutation = useBulkUpdateDevices();

  // Selection
  const selection = useBulkSelection(data?.items || [], (row) => row.id);

  // Prepare filter options
  const deviceTypeOptions = useMemo(() => {
    const options = [{ value: '', label: 'All Device Types' }];
    if (deviceTypesData) {
      deviceTypesData.forEach((dt) => {
        options.push({ value: String(dt.id), label: dt.name });
      });
    }
    return options;
  }, [deviceTypesData]);

  const siteOptions = useMemo(() => {
    const options = [{ value: '', label: 'All Sites' }];
    if (sitesData) {
      sitesData.forEach((site) => {
        options.push({ value: String(site.id), label: site.name });
      });
    }
    return options;
  }, [sitesData]);

  const tagOptions = useMemo(() => {
    const options = [{ value: '', label: 'All Tags' }];
    if (tagsData) {
      tagsData.forEach((tag) => {
        options.push({ value: String(tag.id), label: tag.name });
      });
    }
    return options;
  }, [tagsData]);

  // Handle filter changes
  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1
  }, []);

  // Handle search
  const handleSearchChange = useCallback((e) => {
    handleFilterChange('search', e.target.value);
  }, [handleFilterChange]);

  // Handle pagination
  const handlePageChange = useCallback((newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }, []);

  // Handle bulk update
  const handleBulkUpdate = useCallback(
    (newStatus) => {
      const deviceIds = Array.from(selection.state.ids);
      bulkUpdateMutation.mutate(
        {
          deviceIds,
          updates: { status: newStatus },
        },
        {
          onSuccess: (result) => {
            toast.success(`Updated ${result.succeeded?.length || deviceIds.length} device(s)`);
            selection.clear();
          },
          onError: (err) => {
            toast.error(err?.message || 'Failed to update devices');
          },
        }
      );
    },
    [selection, bulkUpdateMutation, toast]
  );

  // Handle create device
  const handleCreateDevice = useCallback(
    (payload) => {
      createDeviceMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Device created successfully');
          setIsCreateOpen(false);
        },
        onError: (err) => {
          toast.error(err?.message || 'Failed to create device');
        },
      });
    },
    [createDeviceMutation, toast]
  );

  // Table columns
  const columns = useMemo(
    () => [
      {
        key: 'oi_id',
        header: 'OI ID',
        accessor: (row) => row.oi_id || '-',
      },
      {
        key: 'name',
        header: 'Name',
        accessor: (row) => row.name,
      },
      {
        key: 'device_type',
        header: 'Type',
        accessor: (row) => row.device_type?.name || '-',
      },
      {
        key: 'manufacturer',
        header: 'Manufacturer',
        accessor: (row) => row.manufacturer?.name || '-',
      },
      {
        key: 'site',
        header: 'Site',
        accessor: (row) => row.site?.name || '-',
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <Tag variant={STATUS_VARIANTS[row.status] || 'default'}>
            {row.status?.replace('_', ' ') || '-'}
          </Tag>
        ),
      },
      {
        key: 'tags',
        header: 'Tags',
        render: (row) => {
          const tags = row.tags || [];
          if (tags.length === 0) return '-';
          const visibleTags = tags.slice(0, 3);
          const remaining = tags.length - 3;
          return (
            <div className="flex flex-wrap gap-1">
              {visibleTags.map((tag) => (
                <Tag key={tag.id} variant="default">
                  {tag.name}
                </Tag>
              ))}
              {remaining > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">+{remaining}</span>
              )}
            </div>
          );
        },
      },
      {
        key: 'updated_at',
        header: 'Updated',
        accessor: (row) => {
          if (!row.updated_at) return '-';
          const date = new Date(row.updated_at);
          return date.toLocaleDateString();
        },
      },
    ],
    []
  );

  // Active filters for display
  const activeFilters = useMemo(() => {
    const active = [];
    if (filters.status) {
      const statusLabel = STATUS_OPTIONS.find((opt) => opt.value === filters.status)?.label;
      active.push({ key: 'status', label: 'Status', value: statusLabel });
    }
    if (filters.device_type_id) {
      const typeLabel = deviceTypeOptions.find((opt) => opt.value === filters.device_type_id)?.label;
      active.push({ key: 'device_type_id', label: 'Type', value: typeLabel });
    }
    if (filters.site_id) {
      const siteLabel = siteOptions.find((opt) => opt.value === filters.site_id)?.label;
      active.push({ key: 'site_id', label: 'Site', value: siteLabel });
    }
    if (filters.tag_id) {
      const tagLabel = tagOptions.find((opt) => opt.value === filters.tag_id)?.label;
      active.push({ key: 'tag_id', label: 'Tag', value: tagLabel });
    }
    if (filters.search) {
      active.push({ key: 'search', label: 'Search', value: filters.search });
    }
    return active;
  }, [filters, deviceTypeOptions, siteOptions, tagOptions]);

  const clearFilters = useCallback(() => {
    setFilters({
      status: '',
      device_type_id: '',
      site_id: '',
      tag_id: '',
      search: '',
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  // Pagination calculations
  const totalPages = data?.total ? Math.ceil(data.total / pagination.pageSize) : 0;
  const canGoPrevious = pagination.page > 1;
  const canGoNext = pagination.page < totalPages;

  return (
    <div className="p-6">
      <PageHeader
        title="Devices"
        subtitle="All testbed hardware assets"
        actions={
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            Add Device
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mt-6">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Input
              placeholder="Search devices..."
              value={filters.search}
              onChange={handleSearchChange}
            />
            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              options={STATUS_OPTIONS}
            />
            <Select
              value={filters.device_type_id}
              onChange={(e) => handleFilterChange('device_type_id', e.target.value)}
              options={deviceTypeOptions}
            />
            <Select
              value={filters.site_id}
              onChange={(e) => handleFilterChange('site_id', e.target.value)}
              options={siteOptions}
            />
            <Select
              value={filters.tag_id}
              onChange={(e) => handleFilterChange('tag_id', e.target.value)}
              options={tagOptions}
            />
          </div>
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {activeFilters.map((filter) => (
                <Tag
                  key={filter.key}
                  variant="primary"
                  onRemove={() => handleFilterChange(filter.key, '')}
                >
                  {filter.label}: {filter.value}
                </Tag>
              ))}
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Error state */}
      {isError && (
        <Alert type="error" className="mt-6">
          {error?.message || 'Failed to load devices'}
        </Alert>
      )}

      {/* Table */}
      <div className="mt-6">
        <Table
          columns={columns}
          rows={data?.items || []}
          loading={isLoading}
          selection={selection}
          bulkActions={(selection) => (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowBulkUpdateModal(true)}
            >
              Bulk Update Status
            </Button>
          )}
          onRowClick={(row) => navigate(`/devices/${row.id}`)}
          rowId={(row) => row.id}
          emptyState={
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-950 p-6 text-center">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                No devices found
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {Object.values(filters).some((v) => v) ? 'Try adjusting your filters.' : 'Get started by adding a device.'}
              </p>
            </div>
          }
        />
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, data.total)} of {data.total} devices
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!canGoPrevious}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {pagination.page} of {totalPages || 1}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!canGoNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Update Modal */}
      <BulkUpdateModal
        isOpen={showBulkUpdateModal}
        onClose={() => setShowBulkUpdateModal(false)}
        selectedIds={Array.from(selection.state.ids)}
        onConfirm={handleBulkUpdate}
      />

      {/* Create Device Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Device"
        size="lg"
      >
        <DeviceForm
          mode="create"
          initialValues={null}
          onSubmit={handleCreateDevice}
          onCancel={() => setIsCreateOpen(false)}
          isSubmitting={createDeviceMutation.isLoading}
        />
      </Modal>
    </div>
  );
}
