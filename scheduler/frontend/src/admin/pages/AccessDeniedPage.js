import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AccessDeniedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full glass-card rounded-xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg text-center">
        <div className="mb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          You need admin permissions to access this page. Please contact an administrator if you believe this is an error.
        </p>
        <button
          onClick={() => navigate('/client')}
          className="glass-button px-6 py-2 text-sm font-semibold rounded-md"
        >
          Return to Client View
        </button>
      </div>
    </div>
  );
}

