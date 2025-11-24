import React, { useState } from 'react';
import { formatRelative } from '../utils/formatters';

const SEVERITY_STYLES = {
  critical: {
    dot: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-300',
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
  },
  warning: {
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-300',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  },
  info: {
    dot: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-300',
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  },
};

const ASSIGNEES = ['Unassigned', 'You', 'On-call', 'Ops', 'SRE'];

export default function AlertsPanel({ alerts, onSelect, onNavigate }) {
  const [assignments, setAssignments] = useState({});

  if (!alerts || alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Alerts</h2>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          No alerts in queue. Tip: monitor conflict candidates or offline devices.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Alerts</h2>
        <span className="text-xs text-slate-400">{alerts.length}</span>
      </div>
      <ul className="mt-3 space-y-3 text-sm">
        {alerts.map((alert) => {
          const severity = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
          const assignment = assignments[alert.id] ?? 'Unassigned';
          return (
            <li
              key={alert.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-2 w-2 rounded-full ${severity.dot}`} aria-hidden="true" />
                    <span className={`text-xs font-semibold uppercase tracking-wide ${severity.text}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{alert.title}</div>
                  {alert.description && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{alert.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate?.(alert)}
                  className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  View
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>{alert.timestamp ? formatRelative(alert.timestamp) : 'Just now'}</span>
                <span className={`rounded-full px-2 py-0.5 font-semibold ${severity.chip}`}>
                  {alert.tag || 'Approval'}
                </span>
                <label className="ml-auto flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <span>Assign:</span>
                  <select
                    value={assignment}
                    onChange={(event) => {
                      const value = event.target.value;
                      setAssignments((prev) => ({ ...prev, [alert.id]: value }));
                      onSelect?.(alert, value);
                    }}
                    className="rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ASSIGNEES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

