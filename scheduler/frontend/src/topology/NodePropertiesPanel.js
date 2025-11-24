import React, { useState, useEffect } from 'react';

export default function NodePropertiesPanel({ node, onUpdateParameters, selectedMapping, onOverrideDevice, availabilityForecasts }) {
  const [parameters, setParameters] = useState({});

  useEffect(() => {
    if (node) {
      setParameters(node.data.parameters || {});
    } else {
      setParameters({});
    }
  }, [node]);

  const handleParameterChange = (key, value) => {
    const updated = { ...parameters, [key]: value };
    setParameters(updated);
    if (node && onUpdateParameters) {
      onUpdateParameters(node.id, updated);
    }
  };

  if (!node) {
    return (
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-2">Node Properties</h3>
        <p className="text-gray-500 text-sm">Select a node to edit its properties</p>
      </div>
    );
  }

  const getParameterFields = (deviceType) => {
    switch (deviceType) {
      case 'ROADM':
        return [
          { key: 'vendor', label: 'Vendor', type: 'text', placeholder: 'e.g., Ciena' },
          { key: 'ports', label: 'Ports', type: 'number', placeholder: 'e.g., 8' },
          { key: 'wavelength', label: 'Wavelength', type: 'text', placeholder: 'e.g., 1550nm' },
        ];
      case 'Fiber':
        return [
          { key: 'length', label: 'Length', type: 'text', placeholder: 'e.g., 10km' },
          { key: 'vendor', label: 'Vendor', type: 'text', placeholder: 'e.g., Corning' },
          { key: 'loss', label: 'Loss (dB)', type: 'text', placeholder: 'e.g., 0.2' },
        ];
      case 'ILA':
        return [
          { key: 'gain', label: 'Gain', type: 'text', placeholder: 'e.g., 20dB' },
          { key: 'vendor', label: 'Vendor', type: 'text', placeholder: 'e.g., Amphenol' },
          { key: 'noise', label: 'Noise Figure', type: 'text', placeholder: 'e.g., 5dB' },
        ];
      case 'Transceiver':
        return [
          { key: 'vendor', label: 'Vendor', type: 'text', placeholder: 'e.g., Cisco' },
          { key: 'wavelength', label: 'Wavelength', type: 'text', placeholder: 'e.g., 1550nm' },
          { key: 'dataRate', label: 'Data Rate', type: 'text', placeholder: 'e.g., 100G' },
        ];
      case 'OTDR':
        return [
          { key: 'vendor', label: 'Vendor', type: 'text', placeholder: 'e.g., EXFO' },
          { key: 'range', label: 'Range', type: 'text', placeholder: 'e.g., 80km' },
          { key: 'resolution', label: 'Resolution', type: 'text', placeholder: 'e.g., 1m' },
        ];
      case 'Switch':
        return [
          { key: 'vendor', label: 'Vendor', type: 'text', placeholder: 'e.g., Polatis' },
          { key: 'ports', label: 'Ports', type: 'number', placeholder: 'e.g., 16' },
          { key: 'switchingSpeed', label: 'Switching Speed', type: 'text', placeholder: 'e.g., 10ms' },
        ];
      default:
        return [
          { key: 'vendor', label: 'Vendor', type: 'text', placeholder: 'Vendor name' },
        ];
    }
  };

  const fields = getParameterFields(node.data.deviceType);

  return (
    <div className="p-4 border-b border-gray-300">
      <h3 className="text-lg font-semibold mb-3">Node Properties</h3>
      <div className="mb-2">
        <div className="text-sm font-medium text-gray-700">Device Type</div>
        <div className="text-sm text-gray-600">{node.data.deviceType}</div>
      </div>
      <div className="mb-2">
        <div className="text-sm font-medium text-gray-700">Node ID</div>
        <div className="text-xs text-gray-500 font-mono">{node.id}</div>
      </div>
      {node.data.availability && (
        <div className="mb-3">
          <div className="text-sm font-medium text-gray-700">Availability</div>
          <div
            className={`text-sm font-semibold ${
              node.data.availability === 'available'
                ? 'text-green-600'
                : node.data.availability === 'unavailable'
                ? 'text-red-600'
                : 'text-gray-600'
            }`}
          >
            {node.data.availability.toUpperCase()}
          </div>
        </div>
      )}
      {node.data.mapping && (
        <div className="mb-3 p-3 bg-purple-50 rounded-md border border-purple-200">
          <div className="text-sm font-medium text-gray-700 mb-2">Device Mapping</div>
          <div className="text-sm text-gray-800 font-semibold">
            → {node.data.mapping.physical_device_name}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            Fit Score: {(node.data.mapping.fit_score * 100).toFixed(0)}% | Confidence: {node.data.mapping.confidence}
          </div>
          {node.data.mapping.explanation && (
            <div className="text-xs text-gray-500 mt-1 italic">
              {node.data.mapping.explanation}
            </div>
          )}
          {/* Show availability forecast if available */}
          {node.data.mapping.physical_device_id && availabilityForecasts && availabilityForecasts[node.data.mapping.physical_device_id] && (
            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
              <div className="text-xs font-medium text-gray-700 mb-1">Availability Forecast</div>
              <div className="text-xs text-gray-600">
                Probability: {(availabilityForecasts[node.data.mapping.physical_device_id].availability_probability * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-600">
                Confidence: {(availabilityForecasts[node.data.mapping.physical_device_id].confidence * 100).toFixed(0)}%
              </div>
              {availabilityForecasts[node.data.mapping.physical_device_id].factors && availabilityForecasts[node.data.mapping.physical_device_id].factors.length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Factors: {availabilityForecasts[node.data.mapping.physical_device_id].factors.join(', ')}
                </div>
              )}
              {availabilityForecasts[node.data.mapping.physical_device_id].earliest_available_slot && (
                <div className="text-xs text-gray-500 mt-1">
                  Earliest slot: {new Date(availabilityForecasts[node.data.mapping.physical_device_id].earliest_available_slot).toLocaleString()}
                </div>
              )}
            </div>
          )}
          {selectedMapping && onOverrideDevice && node.data.mapping.alternatives && node.data.mapping.alternatives.length > 0 && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Override Device
              </label>
              <select
                value={node.data.mapping.physical_device_id || 'current'}
                onChange={(e) => {
                  const selectedValue = e.target.value;
                  if (selectedValue === 'current') {
                    return;
                  }
                  const selectedAlt = node.data.mapping.alternatives.find(
                    (alt) => alt.device_id?.toString() === selectedValue || alt.device_id === parseInt(selectedValue, 10)
                  );
                  if (selectedAlt) {
                    onOverrideDevice(node.id, selectedAlt);
                  }
                }}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="current">
                  {node.data.mapping.physical_device_name} (Current - Fit: {(node.data.mapping.fit_score * 100).toFixed(0)}%)
                </option>
                {node.data.mapping.alternatives.map((alt, idx) => (
                  <option key={alt.device_id || idx} value={alt.device_id || idx}>
                    {alt.device_name} (Fit: {(alt.fit_score * 100).toFixed(0)}%, {alt.available !== false ? 'Available' : 'Unavailable'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
            </label>
            <input
              type={field.type}
              value={parameters[field.key] || ''}
              onChange={(e) => handleParameterChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

