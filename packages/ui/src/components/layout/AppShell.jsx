// TODO: Implement component (placeholder)
import React from 'react';

export default function AppShell({ children, sidebar, header }) {
  return (
    <div className="app-shell h-screen flex flex-col">
      {header}
      <div className="flex flex-1 overflow-hidden">
        {sidebar}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}

