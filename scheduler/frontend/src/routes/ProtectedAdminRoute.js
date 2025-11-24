import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

/**
 * ProtectedAdminRoute - Route guard for admin pages
 * 
 * Prevents non-admin users from accessing admin routes by:
 * - Checking authentication status
 * - Checking admin status
 * - Redirecting to /client if not authorized
 * 
 * Note: Toast messages are handled by the AdminApp component after redirect,
 * since ToastProvider may not be available at this route level.
 */
export default function ProtectedAdminRoute({ children }) {
  const { authenticated, isAdmin, loading } = useAuthStore();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }} />
          <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to client page
  if (!authenticated) {
    return <Navigate to="/client" replace state={{ adminRedirect: 'You must be signed in to access the admin panel.' }} />;
  }

  // Authenticated but not admin - redirect to client page
  if (!isAdmin) {
    return <Navigate to="/client" replace state={{ adminRedirect: 'You need admin permissions to access this page.' }} />;
  }

  // Authenticated and admin - render the admin component
  return children;
}

