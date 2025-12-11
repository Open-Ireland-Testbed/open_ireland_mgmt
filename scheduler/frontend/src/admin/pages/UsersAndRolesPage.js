import React from 'react';
import PageHeader from '../components/PageHeader';

export default function UsersAndRolesPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Users & Roles"
                subtitle="Manage user accounts, roles, and permissions"
            />
            <div className="glass-card rounded-xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
                <p className="text-gray-600 dark:text-gray-400">
                    TODO: Implement user management, role assignment, and permission configuration.
                </p>
            </div>
        </div>
    );
}

