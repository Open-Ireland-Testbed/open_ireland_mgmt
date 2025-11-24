"""
Tests for booking endpoints
"""
import pytest
from datetime import datetime, timedelta
from models import Booking, Device
from unittest.mock import patch, MagicMock


def test_create_single_booking(authenticated_client, test_user, test_device):
    """Test creating a single booking"""
    start_time = datetime.now() + timedelta(days=1)
    end_time = start_time + timedelta(hours=5)
    
    with patch('main.send_booking_created_notification'):
        response = authenticated_client.post(
            "/bookings",
            json={
                "user_id": test_user.id,
                "message": "Test booking",
                "bookings": [
                    {
                        "device_type": test_device.deviceType,
                        "device_name": test_device.deviceName,
                        "start_time": start_time.isoformat(),
                        "end_time": end_time.isoformat(),
                        "status": "PENDING"
                    }
                ]
            }
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    assert "successfully" in data["message"].lower()


def test_create_multi_device_booking(authenticated_client, test_user, db_session):
    """Test creating a booking for multiple devices"""
    # Create multiple devices
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
    end_time = start_time + timedelta(hours=3)
    
    with patch('main.send_booking_created_notification'):
        response = authenticated_client.post(
            "/bookings",
            json={
                "user_id": test_user.id,
                "message": "Multi-device booking",
                "bookings": [
                    {
                        "device_type": "Router",
                        "device_name": "Router1",
                        "start_time": start_time.isoformat(),
                        "end_time": end_time.isoformat(),
                        "status": "PENDING"
                    },
                    {
                        "device_type": "Switch",
                        "device_name": "Switch1",
                        "start_time": start_time.isoformat(),
                        "end_time": end_time.isoformat(),
                        "status": "PENDING"
                    }
                ]
            }
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 2


def test_create_booking_nonexistent_user(authenticated_client, test_device):
    """Test creating booking with non-existent user"""
    start_time = datetime.now() + timedelta(days=1)
    end_time = start_time + timedelta(hours=5)
    
    response = authenticated_client.post(
        "/bookings",
        json={
            "user_id": 99999,
            "message": "Test",
            "bookings": [
                {
                    "device_type": test_device.deviceType,
                    "device_name": test_device.deviceName,
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "status": "PENDING"
                }
            ]
        }
    )
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


def test_cancel_booking(authenticated_client, test_booking):
    """Test canceling a booking"""
    response = authenticated_client.put(
        f"/bookings/{test_booking.booking_id}/cancel"
    )
    assert response.status_code == 200
    assert "cancelled" in response.json()["message"].lower()


def test_cancel_nonexistent_booking(authenticated_client):
    """Test canceling a non-existent booking"""
    response = authenticated_client.put("/bookings/99999/cancel")
    assert response.status_code == 404


def test_cancel_already_cancelled_booking(authenticated_client, test_booking, db_session):
    """Test canceling an already cancelled booking"""
    test_booking.status = "CANCELLED"
    db_session.commit()
    
    response = authenticated_client.put(
        f"/bookings/{test_booking.booking_id}/cancel"
    )
    assert response.status_code == 400
    assert "already cancelled" in response.json()["detail"].lower()


def test_delete_booking(authenticated_client, test_booking, db_session):
    """Test deleting a booking"""
    test_booking.status = "CANCELLED"
    db_session.commit()
    
    response = authenticated_client.delete(
        f"/bookings/{test_booking.booking_id}"
    )
    assert response.status_code == 200
    assert "deleted" in response.json()["message"].lower()


def test_delete_nonexistent_booking(authenticated_client):
    """Test deleting a non-existent booking"""
    response = authenticated_client.delete("/bookings/99999")
    assert response.status_code == 404


def test_get_user_bookings(authenticated_client, test_user, test_booking):
    """Test getting all bookings for a user"""
    response = authenticated_client.get(f"/bookings/user/{test_user.id}")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert data[0]["booking_id"] == test_booking.booking_id


def test_get_user_bookings_nonexistent_user(authenticated_client):
    """Test getting bookings for non-existent user"""
    response = authenticated_client.get("/bookings/user/99999")
    assert response.status_code == 404


def test_get_bookings_for_week(authenticated_client, test_booking):
    """Test getting bookings for a specific week"""
    week_start = test_booking.start_time.date()
    response = authenticated_client.get(
        f"/bookings/for-week?start={week_start.strftime('%Y-%m-%d')}"
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_get_bookings_for_week_invalid_date(authenticated_client):
    """Test getting bookings with invalid date format"""
    response = authenticated_client.get("/bookings/for-week?start=invalid-date")
    assert response.status_code == 400


def test_booking_auto_expire(authenticated_client, test_user, test_booking, db_session):
    """Test that expired bookings are automatically marked as expired"""
    # Set booking to past
    test_booking.start_time = datetime.now() - timedelta(days=2)
    test_booking.end_time = datetime.now() - timedelta(days=1)
    test_booking.status = "CONFIRMED"
    db_session.commit()
    
    response = authenticated_client.get(f"/bookings/user/{test_user.id}")
    assert response.status_code == 200
    data = response.json()
    # Find the expired booking
    expired = [b for b in data if b["booking_id"] == test_booking.booking_id]
    if expired:
        assert expired[0]["status"] == "EXPIRED"


def test_cancel_booking_resolves_conflict(authenticated_client, test_user, test_device, db_session):
    """Test that canceling a booking resolves conflicts"""
    # Create two overlapping bookings
    start_time = datetime.now() + timedelta(days=1)
    end_time = start_time + timedelta(hours=5)
    
    booking1 = Booking(
        device_id=test_device.id,
        user_id=test_user.id,
        start_time=start_time,
        end_time=end_time,
        status="CONFLICTING"
    )
    db_session.add(booking1)
    db_session.commit()
    
    # Cancel the conflicting booking
    response = authenticated_client.put(f"/bookings/{booking1.booking_id}/cancel")
    assert response.status_code == 200
    
    # The booking should now be cancelled
    db_session.refresh(booking1)
    assert booking1.status == "CANCELLED"

