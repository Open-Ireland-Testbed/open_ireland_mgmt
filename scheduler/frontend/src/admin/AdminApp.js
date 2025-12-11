import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../contexts/ToastContext';
import AdminShell from './AdminShell';
import AdminDashboard from './pages/AdminDashboard';
import ApprovalsPage from './pages/ApprovalsPage';
import ConflictsPage, { ConflictDetailPage } from './pages/ConflictsPage';
import UtilizationInsightsPage from './pages/UtilizationInsightsPage';
import RulesEnginePage from './pages/RulesEnginePage';
import PrioritySeasonPage from './pages/PrioritySeasonPage';
import UsersAndRolesPage from './pages/UsersAndRolesPage';
import LogsPage from './pages/LogsPage';
import SettingsPage from './pages/SettingsPage';

// Create a query client for admin app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function AdminApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Routes>
          <Route element={<AdminShell />}>
            <Route index element={<Navigate to="/admin" replace />} />
            <Route path="/" element={<AdminDashboard />} />
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="conflicts" element={<ConflictsPage />} />
            <Route path="conflicts/:id" element={<ConflictDetailPage />} />
            <Route path="utilization" element={<UtilizationInsightsPage />} />
            <Route path="rules" element={<RulesEnginePage />} />
            <Route path="priority" element={<PrioritySeasonPage />} />
            <Route path="users" element={<UsersAndRolesPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </QueryClientProvider>
  );
}

