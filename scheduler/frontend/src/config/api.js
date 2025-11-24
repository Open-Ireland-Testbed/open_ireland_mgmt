// Centralized API configuration
// This file provides a single source of truth for API base URL
// Ports can be changed in docker-compose.yml via REACT_APP_API_URL

// Read from environment variable if set, otherwise construct from current hostname
const getApiBaseUrl = () => {
  // Always use the current hostname to ensure same-origin for cookies
  // This fixes cross-origin cookie issues when accessing via IP address
  const hostname = window.location.hostname;
  const defaultPort = 25001; // Default backend port (matches docker-compose)
  const apiUrl = `http://${hostname}:${defaultPort}`;

  // If REACT_APP_API_URL is set and matches current hostname, use it
  // Otherwise, use current hostname to ensure same-origin
  if (process.env.REACT_APP_API_URL) {
    const envUrl = process.env.REACT_APP_API_URL;
    // If env URL uses same hostname, use it; otherwise use current hostname
    try {
      const envHost = new URL(envUrl).hostname;
      if (envHost === hostname || envHost === 'localhost' || envHost === '127.0.0.1') {
        return envUrl.replace(envHost, hostname); // Replace with current hostname
      }
    } catch (e) {
      // Invalid URL, fall through to default
    }
  }

  return apiUrl;
};

export const API_BASE_URL = getApiBaseUrl();

