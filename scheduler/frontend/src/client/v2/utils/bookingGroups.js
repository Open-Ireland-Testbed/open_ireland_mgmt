export function groupDatesIntoRanges(dates = []) {
  const sorted = [...new Set(dates)].sort((a, b) => new Date(a) - new Date(b));
  if (sorted.length === 0) {
    return [];
  }

  const ranges = [];
  let rangeStart = sorted[0];
  let prevDate = new Date(sorted[0]);

  for (let i = 1; i < sorted.length; i++) {
    const currentDate = new Date(sorted[i]);
    const diffDays = Math.round((currentDate - prevDate) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) {
      ranges.push({ start: rangeStart, end: prevDate.toISOString().split('T')[0] });
      rangeStart = sorted[i];
    }
    prevDate = currentDate;
  }

  ranges.push({ start: rangeStart, end: prevDate.toISOString().split('T')[0] });
  return ranges;
}

export function summarizeDevices(devices = []) {
  const names = devices
    .map((device) => device.device_name || device.deviceName || 'Device')
    .filter(Boolean);
  if (names.length === 0) {
    return 'No devices';
  }
  if (names.length <= 3) {
    return names.join(', ');
  }
  return `${names.slice(0, 3).join(', ')}…`;
}

export function formatDateRangeLabel(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameDay = startDate.toDateString() === endDate.toDateString();
  if (sameDay) {
    return startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

export function buildGalleryEntries(group) {
  const deviceMap = new Map();
  (group.devices || []).forEach((device) => {
    const ranges = groupDatesIntoRanges(device.dates || []);
    deviceMap.set(device.device_id, {
      deviceName: device.device_name || device.deviceName || 'Device',
      deviceType: device.device_type || device.deviceType || 'Device',
      ranges,
    });
  });
  return Array.from(deviceMap.values());
}

export function buildGroupSummary(group) {
  const deviceCount = group.device_count || (group.devices ? group.devices.length : 0);
  return {
    deviceSummary: summarizeDevices(group.devices || []),
    totalDevices: deviceCount,
    dateSummary: formatDateRangeLabel(group.start_date, group.end_date),
    hasMultipleDates: group.start_date !== group.end_date,
    gallery: buildGalleryEntries(group),
  };
}

export function mergeGroupedBookingEntries(groups = []) {
  const dedupedMap = new Map();
  const statusPriority = (status) => {
    const order = {
      CANCELLED: 0,
      DECLINED: 1,
      REJECTED: 1,
      EXPIRED: 2,
      PENDING: 3,
      CONFLICTING: 3,
      APPROVED: 4,
      CONFIRMED: 4,
    };
    return order[(status || '').toUpperCase()] ?? 5;
  };

  groups.forEach((group) => {
    if (!group) {
      return;
    }

    const key = group.grouped_booking_id || `single:${group.booking_id ?? Math.random()}`;
    const existing = dedupedMap.get(key);

    const normalizeDevices = (devices = []) =>
      devices.map((device) => ({
        ...device,
        dates: Array.isArray(device.dates) ? [...new Set(device.dates)] : [],
      }));

    if (!existing) {
      dedupedMap.set(key, {
        ...group,
        collaborators: Array.from(new Set(group.collaborators || [])),
        devices: normalizeDevices(group.devices),
      });
      return;
    }

    if (!existing.is_owner && group.is_owner) {
      dedupedMap.set(key, {
        ...group,
        collaborators: Array.from(new Set(group.collaborators || [])),
        devices: normalizeDevices(group.devices),
      });
      return;
    }

    const statusCandidates = [existing.status, group.status].filter(Boolean);
    statusCandidates.sort((a, b) => statusPriority(a) - statusPriority(b));
    const mergedStatus = statusCandidates[0] || 'PENDING';

    const collaboratorSet = new Set([
      ...(existing.collaborators || []),
      ...(group.collaborators || []),
    ]);

    const devicesMap = new Map();
    normalizeDevices(existing.devices).forEach((device) => {
      devicesMap.set(device.device_id, { ...device });
    });
    normalizeDevices(group.devices).forEach((device) => {
      if (!devicesMap.has(device.device_id)) {
        devicesMap.set(device.device_id, { ...device });
      } else {
        const entry = devicesMap.get(device.device_id);
        entry.dates = Array.from(new Set([...(entry.dates || []), ...(device.dates || [])]));
      }
    });

    const startDate =
      existing.start_date && group.start_date
        ? (existing.start_date < group.start_date ? existing.start_date : group.start_date)
        : existing.start_date || group.start_date;
    const endDate =
      existing.end_date && group.end_date
        ? (existing.end_date > group.end_date ? existing.end_date : group.end_date)
        : existing.end_date || group.end_date;

    dedupedMap.set(key, {
      ...existing,
      ...group,
      status: mergedStatus,
      collaborators: Array.from(collaboratorSet),
      devices: Array.from(devicesMap.values()),
      device_count: devicesMap.size,
      start_date: startDate,
      end_date: endDate,
    });
  });

  return Array.from(dedupedMap.values()).map((group) => ({
    ...group,
    summary: buildGroupSummary(group),
  }));
}

