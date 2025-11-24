import React, { createContext, useContext } from 'react';

export const AdminContext = createContext(null);

export function AdminProvider({ value, children }) {
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminContext() {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdminContext must be used within an AdminProvider');
  }
  return ctx;
}

