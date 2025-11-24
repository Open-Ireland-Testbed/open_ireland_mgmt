import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, updateSettings } from '../api';
import { useToastContext } from '../../contexts/ToastContext';
import { useAdminContext } from '../context/AdminContext';
import { canEditSettings } from '../utils/permissions';

export default function SettingsPage() {
  const toast = useToastContext();
  const queryClient = useQueryClient();
  const { permissions } = useAdminContext();
  const [draft, setDraft] = useState({});

  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: fetchSettings,
    onSuccess: (data) => setDraft(data?.values || {}),
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => updateSettings(payload),
    onSuccess: async () => {
      toast.success('Settings updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (err) => toast.error(err?.message || 'Unable to update settings.'),
  });

  const handleChange = (key, value) => {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    updateMutation.mutate({ values: draft });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Define policies, notification preferences, and conflict rules.
        </p>
      </div>

      {settingsQuery.status === 'pending' ? (
        <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 animate-pulse bg-gray-50 dark:bg-gray-900">
          Loading settings…
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
            {Object.entries(draft || {}).map(([key, value]) => (
              <div key={key}>
                <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-semibold">{key}</span>
                  <textarea
                    value={JSON.stringify(value, null, 2)}
                    onChange={(event) => {
                      try {
                        const parsed = JSON.parse(event.target.value);
                        handleChange(key, parsed);
                      } catch {
                        handleChange(key, event.target.value);
                      }
                    }}
                    rows={3}
                    className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!canEditSettings(permissions)}
                  />
                </label>
              </div>
            ))}
            {(!draft || Object.keys(draft).length === 0) && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                No admin-configurable settings available yet.
              </div>
            )}
          </div>

          {canEditSettings(permissions) && (
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Save changes
            </button>
          )}
        </form>
      )}
    </div>
  );
}

