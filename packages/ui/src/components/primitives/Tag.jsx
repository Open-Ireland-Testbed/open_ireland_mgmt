// TODO: Implement component (placeholder)
import React from 'react';
import clsx from 'clsx';

export default function Tag({ 
  children, 
  variant = 'default', 
  color,
  onRemove,
  className,
  ...props 
}) {
  const variantStyles = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    primary: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-200',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        variantStyles[variant],
        className
      )}
      style={color ? { backgroundColor: color, color: '#fff' } : {}}
      {...props}
    >
      {children}
      {onRemove && (
        <button
          className="ml-1 hover:opacity-70"
          onClick={onRemove}
          aria-label="Remove"
          type="button"
        >
          ×
        </button>
      )}
    </span>
  );
}

