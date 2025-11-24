import dayjs from 'dayjs';

export function formatDateTime(value, pattern = 'MMM D, YYYY HH:mm') {
  if (!value) return '—';
  return dayjs(value).format(pattern);
}

export function formatRelative(value) {
  if (!value) return '—';
  const diff = dayjs().diff(dayjs(value), 'minute');
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff} min ago`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(diff / 1440);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return dayjs(value).format('MMM D, YYYY');
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat().format(value);
}

export function formatDelta(delta) {
  if (delta === null || delta === undefined) return null;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `${sign}${Math.abs(delta)}`;
}

