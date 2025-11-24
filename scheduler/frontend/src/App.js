import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ClientRoute from './client/ClientRoute';
import Admin from './admin/admin';
import AdminApp from './adminv2/AdminApp';
import TopologyBuilder from './topology/TopologyBuilder';
import BookingsPageWrapper from './client/BookingsPageWrapper';
import ProtectedAdminRoute from './routes/ProtectedAdminRoute';
import useAuthStore from './store/authStore';

function App() {
  // Initialize auth on app startup - use stable selector
  const initialize = useAuthStore.getState().initialize;
  
  useEffect(() => {
    // Only initialize once on mount
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/client" />} />
        <Route path="/client" element={<ClientRoute />} />
        <Route 
          path="/admin/*" 
          element={
            <ProtectedAdminRoute>
              <AdminApp />
            </ProtectedAdminRoute>
          } 
        />
        <Route 
          path="/admin/legacy" 
          element={
            <ProtectedAdminRoute>
              <Admin />
            </ProtectedAdminRoute>
          } 
        />
        <Route path="/topology" element={<TopologyBuilder />} />
        <Route path="/bookings" element={<BookingsPageWrapper />} />
      </Routes>
    </Router>
  );
}

export default App;
