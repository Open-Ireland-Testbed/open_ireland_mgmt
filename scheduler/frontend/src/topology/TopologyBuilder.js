import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
} from 'reactflow';
import NodePalette from './NodePalette';
import PropertiesPanel from './PropertiesPanel';
import TopologyActions from './TopologyActions';
import MappingOptionsPanel from './MappingOptionsPanel';
import SuggestedConfigurationsPanel from './SuggestedConfigurationsPanel';
import TopologyCanvas from './TopologyCanvas';
import { API_BASE_URL } from '../config/api';
import './TopologyBuilder.css';

// Custom node components
const DeviceNode = ({ data, selected, availabilityForecast }) => {
  // Determine color based on mapping status or availability
  let nodeColor = 'bg-gray-400';
  if (data.mapping) {
    // If mapped, use purple shades based on fit score
    const fitScore = data.mapping.fit_score || 0;
    if (fitScore >= 0.8) nodeColor = 'bg-purple-600';
    else if (fitScore >= 0.6) nodeColor = 'bg-purple-500';
    else nodeColor = 'bg-purple-400';
  } else if (data.availability === 'available') {
    nodeColor = 'bg-green-500';
  } else if (data.availability === 'unavailable') {
    nodeColor = 'bg-red-500';
  }
  
  // Get availability forecast for this device
  const forecast = availabilityForecast && data.mapping?.physical_device_id 
    ? availabilityForecast[data.mapping.physical_device_id] 
    : null;
  
  return (
    <div className={`px-4 py-2 shadow-lg rounded-lg border-2 min-w-[120px] relative ${
      selected ? 'border-blue-500' : 'border-gray-300'
    } ${nodeColor}`}>
      {/* Availability Indicator */}
      {forecast && (
        <div className="absolute top-1 right-1">
          <div 
            className={`w-3 h-3 rounded-full border-2 border-white ${
              forecast.availability_probability >= 0.8 ? 'bg-green-400' :
              forecast.availability_probability >= 0.5 ? 'bg-yellow-400' :
              'bg-red-400'
            }`}
            title={`Availability: ${(forecast.availability_probability * 100).toFixed(0)}% (Confidence: ${(forecast.confidence * 100).toFixed(0)}%)`}
          />
        </div>
      )}
      <div className="font-bold text-sm text-white">{data.label}</div>
      <div className="text-xs text-white opacity-90">{data.deviceType}</div>
      {data.mapping && (
        <div className="text-xs text-white mt-1 opacity-90 font-semibold">
          <div>→ {data.mapping.physical_device_name}</div>
          <div className="opacity-75">Fit: {(data.mapping.fit_score * 100).toFixed(0)}%</div>
          {forecast && (
            <div className="opacity-75 text-[10px] mt-0.5">
              Avail: {(forecast.availability_probability * 100).toFixed(0)}%
            </div>
          )}
        </div>
      )}
      {data.parameters && !data.mapping && (
        <div className="text-xs text-white mt-1 opacity-75">
          {data.parameters.vendor && <div>Vendor: {data.parameters.vendor}</div>}
          {data.parameters.length && <div>Length: {data.parameters.length}</div>}
          {data.parameters.gain && <div>Gain: {data.parameters.gain}</div>}
        </div>
      )}
      <Handle type="target" position="top" />
      <Handle type="source" position="bottom" />
    </div>
  );
};

// Create node types with availability forecast context
const createNodeTypes = (availabilityForecasts) => ({
  device: (props) => <DeviceNode {...props} availabilityForecast={availabilityForecasts} />,
});

const initialNodes = [];
const initialEdges = [];

const STORAGE_KEY = 'topology_builder_topologies';

export default function TopologyBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [topologyName, setTopologyName] = useState('');
  const [savedTopologies, setSavedTopologies] = useState([]);
  const [selectedTopologyId, setSelectedTopologyId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [mappings, setMappings] = useState([]);
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [selectedMappingId, setSelectedMappingId] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [availabilityForecasts, setAvailabilityForecasts] = useState({});
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const nodeIdRef = useRef(0);
  const edgeIdRef = useRef(0);

  // Get user session
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch(`${API_BASE_URL}/session`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.logged_in) {
            setUserId(data.user_id);
          }
        }
      } catch (err) {
        console.error('Session check failed:', err);
      }
    }
    checkSession();
  }, []);

  // Load topologies from localStorage on mount
  useEffect(() => {
    loadTopologiesFromStorage();
  }, []);

  // Save to localStorage whenever topology changes
  useEffect(() => {
    if (topologyName && (nodes.length > 0 || edges.length > 0)) {
      autoSaveToStorage();
    }
  }, [nodes, edges, topologyName]);

  const loadTopologiesFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const topologies = JSON.parse(stored);
        setSavedTopologies(topologies);
      }
    } catch (err) {
      console.error('Failed to load topologies from storage:', err);
    }
  };

  const saveTopologyToStorage = (name, nodesData, edgesData, id = null) => {
    try {
      const topologies = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const topologyData = {
        id: id || `topology-${Date.now()}`,
        name,
        nodes: nodesData,
        edges: edgesData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (id) {
        // Update existing
        const index = topologies.findIndex((t) => t.id === id);
        if (index >= 0) {
          topologies[index] = { ...topologyData, created_at: topologies[index].created_at };
        } else {
          topologies.push(topologyData);
        }
      } else {
        // Add new
        topologies.push(topologyData);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(topologies));
      setSavedTopologies(topologies);
      return topologyData.id;
    } catch (err) {
      console.error('Failed to save topology to storage:', err);
      return null;
    }
  };

  const autoSaveToStorage = () => {
    if (topologyName.trim()) {
      const id = selectedTopologyId || `topology-${Date.now()}`;
      saveTopologyToStorage(topologyName, nodes, edges, selectedTopologyId || id);
      if (!selectedTopologyId) {
        setSelectedTopologyId(id);
      }
    }
  };

  const loadTopologyFromStorage = (id) => {
    try {
      const topologies = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const topology = topologies.find((t) => t.id === id);
      if (topology) {
        setNodes(topology.nodes || []);
        setEdges(topology.edges || []);
        setTopologyName(topology.name || '');
        setSelectedTopologyId(id);
        setAvailabilityChecked(false);
        setSelectedNode(null);
        setSelectedEdge(null);

        // Update refs to prevent ID conflicts
        const maxNodeId = Math.max(
          ...(topology.nodes || []).map((node) => {
            const match = node.id?.match(/node-(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          }),
          0
        );
        nodeIdRef.current = maxNodeId + 1;

        const maxEdgeId = Math.max(
          ...(topology.edges || []).map((edge) => {
            const match = edge.id?.match(/edge-(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          }),
          0
        );
        edgeIdRef.current = maxEdgeId + 1;
      }
    } catch (err) {
      console.error('Failed to load topology from storage:', err);
      alert('Failed to load topology from storage.');
    }
  };

  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        id: params.id || `edge-${edgeIdRef.current++}`,
        type: 'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        data: {
          ...params.data,
          parameters: {
            wavelength: '',
            loss: '',
            fiberType: '',
            bandwidth: '',
            notes: '',
            ...params.data?.parameters,
          },
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const onEdgeClick = useCallback((event, edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `node-${nodeIdRef.current++}`,
        type: 'device',
        position,
        data: {
          label: type,
          deviceType: type,
          availability: 'unknown',
          parameters: getDefaultParameters(type),
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const getDefaultParameters = (deviceType) => {
    const defaults = {
      ROADM: { vendor: 'Ciena', ports: 8, wavelength: '1550nm' },
      Fiber: { length: '10km', vendor: 'Corning', loss: '0.2' },
      ILA: { gain: '20dB', vendor: 'Amphenol', noise: '5dB' },
      Transceiver: { vendor: 'Cisco', wavelength: '1550nm', dataRate: '100G' },
      OTDR: { vendor: 'EXFO', range: '80km', resolution: '1m' },
      Switch: { vendor: 'Polatis', ports: 16, switchingSpeed: '10ms' },
    };
    return defaults[deviceType] || { vendor: 'Unknown' };
  };

  const updateNodeParameters = (nodeId, parameters) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, parameters: { ...node.data.parameters, ...parameters } } }
          : node
      )
    );
  };

  const updateEdgeParameters = (edgeId, parameters) => {
    setEdges((eds) =>
      eds.map((edge) =>
        edge.id === edgeId
          ? { ...edge, data: { ...edge.data, parameters: { ...edge.data?.parameters || {}, ...parameters } } }
          : edge
      )
    );
  };

  const checkAvailability = async () => {
    if (nodes.length === 0) {
      alert('Please add nodes to the topology first.');
      return;
    }

    try {
      const topologyData = {
        nodes: nodes.map((node) => ({
          id: node.id,
          deviceType: node.data.deviceType,
          parameters: node.data.parameters,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          parameters: edge.data?.parameters,
        })),
      };

      // Try backend first, fallback to mock if it fails
      let availabilityData = null;
      try {
        const res = await fetch(`${API_BASE_URL}/topology/check-availability`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(topologyData),
        });

        if (res.ok) {
          availabilityData = await res.json();
        }
      } catch (err) {
        console.log('Backend unavailable, using mock data');
      }

      // Mock availability if backend fails
      if (!availabilityData) {
        availabilityData = {
          availability: {},
        };
        nodes.forEach((node) => {
          // Mock: 70% chance of available, 20% unavailable, 10% unknown
          const rand = Math.random();
          if (rand < 0.7) {
            availabilityData.availability[node.id] = { status: 'available' };
          } else if (rand < 0.9) {
            availabilityData.availability[node.id] = { status: 'unavailable' };
          } else {
            availabilityData.availability[node.id] = { status: 'unknown' };
          }
        });
      }

      // Update nodes with availability status (preserve mapping if exists)
      setNodes((nds) =>
        nds.map((node) => {
          const availability = availabilityData.availability[node.id] || { status: 'unknown' };
          return {
            ...node,
            data: {
              ...node.data,
              availability: availability.status || 'unknown',
              availabilityDetails: availability.details || availability,
              // Preserve mapping when checking availability
              mapping: node.data.mapping,
            },
          };
        })
      );
      setAvailabilityChecked(true);
    } catch (err) {
      console.error('Availability check failed:', err);
      alert('Failed to check availability. Please try again.');
    }
  };

  const resolveTopology = async (startTime, endTime) => {
    if (nodes.length === 0) {
      alert('Please add nodes to the topology first.');
      return;
    }

    try {
      // Store current node positions to preserve layout
      const nodePositions = {};
      nodes.forEach((node) => {
        nodePositions[node.id] = { x: node.position.x, y: node.position.y };
      });

      const topologyData = {
        nodes: nodes.map((node) => ({
          id: node.id,
          deviceType: node.data.deviceType,
          parameters: node.data.parameters,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          parameters: edge.data?.parameters,
        })),
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
      };

      // Store start/end time for availability forecasts
      const storedStartTime = startTime;
      const storedEndTime = endTime;

      // Try backend first, fallback to mock if it fails
      let resolveData = null;
      try {
        const res = await fetch(`${API_BASE_URL}/topology/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(topologyData),
        });

        if (res.ok) {
          resolveData = await res.json();
          if (resolveData.total_options === 0) {
            alert('No feasible mappings found for the given topology and date range. Please check device availability or modify the topology.');
            return;
          }
        } else {
          const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(errorData.detail || `Failed to resolve topology: ${res.status}`);
        }
      } catch (err) {
        console.error('Topology resolution failed:', err);
        alert(`Failed to resolve topology: ${err.message}. Please try again.`);
        return;
      }

      // Mock resolver if backend fails (fallback only)
      if (!resolveData || !resolveData.mappings || resolveData.mappings.length === 0) {
        console.warn('No mappings returned, using mock data as fallback');
        const mockMappings = [];
        for (let i = 0; i < 3; i++) {
          const nodeMappings = nodes.map((node) => {
            // Generate alternatives for each node
            const numAlternatives = Math.floor(Math.random() * 3) + 2; // 2-4 alternatives
            const alternatives = [];
            for (let altIdx = 0; altIdx < numAlternatives; altIdx++) {
              alternatives.push({
                device_id: Math.floor(Math.random() * 900) + 100 + altIdx * 1000,
                device_name: `${node.data.deviceType}-${Math.floor(Math.random() * 50) + 1}`,
                device_type: node.data.deviceType,
                fit_score: Math.round((0.5 + Math.random() * 0.5) * 100) / 100,
                available: Math.random() > 0.25, // 75% available
              });
            }
            // Sort alternatives by fit score
            alternatives.sort((a, b) => b.fit_score - a.fit_score);
            
            // Select best available as primary
            const primary = alternatives.find((alt) => alt.available) || alternatives[0];
            
            return {
              logical_node_id: node.id,
              physical_device_id: primary.device_id,
              physical_device_name: primary.device_name,
              physical_device_type: primary.device_type,
              fit_score: primary.fit_score,
              confidence: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
              alternatives: alternatives,
            };
          });

          const linkMappings = edges.map((edge) => ({
            logical_edge_id: edge.id,
            source_mapping: edge.source,
            target_mapping: edge.target,
            physical_link_id: `link-${Math.floor(Math.random() * 9000) + 1000}`,
            fit_score: Math.round((0.6 + Math.random() * 0.4) * 100) / 100,
          }));

          const totalFitScore = nodeMappings.length > 0
            ? nodeMappings.reduce((sum, m) => sum + m.fit_score, 0) / nodeMappings.length
            : 0.8;

          mockMappings.push({
            mapping_id: `mapping-${i + 1}`,
            total_fit_score: Math.round(totalFitScore * 100) / 100,
            node_mappings: nodeMappings,
            link_mappings: linkMappings,
            notes: `Mock mapping option ${i + 1}`,
          });
        }

        resolveData = {
          mappings: mockMappings.sort((a, b) => b.total_fit_score - a.total_fit_score),
          total_options: mockMappings.length,
        };
      }

      setMappings(resolveData.mappings || []);
      
      // Fetch recommendations
      try {
        const suggestRes = await fetch(`${API_BASE_URL}/topology/suggest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            nodes: topologyData.nodes,
            edges: topologyData.edges,
            start_time: topologyData.start_time,
            end_time: topologyData.end_time,
          }),
        });

        if (suggestRes.ok) {
          const suggestData = await suggestRes.json();
          setRecommendations(suggestData.recommendations || []);
          
          // Auto-select best recommendation if available
          if (suggestData.recommendations && suggestData.recommendations.length > 0) {
            const bestRec = suggestData.recommendations[0];
            selectMappingWithPositions(bestRec.mapping, nodePositions);
            setSelectedMapping(bestRec.mapping);
            setSelectedMappingId(bestRec.mapping.mapping_id);
            
            // Fetch availability forecasts for mapped devices
            fetchAvailabilityForecasts(bestRec.mapping, topologyData.start_time, topologyData.end_time);
          } else {
            // No recommendations, use regular mappings
            if (resolveData.mappings && resolveData.mappings.length > 0) {
              selectMappingWithPositions(resolveData.mappings[0], nodePositions);
            }
          }
        } else {
          // Recommendations request failed, use regular mappings
          if (resolveData.mappings && resolveData.mappings.length > 0) {
            selectMappingWithPositions(resolveData.mappings[0], nodePositions);
          }
        }
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
        // Continue with regular mappings if recommendations fail
        if (resolveData.mappings && resolveData.mappings.length > 0) {
          selectMappingWithPositions(resolveData.mappings[0], nodePositions);
        }
      }
    } catch (err) {
      console.error('Topology resolve failed:', err);
      alert('Failed to resolve topology. Please try again.');
    }
  };

  const selectMapping = (mapping, preservePositions = null) => {
    if (!mapping) {
      // Clear mapping
      setSelectedMapping(null);
      setSelectedMappingId(null);
      setNodes((nds) =>
        nds.map((node) => {
          const { mapping, ...restData } = node.data;
          return { ...node, data: restData };
        })
      );
      setEdges((eds) =>
        eds.map((edge) => {
          const { mapping, ...restData } = edge.data || {};
          // Clear edge styling when mapping is cleared
          return { 
            ...edge, 
            data: restData,
            style: undefined, // Reset to default styling
          };
        })
      );
      return;
    }

    setSelectedMapping(mapping);
    setSelectedMappingId(mapping.mapping_id);

    // Create mapping lookup
    const nodeMappingMap = {};
    mapping.node_mappings.forEach((nm) => {
      nodeMappingMap[nm.logical_node_id] = nm;
    });

    const edgeMappingMap = {};
    mapping.link_mappings.forEach((lm) => {
      edgeMappingMap[lm.logical_edge_id] = lm;
    });

    // Update nodes with mapping information (preserve existing data and positions)
    setNodes((nds) =>
      nds.map((node) => {
        const nodeMapping = nodeMappingMap[node.id];
        // Use preserved position if provided, otherwise keep current position
        const position = preservePositions?.[node.id] || node.position;
        
        // Get availability forecast for this device if available
        const deviceId = nodeMapping?.physical_device_id;
        const forecast = deviceId && availabilityForecasts[deviceId] 
          ? availabilityForecasts[deviceId] 
          : null;
        
        return {
          ...node,
          position: position,
          data: {
            ...node.data,
            mapping: {
              ...nodeMapping,
              // Preserve explanation if available
              explanation: nodeMapping?.explanation || '',
            },
            // Preserve availability
            availability: node.data.availability,
            availabilityDetails: node.data.availabilityDetails,
            // Add availability forecast
            availabilityForecast: forecast,
          },
        };
      })
    );

    // Update edges with mapping information and styling
    setEdges((eds) =>
      eds.map((edge) => {
        const edgeMapping = edgeMappingMap[edge.id];
        const fitScore = edgeMapping?.fit_score || 0;
        // Color edges based on fit score
        let edgeColor = '#b1b1b7'; // default gray
        if (fitScore >= 0.8) edgeColor = '#9333ea'; // purple-600
        else if (fitScore >= 0.6) edgeColor = '#a855f7'; // purple-500
        else if (fitScore > 0) edgeColor = '#c084fc'; // purple-400
        
        return {
          ...edge,
          data: {
            ...edge.data,
            mapping: edgeMapping,
          },
          style: {
            stroke: edgeMapping ? edgeColor : undefined,
            strokeWidth: edgeMapping ? 3 : 2,
          },
        };
      })
    );
  };

  const selectMappingWithPositions = (mapping, positions) => {
    selectMapping(mapping, positions);
  };

  const fetchAvailabilityForecasts = async (mapping, startTime, endTime) => {
    if (!mapping || !mapping.node_mappings) return;
    
    const deviceIds = mapping.node_mappings
      .map(nm => nm.physical_device_id)
      .filter(id => id !== null && id !== undefined);
    
    if (deviceIds.length === 0) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/availability/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          device_ids: deviceIds,
          start_time: startTime,
          end_time: endTime,
          forecast_window_days: 7,
        }),
      });

      if (res.ok) {
        const forecastData = await res.json();
        const forecastsMap = {};
        forecastData.forecasts.forEach(f => {
          forecastsMap[f.device_id] = {
            availability_probability: f.availability_probability,
            confidence: f.confidence,
            factors: f.factors,
            earliest_available_slot: f.earliest_available_slot,
          };
        });
        setAvailabilityForecasts(forecastsMap);
      }
    } catch (err) {
      console.error('Failed to fetch availability forecasts:', err);
    }
  };

  const handleSelectRecommendation = (recommendation) => {
    if (!recommendation) {
      selectMapping(null);
      setRecommendations([]);
      return;
    }
    
    // Store node positions
    const nodePositions = {};
    nodes.forEach((node) => {
      nodePositions[node.id] = { x: node.position.x, y: node.position.y };
    });
    
    // Apply the recommendation's mapping
    selectMappingWithPositions(recommendation.mapping, nodePositions);
    setSelectedMapping(recommendation.mapping);
    setSelectedMappingId(recommendation.mapping.mapping_id);
    
    // Fetch availability forecasts - use stored times or current time
    const forecastStart = recommendation.mapping.node_mappings?.[0] ? 
      new Date().toISOString() : new Date().toISOString();
    const forecastEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    fetchAvailabilityForecasts(recommendation.mapping, forecastStart, forecastEnd);
  };

  const handleOverrideDevice = (nodeId, deviceOverride) => {
    if (!selectedMapping) {
      alert('Please select a mapping first before overriding devices.');
      return;
    }

    // Update the selected mapping with the override
    const updatedMapping = {
      ...selectedMapping,
      node_mappings: selectedMapping.node_mappings.map((nm) => {
        if (nm.logical_node_id === nodeId) {
          // Use the override device directly
          return {
            ...nm,
            physical_device_id: deviceOverride.device_id || nm.physical_device_id,
            physical_device_name: deviceOverride.device_name || nm.physical_device_name,
            physical_device_type: deviceOverride.device_type || nm.physical_device_type,
            fit_score: deviceOverride.fit_score !== undefined ? deviceOverride.fit_score : nm.fit_score,
          };
        }
        return nm;
      }),
    };

    // Update the mapping in the mappings array
    setMappings((prevMappings) =>
      prevMappings.map((m) => (m.mapping_id === selectedMapping.mapping_id ? updatedMapping : m))
    );

    // Re-apply the updated mapping
    selectMapping(updatedMapping);
  };

  const bookTopology = async (startTime, endTime) => {
    if (!userId) {
      alert('Please log in to book topology.');
      return;
    }

    if (!availabilityChecked) {
      alert('Please check availability first.');
      return;
    }

    try {
      // Map nodes to device bookings
      const bookings = nodes
        .filter((node) => node.data.availability === 'available')
        .map((node) => {
          const deviceName = node.data.parameters?.deviceName || 
                           `${node.data.deviceType}-${node.id.substring(0, 8)}`;
          return {
            device_type: node.data.deviceType,
            device_name: deviceName,
            start_time: startTime,
            end_time: endTime,
            status: 'PENDING',
          };
        });

      if (bookings.length === 0) {
        alert('No available devices to book.');
        return;
      }

      const payload = {
        user_id: userId,
        message: `Topology booking: ${topologyName || 'Unnamed Topology'}`,
        bookings,
      };

      const res = await fetch(`${API_BASE_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Successfully booked ${data.count} device(s)!`);
        
        // Auto-save topology after booking
        if (topologyName) {
          saveTopologyToStorage(topologyName, nodes, edges, selectedTopologyId);
        }
      } else {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to book topology');
      }
    } catch (err) {
      console.error('Booking failed:', err);
      alert(`Failed to book topology: ${err.message}`);
    }
  };

  const saveTopology = () => {
    if (!topologyName.trim()) {
      alert('Please enter a name for the topology.');
      return;
    }

    const id = saveTopologyToStorage(topologyName, nodes, edges, selectedTopologyId);
    if (id) {
      setSelectedTopologyId(id);
      alert('Topology saved to localStorage!');
    } else {
      alert('Failed to save topology.');
    }
  };

  const loadTopology = (topologyId) => {
    loadTopologyFromStorage(topologyId);
  };

  const newTopology = () => {
    if (window.confirm('Create a new topology? Unsaved changes will be lost.')) {
      setNodes(initialNodes);
      setEdges(initialEdges);
      setTopologyName('');
      setSelectedTopologyId(null);
      setSelectedNode(null);
      setSelectedEdge(null);
      setAvailabilityChecked(false);
      setMappings([]);
      setSelectedMapping(null);
      setSelectedMappingId(null);
      setRecommendations([]);
      setAvailabilityForecasts({});
      nodeIdRef.current = 0;
      edgeIdRef.current = 0;
    }
  };

  const deleteTopology = (topologyId) => {
    if (window.confirm('Delete this topology?')) {
      try {
        const topologies = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const filtered = topologies.filter((t) => t.id !== topologyId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        setSavedTopologies(filtered);
        if (selectedTopologyId === topologyId) {
          newTopology();
        }
      } catch (err) {
        console.error('Failed to delete topology:', err);
        alert('Failed to delete topology.');
      }
    }
  };

  return (
    <div className="topology-builder bg-gray-50">
      <div className="topology-container">
        <NodePalette />
        <div 
          className="flex-1 relative" 
          ref={reactFlowWrapper}
          style={{
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <TopologyCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={createNodeTypes(availabilityForecasts)}
            deleteKeyCode="Delete"
            multiSelectionKeyCode="Shift"
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
            <MiniMap />
          </TopologyCanvas>
        </div>
        <div className="w-96 bg-white border-l border-gray-300 flex flex-col shadow-lg">
          {recommendations.length > 0 && (
            <div className="border-b border-gray-300">
              <SuggestedConfigurationsPanel
                recommendations={recommendations}
                onSelectRecommendation={handleSelectRecommendation}
                selectedMappingId={selectedMappingId}
              />
            </div>
          )}
          {mappings.length > 0 && recommendations.length === 0 && (
            <div className="border-b border-gray-300">
              <MappingOptionsPanel
                mappings={mappings}
                onSelectMapping={selectMapping}
                selectedMappingId={selectedMappingId}
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <PropertiesPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              onUpdateNodeParameters={updateNodeParameters}
              onUpdateEdgeParameters={updateEdgeParameters}
              selectedMapping={selectedMapping}
              onOverrideDevice={handleOverrideDevice}
              availabilityForecasts={availabilityForecasts}
            />
          </div>
          <div className="border-t border-gray-300">
            <TopologyActions
              topologyName={topologyName}
              onTopologyNameChange={setTopologyName}
              onCheckAvailability={checkAvailability}
              onResolveTopology={resolveTopology}
              onBookTopology={bookTopology}
              onSaveTopology={saveTopology}
              onNewTopology={newTopology}
              savedTopologies={savedTopologies}
              onLoadTopology={loadTopology}
              onDeleteTopology={deleteTopology}
              availabilityChecked={availabilityChecked}
              hasResolvedMapping={selectedMapping !== null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
