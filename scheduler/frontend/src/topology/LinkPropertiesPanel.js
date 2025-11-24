import React, { useState, useEffect } from 'react';

export default function LinkPropertiesPanel({ edge, onUpdateParameters }) {
  const [parameters, setParameters] = useState({});

  useEffect(() => {
    if (edge) {
      setParameters(edge.data?.parameters || {});
    } else {
      setParameters({});
    }
  }, [edge]);

  const handleParameterChange = (key, value) => {
    const updated = { ...parameters, [key]: value };
    setParameters(updated);
    if (edge && onUpdateParameters) {
      onUpdateParameters(edge.id, updated);
    }
  };

  if (!edge) {
    return null;
  }

  return (
    <div className="p-4 border-b border-gray-300">
      <h3 className="text-lg font-semibold mb-3">Link Properties</h3>
      <div className="mb-2">
        <div className="text-sm font-medium text-gray-700">Link ID</div>
        <div className="text-xs text-gray-500 font-mono">{edge.id}</div>
      </div>
      <div className="mb-2">
        <div className="text-sm font-medium text-gray-700">Source</div>
        <div className="text-sm text-gray-600">{edge.source}</div>
      </div>
      <div className="mb-3">
        <div className="text-sm font-medium text-gray-700">Target</div>
        <div className="text-sm text-gray-600">{edge.target}</div>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Wavelength (nm)
          </label>
          <input
            type="text"
            value={parameters.wavelength || ''}
            onChange={(e) => handleParameterChange('wavelength', e.target.value)}
            placeholder="e.g., 1550"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Loss (dB)
          </label>
          <input
            type="number"
            value={parameters.loss || ''}
            onChange={(e) => handleParameterChange('loss', e.target.value)}
            placeholder="e.g., 0.2"
            step="0.1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fiber Type
          </label>
          <select
            value={parameters.fiberType || ''}
            onChange={(e) => handleParameterChange('fiberType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select fiber type</option>
            <option value="SMF">SMF (Single Mode Fiber)</option>
            <option value="MMF">MMF (Multi Mode Fiber)</option>
            <option value="DSF">DSF (Dispersion Shifted Fiber)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bandwidth (Gbps)
          </label>
          <input
            type="number"
            value={parameters.bandwidth || ''}
            onChange={(e) => handleParameterChange('bandwidth', e.target.value)}
            placeholder="e.g., 100"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={parameters.notes || ''}
            onChange={(e) => handleParameterChange('notes', e.target.value)}
            placeholder="Additional notes about this link"
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

