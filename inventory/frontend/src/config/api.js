// Centralized API configuration for Inventory Management
// This file provides a single source of truth for API base URLs

// Read from environment variable if set, otherwise construct from current hostname
const getInventoryApiBaseUrl = () => {
  // If REACT_APP_API_URL is set, use it directly
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Fallback: construct from current hostname and default port
  // This is useful for local development
  const hostname = window.location.hostname;
  const defaultPort = 25001; // Default backend port (matches docker-compose and scheduler frontend)
  return `http://${hostname}:${defaultPort}`;
};

const getSchedulerApiBaseUrl = () => {
  // Optional: for future cross-calls to scheduler API
  if (process.env.REACT_APP_SCHEDULER_API_URL) {
    return process.env.REACT_APP_SCHEDULER_API_URL;
  }
  
  // Fallback: construct from current hostname and scheduler port
  const hostname = window.location.hostname;
  const defaultPort = 20001; // Default scheduler backend port
  return `http://${hostname}:${defaultPort}`;
};

export const INVENTORY_API_BASE_URL = getInventoryApiBaseUrl();
export const SCHEDULER_API_BASE_URL = getSchedulerApiBaseUrl();

