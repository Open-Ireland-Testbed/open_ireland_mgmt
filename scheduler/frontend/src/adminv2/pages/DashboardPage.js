import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboard, fetchBookings } from '../api';
import StatCard from '../components/StatCard';
import ActivityFeed from '../components/ActivityFeed';
import DeviceHealthPanel from '../components/DeviceHealthPanel';
import AlertsPanel from '../components/AlertsPanel';
import { formatNumber, formatRelative } from '../utils/formatters';

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data, status } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchDashboard,
    staleTime: 30 * 1000,
  });

  const approvalsPreview = useQuery({
    queryKey: ['admin-dashboard-approvals-preview'],
    queryFn: () => fetchBookings({ status: 'PENDING', limit: 5 }),
    staleTime: 15 * 1000,
  });

  const cards = data?.cards || [];
  const deviceCounts = data?.device_counts;
  const recentActivity = data?.recent_activity || [];
  const topologyConflicts = data?.topology_conflicts || [];

  const pendingApprovals = approvalsPreview.data?.items || [];

  const kpis = useMemo(() => {
    if (status !== 'success') {
      return [];
    }
    const pendingCard = cards.find((card) => card.id === 'pending_approvals');
    const slaCard = cards.find((card) => card.id === 'sla_breaches');
    return [
      {
        id: 'approvals',
        label: 'Pending approvals',
        value: pendingCard?.value ?? 0,
        delta: pendingCard?.delta ?? 0,
        trend: pendingCard?.sparkline || pendingCard?.trend || [],
        href: () => navigate('/admin/approvals'),
        hint: 'vs last week',
      },
      {
        id: 'conflicts',
        label: 'Active conflicts',
        value: topologyConflicts.length,
        delta: 0,
        trend: topologyConflicts.map((conflict) => conflict.conflict_count),
        href: () => navigate('/admin/approvals?conflictOnly=1'),
        hint: 'Require resolution',
      },
      {
        id: 'devices',
        label: 'Offline / Maintenance',
        value: (deviceCounts?.offline || 0) + (deviceCounts?.maintenance || 0),
        delta: 0,
        trend: [deviceCounts?.offline || 0, deviceCounts?.maintenance || 0],
        href: () => navigate('/admin/devices'),
        hint: `${formatNumber(deviceCounts?.offline || 0)} offline, ${formatNumber(deviceCounts?.maintenance || 0)} maintenance`,
      },
      {
        id: 'sla',
        label: 'SLA breaches today',
        value: slaCard?.value ?? 0,
        delta: slaCard?.delta ?? 0,
        trend: slaCard?.sparkline || slaCard?.trend || [],
        href: () => navigate('/admin/logs'),
        hint: 'Approvals over 15 min',
      },
    ];
  }, [cards, deviceCounts, topologyConflicts, status]);

  const alerts = useMemo(() => {
    if (status !== 'success') {
      return [];
    }
    const list = [];
    topologyConflicts.forEach((item) => {
      list.push({
        id: `conflict-${item.topology_id}`,
        severity: 'critical',
        title: `${item.name} has ${item.conflict_count} conflict${item.conflict_count === 1 ? '' : 's'}`,
        description: 'Resolve to unblock dependent bookings.',
        timestamp: item.last_updated || new Date().toISOString(),
        href: `/admin/topologies?focus=${item.topology_id}`,
        tag: 'Topology',
      });
    });

    const pendingCount = cards.find((card) => card.id === 'pending_approvals')?.value ?? 0;
    if (pendingCount > 50) {
      list.push({
        id: 'queue',
        severity: 'warning',
        title: 'Approval queue is growing',
        description: `${pendingCount} requests waiting. Consider triaging escalations.`,
        timestamp: new Date().toISOString(),
        href: '/admin/approvals',
        tag: 'Queue',
      });
    }

    if ((deviceCounts?.offline || 0) > 0) {
      list.push({
        id: 'offline',
        severity: 'critical',
        title: `${deviceCounts.offline} device${deviceCounts.offline === 1 ? '' : 's'} offline`,
        description: 'Impacts scheduling availability.',
        timestamp: new Date().toISOString(),
        href: '/admin/devices',
        tag: 'Devices',
      });
    }

    const slaBreaches = cards.find((card) => card.id === 'sla_breaches')?.value ?? 0;
    if (slaBreaches > 0) {
      list.push({
        id: 'sla',
        severity: 'warning',
        title: 'SLA breaches detected',
        description: `${slaBreaches} approval${slaBreaches === 1 ? '' : 's'} exceeded 15 minutes today.`,
        timestamp: new Date().toISOString(),
        href: '/admin/logs',
        tag: 'SLA',
      });
    }

    return list;
  }, [cards, deviceCounts, topologyConflicts, status]);

  if (status === 'pending') {
    return (
      <div className="grid gap-6">
        <div className="h-32 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 animate-pulse" />
        <div className="h-64 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 animate-pulse" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-6">
        <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">Dashboard unavailable</h3>
        <p className="mt-2 text-sm text-red-600 dark:text-red-200">
          Unable to load admin metrics right now. Please refresh and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Admin</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Monitor, approve, and unblock bookings.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((card) => (
          <StatCard
            key={card.id}
            label={card.label}
            value={card.value}
            delta={card.delta}
            deltaDirection={card.delta >= 0 ? 'up' : 'down'}
            hint={card.hint}
            onClick={card.href}
            trend={card.trend}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="space-y-4 lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Quick actions</h2>
            <div className="mt-3 space-y-2 text-sm">
              <button
                type="button"
                onClick={() => navigate('/admin/approvals')}
                className="block w-full rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Review queue
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/approvals?conflictOnly=1')}
                className="block w-full rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Resolve conflicts
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/devices')}
                className="block w-full rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Device health
              </button>
            </div>
          </div>
        </aside>

        <section className="space-y-4 lg:col-span-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Approvals queue</h2>
              <button
                type="button"
                onClick={() => navigate('/admin/approvals')}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Open workspace
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {pendingApprovals.length ? (
                pendingApprovals.map((item) => (
                  <button
                    key={`preview-${item.booking_id}`}
                    type="button"
                    onClick={() => navigate(`/admin/approvals?focus=${item.booking_id}`)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">#{item.booking_id} · {item.device.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {item.user.username} · {formatRelative(item.start_time)}
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      {item.status}
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  No pending approvals. Tip: switch to “All” or broaden the date range.
                </div>
              )}
            </div>
          </div>
          <ActivityFeed items={recentActivity} />
        </section>

        <aside className="space-y-4 lg:col-span-3">
          <DeviceHealthPanel />
          <AlertsPanel
            alerts={alerts}
            onNavigate={(alert) => {
              if (alert.href) navigate(alert.href);
            }}
            onSelect={(alert, assignee) => {
              if (assignee && assignee !== 'Unassigned') {
                console.info(`Assigning ${alert.id} to ${assignee}`);
              }
            }}
          />
        </aside>
      </div>
    </div>
  );
}

