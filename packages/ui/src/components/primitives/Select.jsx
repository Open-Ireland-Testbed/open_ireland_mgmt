// TODO: Implement component (placeholder)
import React from 'react';
import clsx from 'clsx';

export default function Select({ 
  options = [], 
  value, 
  onChange, 
  placeholder,
  label,
  className,
  error,
  ...props 
}) {
  return (
    <div className="select-wrapper">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <select
        className={clsx(
          'block w-full rounded-lg border px-3 py-2 text-sm',
          'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
          'border-gray-300 dark:border-gray-700',
          'focus:border-blue-500 focus:ring-blue-500 focus:outline-none',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          className
        )}
        value={value}
        onChange={onChange}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}

