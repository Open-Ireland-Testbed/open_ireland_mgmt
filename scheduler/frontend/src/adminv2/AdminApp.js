import React, { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import CryptoJS from 'crypto-js';

import { ToastProvider, useToastContext } from '../contexts/ToastContext';
import { AdminProvider } from './context/AdminContext';
import {
  getSession,
  adminRequest,
} from './api';
import AdminLayout from './components/AdminLayout';
import DashboardPage from './pages/DashboardPage';
import ApprovalsPage from './pages/ApprovalsPage';
import BookingsPage from './pages/BookingsPage';
import DevicesPage from './pages/DevicesPage';
import UsersPage from './pages/UsersPage';
import TopologiesPage from './pages/TopologiesPage';
import LogsPage from './pages/LogsPage';
import SettingsPage from './pages/SettingsPage';
import LoginGate from './pages/LoginGate';
import WhatIsNewTour from './pages/WhatIsNewTour';

function AdminAppInner() {
  const queryClient = useQueryClient();
  const toast = useToastContext();
  const {
    data: session,
    status,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-session'],
    queryFn: () => getSession(),
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }) => {
      const hashedPassword = CryptoJS.SHA256(password).toString();
      await adminRequest('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password: hashedPassword }),
      });
    },
    onSuccess: async () => {
      toast.success('Signed in successfully.');
      await queryClient.invalidateQueries({ queryKey: ['admin-session'] });
    },
    onError: (err) => {
      toast.error(err?.message || 'Unable to sign in.');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () =>
      adminRequest('/logout', {
        method: 'POST',
      }),
    onSuccess: async () => {
      toast.success('Signed out successfully.');
      await queryClient.invalidateQueries({ queryKey: ['admin-session'] });
    },
    onError: (err) => {
      toast.error(err?.message || 'Unable to sign out.');
    },
  });

  const adminState = useMemo(() => {
    if (!session) {
      return null;
    }
    return {
      session,
      role: session.role,
      status: session.status,
      permissions: session.permissions || {},
      logout: () => logoutMutation.mutate(),
      refetchSession: refetch,
    };
  }, [logoutMutation, refetch, session]);

  if (status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-sm text-gray-500 dark:text-gray-300 animate-pulse">Loading admin app…</div>
      </div>
    );
  }

  if (status === 'error' && error?.status !== 401) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md rounded-lg border border-red-200 bg-white dark:bg-gray-800 dark:border-red-700 p-6 shadow">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-300 mb-2">Unable to load admin session</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">{error?.message || 'Unexpected error occurred.'}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isAuthenticated = Boolean(session);
  const isActiveAdmin = Boolean(session && session.status === 'active');

  if (!isAuthenticated || !isActiveAdmin) {
    return (
      <LoginGate
        onLogin={(credentials) => loginMutation.mutate(credentials)}
        loading={loginMutation.isPending}
        error={
          error?.status === 401
            ? 'You must sign in with an admin account to access this area.'
            : loginMutation.error?.message
        }
      />
    );
  }

  return (
    <AdminProvider value={adminState}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex">
        <WhatIsNewTour />
        <AdminLayout>
          <Routes>
            <Route index element={<Navigate to="approvals" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="topologies" element={<TopologiesPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/admin/approvals" replace />} />
          </Routes>
        </AdminLayout>
      </div>
    </AdminProvider>
  );
}

export default function AdminApp() {
  return (
    <ToastProvider>
      <AdminAppInner />
    </ToastProvider>
  );
}

