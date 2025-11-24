// TODO: Implement component (placeholder)
import React from 'react';
import clsx from 'clsx';

export default function Tabs({ tabs = [], activeTab, onTabChange }) {
  return (
    <div className="tabs">
      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            )}
            onClick={() => onTabChange?.(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tabs-content">
        {tabs.find((tab) => tab.key === activeTab)?.content}
      </div>
    </div>
  );
}

