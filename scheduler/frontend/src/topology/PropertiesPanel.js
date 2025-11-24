import React from 'react';
import NodePropertiesPanel from './NodePropertiesPanel';
import LinkPropertiesPanel from './LinkPropertiesPanel';

export default function PropertiesPanel({ 
  selectedNode, 
  selectedEdge, 
  onUpdateNodeParameters, 
  onUpdateEdgeParameters,
  selectedMapping,
  onOverrideDevice,
  availabilityForecasts,
}) {
  return (
    <div className="h-full flex flex-col">
      {selectedNode && (
        <NodePropertiesPanel
          node={selectedNode}
          onUpdateParameters={onUpdateNodeParameters}
          selectedMapping={selectedMapping}
          onOverrideDevice={onOverrideDevice}
          availabilityForecasts={availabilityForecasts}
        />
      )}
      {selectedEdge && !selectedNode && (
        <LinkPropertiesPanel
          edge={selectedEdge}
          onUpdateParameters={onUpdateEdgeParameters}
          selectedMapping={selectedMapping}
        />
      )}
      {!selectedNode && !selectedEdge && (
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-2">Properties</h3>
          <p className="text-gray-500 text-sm">
            Select a node or link to edit its properties
          </p>
          <div className="mt-4 text-xs text-gray-400">
            <p>• Click on a node to edit device properties</p>
            <p>• Click on a link to edit connection properties</p>
            <p>• Drag devices from the palette to add them</p>
            <p>• Connect nodes by dragging from source to target</p>
          </div>
        </div>
      )}
    </div>
  );
}

