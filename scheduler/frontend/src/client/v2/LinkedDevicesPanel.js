import React, { useState } from 'react';
import useSchedulerStore from '../../store/schedulerStore';
import { useDevices } from '../../services/deviceService';

export default function LinkedDevicesPanel({ selectedDeviceIds, onSelectGroup }) {
  const { linkedDeviceGroups, addLinkedDeviceGroup, deleteLinkedDeviceGroup, setFilters } = useSchedulerStore();
  const { data: devices = [] } = useDevices();
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [activeGroupId, setActiveGroupId] = useState(null);

  const handleSaveGroup = () => {
    if (!newGroupName.trim() || selectedDeviceIds.length === 0) return;
    
    addLinkedDeviceGroup({
      name: newGroupName,
      deviceIds: selectedDeviceIds,
    });
    
    setNewGroupName('');
    setIsCreating(false);
  };

  const handleApplyGroup = (group) => {
    setActiveGroupId(group.id);
    
    // Filter devices to show only this group by setting device IDs filter
    setFilters({ deviceIds: group.deviceIds });
    
    if (onSelectGroup) {
      onSelectGroup(group.deviceIds);
    }
  };

  const handleClearGroup = () => {
    setActiveGroupId(null);
    setFilters({ deviceIds: [] });
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Linked Groups</h3>
        <div className="flex items-center gap-2">
          {activeGroupId && (
            <button
              onClick={handleClearGroup}
              className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
              title="Clear filter"
            >
              Clear
            </button>
          )}
          {selectedDeviceIds.length > 0 && (
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {isCreating ? 'Cancel' : '+ Link Selected'}
            </button>
          )}
        </div>
      </div>

      {/* Create Group Form */}
      {isCreating && (
        <div className="mb-3 p-3 glass-card rounded-lg border border-gray-200 dark:border-gray-700">
          <input
            type="text"
            placeholder="Group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {selectedDeviceIds.length} device{selectedDeviceIds.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleSaveGroup}
              className="ml-auto px-3 py-1 text-xs bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Group List */}
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {linkedDeviceGroups.map((group) => {
          const groupDevices = devices.filter(d => group.deviceIds.includes(d.id));
          const isActive = activeGroupId === group.id;
          return (
            <div
              key={group.id}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                  : 'glass-card border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
              }`}
              onClick={() => handleApplyGroup(group)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white">
                    {group.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {groupDevices.length} device{groupDevices.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteLinkedDeviceGroup(group.id);
                  }}
                  className="ml-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  aria-label={`Delete ${group.name}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

