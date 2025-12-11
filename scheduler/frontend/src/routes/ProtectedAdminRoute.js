import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import AccessDeniedPage from '../admin/pages/AccessDeniedPage';

/**
 * ProtectedAdminRoute - Route guard for admin pages
 * 
 * Prevents non-admin users from accessing admin routes by:
 * - Checking authentication status
 * - Checking admin status
 * - Showing access denied page if not authorized (instead of redirecting)
 * 
 * Note: Non-authenticated users are still redirected to /client
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

  // Authenticated but not admin - show access denied page
  if (!isAdmin) {
    return <AccessDeniedPage />;
  }

  // Authenticated and admin - render the admin component
  return children;
}

