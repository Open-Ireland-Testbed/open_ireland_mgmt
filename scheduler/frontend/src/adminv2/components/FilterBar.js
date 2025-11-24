import React from 'react';

export default function FilterBar({ filters, onReset, children }) {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {filters?.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => filter.onRemove?.()}
            className={[
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border',
              filter.active
                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700'
                : 'bg-gray-100 text-gray-600 border-transparent dark:bg-gray-800 dark:text-gray-300',
            ].join(' ')}
          >
            <span>{filter.label}</span>
            {filter.value && <span className="text-gray-400 dark:text-gray-500">· {filter.value}</span>}
            {filter.onRemove && <span className="text-gray-400 dark:text-gray-500">×</span>}
          </button>
        ))}
      </div>
      <div className="flex-1 flex items-center justify-end gap-2">
        {children}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

