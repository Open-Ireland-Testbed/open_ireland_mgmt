// TODO: Implement component (placeholder)
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar({ items, activeItem, onItemClick }) {
  const location = useLocation();
  
  return (
    <aside className="sidebar w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800">
      <nav className="p-4 space-y-1">
        {items?.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.key}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

