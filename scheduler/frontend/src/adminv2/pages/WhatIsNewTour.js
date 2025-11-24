import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'admin-v2-whats-new-dismissed';

export default function WhatIsNewTour() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-sm">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-xl rounded-2xl p-5 space-y-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-blue-500 font-semibold">What&apos;s new</div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">Unified admin console</h3>
        </div>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside">
          <li>Dashboard-first workflows for approvals, devices, and conflicts.</li>
          <li>Bulk actions and filters across bookings, devices, and users.</li>
          <li>Keyboard-friendly navigation to match the client v2 experience.</li>
        </ul>
        <button
          type="button"
          className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => {
            setVisible(false);
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(STORAGE_KEY, 'true');
            }
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

