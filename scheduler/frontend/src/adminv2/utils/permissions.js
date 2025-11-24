export function canEditBookings(permissions) {
  return Boolean(permissions?.['bookings:write']);
}

export function canExportBookings(permissions) {
  return Boolean(permissions?.['bookings:export']);
}

export function canEditDevices(permissions) {
  return Boolean(permissions?.['devices:write']);
}

export function canEditUsers(permissions) {
  return Boolean(permissions?.['users:write']);
}

export function canEditSettings(permissions) {
  return Boolean(permissions?.['settings:write']);
}

export function canExportLogs(permissions) {
  return Boolean(permissions?.['logs:export']);
}

export function canActOnTopologies(permissions) {
  return Boolean(permissions?.['topologies:write']);
}

