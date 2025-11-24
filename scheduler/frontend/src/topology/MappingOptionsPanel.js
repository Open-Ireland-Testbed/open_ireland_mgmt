import React from 'react';

export default function MappingOptionsPanel({ mappings, onSelectMapping, selectedMappingId }) {
  if (!mappings || mappings.length === 0) {
    return null;
  }

  const getScoreColor = (score) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-4 border-b border-gray-300 bg-white">
      <h3 className="text-lg font-semibold mb-3">Mapping Options</h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {mappings.map((mapping) => (
          <div
            key={mapping.mapping_id}
            onClick={() => onSelectMapping(mapping)}
            className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
              selectedMappingId === mapping.mapping_id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-sm">{mapping.mapping_id}</div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">Fit Score:</div>
                <div className={`px-2 py-1 rounded text-white text-xs font-bold ${getScoreColor(mapping.total_fit_score)}`}>
                  {(mapping.total_fit_score * 100).toFixed(0)}%
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-600 mb-1">
              {mapping.node_mappings?.length || 0} nodes, {mapping.link_mappings?.length || 0} links
            </div>
            {mapping.notes && (
              <div className="text-xs text-gray-500 italic mb-1">{mapping.notes}</div>
            )}
            {/* Show explanation for first node mapping if available */}
            {mapping.node_mappings && mapping.node_mappings.length > 0 && mapping.node_mappings[0].explanation && (
              <div className="text-xs text-gray-400 mt-1">
                {mapping.node_mappings[0].explanation.substring(0, 60)}...
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {mapping.node_mappings?.slice(0, 3).map((nodeMapping, idx) => (
                <div
                  key={idx}
                  className={`text-xs px-2 py-0.5 rounded ${
                    getConfidenceColor(nodeMapping.confidence)
                  } bg-gray-100`}
                  title={`${nodeMapping.logical_node_id} → ${nodeMapping.physical_device_name} (${nodeMapping.confidence})`}
                >
                  {nodeMapping.physical_device_name?.substring(0, 10)}...
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {selectedMappingId && (
        <button
          onClick={() => onSelectMapping(null)}
          className="mt-3 w-full text-xs text-gray-600 hover:text-gray-800 underline"
        >
          Clear Selection
        </button>
      )}
    </div>
  );
}

