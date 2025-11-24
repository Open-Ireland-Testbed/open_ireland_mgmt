// TODO: Implement component (placeholder)
import React from 'react';
import { useTheme } from '../../providers/ThemeProvider';

export default function Header({ user, onLogout, title = 'Open Ireland Inventory' }) {
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === 'dark';

  return (
    <header className="header h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
      <div className="header-content flex items-center justify-between px-6 h-full">
        <div className="header-left">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
        </div>
        <div className="header-right flex items-center gap-4">
          {user && <span className="text-sm text-gray-700 dark:text-gray-300">{user.username}</span>}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

