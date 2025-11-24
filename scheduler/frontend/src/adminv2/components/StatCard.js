import React from 'react';
import { formatDelta, formatNumber } from '../utils/formatters';

function DeltaBadge({ delta, direction }) {
  if (delta === null || delta === undefined) return null;
  const formatted = formatDelta(delta);
  const positive = delta >= 0;
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
        positive
          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
          : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
      ].join(' ')}
    >
      {positive ? '▲' : '▼'} {formatted}
    </span>
  );
}

function Sparkline({ data }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((point, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((point - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" className="mt-4 h-10 w-full text-blue-500" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function StatCard({ label, value, delta, deltaDirection, hint, icon, onClick, trend }) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-5 shadow-sm text-left',
        onClick ? 'transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
            {label}
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {formatNumber(value)}
          </div>
        </div>
        {icon && (
          <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-lg">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <DeltaBadge delta={delta} direction={deltaDirection} />
        {hint && (
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {hint}
          </div>
        )}
      </div>
      <Sparkline data={trend} />
    </Wrapper>
  );
}

