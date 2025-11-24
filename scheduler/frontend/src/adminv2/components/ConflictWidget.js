import React from 'react';
import { formatRelative } from '../utils/formatters';

export default function ConflictWidget({ items, onResolve }) {
  return (
    <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Topology conflicts</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Resolve submitted conflicts swiftly</p>
        </div>
        <span className="inline-flex items-center justify-center text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
          {items?.length || 0}
        </span>
      </div>
      {(!items || items.length === 0) ? (
        <div className="px-6 py-6 text-sm text-gray-500 dark:text-gray-400">
          No outstanding conflicts. You&apos;re all clear!
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
          {items.map((item) => (
            <li key={item.topology_id} className="px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {item.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {item.conflict_count} conflict{item.conflict_count === 1 ? '' : 's'} ·{' '}
                    {item.submitted_by ? `Submitted by ${item.submitted_by}` : 'System-generated'}
                  </div>
                  {item.last_updated && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Updated {formatRelative(item.last_updated)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onResolve?.(item)}
                  className="px-3 py-2 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Resolve
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

