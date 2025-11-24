import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
// Import shared UI styles
// Note: CSS imports from node_modules are handled differently - we'll import via @tcdona/ui if needed
// For now, skip this import as it may cause issues with CRA
import App from './App';
import reportWebVitals from './reportWebVitals';

// Additional error suppression layer
if (typeof window !== 'undefined') {
  const originalErrorHandler = window.__REACT_ERROR_OVERLAY_GLOBAL_HANDLER__;
  if (originalErrorHandler) {
    window.__REACT_ERROR_OVERLAY_GLOBAL_HANDLER__ = function(error, isFatal) {
      const errorMessage = error?.message || error?.toString() || '';
      if (errorMessage.includes('ResizeObserver')) {
        return;
      }
      if (originalErrorHandler) {
        return originalErrorHandler.call(this, error, isFatal);
      }
    };
  }

  const errorHandler = (e) => {
    if (e.message?.includes('ResizeObserver')) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return false;
    }
  };
  window.addEventListener('error', errorHandler, true);

  const rejectionHandler = (e) => {
    const reason = e.reason?.toString() || e.reason?.message || '';
    if (reason.includes('ResizeObserver')) {
      e.preventDefault();
    }
  };
  window.addEventListener('unhandledrejection', rejectionHandler);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();

