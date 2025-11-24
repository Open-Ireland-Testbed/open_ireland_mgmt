"""
Integration tests for complete workflows
"""
import pytest
from datetime import datetime, timedelta
from models import User, Device, Booking
from hash import hash_password
from unittest.mock import patch


@pytest.mark.integration
def test_complete_booking_workflow(authenticated_client, test_user, db_session):
    """Test complete booking lifecycle: create -> approve -> cancel"""
    # Create device
    device = Device(
        deviceType="Router",
        deviceName="Router1",
        status="Available",
        Out_Port=1,
        In_Port=2
    )
    db_session.add(device)
    db_session.commit()
    
    # Create booking
    start_time = datetime.now() + timedelta(days=1)
    end_time = start_time + timedelta(hours=5)
    
    with patch('main.send_booking_created_notification'):
        response = authenticated_client.post(
            "/bookings",
            json={
                "user_id": test_user.id,
                "message": "Integration test booking",
                "bookings": [{
                    "device_type": "Router",
                    "device_name": "Router1",
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "status": "PENDING"
                }]
            }
        )
    assert response.status_code == 200
    
    # Get bookings
    bookings_response = authenticated_client.get(f"/bookings/user/{test_user.id}")
    assert bookings_response.status_code == 200
    bookings = bookings_response.json()
    assert len(bookings) > 0
    booking_id = bookings[0]["booking_id"]
    assert bookings[0]["status"] == "PENDING"
    
    # Cancel booking
    cancel_response = authenticated_client.put(
        f"/bookings/{booking_id}/cancel",
        json={"user_id": test_user.id},
    )
    assert cancel_response.status_code == 200
    
    # Verify cancellation
    bookings_response = authenticated_client.get(f"/bookings/user/{test_user.id}")
    cancelled = [b for b in bookings_response.json() if b["booking_id"] == booking_id]
    assert cancelled[0]["status"] == "CANCELLED"


@pytest.mark.integration
def test_admin_device_management_workflow(authenticated_admin_client):
    """Test complete device management: add -> update -> delete"""
    # Add device
    add_response = authenticated_admin_client.post(
        "/admin/devices",
        json={
            "deviceType": "Switch",
            "deviceName": "Switch1",
            "ip_address": "192.168.1.50",
            "status": "Available",
            "Out_Port": 5,
            "In_Port": 6
        }
    )
    assert add_response.status_code == 201
    device_id = add_response.json()["id"]
    
    # Update device
    update_response = authenticated_admin_client.put(
        f"/admin/devices/{device_id}",
        json={
            "deviceType": "Switch",
            "deviceName": "Switch1",
            "ip_address": "192.168.1.51",
            "status": "Maintenance",
            "Out_Port": 5,
            "In_Port": 6
        }
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "Maintenance"
    
    # Delete device
    delete_response = authenticated_admin_client.delete(f"/admin/devices/{device_id}")
    assert delete_response.status_code == 200


@pytest.mark.integration
def test_user_registration_and_login_workflow(client, db_session):
    """Test complete user registration and login flow"""
    # Register
    register_response = client.post(
        "/users/register",
        json={
            "username": "newuser",
            "email": "newuser@test.com",
            "password": "password123",
            "password2": "password123",
            "discord_id": "123456789"
        }
    )
    assert register_response.status_code == 200
    user_id = register_response.json()["id"]
    
    # Check session is set
    session_response = client.get("/session")
    assert session_response.json()["logged_in"] is True
    assert session_response.json()["user_id"] == user_id
    
    # Logout
    logout_response = client.post("/logout")
    assert logout_response.status_code == 200
    
    # Verify session is cleared
    session_response = client.get("/session")
    assert session_response.json()["logged_in"] is False
    
    # Login again
    login_response = client.post(
        "/login",
        json={
            "username": "newuser",
            "password": "password123"
        }
    )
    assert login_response.status_code == 200


@pytest.mark.integration
def test_booking_conflict_detection_workflow(authenticated_client, test_user, db_session):
    """Test booking conflict detection and resolution"""
    # Create device
    device = Device(
        deviceType="Router",
        deviceName="Router1",
        status="Available",
        Out_Port=1,
        In_Port=2
    )
    db_session.add(device)
    db_session.commit()
    
    # Create first booking
    start_time = datetime.now() + timedelta(days=1)
    end_time = start_time + timedelta(hours=5)
    
    booking1 = Booking(
        device_id=device.id,
        user_id=test_user.id,
        start_time=start_time,
        end_time=end_time,
        status="CONFIRMED"
    )
    db_session.add(booking1)
    db_session.commit()
    
    # Check for conflicts
    conflict_response = authenticated_client.post(
        "/check-conflicts",
        json={
            "device_ids": [device.id],
            "start": (start_time + timedelta(hours=1)).isoformat(),
            "end": (start_time + timedelta(hours=3)).isoformat()
        }
    )
    assert conflict_response.status_code == 200
    conflicts = conflict_response.json()
    assert len(conflicts) > 0
    assert len(conflicts[0]["conflicts"]) > 0

