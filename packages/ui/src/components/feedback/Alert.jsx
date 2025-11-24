// TODO: Implement component (placeholder)
import React from 'react';
import clsx from 'clsx';

export default function Alert({ 
  children, 
  type = 'info', 
  title,
  onClose,
  className 
}) {
  const typeStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300',
    success: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300',
    error: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300',
  };

  return (
    <div
      className={clsx(
        'rounded-lg border px-4 py-3',
        typeStyles[type],
        className
      )}
      role="alert"
    >
      {title && (
        <h4 className="font-semibold mb-1">{title}</h4>
      )}
      <div className="text-sm">{children}</div>
      {onClose && (
        <button
          className="absolute top-2 right-2 text-current opacity-70 hover:opacity-100"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          ×
        </button>
      )}
    </div>
  );
}

