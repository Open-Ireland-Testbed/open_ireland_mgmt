import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDevices } from '../api';
import { useToastContext } from '../../contexts/ToastContext';
import { formatRelative } from '../utils/formatters';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'offline', label: 'Offline' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'rate-limited', label: 'Rate-limited' },
  { key: 'metadata', label: 'Needs metadata' },
];

function deviceMatchesTab(device, tab) {
  const status = device.status?.toLowerCase() || '';
  switch (tab) {
    case 'offline':
      return status.includes('offline');
    case 'maintenance':
      return status.includes('maintenance');
    case 'rate-limited':
      return Boolean(device.health?.metrics?.rateLimited);
    case 'metadata':
      return !device.owner?.username || !(device.tags && device.tags.length);
    default:
      return true;
  }
}

function impactLabel(device) {
  if (device.health?.metrics?.nextBookingImpact) {
    return device.health.metrics.nextBookingImpact;
  }
  if (device.health?.metrics?.upcomingBookings) {
    return `Blocks ${device.health.metrics.upcomingBookings} bookings`;
  }
  return 'No upcoming impact';
}

export default function DeviceHealthPanel() {
  const toast = useToastContext();
  const [tab, setTab] = useState('all');

  const devicesQuery = useQuery({
    queryKey: ['admin-dashboard-device-health'],
    queryFn: () => fetchDevices({}),
    staleTime: 15 * 1000,
  });

  const devices = devicesQuery.data?.items || [];

  const filtered = useMemo(() => {
    return devices.filter((device) => deviceMatchesTab(device, tab));
  }, [devices, tab]);

  if (devicesQuery.status === 'pending') {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
        <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="mt-4 space-y-2">
          <div className="h-14 rounded-lg bg-slate-100 dark:bg-slate-900/30 animate-pulse" />
          <div className="h-14 rounded-lg bg-slate-100 dark:bg-slate-900/30 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Device health</h2>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{devices.length} devices</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={[
              'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              tab === item.key
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
            ].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-3 text-sm">
        {filtered.length ? (
          filtered.slice(0, 5).map((device) => (
            <div
              key={device.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{device.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{device.type}</div>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {device.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>Owner: {device.owner?.username || 'Unassigned'}</span>
                <span>Last heartbeat: {device.last_updated ? formatRelative(device.last_updated) : 'n/a'}</span>
                <span>{impactLabel(device)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => toast.info('Maintenance workflow coming soon.')}
                  className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Mark maintenance
                </button>
                <button
                  type="button"
                  onClick={() => toast.info('Owner notification coming soon.')}
                  className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Notify owner
                </button>
                <button
                  type="button"
                  onClick={() => toast.info('De-listing coming soon.')}
                  className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  De-list
                </button>
                <button
                  type="button"
                  onClick={() => toast.info('Connectivity test coming soon.')}
                  className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Re-test
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            No devices in this state. Tip: switch tabs or open the full inventory.
          </div>
        )}
      </div>
    </div>
  );
}

