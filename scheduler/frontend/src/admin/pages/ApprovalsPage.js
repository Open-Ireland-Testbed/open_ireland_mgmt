import React from 'react';
import PageHeader from '../components/PageHeader';

export default function ApprovalsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Approvals"
                subtitle="Review and approve pending booking requests"
            />
            <div className="glass-card rounded-xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
                <p className="text-gray-600 dark:text-gray-400">
                    TODO: Implement approval board with filtering, bulk actions, and detailed review.
                </p>
            </div>
        </div>
    );
}

