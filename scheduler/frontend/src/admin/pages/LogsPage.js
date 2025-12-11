import React from 'react';
import PageHeader from '../components/PageHeader';

export default function LogsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Logs & Audit"
                subtitle="View system logs and audit trails"
            />
            <div className="glass-card rounded-xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
                <p className="text-gray-600 dark:text-gray-400">
                    TODO: Implement log viewer with filtering, search, and export capabilities.
                </p>
            </div>
        </div>
    );
}

