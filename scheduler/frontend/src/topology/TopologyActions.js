import React, { useState } from 'react';
import dayjs from 'dayjs';

export default function TopologyActions({
  topologyName,
  onTopologyNameChange,
  onCheckAvailability,
  onResolveTopology,
  onBookTopology,
  onSaveTopology,
  onNewTopology,
  savedTopologies,
  onLoadTopology,
  onDeleteTopology,
  availabilityChecked,
  hasResolvedMapping,
}) {
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [resolveStartTime, setResolveStartTime] = useState('');
  const [resolveEndTime, setResolveEndTime] = useState('');

  const handleBookClick = () => {
    if (!availabilityChecked) {
      alert('Please check availability first.');
      return;
    }
    setShowBookingDialog(true);
    // Set default times (now + 1 hour to tomorrow same time)
    const tomorrow = dayjs().add(1, 'day');
    setStartTime(tomorrow.format('YYYY-MM-DDTHH:mm'));
    setEndTime(tomorrow.add(1, 'hour').format('YYYY-MM-DDTHH:mm'));
  };

  const handleBookSubmit = () => {
    if (!startTime || !endTime) {
      alert('Please select both start and end times.');
      return;
    }
    if (new Date(endTime) <= new Date(startTime)) {
      alert('End time must be after start time.');
      return;
    }
    onBookTopology(startTime, endTime);
    setShowBookingDialog(false);
  };

  return (
    <div className="p-4 flex-1 overflow-y-auto">
      <h3 className="text-lg font-semibold mb-4">Topology Actions</h3>
      
      <div className="space-y-3 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Topology Name
          </label>
          <input
            type="text"
            value={topologyName}
            onChange={(e) => onTopologyNameChange(e.target.value)}
            placeholder="Enter topology name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={onNewTopology}
          className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md transition-colors"
        >
          New Topology
        </button>

        <button
          onClick={onSaveTopology}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors"
        >
          Save Topology
        </button>

        <button
          onClick={onCheckAvailability}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded-md transition-colors"
        >
          Check Availability
        </button>

        <button
          onClick={() => {
            const tomorrow = dayjs().add(1, 'day');
            setResolveStartTime(tomorrow.format('YYYY-MM-DDTHH:mm'));
            setResolveEndTime(tomorrow.add(2, 'hours').format('YYYY-MM-DDTHH:mm'));
            setShowResolveDialog(true);
          }}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-md transition-colors"
        >
          Resolve Topology
        </button>

        <button
          onClick={handleBookClick}
          disabled={!availabilityChecked}
          className={`w-full py-2 px-4 rounded-md transition-colors ${
            availabilityChecked
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Book Topology
        </button>
      </div>

      {savedTopologies.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Saved Topologies</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {savedTopologies.map((topology) => (
              <div
                key={topology.id}
                className="p-2 bg-gray-100 rounded-md border border-gray-200 hover:bg-gray-200 transition-colors group"
              >
                <div 
                  className="cursor-pointer"
                  onClick={() => onLoadTopology(topology.id)}
                >
                  <div className="text-sm font-medium text-gray-900">{topology.name}</div>
                  <div className="text-xs text-gray-500">
                    {dayjs(topology.updated_at || topology.created_at).format('MMM DD, YYYY HH:mm')}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {topology.nodes?.length || 0} nodes, {topology.edges?.length || 0} links
                  </div>
                </div>
                {onDeleteTopology && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTopology(topology.id);
                    }}
                    className="mt-2 text-xs text-red-600 hover:text-red-800 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showBookingDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Book Topology</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBookSubmit}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md transition-colors"
                >
                  Confirm Booking
                </button>
                <button
                  onClick={() => setShowBookingDialog(false)}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showResolveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Resolve Topology</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter the date range to resolve logical devices to physical devices.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={resolveStartTime}
                  onChange={(e) => setResolveStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={resolveEndTime}
                  onChange={(e) => setResolveEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!resolveStartTime || !resolveEndTime) {
                      alert('Please select both start and end times.');
                      return;
                    }
                    if (new Date(resolveEndTime) <= new Date(resolveStartTime)) {
                      alert('End time must be after start time.');
                      return;
                    }
                    onResolveTopology(resolveStartTime, resolveEndTime);
                    setShowResolveDialog(false);
                  }}
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-md transition-colors"
                >
                  Resolve
                </button>
                <button
                  onClick={() => setShowResolveDialog(false)}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

