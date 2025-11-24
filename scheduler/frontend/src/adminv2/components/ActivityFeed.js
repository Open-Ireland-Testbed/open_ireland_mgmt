import React from 'react';
import { formatRelative } from '../utils/formatters';

export default function ActivityFeed({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Recent activity</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">No activity captured yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Recent activity</h3>
      </div>
      <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {items.map((item) => (
          <li key={item.id} className="px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {item.action}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {item.actor?.name ? `${item.actor.name}` : 'System'}
                  {item.entity?.label ? ` · ${item.entity.label}` : ''}
                  {item.message ? ` – ${item.message}` : ''}
                </div>
                {item.metadata && (
                  <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {JSON.stringify(item.metadata)}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{formatRelative(item.timestamp)}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

