// TODO: Implement component (placeholder)
import React from 'react';
import { Link } from 'react-router-dom';

export default function PageHeader({ title, subtitle, actions, breadcrumbs }) {
  return (
    <div className="page-header">
      {breadcrumbs && Array.isArray(breadcrumbs) && breadcrumbs.length > 0 && (
        <nav className="mb-2 text-sm text-gray-500 dark:text-gray-400">
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx}>
              {crumb.path ? (
                <Link to={crumb.path} className="hover:text-gray-700 dark:hover:text-gray-300">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
              {idx < breadcrumbs.length - 1 && <span className="mx-2">/</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="page-header-content flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>}
        </div>
        {actions && <div className="page-actions flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

