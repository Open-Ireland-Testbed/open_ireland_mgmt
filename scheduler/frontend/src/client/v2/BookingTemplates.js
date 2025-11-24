import React, { useState, useEffect } from 'react';
import useSchedulerStore from '../../store/schedulerStore';
import { useDevices } from '../../services/deviceService';
import useBookingState from '../../store/useBookingState';

export default function BookingTemplates({ onApply }) {
  const { bookingTemplates, addBookingTemplate, deleteBookingTemplate, initializeDefaultTemplates, setDateRange } = useSchedulerStore();
  const { data: devices = [] } = useDevices();
  const setSelectedRange = useBookingState((state) => state.setSelectedRange);
  const importDeviceSelections = useBookingState((state) => state.importDeviceSelections);
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', duration: 7, deviceTypes: [] });

  useEffect(() => {
    initializeDefaultTemplates();
  }, [initializeDefaultTemplates]);

  const handleApplyTemplate = (template) => {
    // Set date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = today.toISOString().split('T')[0];
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + template.duration - 1);
    const end = endDate.toISOString().split('T')[0];
    
    setDateRange({ start, end });
    setSelectedRange({ start, end });

    // Select devices based on template
    const matchingDevices = devices.filter(device => {
      if (template.deviceIds && template.deviceIds.length > 0) {
        return template.deviceIds.includes(device.id);
      }
      if (template.deviceTypes && template.deviceTypes.length > 0) {
        return template.deviceTypes.includes(device.deviceType);
      }
      return false;
    });

    if (matchingDevices.length === 0) {
      // No devices match - could show a toast
      return;
    }

    // Select all days in range for matching devices
    const days = [];
    for (let i = 0; i < template.duration; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      days.push(date.toISOString().split('T')[0]);
    }

    if (matchingDevices.length > 0 && days.length > 0) {
      importDeviceSelections(
        matchingDevices.map(device => device.id),
        days
      );
    }

    if (onApply) {
      onApply();
    }
  };

  const handleCreateTemplate = () => {
    if (!newTemplate.name) return;
    
    addBookingTemplate(newTemplate);
    setNewTemplate({ name: '', description: '', duration: 7, deviceTypes: [] });
    setIsCreating(false);
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Templates</h3>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {isCreating ? 'Cancel' : '+ New'}
        </button>
      </div>

      {/* Create Template Form */}
      {isCreating && (
        <div className="mb-3 p-3 glass-card rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
          <input
            type="text"
            placeholder="Template name"
            value={newTemplate.name}
            onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <input
            type="text"
            placeholder="Description"
            value={newTemplate.description}
            onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Duration (days)"
              value={newTemplate.duration}
              onChange={(e) => setNewTemplate({ ...newTemplate, duration: parseInt(e.target.value) || 7 })}
              className="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={handleCreateTemplate}
              className="px-3 py-1 text-xs bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Template List */}
      <div className="space-y-2">
        {bookingTemplates.map((template) => (
          <div
            key={template.id}
            className="p-2 glass-card rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
            onClick={() => handleApplyTemplate(template)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-xs font-semibold text-gray-900 dark:text-white">
                  {template.name}
                </div>
                {template.description && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {template.description}
                  </div>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {template.duration} day{template.duration !== 1 ? 's' : ''}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteBookingTemplate(template.id);
                }}
                className="ml-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                aria-label={`Delete ${template.name}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

