import React from 'react';
import { useNavigate } from 'react-router-dom';

const deviceTypes = [
  { type: 'ROADM', label: 'ROADM', icon: '📡', description: 'Reconfigurable Optical Add-Drop Multiplexer' },
  { type: 'Fiber', label: 'Fiber', icon: '🔌', description: 'Optical Fiber Link' },
  { type: 'ILA', label: 'ILA', icon: '📶', description: 'In-Line Amplifier' },
  { type: 'Transceiver', label: 'Transceiver', icon: '💾', description: 'Optical Transceiver' },
  { type: 'OTDR', label: 'OTDR', icon: '📊', description: 'Optical Time Domain Reflectometer' },
  { type: 'Switch', label: 'Switch', icon: '🔄', description: 'Optical Switch' },
];

export default function NodePalette() {
  const navigate = useNavigate();
  
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleBackToScheduler = () => {
    navigate('/client');
  };

  return (
    <div className="w-56 bg-gray-800 text-white p-4 border-r border-gray-600 overflow-y-auto flex flex-col">
      {/* Back to Scheduler Button */}
      <button
        onClick={handleBackToScheduler}
        className="w-full px-3 py-2 text-xs font-medium text-white bg-gray-700 rounded-md hover:bg-gray-600 transition-colors mb-4 flex items-center justify-center gap-2 border border-gray-600"
        title="Return to Lab Scheduler"
      >
        <span>←</span>
        <span>Back to Scheduler</span>
      </button>
      
      <h2 className="text-lg font-bold mb-4">Device Palette</h2>
      <div className="space-y-2">
        {deviceTypes.map((device) => (
          <div
            key={device.type}
            className="bg-gray-700 p-3 rounded-lg cursor-grab active:cursor-grabbing hover:bg-gray-600 transition-colors"
            onDragStart={(e) => onDragStart(e, device.type)}
            draggable
            title={device.description}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{device.icon}</span>
              <div className="flex-1">
                <div className="font-medium">{device.label}</div>
                {device.description && (
                  <div className="text-xs text-gray-400 mt-0.5">{device.description}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 text-xs text-gray-400">
        <p className="mb-2">💡 Drag devices to canvas</p>
        <p className="mb-2">🔗 Connect by dragging between nodes</p>
        <p>⌨️ Press Delete to remove selected items</p>
      </div>
    </div>
  );
}

