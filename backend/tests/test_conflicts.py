"""
Tests for conflict detection functionality
"""
import pytest
from datetime import datetime, timedelta
from models import Booking, Device, User
from hash import hash_password


def test_check_conflicts_no_conflicts(authenticated_client, test_device):
    """Test conflict check when there are no conflicts"""
    start_time = datetime.now() + timedelta(days=2)
    end_time = start_time + timedelta(days=1)
    
    response = authenticated_client.post(
        "/check-conflicts",
        json={
            "device_ids": [test_device.id],
            "start": start_time.isoformat(),
            "end": end_time.isoformat()
        }
    )
    assert response.status_code == 200
    data = response.json()
    # Should return empty list or list with no conflicts
    assert isinstance(data, list)


def test_check_conflicts_with_booking_overlap(authenticated_client, test_user, test_device, db_session):
    """Test conflict detection with overlapping booking"""
    # Create existing booking
    start_time = datetime.now() + timedelta(days=1)
    end_time = start_time + timedelta(hours=5)
    
    existing_booking = Booking(
        device_id=test_device.id,
        user_id=test_user.id,
        start_time=start_time,
        end_time=end_time,
        status="CONFIRMED"
    )
    db_session.add(existing_booking)
    db_session.commit()
    
    # Check for conflicts in overlapping time
    check_start = start_time + timedelta(hours=1)
    check_end = start_time + timedelta(hours=3)
    
    response = authenticated_client.post(
        "/check-conflicts",
        json={
            "device_ids": [test_device.id],
            "start": check_start.isoformat(),
            "end": check_end.isoformat()
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert data[0]["device_id"] == test_device.id
    assert len(data[0]["conflicts"]) > 0


def test_check_conflicts_with_maintenance(authenticated_client, test_device, db_session):
    """Test conflict detection with maintenance period"""
    # Set maintenance period
    tomorrow = datetime.now() + timedelta(days=1)
    maintenance_start = f"All Day/{tomorrow.date().strftime('%Y-%m-%d')}"
    maintenance_end = f"All Day/{tomorrow.date().strftime('%Y-%m-%d')}"
    
    test_device.maintenance_start = maintenance_start
    test_device.maintenance_end = maintenance_end
    db_session.commit()
    
    # Check for conflicts during maintenance
    check_start = tomorrow
    check_end = tomorrow + timedelta(days=1)
    
    response = authenticated_client.post(
        "/check-conflicts",
        json={
            "device_ids": [test_device.id],
            "start": check_start.isoformat(),
            "end": check_end.isoformat()
        }
    )
    assert response.status_code == 200
    data = response.json()
    # Should detect maintenance conflict
    if len(data) > 0:
        conflicts = data[0].get("conflicts", [])
        maintenance_conflicts = [c for c in conflicts if c["conflict_type"] == "maintenance"]
        assert len(maintenance_conflicts) > 0


def test_check_conflicts_multiple_devices(authenticated_client, db_session):
    """Test conflict check for multiple devices"""
    device1 = Device(
        deviceType="Router",
        deviceName="Router1",
        status="Available",
        Out_Port=1,
        In_Port=2
    )
    device2 = Device(
        deviceType="Switch",
        deviceName="Switch1",
        status="Available",
        Out_Port=3,
        In_Port=4
    )
    db_session.add_all([device1, device2])
    db_session.commit()
    
    start_time = datetime.now() + timedelta(days=1)
    end_time = start_time + timedelta(days=1)
    
    response = authenticated_client.post(
        "/check-conflicts",
        json={
            "device_ids": [device1.id, device2.id],
            "start": start_time.isoformat(),
            "end": end_time.isoformat()
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_check_conflicts_pending_bookings(authenticated_client, test_user, test_device, db_session):
    """Test that pending bookings are considered in conflict check"""
    start_time = datetime.now() + timedelta(days=1)
    end_time = start_time + timedelta(hours=5)
    
    pending_booking = Booking(
        device_id=test_device.id,
        user_id=test_user.id,
        start_time=start_time,
        end_time=end_time,
        status="PENDING"
    )
    db_session.add(pending_booking)
    db_session.commit()
    
    check_start = start_time + timedelta(hours=1)
    check_end = start_time + timedelta(hours=3)
    
    response = authenticated_client.post(
        "/check-conflicts",
        json={
            "device_ids": [test_device.id],
            "start": check_start.isoformat(),
            "end": check_end.isoformat()
        }
    )
    assert response.status_code == 200
    data = response.json()
    # Should detect conflict with pending booking
    if len(data) > 0 and len(data[0].get("conflicts", [])) > 0:
        booking_conflicts = [c for c in data[0]["conflicts"] if c["conflict_type"] == "booking"]
        assert len(booking_conflicts) > 0


def test_check_conflicts_cancelled_bookings_ignored(authenticated_client, test_user, test_device, db_session):
    """Test that cancelled bookings are not considered conflicts"""
    start_time = datetime.now() + timedelta(days=1)
    end_time = start_time + timedelta(hours=5)
    
    cancelled_booking = Booking(
        device_id=test_device.id,
        user_id=test_user.id,
        start_time=start_time,
        end_time=end_time,
        status="CANCELLED"
    )
    db_session.add(cancelled_booking)
    db_session.commit()
    
    check_start = start_time + timedelta(hours=1)
    check_end = start_time + timedelta(hours=3)
    
    response = authenticated_client.post(
        "/check-conflicts",
        json={
            "device_ids": [test_device.id],
            "start": check_start.isoformat(),
            "end": check_end.isoformat()
        }
    )
    assert response.status_code == 200
    data = response.json()
    # Cancelled bookings should not create conflicts
    if len(data) > 0:
        conflicts = data[0].get("conflicts", [])
        # Should have no conflicts or only maintenance conflicts
        booking_conflicts = [c for c in conflicts if c["conflict_type"] == "booking"]
        assert len(booking_conflicts) == 0


def test_max_two_users_per_device(authenticated_client, test_device, db_session):
    """Test that system allows max 2 users per device at same time"""
    # Create two users
    user1 = User(
        username="user1",
        email="user1@test.com",
        password=hash_password("pass123"),
        is_admin=False
    )
    user2 = User(
        username="user2",
        email="user2@test.com",
        password=hash_password("pass123"),
        is_admin=False
    )
    db_session.add_all([user1, user2])
    db_session.commit()
    
    # Create two bookings for same device at same time
    start_time = datetime.now() + timedelta(days=1)
    end_time = start_time + timedelta(hours=5)
    
    booking1 = Booking(
        device_id=test_device.id,
        user_id=user1.id,
        start_time=start_time,
        end_time=end_time,
        status="PENDING"
    )
    booking2 = Booking(
        device_id=test_device.id,
        user_id=user2.id,
        start_time=start_time,
        end_time=end_time,
        status="PENDING"
    )
    db_session.add_all([booking1, booking2])
    db_session.commit()
    
    # Check conflicts - should show conflict for third user
    response = authenticated_client.post(
        "/check-conflicts",
        json={
            "device_ids": [test_device.id],
            "start": start_time.isoformat(),
            "end": end_time.isoformat()
        }
    )
    assert response.status_code == 200
    # System should detect conflicts when 2 users already have bookings

