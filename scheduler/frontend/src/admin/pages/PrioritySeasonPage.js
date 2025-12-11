import React from 'react';
import PageHeader from '../components/PageHeader';
import useAdminStore from '../../store/adminStore';

export default function PrioritySeasonPage() {
    const { isPrioritySeason, setPrioritySeason } = useAdminStore();

    return (
        <div className="space-y-6">
            <PageHeader
                title="Priority Season"
                subtitle="Plan and manage conference or priority allocation periods"
            />
            <div className="glass-card rounded-xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Priority Season Status</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {isPrioritySeason ? 'Currently active' : 'Currently inactive'}
                            </p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isPrioritySeason}
                                onChange={(e) => setPrioritySeason(e.target.checked)}
                                className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Enable Priority Season
                            </span>
                        </label>
                    </div>
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-gray-600 dark:text-gray-400">
                            TODO: Implement priority season planning, allocation management, and deviation tracking.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

