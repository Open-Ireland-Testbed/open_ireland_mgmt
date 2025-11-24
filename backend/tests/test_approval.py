"""
Tests for booking approval/rejection endpoints
"""
import pytest
from datetime import datetime, timedelta
from models import Booking
from unittest.mock import patch


def test_get_pending_bookings(authenticated_admin_client, test_user, test_device, db_session):
    """Test getting all pending bookings"""
    # Create pending booking
    start_time = datetime.now() + timedelta(days=1)
    booking = Booking(
        device_id=test_device.id,
        user_id=test_user.id,
        start_time=start_time,
        end_time=start_time + timedelta(hours=5),
        status="PENDING"
    )
    db_session.add(booking)
    db_session.commit()
    
    response = authenticated_admin_client.get("/admin/bookings/pending")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert any(b["booking_id"] == booking.booking_id for b in data)


def test_get_all_bookings(authenticated_admin_client, test_booking):
    """Test getting all bookings"""
    response = authenticated_admin_client.get("/admin/bookings/all")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert any(b["booking_id"] == test_booking.booking_id for b in data)


def test_approve_booking(authenticated_admin_client, test_booking):
    """Test approving a pending booking"""
    test_booking.status = "PENDING"
    
    with patch('admin.send_admin_action_notification'):
        response = authenticated_admin_client.put(
            f"/admin/bookings/{test_booking.booking_id}",
            json={"status": "CONFIRMED"}
        )
    
    assert response.status_code == 200
    assert "updated" in response.json()["message"].lower()


def test_reject_booking(authenticated_admin_client, test_booking):
    """Test rejecting a pending booking"""
    test_booking.status = "PENDING"
    
    with patch('admin.send_admin_action_notification'):
        response = authenticated_admin_client.put(
            f"/admin/bookings/{test_booking.booking_id}",
            json={"status": "REJECTED"}
        )
    
    assert response.status_code == 200
    assert "updated" in response.json()["message"].lower()


def test_approve_booking_invalid_status(authenticated_admin_client, test_booking):
    """Test approving with invalid status"""
    response = authenticated_admin_client.put(
        f"/admin/bookings/{test_booking.booking_id}",
        json={"status": "INVALID_STATUS"}
    )
    assert response.status_code == 400


def test_approve_booking_nonexistent(authenticated_admin_client):
    """Test approving non-existent booking"""
    response = authenticated_admin_client.put(
        "/admin/bookings/99999",
        json={"status": "CONFIRMED"}
    )
    assert response.status_code == 404


def test_approve_booking_requires_admin(authenticated_client, test_booking):
    """Test that non-admin users cannot approve bookings"""
    response = authenticated_client.put(
        f"/admin/bookings/{test_booking.booking_id}",
        json={"status": "CONFIRMED"}
    )
    assert response.status_code == 403


def test_get_conflicting_bookings(authenticated_admin_client, test_user, test_device, db_session):
    """Test getting conflicting bookings"""
    # Create two conflicting bookings
    start_time = datetime.now() + timedelta(days=1)
    end_time = start_time + timedelta(hours=5)
    
    booking1 = Booking(
        device_id=test_device.id,
        user_id=test_user.id,
        start_time=start_time,
        end_time=end_time,
        status="CONFLICTING"
    )
    booking2 = Booking(
        device_id=test_device.id,
        user_id=test_user.id,
        start_time=start_time + timedelta(hours=1),
        end_time=end_time + timedelta(hours=1),
        status="CONFLICTING"
    )
    db_session.add_all([booking1, booking2])
    db_session.commit()
    
    response = authenticated_admin_client.get("/admin/bookings/pending")
    assert response.status_code == 200
    data = response.json()
    # Should include conflicting bookings
    conflicting = [b for b in data if b["status"] == "CONFLICTING"]
    assert len(conflicting) >= 2


def test_approve_conflicting_booking(authenticated_admin_client, test_user, test_device, db_session):
    """Test that admin can approve conflicting bookings"""
    start_time = datetime.now() + timedelta(days=1)
    conflicting_booking = Booking(
        device_id=test_device.id,
        user_id=test_user.id,
        start_time=start_time,
        end_time=start_time + timedelta(hours=5),
        status="CONFLICTING"
    )
    db_session.add(conflicting_booking)
    db_session.commit()
    
    with patch('admin.send_admin_action_notification'):
        response = authenticated_admin_client.put(
            f"/admin/bookings/{conflicting_booking.booking_id}",
            json={"status": "CONFIRMED"}
        )
    
    assert response.status_code == 200
    db_session.refresh(conflicting_booking)
    assert conflicting_booking.status == "CONFIRMED"

