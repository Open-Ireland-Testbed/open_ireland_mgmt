"""
Tests for device management endpoints (admin only)
"""
import pytest
from models import Device


def test_get_all_devices(authenticated_admin_client, test_device):
    """Test getting all devices (admin only)"""
    response = authenticated_admin_client.get("/admin/devices")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_get_devices_requires_admin(authenticated_client):
    """Test that non-admin users cannot access device list"""
    response = authenticated_client.get("/admin/devices")
    assert response.status_code == 403


def test_add_device(authenticated_admin_client):
    """Test adding a new device"""
    response = authenticated_admin_client.post(
        "/admin/devices",
        json={
            "deviceType": "Router",
            "deviceName": "NewRouter",
            "ip_address": "192.168.1.100",
            "status": "Available",
            "Out_Port": 10,
            "In_Port": 20
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["deviceType"] == "Router"
    assert data["deviceName"] == "NewRouter"
    assert data["ip_address"] == "192.168.1.100"


def test_add_device_with_maintenance(authenticated_admin_client):
    """Test adding device with maintenance period"""
    from datetime import datetime, timedelta
    tomorrow = datetime.now() + timedelta(days=1)
    
    response = authenticated_admin_client.post(
        "/admin/devices",
        json={
            "deviceType": "Switch",
            "deviceName": "Switch1",
            "ip_address": "192.168.1.101",
            "status": "Maintenance",
            "maintenance_start": f"All Day/{tomorrow.date().strftime('%Y-%m-%d')}",
            "maintenance_end": f"All Day/{tomorrow.date().strftime('%Y-%m-%d')}",
            "Out_Port": 11,
            "In_Port": 21
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "Maintenance"
    assert data["maintenance_start"] is not None


def test_add_device_duplicate_ip(authenticated_admin_client, test_device):
    """Test adding device with duplicate IP address"""
    response = authenticated_admin_client.post(
        "/admin/devices",
        json={
            "deviceType": "DifferentType",
            "deviceName": "DifferentName",
            "ip_address": test_device.ip_address,  # Same IP
            "status": "Available",
            "Out_Port": 12,
            "In_Port": 22
        }
    )
    assert response.status_code == 400
    assert "ip" in response.json()["detail"].lower() or "address" in response.json()["detail"].lower()


def test_update_device(authenticated_admin_client, test_device):
    """Test updating device information"""
    response = authenticated_admin_client.put(
        f"/admin/devices/{test_device.id}",
        json={
            "deviceType": test_device.deviceType,
            "deviceName": test_device.deviceName,
            "ip_address": "192.168.1.200",
            "status": "Maintenance",
            "Out_Port": test_device.Out_Port,
            "In_Port": test_device.In_Port
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ip_address"] == "192.168.1.200"
    assert data["status"] == "Maintenance"


def test_update_device_nonexistent(authenticated_admin_client):
    """Test updating non-existent device"""
    response = authenticated_admin_client.put(
        "/admin/devices/99999",
        json={
            "deviceType": "Router",
            "deviceName": "Router1",
            "status": "Available",
            "Out_Port": 1,
            "In_Port": 2
        }
    )
    assert response.status_code == 404


def test_delete_device(authenticated_admin_client, test_device):
    """Test deleting a device"""
    response = authenticated_admin_client.delete(f"/admin/devices/{test_device.id}")
    assert response.status_code == 200
    assert "deleted" in response.json()["message"].lower()


def test_delete_device_nonexistent(authenticated_admin_client):
    """Test deleting non-existent device"""
    response = authenticated_admin_client.delete("/admin/devices/99999")
    assert response.status_code == 404


def test_delete_device_requires_admin(authenticated_client, test_device):
    """Test that non-admin users cannot delete devices"""
    response = authenticated_client.delete(f"/admin/devices/{test_device.id}")
    assert response.status_code == 403


def test_add_device_with_polatis_name(authenticated_admin_client):
    """Test adding device with Polatis name"""
    response = authenticated_admin_client.post(
        "/admin/devices",
        json={
            "polatis_name": "POLATIS_001",
            "deviceType": "Router",
            "deviceName": "RouterWithPolatis",
            "ip_address": "192.168.1.102",
            "status": "Available",
            "Out_Port": 13,
            "In_Port": 23
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["polatis_name"] == "POLATIS_001"


def test_add_device_duplicate_polatis_name(authenticated_admin_client, db_session):
    """Test adding device with duplicate Polatis name in same device group"""
    # Create first device
    device1 = Device(
        polatis_name="POLATIS_DUP",
        deviceType="Router",
        deviceName="Router1",
        status="Available",
        Out_Port=1,
        In_Port=2
    )
    db_session.add(device1)
    db_session.commit()
    
    # Try to add another with same Polatis name in same group
    response = authenticated_admin_client.post(
        "/admin/devices",
        json={
            "polatis_name": "POLATIS_DUP",
            "deviceType": "Router",
            "deviceName": "Router1",
            "status": "Available",
            "Out_Port": 14,
            "In_Port": 24
        }
    )
    assert response.status_code == 400
    assert "polatis" in response.json()["detail"].lower()

