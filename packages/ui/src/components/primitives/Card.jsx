// TODO: Implement component (placeholder)
import React from 'react';
import clsx from 'clsx';

export default function Card({ children, title, subtitle, actions, className, ...props }) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm',
        className
      )}
      {...props}
    >
      {(title || subtitle || actions) && (
        <div className="card-header px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>}
            {subtitle && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className="card-content p-6">
        {children}
      </div>
    </div>
  );
}

