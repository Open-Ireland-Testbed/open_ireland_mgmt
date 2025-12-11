import React from 'react';
import PageHeader from '../components/PageHeader';

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Settings"
                subtitle="Configure system settings and preferences"
            />
            <div className="glass-card rounded-xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
                <p className="text-gray-600 dark:text-gray-400">
                    TODO: Implement system settings, notification preferences, and integration configuration.
                </p>
            </div>
        </div>
    );
}

