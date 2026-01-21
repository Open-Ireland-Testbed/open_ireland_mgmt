"""
Topology Resolver Module

This module implements a real topology-matching engine that:
1. Represents the physical inventory as a NetworkX graph
2. Matches logical topology nodes to physical devices based on type, attributes, and availability
3. Computes fit scores and explanations for mappings
4. Generates multiple feasible mapping options
"""

import networkx as nx
from typing import List, Dict, Optional, Tuple, Set
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
# Phase U2: Import InventoryDevice as Device for unified device management
from backend.inventory.models import InventoryDevice as Device
from backend.scheduler import models
from collections import defaultdict
import itertools


class TopologyResolver:
    """Resolves logical topologies to physical device mappings"""
    
    def __init__(self, db: Session):
        self.db = db
        self.physical_graph = None
        self.device_cache = {}
        
    def build_physical_graph(self, date_range_start: datetime, date_range_end: datetime) -> nx.Graph:
        """
        Build a NetworkX graph representing the physical inventory.
        
        Nodes: Physical devices
        Edges: Physical connections (based on Out_Port/In_Port relationships)
        
        Each node stores:
        - device_id, device_type, device_name
        - availability status for the date range
        - device attributes (ports, IP, status)
        """
        G = nx.Graph()
        
        # Phase U2: Query all devices with eager loading
        devices = self.db.query(Device).options(joinedload(Device.device_type)).all()
        
        # Query all active bookings for the date range
        overlapping_bookings = (
            self.db.query(models.Booking)
            .filter(
                models.Booking.end_time > date_range_start,
                models.Booking.start_time < date_range_end,
                models.Booking.status.in_(["PENDING", "CONFIRMED", "CONFLICTING"]),
            )
            .all()
        )
        
        # Build booking map: device_id -> list of booking time ranges
        device_bookings = defaultdict(list)
        for booking in overlapping_bookings:
            device_bookings[booking.device_id].append((booking.start_time, booking.end_time))
        
        # Add devices as nodes
        for device in devices:
            # Check if device is available in the date range
            is_available = self._check_device_availability(
                device, date_range_start, date_range_end, device_bookings.get(device.id, [])
            )
            
            # Check maintenance
            in_maintenance = self._check_maintenance(device, date_range_start, date_range_end)
            
            # Device attributes
            device_attrs = {
                'device_id': device.id,
                'device_type': device.deviceType or 'Unknown',
                'device_name': device.deviceName or f'Device-{device.id}',
                'ip_address': device.ip_address,
                'status': device.status or 'Available',
                'out_port': device.Out_Port,
                'in_port': device.In_Port,
                'available': is_available and not in_maintenance,
                'in_maintenance': in_maintenance,
                'bookings': device_bookings.get(device.id, []),
            }
            
            G.add_node(device.id, **device_attrs)
            self.device_cache[device.id] = device_attrs
        
        # Build edges based on port connections
        # If device A's Out_Port connects to device B's In_Port, create an edge
        # For now, we'll create edges for devices that could potentially connect
        # In a real system, you might have explicit connection mappings
        device_nodes = list(G.nodes(data=True))
        for i, (dev_id1, attrs1) in enumerate(device_nodes):
            for dev_id2, attrs2 in device_nodes[i+1:]:
                # Simple heuristic: if devices have matching port types or are same type, they can connect
                # You might want to refine this based on actual physical topology
                if self._can_connect(attrs1, attrs2):
                    G.add_edge(dev_id1, dev_id2, weight=1.0)
        
        self.physical_graph = G
        return G
    
    def _check_device_availability(self, device: models.Device, start: datetime, end: datetime, bookings: List[Tuple[datetime, datetime]]) -> bool:
        """Check if device is available in the given time range"""
        # Check if device status is available
        if device.status and device.status.lower() in ['maintenance', 'unavailable', 'broken']:
            return False
        
        # Check bookings for conflicts
        for booking_start, booking_end in bookings:
            # Check for overlap
            if not (booking_end <= start or booking_start >= end):
                return False  # Device is booked during this time
        
        return True
    
    def _check_maintenance(self, device: models.Device, start: datetime, end: datetime) -> bool:
        """Check if device is in maintenance during the time range"""
        if device.status and device.status.lower() == 'maintenance':
            return True
        
        if device.maintenance_start and device.maintenance_end:
            try:
                # Parse maintenance dates (format: "Maintenance/2025-03-22")
                maint_start_str = device.maintenance_start.split("/")[-1] if "/" in device.maintenance_start else device.maintenance_start
                maint_end_str = device.maintenance_end.split("/")[-1] if "/" in device.maintenance_end else device.maintenance_end
                
                maint_start = datetime.strptime(maint_start_str, "%Y-%m-%d")
                maint_end = datetime.strptime(maint_end_str, "%Y-%m-%d")
                
                # Check for overlap
                if not (maint_end < start or maint_start > end):
                    return True
            except (ValueError, AttributeError):
                pass  # Invalid date format, skip
        
        return False
    
    def _can_connect(self, attrs1: Dict, attrs2: Dict) -> bool:
        """Check if two devices can be physically connected"""
        # Simple heuristic: devices of compatible types can connect
        # You might want to refine this based on actual physical topology
        
        type1 = attrs1.get('device_type', '').lower()
        type2 = attrs2.get('device_type', '').lower()
        
        # ROADM can connect to Fiber, ILA, Transceiver
        # Fiber can connect to ROADM, ILA, OTDR
        # ILA can connect to Fiber, ROADM
        # Transceiver can connect to ROADM, Switch
        # Switch can connect to Transceiver, ROADM
        
        compatible_pairs = [
            ('roadm', 'fiber'), ('roadm', 'ila'), ('roadm', 'transceiver'), ('roadm', 'switch'),
            ('fiber', 'roadm'), ('fiber', 'ila'), ('fiber', 'otdr'),
            ('ila', 'fiber'), ('ila', 'roadm'),
            ('transceiver', 'roadm'), ('transceiver', 'switch'),
            ('switch', 'transceiver'), ('switch', 'roadm'),
        ]
        
        return (type1, type2) in compatible_pairs or (type2, type1) in compatible_pairs
    
    def match_logical_node(self, logical_node: Dict, available_devices: List[int], 
                          logical_edges: List[Dict] = None) -> List[Dict]:
        """
        Find matching physical devices for a logical node.
        
        Returns list of candidate devices with fit scores and explanations.
        """
        logical_type = logical_node.get('deviceType', '').strip()
        logical_params = logical_node.get('parameters', {})
        logical_id = logical_node.get('id', '')
        
        candidates = []
        
        if not self.physical_graph:
            return candidates
        
        # Get devices that match the type and are available
        for device_id in available_devices:
            if device_id not in self.physical_graph:
                continue
                
            device_attrs = self.physical_graph.nodes[device_id]
            physical_type = (device_attrs.get('device_type') or '').strip()
            
            # Type matching
            if physical_type.lower() != logical_type.lower():
                continue
            
            # Compute fit score
            fit_score, explanation = self._compute_fit_score(
                logical_node, device_attrs, logical_params, logical_edges
            )
            
            candidates.append({
                'device_id': device_id,
                'device_name': device_attrs.get('device_name', f'Device-{device_id}'),
                'device_type': physical_type,
                'fit_score': fit_score,
                'explanation': explanation,
                'available': device_attrs.get('available', False),
            })
        
        # Sort by fit score (descending)
        candidates.sort(key=lambda x: x['fit_score'], reverse=True)
        return candidates
    
    def _compute_fit_score(self, logical_node: Dict, physical_attrs: Dict, 
                          logical_params: Dict, logical_edges: List[Dict] = None) -> Tuple[float, str]:
        """
        Compute fit score (0.0 to 1.0) and explanation for matching a logical node to a physical device.
        
        Factors:
        1. Type match (required, 1.0 if match, 0.0 otherwise)
        2. Availability (1.0 if available, 0.0 if not)
        3. Attribute matching (vendor, ports, etc.)
        4. Connection compatibility (if edges are specified)
        """
        score = 1.0
        factors = []
        
        # Factor 1: Type match (already filtered, so always 1.0)
        factors.append("Type match: ✓")
        
        # Factor 2: Availability
        if not physical_attrs.get('available', False):
            score = 0.0
            factors.append("Availability: ✗ (not available in time range)")
            return score, " | ".join(factors)
        factors.append("Availability: ✓")
        
        # Factor 3: Status
        status = physical_attrs.get('status', '').lower()
        if status == 'available':
            factors.append("Status: ✓")
        elif status == 'maintenance':
            score *= 0.0
            factors.append("Status: ✗ (maintenance)")
        else:
            factors.append(f"Status: {status}")
        
        # Factor 4: Attribute matching
        param_score = 1.0
        param_factors = []
        
        # Vendor matching
        if logical_params.get('vendor'):
            # Physical devices don't store vendor in current schema, so skip for now
            # In a real system, you'd compare vendor compatibility
            pass
        
        # Port matching (for ROADM, Switch)
        if logical_params.get('ports'):
            logical_ports = int(logical_params.get('ports', 0))
            # Physical devices have Out_Port and In_Port, but not total ports
            # This is a limitation of current schema
            pass
        
        # Length matching (for Fiber)
        if logical_params.get('length'):
            # Fiber length is a logical parameter, physical fiber has fixed length
            # This could be used to filter, but for now we accept any fiber
            param_factors.append("Length: acceptable")
        
        # Gain matching (for ILA)
        if logical_params.get('gain'):
            # ILA gain is a logical parameter, physical ILA has fixed gain
            # This could be used to filter
            param_factors.append("Gain: acceptable")
        
        if param_factors:
            factors.append(f"Attributes: {' | '.join(param_factors)}")
        
        # Factor 5: Connection compatibility (if we have edges)
        if logical_edges:
            # Check if physical device can connect to required neighbors
            # This is a simplified check - in reality, you'd verify the physical topology
            connection_score = 1.0
            # For now, we assume connections are possible if devices are in the graph
            factors.append("Connections: compatible")
        
        return score, " | ".join(factors)
    
    def resolve_topology(self, logical_nodes: List[Dict], logical_edges: List[Dict],
                        date_range_start: datetime, date_range_end: datetime,
                        num_options: int = 3) -> List[Dict]:
        """
        Resolve a logical topology to physical device mappings.
        
        Returns multiple mapping options, each with:
        - mapping_id: Unique identifier
        - total_fit_score: Overall fit score (0.0 to 1.0)
        - node_mappings: List of logical_node_id -> physical_device mappings
        - link_mappings: List of logical_edge_id -> physical_link mappings
        - notes: Explanation of the mapping
        """
        # Build physical graph
        physical_graph = self.build_physical_graph(date_range_start, date_range_end)
        
        if not physical_graph or len(physical_graph.nodes) == 0:
            return []
        
        # Get available devices by type
        available_by_type = defaultdict(list)
        for node_id, attrs in physical_graph.nodes(data=True):
            if attrs.get('available', False):
                device_type = attrs.get('device_type', '').lower()
                available_by_type[device_type].append(node_id)
        
        # Generate mapping options using different strategies
        mapping_options = []
        
        # Strategy 1: Greedy - Best fit for each node independently
        mapping_options.append(
            self._generate_greedy_mapping(logical_nodes, logical_edges, available_by_type, physical_graph, "greedy-best-fit")
        )
        
        # Strategy 2: Balanced - Try to use different devices
        mapping_options.append(
            self._generate_balanced_mapping(logical_nodes, logical_edges, available_by_type, physical_graph, "balanced-distribution")
        )
        
        # Strategy 3: Connection-optimized - Prefer devices that are physically connected
        mapping_options.append(
            self._generate_connection_optimized_mapping(logical_nodes, logical_edges, available_by_type, physical_graph, "connection-optimized")
        )
        
        # Filter out None mappings and sort by fit score
        mapping_options = [m for m in mapping_options if m is not None]
        mapping_options.sort(key=lambda x: x['total_fit_score'], reverse=True)
        
        # Return top num_options
        return mapping_options[:num_options]
    
    def _generate_greedy_mapping(self, logical_nodes: List[Dict], logical_edges: List[Dict],
                                 available_by_type: Dict[str, List[int]], physical_graph: nx.Graph,
                                 strategy_name: str) -> Optional[Dict]:
        """Generate mapping using greedy best-fit strategy"""
        node_mappings = []
        used_devices = set()
        
        for logical_node in logical_nodes:
            logical_type = logical_node.get('deviceType', '').lower()
            available_devices = available_by_type.get(logical_type, [])
            
            # Filter out already used devices
            candidates = [d for d in available_devices if d not in used_devices]
            
            if not candidates:
                # No available devices, try with used devices
                candidates = available_devices
            
            # Get best match
            matches = self.match_logical_node(logical_node, candidates, logical_edges)
            
            if not matches:
                # No match found, return None to indicate failure
                return None
            
            best_match = matches[0]
            used_devices.add(best_match['device_id'])
            
            node_mappings.append({
                'logical_node_id': logical_node.get('id', ''),
                'physical_device_id': best_match['device_id'],
                'physical_device_name': best_match['device_name'],
                'physical_device_type': best_match['device_type'],
                'fit_score': best_match['fit_score'],
                'confidence': 'high' if best_match['fit_score'] >= 0.8 else 'medium' if best_match['fit_score'] >= 0.5 else 'low',
                'alternatives': matches[1:4],  # Top 3 alternatives
                'explanation': best_match.get('explanation', ''),
            })
        
        # Generate link mappings
        link_mappings = self._generate_link_mappings(logical_edges, node_mappings, physical_graph)
        
        # Calculate total fit score
        node_scores = [m['fit_score'] for m in node_mappings]
        link_scores = [m['fit_score'] for m in link_mappings]
        total_fit_score = (
            (sum(node_scores) / len(node_scores) if node_scores else 0) * 0.7 +
            (sum(link_scores) / len(link_scores) if link_scores else 0) * 0.3
        )
        
        return {
            'mapping_id': strategy_name,
            'total_fit_score': round(total_fit_score, 2),
            'node_mappings': node_mappings,
            'link_mappings': link_mappings,
            'notes': f'Greedy best-fit mapping. All nodes matched to best available devices.',
        }
    
    def _generate_balanced_mapping(self, logical_nodes: List[Dict], logical_edges: List[Dict],
                                   available_by_type: Dict[str, List[int]], physical_graph: nx.Graph,
                                   strategy_name: str) -> Optional[Dict]:
        """Generate mapping trying to distribute devices evenly"""
        node_mappings = []
        device_usage_count = defaultdict(int)
        
        for logical_node in logical_nodes:
            logical_type = logical_node.get('deviceType', '').lower()
            available_devices = available_by_type.get(logical_type, [])
            
            if not available_devices:
                return None
            
            # Get matches and prefer less-used devices
            matches = self.match_logical_node(logical_node, available_devices, logical_edges)
            
            if not matches:
                return None
            
            # Score by fit_score - usage_penalty
            scored_matches = []
            for match in matches:
                usage = device_usage_count[match['device_id']]
                adjusted_score = match['fit_score'] - (usage * 0.1)  # Penalty for reuse
                scored_matches.append((adjusted_score, match))
            
            scored_matches.sort(key=lambda x: x[0], reverse=True)
            best_match = scored_matches[0][1]
            
            device_usage_count[best_match['device_id']] += 1
            node_mappings.append({
                'logical_node_id': logical_node.get('id', ''),
                'physical_device_id': best_match['device_id'],
                'physical_device_name': best_match['device_name'],
                'physical_device_type': best_match['device_type'],
                'fit_score': best_match['fit_score'],
                'confidence': 'high' if best_match['fit_score'] >= 0.8 else 'medium' if best_match['fit_score'] >= 0.5 else 'low',
                'alternatives': [m[1] for m in scored_matches[1:4]],
                'explanation': best_match.get('explanation', ''),
            })
        
        link_mappings = self._generate_link_mappings(logical_edges, node_mappings, physical_graph)
        
        node_scores = [m['fit_score'] for m in node_mappings]
        link_scores = [m['fit_score'] for m in link_mappings]
        total_fit_score = (
            (sum(node_scores) / len(node_scores) if node_scores else 0) * 0.7 +
            (sum(link_scores) / len(link_scores) if link_scores else 0) * 0.3
        )
        
        return {
            'mapping_id': strategy_name,
            'total_fit_score': round(total_fit_score, 2),
            'node_mappings': node_mappings,
            'link_mappings': link_mappings,
            'notes': 'Balanced distribution mapping. Tries to use different devices when possible.',
        }
    
    def _generate_connection_optimized_mapping(self, logical_nodes: List[Dict], logical_edges: List[Dict],
                                               available_by_type: Dict[str, List[int]], physical_graph: nx.Graph,
                                               strategy_name: str) -> Optional[Dict]:
        """Generate mapping preferring devices that are physically connected"""
        # Start with greedy, but boost score for connected devices
        node_mappings = []
        used_devices = set()
        
        # Build logical adjacency
        logical_adj = defaultdict(set)
        for edge in logical_edges:
            source = edge.get('source', '')
            target = edge.get('target', '')
            logical_adj[source].add(target)
            logical_adj[target].add(source)
        
        for logical_node in logical_nodes:
            logical_id = logical_node.get('id', '')
            logical_type = logical_node.get('deviceType', '').lower()
            available_devices = available_by_type.get(logical_type, [])
            
            candidates = [d for d in available_devices if d not in used_devices]
            if not candidates:
                candidates = available_devices
            
            matches = self.match_logical_node(logical_node, candidates, logical_edges)
            
            if not matches:
                return None
            
            # Boost score for devices connected to already-mapped neighbors
            for match in matches:
                device_id = match['device_id']
                connection_bonus = 0.0
                
                # Check if this device is connected to any already-mapped devices
                logical_neighbors = logical_adj.get(logical_id, set())
                for neighbor_id in logical_neighbors:
                    # Find physical device for neighbor
                    for nm in node_mappings:
                        if nm['logical_node_id'] == neighbor_id:
                            neighbor_physical_id = nm['physical_device_id']
                            if physical_graph.has_edge(device_id, neighbor_physical_id):
                                connection_bonus += 0.1
                                break
                
                match['fit_score'] = min(1.0, match['fit_score'] + connection_bonus)
            
            matches.sort(key=lambda x: x['fit_score'], reverse=True)
            best_match = matches[0]
            used_devices.add(best_match['device_id'])
            
            node_mappings.append({
                'logical_node_id': logical_id,
                'physical_device_id': best_match['device_id'],
                'physical_device_name': best_match['device_name'],
                'physical_device_type': best_match['device_type'],
                'fit_score': best_match['fit_score'],
                'confidence': 'high' if best_match['fit_score'] >= 0.8 else 'medium' if best_match['fit_score'] >= 0.5 else 'low',
                'alternatives': matches[1:4],
                'explanation': best_match.get('explanation', ''),
            })
        
        link_mappings = self._generate_link_mappings(logical_edges, node_mappings, physical_graph)
        
        node_scores = [m['fit_score'] for m in node_mappings]
        link_scores = [m['fit_score'] for m in link_mappings]
        total_fit_score = (
            (sum(node_scores) / len(node_scores) if node_scores else 0) * 0.7 +
            (sum(link_scores) / len(link_scores) if link_scores else 0) * 0.3
        )
        
        return {
            'mapping_id': strategy_name,
            'total_fit_score': round(total_fit_score, 2),
            'node_mappings': node_mappings,
            'link_mappings': link_mappings,
            'notes': 'Connection-optimized mapping. Prefers physically connected devices.',
        }
    
    def _generate_link_mappings(self, logical_edges: List[Dict], node_mappings: List[Dict],
                                physical_graph: nx.Graph) -> List[Dict]:
        """Generate mappings for logical edges to physical links"""
        link_mappings = []
        
        # Create lookup: logical_node_id -> physical_device_id
        node_lookup = {nm['logical_node_id']: nm['physical_device_id'] for nm in node_mappings}
        
        for edge in logical_edges:
            source_logical = edge.get('source', '')
            target_logical = edge.get('target', '')
            edge_id = edge.get('id', f"{source_logical}-{target_logical}")
            
            source_physical = node_lookup.get(source_logical)
            target_physical = node_lookup.get(target_logical)
            
            if source_physical and target_physical:
                # Check if physical devices are connected
                if physical_graph.has_edge(source_physical, target_physical):
                    fit_score = 1.0
                    explanation = "Direct physical connection"
                else:
                    # Check if there's a path
                    try:
                        if nx.has_path(physical_graph, source_physical, target_physical):
                            path_length = len(nx.shortest_path(physical_graph, source_physical, target_physical)) - 1
                            fit_score = max(0.5, 1.0 - (path_length - 1) * 0.2)
                            explanation = f"Indirect connection (path length: {path_length})"
                        else:
                            fit_score = 0.3
                            explanation = "No physical path (may require additional configuration)"
                    except (nx.NodeNotFound, nx.NetworkXNoPath):
                        fit_score = 0.3
                        explanation = "No physical path"
            else:
                fit_score = 0.0
                explanation = "Source or target device not mapped"
            
            link_mappings.append({
                'logical_edge_id': edge_id,
                'source_mapping': source_logical,
                'target_mapping': target_logical,
                'physical_link_id': f"link-{source_physical}-{target_physical}" if source_physical and target_physical else None,
                'fit_score': round(fit_score, 2),
                'explanation': explanation,
            })
        
        return link_mappings

