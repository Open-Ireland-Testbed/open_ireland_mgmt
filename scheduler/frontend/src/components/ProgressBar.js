import React from 'react';

export default function ProgressBar({ progress, message, className = '' }) {
  return (
    <div className={`w-full ${className}`}>
      {message && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
          {message}
        </div>
      )}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={message || 'Progress'}
        />
      </div>
    </div>
  );
}

















