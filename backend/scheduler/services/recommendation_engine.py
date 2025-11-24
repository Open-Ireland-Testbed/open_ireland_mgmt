"""
Recommendation Engine Module

This module provides:
1. Historical booking outcome tracking and analysis
2. Lightweight ML model for fit_score adjustments and performance prediction
3. Availability forecasting
4. Topology configuration recommendations
"""

from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from collections import defaultdict
from backend.scheduler import models
import statistics
import math


class RecommendationEngine:
    """Provides recommendations and predictions based on historical data"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def record_booking_outcome(self, booking_id: int, outcome: str, performance_metrics: Dict = None):
        """
        Record the outcome of a booking for learning.
        
        Outcomes: 'successful', 'failed', 'cancelled', 'conflict_resolved'
        performance_metrics: optional dict with metrics like 'duration_used', 'issues_reported', etc.
        """
        # For now, we'll use the booking status as the outcome
        # In a full implementation, you might want a separate outcome tracking table
        booking = self.db.query(models.Booking).get(booking_id)
        if booking:
            # We can infer outcome from status
            # CONFIRMED -> successful, REJECTED -> failed, CANCELLED -> cancelled
            pass  # Outcome is already in booking.status
    
    def get_historical_booking_stats(self, device_id: Optional[int] = None, 
                                    device_type: Optional[str] = None,
                                    days_back: int = 90) -> Dict:
        """
        Get historical booking statistics for devices.
        
        Returns statistics like:
        - success_rate: % of CONFIRMED bookings
        - cancellation_rate: % of CANCELLED bookings
        - average_duration: average booking duration
        - conflict_rate: % of CONFLICTING bookings
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)
        
        query = self.db.query(models.Booking).filter(
            models.Booking.start_time >= cutoff_date
        )
        
        if device_id:
            query = query.filter(models.Booking.device_id == device_id)
        elif device_type:
            query = query.join(models.Device).filter(
                models.Device.deviceType == device_type
            )
        
        bookings = query.all()
        
        if not bookings:
            return {
                'total_bookings': 0,
                'success_rate': 0.0,
                'cancellation_rate': 0.0,
                'conflict_rate': 0.0,
                'average_duration_hours': 0.0,
                'reliability_score': 0.5,  # Default neutral score
            }
        
        total = len(bookings)
        confirmed = sum(1 for b in bookings if b.status == 'CONFIRMED')
        cancelled = sum(1 for b in bookings if b.status == 'CANCELLED')
        conflicting = sum(1 for b in bookings if b.status == 'CONFLICTING')
        
        durations = []
        for b in bookings:
            if b.end_time and b.start_time:
                duration = (b.end_time - b.start_time).total_seconds() / 3600
                durations.append(duration)
        
        avg_duration = statistics.mean(durations) if durations else 0.0
        
        # Reliability score: combines success rate and conflict rate
        success_rate = confirmed / total if total > 0 else 0.0
        conflict_rate = conflicting / total if total > 0 else 0.0
        reliability_score = success_rate * (1 - conflict_rate * 0.5)  # Penalize conflicts
        
        return {
            'total_bookings': total,
            'success_rate': round(success_rate, 3),
            'cancellation_rate': round(cancelled / total if total > 0 else 0.0, 3),
            'conflict_rate': round(conflict_rate, 3),
            'average_duration_hours': round(avg_duration, 2),
            'reliability_score': round(reliability_score, 3),
        }
    
    def predict_fit_score_adjustment(self, device_id: int, device_type: str, 
                                     base_fit_score: float, date_range_start: datetime,
                                     date_range_end: datetime) -> Tuple[float, str]:
        """
        Predict fit_score adjustment based on historical data.
        
        Returns: (adjusted_score, explanation)
        """
        # Get historical stats
        device_stats = self.get_historical_booking_stats(device_id=device_id, days_back=90)
        type_stats = self.get_historical_booking_stats(device_type=device_type, days_back=90)
        
        # Combine device-specific and type-specific reliability
        device_reliability = device_stats.get('reliability_score', 0.5)
        type_reliability = type_stats.get('reliability_score', 0.5)
        
        # Weight: 70% device-specific, 30% type-specific
        combined_reliability = device_reliability * 0.7 + type_reliability * 0.3
        
        # Adjust fit score based on reliability
        # High reliability (0.8+) adds up to 0.1 to score
        # Low reliability (<0.5) subtracts up to 0.1 from score
        reliability_adjustment = (combined_reliability - 0.5) * 0.2
        adjusted_score = max(0.0, min(1.0, base_fit_score + reliability_adjustment))
        
        # Check time-based patterns (weekday/weekend, time of day)
        time_adjustment = self._get_time_based_adjustment(date_range_start, date_range_end)
        adjusted_score = max(0.0, min(1.0, adjusted_score + time_adjustment))
        
        explanation_parts = []
        if device_stats['total_bookings'] > 0:
            explanation_parts.append(
                f"Device reliability: {device_reliability:.1%} ({device_stats['success_rate']:.1%} success rate)"
            )
        if type_stats['total_bookings'] > 0:
            explanation_parts.append(
                f"Type reliability: {type_reliability:.1%}"
            )
        if abs(reliability_adjustment) > 0.01:
            direction = "improved" if reliability_adjustment > 0 else "reduced"
            explanation_parts.append(
                f"Score {direction} by {abs(reliability_adjustment):.1%} based on historical performance"
            )
        
        explanation = " | ".join(explanation_parts) if explanation_parts else "Standard fit score"
        
        return round(adjusted_score, 3), explanation
    
    def _get_time_based_adjustment(self, start: datetime, end: datetime) -> float:
        """
        Get time-based adjustment for fit score.
        
        Patterns:
        - Weekends might have lower availability
        - Peak hours might have more conflicts
        """
        adjustment = 0.0
        
        # Check if spans weekend
        start_weekday = start.weekday()
        end_weekday = end.weekday()
        days_span = (end.date() - start.date()).days
        
        # Weekend penalty (small)
        if start_weekday >= 5 or end_weekday >= 5 or days_span > 5:
            adjustment -= 0.02
        
        # Very long bookings might have more conflicts
        if days_span > 7:
            adjustment -= 0.01
        
        return adjustment
    
    def forecast_availability(self, device_ids: List[int], 
                            start_time: datetime, end_time: datetime,
                            forecast_window_days: int = 7) -> Dict[int, Dict]:
        """
        Forecast availability probability for devices over a time window.
        
        Returns dict mapping device_id -> {
            'availability_probability': float (0.0 to 1.0),
            'confidence': float,
            'factors': List[str],
            'earliest_available_slot': Optional[datetime],
        }
        """
        results = {}
        
        for device_id in device_ids:
            device = self.db.query(models.Device).get(device_id)
            if not device:
                continue
            
            # Get current availability status
            is_available_now = self._check_current_availability(device, start_time, end_time)
            
            # Get historical booking patterns
            historical_stats = self.get_historical_booking_stats(device_id=device_id, days_back=30)
            
            # Calculate availability probability
            # Base probability from current status
            base_prob = 1.0 if is_available_now else 0.0
            
            # Adjust based on historical patterns
            # If device has high booking rate, lower availability probability
            booking_density = self._calculate_booking_density(
                device_id, start_time, end_time, forecast_window_days
            )
            
            # Availability probability = 1 - booking_density (with some uncertainty)
            availability_prob = max(0.0, min(1.0, 1.0 - booking_density * 1.2))
            
            # If currently available, boost probability
            if is_available_now:
                availability_prob = max(availability_prob, 0.7)
            
            # Confidence based on historical data volume
            confidence = min(1.0, historical_stats['total_bookings'] / 10.0) if historical_stats['total_bookings'] > 0 else 0.3
            
            # Find earliest available slot
            earliest_slot = self._find_earliest_available_slot(
                device_id, start_time, forecast_window_days
            )
            
            factors = []
            if booking_density > 0.5:
                factors.append("High historical booking density")
            if historical_stats['conflict_rate'] > 0.1:
                factors.append("Frequent conflicts in past")
            if is_available_now:
                factors.append("Currently available")
            else:
                factors.append("Currently booked")
            
            results[device_id] = {
                'availability_probability': round(availability_prob, 3),
                'confidence': round(confidence, 3),
                'factors': factors,
                'earliest_available_slot': earliest_slot.isoformat() if earliest_slot else None,
            }
        
        return results
    
    def _check_current_availability(self, device: models.Device, start: datetime, end: datetime) -> bool:
        """Check if device is currently available"""
        # Check status
        if device.status and device.status.lower() in ['maintenance', 'unavailable']:
            return False
        
        # Check bookings
        overlapping = self.db.query(models.Booking).filter(
            models.Booking.device_id == device.id,
            models.Booking.end_time > start,
            models.Booking.start_time < end,
            models.Booking.status.in_(['PENDING', 'CONFIRMED', 'CONFLICTING']),
        ).first()
        
        return overlapping is None
    
    def _calculate_booking_density(self, device_id: int, start: datetime, 
                                   end: datetime, window_days: int) -> float:
        """Calculate historical booking density for a device"""
        # Look at historical bookings in similar time windows
        historical_start = start - timedelta(days=window_days * 2)
        historical_end = end - timedelta(days=window_days)
        
        bookings = self.db.query(models.Booking).filter(
            models.Booking.device_id == device_id,
            models.Booking.start_time >= historical_start,
            models.Booking.end_time <= historical_end,
            models.Booking.status.in_(['CONFIRMED', 'PENDING']),
        ).all()
        
        if not bookings:
            return 0.0
        
        # Calculate total booked hours
        total_booked_hours = sum(
            (b.end_time - b.start_time).total_seconds() / 3600
            for b in bookings
        )
        
        # Calculate window hours
        window_hours = (end - start).total_seconds() / 3600
        
        # Density = booked hours / window hours (capped at 1.0)
        density = min(1.0, total_booked_hours / window_hours) if window_hours > 0 else 0.0
        
        return density
    
    def _find_earliest_available_slot(self, device_id: int, from_time: datetime, 
                                     window_days: int) -> Optional[datetime]:
        """Find earliest available slot for a device"""
        # Get all bookings in the window
        window_end = from_time + timedelta(days=window_days)
        
        bookings = self.db.query(models.Booking).filter(
            models.Booking.device_id == device_id,
            models.Booking.end_time > from_time,
            models.Booking.end_time <= window_end,
            models.Booking.status.in_(['PENDING', 'CONFIRMED', 'CONFLICTING']),
        ).order_by(models.Booking.end_time.asc()).all()
        
        if not bookings:
            return from_time
        
        # Check if there's a gap after the last booking
        last_booking_end = max(b.end_time for b in bookings)
        if last_booking_end < window_end:
            return last_booking_end + timedelta(minutes=1)
        
        # Check for gaps between bookings
        current_time = from_time
        for booking in bookings:
            if current_time < booking.start_time:
                # Found a gap
                return current_time
            current_time = max(current_time, booking.end_time)
        
        return None  # No available slot found
    
    def suggest_topology_configurations(self, logical_nodes: List[Dict], 
                                       logical_edges: List[Dict],
                                       date_range_start: datetime,
                                       date_range_end: datetime,
                                       base_mappings: List[Dict]) -> List[Dict]:
        """
        Suggest optimized topology configurations based on:
        - Performance predictions
        - Earliest availability
        - Resource efficiency
        - Historical reliability
        
        Returns ranked list of suggested configurations with rationale.
        """
        suggestions = []
        
        for mapping in base_mappings:
            # Apply fit score adjustments based on historical data
            adjusted_mapping = self._apply_fit_score_adjustments(
                mapping, date_range_start, date_range_end
            )
            
            # Calculate various metrics
            performance_score = self._calculate_performance_score(adjusted_mapping, logical_nodes)
            availability_score = self._calculate_availability_score(
                adjusted_mapping, date_range_start, date_range_end
            )
            efficiency_score = self._calculate_efficiency_score(adjusted_mapping, logical_nodes)
            reliability_score = self._calculate_reliability_score(adjusted_mapping)
            
            # Combined recommendation score
            recommendation_score = (
                performance_score * 0.3 +
                availability_score * 0.25 +
                efficiency_score * 0.25 +
                reliability_score * 0.2
            )
            
            # Generate rationale
            rationale = self._generate_rationale(
                adjusted_mapping, performance_score, availability_score, 
                efficiency_score, reliability_score
            )
            
            # Find earliest slot if not immediately available
            earliest_slot = self._find_earliest_slot_for_mapping(
                adjusted_mapping, date_range_start, date_range_end
            )
            
            suggestions.append({
                'mapping_id': adjusted_mapping.get('mapping_id', 'unknown'),
                'recommendation_score': round(recommendation_score, 3),
                'performance_score': round(performance_score, 3),
                'availability_score': round(availability_score, 3),
                'efficiency_score': round(efficiency_score, 3),
                'reliability_score': round(reliability_score, 3),
                'rationale': rationale,
                'earliest_available_slot': earliest_slot.isoformat() if earliest_slot else None,
                'mapping': adjusted_mapping,
            })
        
        # Sort by recommendation score
        suggestions.sort(key=lambda x: x['recommendation_score'], reverse=True)
        
        return suggestions
    
    def _apply_fit_score_adjustments(self, mapping: Dict, 
                                     date_range_start: datetime,
                                     date_range_end: datetime) -> Dict:
        """
        Apply fit score adjustments to node mappings based on historical data.
        
        Updates fit scores and explanations for each node mapping.
        """
        adjusted_node_mappings = []
        
        for nm in mapping.get('node_mappings', []):
            device_id = nm.get('physical_device_id')
            device_type = nm.get('physical_device_type', '')
            base_fit_score = nm.get('fit_score', 0.0)
            
            if device_id and device_type:
                # Get adjusted fit score
                adjusted_score, explanation = self.predict_fit_score_adjustment(
                    device_id, device_type, base_fit_score,
                    date_range_start, date_range_end
                )
                
                # Update the mapping
                adjusted_nm = nm.copy()
                adjusted_nm['fit_score'] = adjusted_score
                if explanation:
                    # Append to existing explanation
                    existing_explanation = nm.get('explanation', '')
                    adjusted_nm['explanation'] = f"{existing_explanation} | {explanation}" if existing_explanation else explanation
                
                adjusted_node_mappings.append(adjusted_nm)
            else:
                adjusted_node_mappings.append(nm)
        
        # Recalculate total fit score
        node_scores = [nm['fit_score'] for nm in adjusted_node_mappings]
        link_scores = [lm.get('fit_score', 0.0) for lm in mapping.get('link_mappings', [])]
        total_fit_score = (
            (sum(node_scores) / len(node_scores) if node_scores else 0) * 0.7 +
            (sum(link_scores) / len(link_scores) if link_scores else 0) * 0.3
        )
        
        adjusted_mapping = mapping.copy()
        adjusted_mapping['node_mappings'] = adjusted_node_mappings
        adjusted_mapping['total_fit_score'] = round(total_fit_score, 2)
        
        return adjusted_mapping
    
    def _calculate_performance_score(self, mapping: Dict, logical_nodes: List[Dict]) -> float:
        """Calculate performance score based on fit scores"""
        node_mappings = mapping.get('node_mappings', [])
        if not node_mappings:
            return 0.0
        
        fit_scores = [nm.get('fit_score', 0.0) for nm in node_mappings]
        return statistics.mean(fit_scores) if fit_scores else 0.0
    
    def _calculate_availability_score(self, mapping: Dict, start: datetime, end: datetime) -> float:
        """Calculate availability score (higher = more available)"""
        node_mappings = mapping.get('node_mappings', [])
        if not node_mappings:
            return 0.0
        
        available_count = sum(
            1 for nm in node_mappings
            if nm.get('available', False)
        )
        
        return available_count / len(node_mappings) if node_mappings else 0.0
    
    def _calculate_efficiency_score(self, mapping: Dict, logical_nodes: List[Dict]) -> float:
        """Calculate resource efficiency score"""
        node_mappings = mapping.get('node_mappings', [])
        if not node_mappings:
            return 0.0
        
        # Efficiency: prefer using fewer unique devices (device reuse)
        unique_devices = len(set(nm.get('physical_device_id') for nm in node_mappings))
        total_nodes = len(node_mappings)
        
        # Lower device count relative to node count = higher efficiency
        efficiency = 1.0 - (unique_devices / total_nodes - 0.5) * 0.5 if total_nodes > 0 else 0.0
        return max(0.0, min(1.0, efficiency))
    
    def _calculate_reliability_score(self, mapping: Dict) -> float:
        """Calculate reliability score based on historical data"""
        node_mappings = mapping.get('node_mappings', [])
        if not node_mappings:
            return 0.0
        
        reliability_scores = []
        for nm in node_mappings:
            device_id = nm.get('physical_device_id')
            device_type = nm.get('physical_device_type', '')
            
            if device_id:
                stats = self.get_historical_booking_stats(device_id=device_id, days_back=90)
                reliability_scores.append(stats.get('reliability_score', 0.5))
            elif device_type:
                stats = self.get_historical_booking_stats(device_type=device_type, days_back=90)
                reliability_scores.append(stats.get('reliability_score', 0.5))
            else:
                reliability_scores.append(0.5)  # Default
        
        return statistics.mean(reliability_scores) if reliability_scores else 0.5
    
    def _generate_rationale(self, mapping: Dict, performance_score: float,
                           availability_score: float, efficiency_score: float,
                           reliability_score: float) -> str:
        """Generate human-readable rationale for a recommendation"""
        parts = []
        
        if performance_score >= 0.8:
            parts.append("Excellent performance fit")
        elif performance_score >= 0.6:
            parts.append("Good performance fit")
        
        if availability_score >= 0.9:
            parts.append("All devices available")
        elif availability_score >= 0.7:
            parts.append("Most devices available")
        elif availability_score < 0.5:
            parts.append("Limited availability")
        
        if efficiency_score >= 0.7:
            parts.append("Efficient resource usage")
        
        if reliability_score >= 0.8:
            parts.append("High historical reliability")
        elif reliability_score < 0.5:
            parts.append("Lower reliability (check alternatives)")
        
        return " | ".join(parts) if parts else "Standard configuration"
    
    def _find_earliest_slot_for_mapping(self, mapping: Dict, 
                                       preferred_start: datetime,
                                       preferred_end: datetime) -> Optional[datetime]:
        """Find earliest available slot for entire mapping"""
        node_mappings = mapping.get('node_mappings', [])
        if not node_mappings:
            return None
        
        # Get earliest slot for each device
        earliest_slots = []
        for nm in node_mappings:
            device_id = nm.get('physical_device_id')
            if device_id:
                slot = self._find_earliest_available_slot(device_id, preferred_start, 14)
                if slot:
                    earliest_slots.append(slot)
        
        if not earliest_slots:
            return None
        
        # Return the latest of the earliest slots (when all devices are available)
        return max(earliest_slots)

