import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, AppShell, Sidebar, Header } from '@tcdona/ui';
import QueryProvider from './providers/QueryProvider';
import { ToastProvider } from './contexts/ToastContext';
import { NAV_ITEMS } from './config/navigation';
import DevicesListPage from './routes/DevicesListPage';
import DeviceDetailPage from './routes/DeviceDetailPage';
import DeviceTypesPage from './routes/DeviceTypesPage';
import ManufacturersPage from './routes/ManufacturersPage';
import SitesPage from './routes/SitesPage';
import TagsPage from './routes/TagsPage';
import StatsPage from './routes/StatsPage';

function AppContent() {
  return (
    <AppShell
      sidebar={<Sidebar items={NAV_ITEMS} />}
      header={<Header title="Open Ireland Inventory" />}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/devices" replace />} />
        <Route path="/devices" element={<DevicesListPage />} />
        <Route path="/devices/:deviceId" element={<DeviceDetailPage />} />
        <Route path="/device-types" element={<DeviceTypesPage />} />
        <Route path="/manufacturers" element={<ManufacturersPage />} />
        <Route path="/sites" element={<SitesPage />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Routes>
    </AppShell>
  );
}

function App() {
  return (
    <QueryProvider>
      <ThemeProvider defaultTheme="light">
        <ToastProvider>
          <Router>
            <AppContent />
          </Router>
        </ToastProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}

export default App;

