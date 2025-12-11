import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchBookings, fetchBookingDetail } from '../../adminv2/api';
import Modal from '../components/Modal';

export default function ConflictsPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [selectedConflictId, setSelectedConflictId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Fetch conflicts
    const { data: conflictsData, status } = useQuery({
        queryKey: ['admin-conflicts'],
        queryFn: () => fetchBookings({ status: 'CONFLICTING' }),
        staleTime: 15 * 1000,
    });

    // Fetch selected conflict detail if modal is open
    const { data: conflictDetail } = useQuery({
        queryKey: ['admin-conflict-detail', selectedConflictId],
        queryFn: () => fetchBookingDetail(selectedConflictId),
        enabled: !!selectedConflictId && isModalOpen,
    });

    const conflicts = conflictsData?.items || [];

    const handleRowClick = (bookingId) => {
        setSelectedConflictId(bookingId);
        setIsModalOpen(true);
    };

    const handleOpenFullView = () => {
        if (selectedConflictId) {
            setIsModalOpen(false);
            navigate(`/admin/conflicts/${selectedConflictId}`);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedConflictId(null);
    };

    if (status === 'pending') {
        return (
            <div className="space-y-6">
                <div className="h-32 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 animate-pulse" />
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6">
                {/* Page Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Conflicts</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Review and resolve booking conflicts.
                    </p>
                </div>

                {/* Conflicts Table */}
                <div className="glass-card rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Active Conflicts ({conflicts.length})
                        </h2>
                    </div>
                    {conflicts.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Device
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Users
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Date Range
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {conflicts.map((conflict) => (
                                        <tr
                                            key={conflict.booking_id}
                                            onClick={() => handleRowClick(conflict.booking_id)}
                                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {conflict.device?.name || 'Unknown Device'}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {conflict.device?.deviceType || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900 dark:text-white">
                                                    {conflict.user?.username || 'Unknown User'}
                                                </div>
                                                {conflict.collaborators && conflict.collaborators.length > 0 && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                        +{conflict.collaborators.length} collaborator(s)
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900 dark:text-white">
                                                    {new Date(conflict.start_time).toLocaleDateString()}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {new Date(conflict.start_time).toLocaleTimeString()} - {new Date(conflict.end_time).toLocaleTimeString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">
                                                    {conflict.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            <p className="text-sm">No active conflicts found.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Conflict Details Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={
                    <div className="flex items-center justify-between w-full">
                        <span>
                            Conflict: {conflictDetail?.device?.name || conflictDetail?.device?.deviceType || 'Unknown Device'}
                        </span>
                        <button
                            onClick={handleOpenFullView}
                            className="ml-4 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                            title="Open full view"
                        >
                            ↗ Open Full View
                        </button>
                    </div>
                }
                size="xl"
            >
                {conflictDetail ? (
                    <div className="grid grid-cols-3 gap-6">
                        {/* Left Column - Summary */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Summary</h3>
                            <div className="space-y-3">
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Requester</div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {conflictDetail.user?.username || 'Unknown'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Device Type</div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {conflictDetail.device?.deviceType || 'N/A'}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Interchangeable: {conflictDetail.device?.interchangeable !== false ? 'Yes' : 'No'}
                                    </div>
                                </div>
                                {conflictDetail.conflicts && conflictDetail.conflicts.length > 0 && (
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Conflicting With</div>
                                        {conflictDetail.conflicts.map((c, idx) => (
                                            <div key={idx} className="text-sm text-gray-900 dark:text-white">
                                                {c.user?.username || 'Unknown User'}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Middle Column - Timeline */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Timeline</h3>
                            <div className="space-y-2">
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(conflictDetail.start_time).toLocaleString()} - {new Date(conflictDetail.end_time).toLocaleString()}
                                </div>
                                <div className="p-3 rounded-md bg-gray-50 dark:bg-gray-800">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Visual Timeline (TODO)</div>
                                    <div className="h-20 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded">
                                        <span className="text-xs text-gray-400">Timeline visualization coming soon</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Actions */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Suggestions & Actions</h3>
                            <div className="space-y-3">
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Alternative Devices</div>
                                    <div className="text-xs text-gray-400 italic">TODO: Load from API</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Alternative Time Slots</div>
                                    <div className="text-xs text-gray-400 italic">TODO: Load from API</div>
                                </div>
                                <div className="space-y-2 pt-2">
                                    <button className="w-full glass-button py-2 text-sm font-semibold rounded-md">
                                        Approve as is (Override)
                                    </button>
                                    <button className="w-full glass-button py-2 text-sm font-semibold rounded-md">
                                        Reject with Note
                                    </button>
                                    <button
                                        onClick={() => {
                                            // TODO: Implement "Ask both users" feature
                                            alert('Feature coming soon: Ask both users');
                                        }}
                                        className="w-full glass-button py-2 text-sm font-semibold rounded-md"
                                    >
                                        Ask Both Users
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        Loading conflict details...
                    </div>
                )}
            </Modal>
        </>
    );
}

// Full-page conflict view component
export function ConflictDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { data: conflictDetail, status } = useQuery({
        queryKey: ['admin-conflict-detail', id],
        queryFn: () => fetchBookingDetail(id),
        enabled: !!id,
    });

    if (status === 'pending') {
        return (
            <div className="space-y-6">
                <div className="h-32 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 animate-pulse" />
            </div>
        );
    }

    if (!conflictDetail) {
        return (
            <div className="space-y-6">
                <div className="glass-card rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <p className="text-gray-500 dark:text-gray-400">Conflict not found.</p>
                    <button
                        onClick={() => navigate('/admin/conflicts')}
                        className="mt-4 glass-button py-2 px-4 text-sm font-semibold rounded-md"
                    >
                        Back to Conflicts
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Conflict: {conflictDetail.device?.name || 'Unknown Device'}
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Detailed conflict resolution view
                    </p>
                </div>
                <button
                    onClick={() => navigate('/admin/conflicts')}
                    className="glass-button py-2 px-4 text-sm font-semibold rounded-md"
                >
                    Back to Conflicts
                </button>
            </div>

            {/* Full-page conflict content (similar to modal but wider) */}
            <div className="glass-card rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
                <div className="grid grid-cols-3 gap-6">
                    {/* Same structure as modal but with more space */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Summary</h3>
                        {/* Same content as modal */}
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Timeline</h3>
                        {/* Wider timeline visualization */}
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</h3>
                        {/* Same actions as modal */}
                    </div>
                </div>
            </div>
        </div>
    );
}

