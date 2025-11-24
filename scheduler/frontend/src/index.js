import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import QueryProvider from './providers/QueryProvider';

// Additional error suppression layer (backup to HTML script)
// React's error overlay handler is already suppressed by the script in index.html
if (typeof window !== 'undefined') {
  // Override any error overlay handlers that might have been set
  const originalErrorHandler = window.__REACT_ERROR_OVERLAY_GLOBAL_HANDLER__;
  if (originalErrorHandler) {
    window.__REACT_ERROR_OVERLAY_GLOBAL_HANDLER__ = function(error, isFatal) {
      const errorMessage = error?.message || error?.toString() || '';
      if (errorMessage.includes('ResizeObserver')) {
        return; // Suppress ResizeObserver errors from error overlay
      }
      if (originalErrorHandler) {
        return originalErrorHandler.call(this, error, isFatal);
      }
    };
  }

  // Backup error listeners (in case HTML script didn't run)
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
    <QueryProvider>
      <App />
    </QueryProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
