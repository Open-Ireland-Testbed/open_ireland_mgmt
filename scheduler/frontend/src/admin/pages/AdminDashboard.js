import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboard, fetchBookings } from '../../adminv2/api';
import useAdminStore from '../../store/adminStore';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isPrioritySeason } = useAdminStore();

  // Fetch dashboard data
  const { data: dashboardData, status: dashboardStatus } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchDashboard,
    staleTime: 30 * 1000,
  });

  // Fetch pending approvals preview
  const { data: approvalsData } = useQuery({
    queryKey: ['admin-dashboard-approvals'],
    queryFn: () => fetchBookings({ status: 'PENDING', limit: 5 }),
    staleTime: 15 * 1000,
  });

  // Fetch conflicts preview
  const { data: conflictsData } = useQuery({
    queryKey: ['admin-dashboard-conflicts'],
    queryFn: () => fetchBookings({ status: 'CONFLICTING', limit: 5 }),
    staleTime: 15 * 1000,
  });

  const pendingCount = dashboardData?.cards?.find((c) => c.id === 'pending_approvals')?.value ?? 0;
  const conflictsCount = conflictsData?.items?.length ?? 0;
  const topologyConflicts = dashboardData?.topology_conflicts || [];
  const deviceCounts = dashboardData?.device_counts || {};
  const recentActivity = dashboardData?.recent_activity || [];

  if (dashboardStatus === 'pending') {
    return (
      <div className="space-y-6">
        <div className="h-32 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Monitor, approve, and manage lab bookings and resources.
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Need Your Attention Card */}
        <div className="glass-card rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Need Your Attention</h3>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/admin/approvals')}
              className="w-full text-left flex items-center justify-between p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-sm text-gray-600 dark:text-gray-400">Pending Approvals</span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{pendingCount}</span>
            </button>
            <button
              onClick={() => navigate('/admin/conflicts')}
              className="w-full text-left flex items-center justify-between p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-sm text-gray-600 dark:text-gray-400">Active Conflicts</span>
              <span className="text-lg font-bold text-red-600 dark:text-red-400">{conflictsCount}</span>
            </button>
            <div className="w-full text-left flex items-center justify-between p-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Offline Devices</span>
              <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                {(deviceCounts?.offline || 0) + (deviceCounts?.maintenance || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Today & This Week Card */}
        <div className="glass-card rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Today & This Week</h3>
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <div className="flex justify-between mb-1">
                <span>Devices booked today</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {dashboardData?.today_bookings || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Bookings this week</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {dashboardData?.week_bookings || 0}
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin/approvals')}
              className="w-full mt-4 glass-button py-2 text-sm font-semibold rounded-md"
            >
              Open Approvals Board
            </button>
          </div>
        </div>

        {/* Conflicts Snapshot Card */}
        <div className="glass-card rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Conflicts Snapshot</h3>
          {conflictsData?.items && conflictsData.items.length > 0 ? (
            <div className="space-y-2 mb-4">
              {conflictsData.items.slice(0, 3).map((conflict) => (
                <div key={conflict.booking_id} className="text-xs text-gray-600 dark:text-gray-400 p-2 rounded bg-gray-50 dark:bg-gray-800">
                  <div className="font-semibold">{conflict.device?.name || 'Unknown Device'}</div>
                  <div>{conflict.user?.username || 'Unknown User'}</div>
                  <div className="text-gray-500 dark:text-gray-500">
                    {new Date(conflict.start_time).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No active conflicts</p>
          )}
          <button
            onClick={() => navigate('/admin/conflicts')}
            className="w-full glass-button py-2 text-sm font-semibold rounded-md"
          >
            Review All Conflicts
          </button>
        </div>

        {/* Rules Summary Card */}
        <div className="glass-card rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Rules Summary</h3>
          <div className="space-y-2 mb-4">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <div className="p-2 rounded bg-gray-50 dark:bg-gray-800">
                Auto-approve when utilization &lt; 70%
              </div>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <div className="p-2 rounded bg-gray-50 dark:bg-gray-800">
                Auto-approve NTT collaborators
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 italic">
              TODO: Load from rules engine
            </div>
          </div>
          <button
            onClick={() => navigate('/admin/rules')}
            className="w-full glass-button py-2 text-sm font-semibold rounded-md"
          >
            Open Rules Engine
          </button>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Utilization & Fairness Card */}
        <div className="glass-card rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Utilization & Fairness</h3>
          <div className="space-y-2 mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
              Top 3 users by usage (last 30 days)
            </p>
            <div className="space-y-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-xs text-gray-600 dark:text-gray-400 p-2 rounded bg-gray-50 dark:bg-gray-800">
                  <div className="flex justify-between">
                    <span>User {i}</span>
                    <span className="font-semibold">{(Math.random() * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 italic mt-2">
              TODO: Wire to utilization API
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/utilization')}
            className="w-full glass-button py-2 text-sm font-semibold rounded-md"
          >
            View Full Insights
          </button>
        </div>

        {/* Priority Season Card */}
        <div className="glass-card rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Priority Season</h3>
          {isPrioritySeason ? (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Priority Season is Active</p>
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                  Planned allocations: <span className="font-semibold">0</span> (TODO)
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-300">
                  Deviations: <span className="font-semibold">0</span> (TODO)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/admin/priority')}
                  className="flex-1 glass-button py-2 text-sm font-semibold rounded-md"
                >
                  Review Plan
                </button>
                <button
                  onClick={() => navigate('/admin/priority?view=deviations')}
                  className="flex-1 glass-button py-2 text-sm font-semibold rounded-md"
                >
                  View Deviations
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Priority Season is currently off.
              </p>
              <button
                onClick={() => navigate('/admin/priority')}
                className="w-full glass-button py-2 text-sm font-semibold rounded-md"
              >
                Plan Priority Season
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

